export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
}

export interface User {
  id: string;
  apple_user_id: string;
  email: string | null;
  created_at: string;
  subscription_status: "trial" | "active" | "expired";
  subscription_expires_at: string | null;
}

export interface Entry {
  id: string;
  time: string;
  text: string;
  tags: string[];
}

export interface DayEntries {
  date: string;
  entries: Entry[];
}

export interface UserSettings {
  schedule: Record<
    string,
    { start: string; end: string } | undefined
  >;
  pauseUntil: string | null;
  timezone: string;
  intervalMinutes: number;
}

export interface Summary {
  period: string;
  breakdown: Record<string, number>;
  summary: string;
  generatedAt: string;
}

export interface JWTPayload {
  sub: string; // user id
  iat: number;
  exp: number;
}
