import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseMergeArgs } from "../src/cli";
import { mergeTimelines, toToml } from "../src/timeline";

let opts: ReturnType<typeof parseMergeArgs>;
try {
  opts = parseMergeArgs(process.argv.slice(2));
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const { name, title, dir } = opts;
const texts = readdirSync(dir).filter((f) => f.endsWith(".toml")).map((f) => readFileSync(`${dir}/${f}`, "utf8"));
const timeline = mergeTimelines(title, texts, name);
writeFileSync("data/timeline.toml", toToml(timeline));
console.log(`${timeline.days.length} days, ${timeline.days.reduce((n, d) => n + d.events.length, 0)} events`);
