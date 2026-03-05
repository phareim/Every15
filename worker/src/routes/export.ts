import { Hono } from "hono";
import type { Env, DayEntries } from "../types";

type Variables = { userId: string };

const exportRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

exportRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const format = c.req.query("format") ?? "csv";

  if (!from || !to) {
    return c.json({ error: "from and to query params required" }, 400);
  }

  if (format !== "csv") {
    return c.json({ error: "Only CSV format is supported" }, 400);
  }

  const rows: string[] = ["date,time,text,tags"];
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
      for (const entry of data.entries) {
        const escapedText = `"${entry.text.replace(/"/g, '""')}"`;
        const tags = entry.tags.join(";");
        rows.push(`${dateStr},${entry.time},${escapedText},${tags}`);
      }
    }
  }

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="every15-${from}-to-${to}.csv"`,
    },
  });
});

export default exportRoute;
