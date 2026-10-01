import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fetchAll, mergeEvents, npubToHex, queryRelay } from "../src/nostr";
import type { NostrEvent } from "../src/types";

const NPUB = "npub1xxxxxxxx";
const RELAYS = ["wss://yabu.me", "wss://relay.ditto.pub"];

const pubkey = npubToHex(NPUB);
const until = Math.floor(Date.now() / 1000);
const since = until - 365 * 24 * 3600;
let all: NostrEvent[] = [];

for (const url of RELAYS) {
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
