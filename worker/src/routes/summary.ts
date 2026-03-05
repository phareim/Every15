import { Hono } from "hono";
import type { Env, DayEntries, Summary } from "../types";

type Variables = { userId: string };

const summary = new Hono<{ Bindings: Env; Variables: Variables }>();

summary.post("/", async (c) => {
  const userId = c.get("userId");
  const { from, to } = await c.req.json<{ from: string; to: string }>();

  if (!from || !to) {
    return c.json({ error: "from and to fields required" }, 400);
  }

  // Gather all entries in range
  const allEntries: { date: string; time: string; text: string }[] = [];
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
        allEntries.push({ date: dateStr, time: entry.time, text: entry.text });
      }
    }
  }

  if (allEntries.length === 0) {
    return c.json({ error: "No entries found in date range" }, 404);
  }

  const entriesText = allEntries
    .map((e) => `${e.date} ${e.time}: ${e.text}`)
    .join("\n");

  const prompt = `You are a work-tracking assistant. Analyze these time log entries and provide:
1. A time breakdown by category (estimate hours per category based on 15-minute intervals)
2. A brief summary of accomplishments
3. One suggestion for focus areas

Entries:
${entriesText}

Respond in JSON format:
{
  "breakdown": { "category": hours_number },
  "summary": "text",
  "suggestion": "text"
}`;

  const aiResponse = (await c.env.AI.run(
    "@cf/meta/llama-3.1-70b-instruct" as Parameters<Ai["run"]>[0],
    {
      messages: [{ role: "user", content: prompt }],
    },
  )) as { response?: string };

  let parsed: { breakdown: Record<string, number>; summary: string; suggestion: string };
  try {
    const text = aiResponse.response ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
  } catch {
    parsed = {
      breakdown: {},
      summary: "Unable to parse AI response",
      suggestion: "",
    };
  }

  const result: Summary = {
    period: `${from} to ${to}`,
    breakdown: parsed.breakdown,
    summary: `${parsed.summary}${parsed.suggestion ? `\n\nFocus suggestion: ${parsed.suggestion}` : ""}`,
    generatedAt: new Date().toISOString(),
  };

  // Cache the summary
  const summaryKey = `${userId}/summaries/${from}_${to}.json`;
  await c.env.BUCKET.put(summaryKey, JSON.stringify(result));

  return c.json(result);
});

export default summary;
