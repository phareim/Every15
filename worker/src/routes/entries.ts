import { Hono } from "hono";
import type { Env, DayEntries } from "../types";

type Variables = { userId: string };

const entries = new Hono<{ Bindings: Env; Variables: Variables }>();

entries.get("/", async (c) => {
  const userId = c.get("userId");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!from || !to) {
    return c.json({ error: "from and to query params required" }, 400);
  }

  // List all entry files in the date range
  const results: DayEntries[] = [];
  const startDate = new Date(from);
  const endDate = new Date(to);

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().split("T")[0];
    const key = `${userId}/entries/${dateStr}.json`;
    const obj = await c.env.BUCKET.get(key);
    if (obj) {
      const data = (await obj.json()) as DayEntries;
      results.push(data);
    }
  }

  return c.json(results);
});

entries.put("/:date", async (c) => {
  const userId = c.get("userId");
  const date = c.req.param("date");

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
  }

  const body = await c.req.json<DayEntries>();
  const key = `${userId}/entries/${date}.json`;

  // Merge with existing if present
  const existing = await c.env.BUCKET.get(key);
  let merged: DayEntries;

  if (existing) {
    const existingData = (await existing.json()) as DayEntries;
    // Merge by entry ID — incoming entries overwrite existing ones with same ID
    const entryMap = new Map(
      existingData.entries.map((e) => [e.id, e]),
    );
    for (const entry of body.entries) {
      entryMap.set(entry.id, entry);
    }
    merged = {
      date,
      entries: Array.from(entryMap.values()).sort((a, b) =>
        a.time.localeCompare(b.time),
      ),
    };
  } else {
    merged = { date, entries: body.entries };
  }

  await c.env.BUCKET.put(key, JSON.stringify(merged));
  return c.json(merged);
});

export default entries;
