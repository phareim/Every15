import * as jose from "jose";
import type { Env, User } from "../types";

const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";

let cachedKeys: jose.JSONWebKeySet | null = null;
let keysLastFetched = 0;
const KEYS_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function getApplePublicKeys(): Promise<jose.JSONWebKeySet> {
  const now = Date.now();
  if (cachedKeys && now - keysLastFetched < KEYS_CACHE_MS) {
    return cachedKeys;
  }
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new Error("Failed to fetch Apple public keys");
  cachedKeys = (await res.json()) as jose.JSONWebKeySet;
  keysLastFetched = now;
  return cachedKeys;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<{ appleUserId: string; email: string | null }> {
  const jwks = jose.createRemoteJWKSet(new URL(APPLE_KEYS_URL));

  const { payload } = await jose.jwtVerify(identityToken, jwks, {
    issuer: "https://appleid.apple.com",
  });

  // Verify audience matches our bundle ID
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes("no.phareim.every15")) {
    throw new Error(`unexpected audience: ${aud.join(", ")}`);
  }

  return {
    appleUserId: payload.sub!,
    email: (payload.email as string) ?? null,
  };
}

export async function findOrCreateUser(
  db: D1Database,
  appleUserId: string,
  email: string | null,
): Promise<User> {
  const existing = await db
    .prepare("SELECT * FROM users WHERE apple_user_id = ?")
    .bind(appleUserId)
    .first<User>();

  if (existing) {
    if (email && !existing.email) {
      await db
        .prepare("UPDATE users SET email = ? WHERE id = ?")
        .bind(email, existing.id)
        .run();
      existing.email = email;
    }
    return existing;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO users (id, apple_user_id, email) VALUES (?, ?, ?)",
    )
    .bind(id, appleUserId, email)
    .run();

  return {
    id,
    apple_user_id: appleUserId,
    email,
    created_at: new Date().toISOString(),
    subscription_status: "trial",
    subscription_expires_at: null,
  };
}

export async function issueJWT(
  userId: string,
  secret: string,
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<{ sub: string }> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, secretKey);
  return { sub: payload.sub as string };
}
