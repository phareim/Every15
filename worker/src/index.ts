import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { verifyAppleIdentityToken, findOrCreateUser, issueJWT, verifyJWT } from "./auth/apple";
import entries from "./routes/entries";
import settings from "./routes/settings";
import summary from "./routes/summary";
import exportRoute from "./routes/export";

type Variables = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", cors());

// Auth endpoint — no JWT required
app.post("/auth/apple", async (c) => {
  const { identityToken } = await c.req.json<{ identityToken: string }>();

  if (!identityToken) {
    return c.json({ error: "identityToken required" }, 400);
  }

  try {
    const { appleUserId, email } = await verifyAppleIdentityToken(identityToken);
    const user = await findOrCreateUser(c.env.DB, appleUserId, email);
    const token = await issueJWT(user.id, c.env.JWT_SECRET);

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        subscriptionStatus: user.subscription_status,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Auth error:", message);
    return c.json({ error: "Authentication failed", detail: message }, 401);
  }
});

// JWT auth middleware for all other routes
app.use("*", async (c, next) => {
  if (c.req.path === "/auth/apple" || c.req.path === "/") return next();

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const { sub } = await verifyJWT(token, c.env.JWT_SECRET);
    c.set("userId", sub);
    return next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Mount routes
app.route("/entries", entries);
app.route("/settings", settings);
app.route("/summary", summary);
app.route("/export", exportRoute);

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "every15" }));

export default app;
