import { describe, expect, it, vi } from "vitest";
import { buildFilter, fetchAll, mergeEvents, nextUntil, npubToHex, type Filter } from "../src/nostr";
import type { NostrEvent } from "../src/types";

const ev = (id: string, created_at: number): NostrEvent => ({
  id, pubkey: "pk", created_at, kind: 1, tags: [], content: "", sig: "",
});

describe("npubToHex", () => {
  it("decodes NIP-19 vector", () => {
    expect(npubToHex("npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg"))
      .toBe("7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e");
  });
  it("throws on invalid", () => {
    expect(() => npubToHex("nsec1xxx")).toThrow();
  });
});

describe("buildFilter", () => {
  it("omits until when absent", () => {
    expect(buildFilter({ pubkey: "pk", since: 1, limit: 5 }))
      .toEqual({ authors: ["pk"], kinds: [1], since: 1, limit: 5 });
  });
  it("includes until", () => {
    expect(buildFilter({ pubkey: "pk", since: 1, until: 9, limit: 5 }))
      .toEqual({ authors: ["pk"], kinds: [1], since: 1, until: 9, limit: 5 });
  });
});

describe("mergeEvents", () => {
  it("dedupes by id and sorts created_at desc", () => {
    expect(mergeEvents([ev("a", 1), ev("b", 3)], [ev("a", 1), ev("c", 2)]).map((e) => e.id))
      .toEqual(["b", "c", "a"]);
  });
});

describe("nextUntil", () => {
  it("null for empty", () => expect(nextUntil([])).toBeNull());
  it("oldest created_at", () => expect(nextUntil([ev("a", 5), ev("b", 2), ev("c", 7)])).toBe(2));
});

describe("fetchAll", () => {
  const base = { pubkey: "pk", since: 10, until: 100, limit: 2, maxPages: 10, delayMs: 7 };

  it("pages with inclusive until and stops when no new ids", async () => {
    const pages = [[ev("a", 90), ev("b", 50)], [ev("b", 50), ev("c", 40)], [ev("c", 40)]];
    const query = vi.fn(async (_f: Filter) => pages.shift() ?? []);
    const sleep = vi.fn(async () => {});
    const got = await fetchAll({ ...base, query, sleep });
    expect(got.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(query.mock.calls.map((c) => c[0].until)).toEqual([100, 50, 40]);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(7);
  });

  it("stops when reaching below since and excludes those events", async () => {
    const query = vi.fn(async () => [ev("a", 20), ev("old", 5)]);
    const got = await fetchAll({ ...base, query, sleep: async () => {} });
    expect(got.map((e) => e.id)).toEqual(["a"]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("stops at maxPages", async () => {
    let t = 100;
    const query = vi.fn(async () => [ev(String(t), --t)]);
    await fetchAll({ ...base, maxPages: 3, query, sleep: async () => {} });
    expect(query).toHaveBeenCalledTimes(3);
  });
});
