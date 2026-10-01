import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { groupByDay } from "../src/timeline";
import type { NostrEvent } from "../src/types";

const outDir = process.argv[2] ?? "tasks/summary/input";
const events: NostrEvent[] = JSON.parse(readFileSync("data/posts.json", "utf8"));
const months = new Map<string, string[]>();
for (const { date, posts } of groupByDay(events)) {
  const lines = [`## ${date}`, ...posts.map((p) => `- ${p.time} ${p.content.replace(/\s*\n\s*/g, " ")}`)];
  months.set(date.slice(0, 7), [...(months.get(date.slice(0, 7)) ?? []), lines.join("\n")]);
}
mkdirSync(outDir, { recursive: true });
for (const [month, blocks] of months) writeFileSync(`${outDir}/${month}.txt`, blocks.join("\n\n") + "\n");
console.log(`${events.length} events -> ${months.size} files in ${outDir}`);
