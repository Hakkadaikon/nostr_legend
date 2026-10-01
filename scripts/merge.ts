import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mergeTimelines, toToml } from "../src/timeline";

const dir = process.argv[2] ?? "tasks/summary/output";
const texts = readdirSync(dir).filter((f) => f.endsWith(".toml")).map((f) => readFileSync(`${dir}/${f}`, "utf8"));
const timeline = mergeTimelines("伝説の男・LEGENDの年表", texts);
writeFileSync("data/timeline.toml", toToml(timeline));
console.log(`${timeline.days.length} days, ${timeline.days.reduce((n, d) => n + d.events.length, 0)} events`);
