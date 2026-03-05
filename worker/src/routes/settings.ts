import { Hono } from "hono";
import type { Env, UserSettings } from "../types";

type Variables = { userId: string };

const settings = new Hono<{ Bindings: Env; Variables: Variables }>();

const DEFAULT_SETTINGS: UserSettings = {
  schedule: {
    monday: { start: "09:00", end: "17:00" },
    tuesday: { start: "09:00", end: "17:00" },
    wednesday: { start: "09:00", end: "17:00" },
    thursday: { start: "09:00", end: "17:00" },
    friday: { start: "09:00", end: "17:00" },
  },
  pauseUntil: null,
  timezone: "Europe/Oslo",
  intervalMinutes: 15,
};

settings.get("/", async (c) => {
  const userId = c.get("userId");
  const key = `${userId}/settings.json`;
  const obj = await c.env.BUCKET.get(key);

  if (!obj) {
    return c.json(DEFAULT_SETTINGS);
  }

  return c.json(await obj.json());
});

settings.put("/", async (c) => {
  const userId = c.get("userId");
  const key = `${userId}/settings.json`;
  const body = await c.req.json<UserSettings>();

  await c.env.BUCKET.put(key, JSON.stringify(body));
  return c.json(body);
});

export default settings;
