import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { parseFetchArgs } from "../src/cli";
import { fetchAll, mergeEvents, queryRelay } from "../src/nostr";
import type { NostrEvent } from "../src/types";

let opts: ReturnType<typeof parseFetchArgs>;
try {
  opts = parseFetchArgs(process.argv.slice(2));
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const { pubkey, relays } = opts;
const resume = opts.since !== undefined;
const until = Math.floor(Date.now() / 1000);
const since = opts.since ?? until - 365 * 24 * 3600;
// --since のときは既存の posts.json に足す
let all: NostrEvent[] = resume && existsSync("data/posts.json") ? JSON.parse(readFileSync("data/posts.json", "utf8")).reverse() : [];

for (const url of relays) {
  try {
    let page = 0;
    const got = await fetchAll({
      pubkey, since, until, limit: 500, maxPages: 100, delayMs: 2000,
      sleep: (ms) => sleep(ms),
      query: async (f) => {
        const evs = await queryRelay(url, f, 20_000);
        console.log(`${url} page ${++page}: ${evs.length} events (until ${new Date(f.until! * 1000).toISOString()})`);
        return evs;
      },
    });
    console.log(`${url}: ${got.length} events`);
    all = mergeEvents(all, got);
  } catch (e) {
    console.warn(`${url} failed: ${(e as Error).message}`);
  }
}

await mkdir("data", { recursive: true });
await writeFile("data/posts.json", JSON.stringify([...all].reverse(), null, 2) + "\n");
console.log(`saved ${all.length} events to data/posts.json`);
