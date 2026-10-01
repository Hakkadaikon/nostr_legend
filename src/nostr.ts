import { nip19 } from "nostr-tools";
import type { NostrEvent } from "./types";

export type Filter = { authors: string[]; kinds: number[]; since: number; until?: number; limit: number };

export function npubToHex(npub: string): string {
  const d = nip19.decode(npub);
  if (d.type !== "npub") throw new Error(`not npub: ${npub}`);
  return d.data;
}

export function buildFilter(o: { pubkey: string; since: number; until?: number; limit: number }): Filter {
  return {
    authors: [o.pubkey], kinds: [1], since: o.since,
    ...(o.until === undefined ? {} : { until: o.until }), limit: o.limit,
  };
}

export function mergeEvents(a: NostrEvent[], b: NostrEvent[]): NostrEvent[] {
  return [...new Map([...a, ...b].map((e) => [e.id, e])).values()].sort((x, y) => y.created_at - x.created_at);
}

export function nextUntil(events: NostrEvent[]): number | null {
  return events.length ? Math.min(...events.map((e) => e.created_at)) : null;
}

export async function fetchAll(o: {
  query: (f: Filter) => Promise<NostrEvent[]>;
  pubkey: string; since: number; until: number; limit: number; maxPages: number;
  sleep: (ms: number) => Promise<void>; delayMs: number;
}): Promise<NostrEvent[]> {
  let all: NostrEvent[] = [];
  let until = o.until;
  for (let page = 0; page < o.maxPages; page++) {
    if (page > 0) await o.sleep(o.delayMs);
    const got = await o.query(buildFilter({ pubkey: o.pubkey, since: o.since, until, limit: o.limit }));
    const seen = new Set(all.map((e) => e.id));
    const fresh = got.filter((e) => !seen.has(e.id));
    all = mergeEvents(all, fresh.filter((e) => e.created_at >= o.since));
    const oldest = nextUntil(got);
    if (!fresh.length || oldest === null || oldest < o.since) break;
    until = oldest; // inclusive: same-second events on the boundary are re-fetched, dedup by id
  }
  return all;
}

export function queryRelay(url: string, filter: Filter, timeoutMs: number): Promise<NostrEvent[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const sub = "s" + Math.random().toString(36).slice(2);
    const events: NostrEvent[] = [];
    const done = () => {
      clearTimeout(timer);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(["CLOSE", sub]));
        ws.close();
      }
      resolve(events);
    };
    const timer = setTimeout(done, timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify(["REQ", sub, filter]));
    ws.onmessage = (m) => {
      const [type, id, ev] = JSON.parse(String(m.data));
      if (id !== sub) return;
      if (type === "EVENT" && ev.kind === 1 && filter.authors.includes(ev.pubkey)) events.push(ev);
      else if (type === "EOSE" || type === "CLOSED") done();
    };
    ws.onerror = () => {
      clearTimeout(timer);
      if (events.length) resolve(events);
      else reject(new Error(`relay error: ${url}`));
    };
  });
}
