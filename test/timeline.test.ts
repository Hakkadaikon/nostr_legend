import { describe, expect, it } from "vitest";
import { groupByDay, mergeTimelines, parseTimeline, toJstDate, toToml } from "../src/timeline";
import type { NostrEvent } from "../src/types";

const ev = (iso: string, content: string): NostrEvent => ({
  id: content, pubkey: "p", kind: 1, tags: [], sig: "s", content,
  created_at: Date.parse(iso) / 1000,
});

describe("toJstDate", () => {
  it("UTC 14:59:59 は同日", () => expect(toJstDate(Date.parse("2025-10-03T14:59:59Z") / 1000)).toBe("2025-10-03"));
  it("UTC 15:00:00 は翌日", () => expect(toJstDate(Date.parse("2025-10-03T15:00:00Z") / 1000)).toBe("2025-10-04"));
  it("年跨ぎ", () => expect(toJstDate(Date.parse("2025-12-31T15:00:00Z") / 1000)).toBe("2026-01-01"));
});

describe("groupByDay", () => {
  it("空配列は空", () => expect(groupByDay([])).toEqual([]));
  it("JST 日付でまとめ、日付昇順・日内時刻昇順", () => {
    const r = groupByDay([
      ev("2025-10-04T01:00:00Z", "c"),
      ev("2025-10-03T15:30:00Z", "b"),
      ev("2025-10-03T00:05:00Z", "a"),
    ]);
    expect(r).toEqual([
      { date: "2025-10-03", posts: [{ time: "09:05", content: "a" }] },
      { date: "2025-10-04", posts: [{ time: "00:30", content: "b" }, { time: "10:00", content: "c" }] },
    ]);
  });
});

const sample = `title = "T"
[[days]]
date = "2026-01-01"
events = ["x"]
[[days]]
date = "2025-10-03"
events = ["a", "b"]
`;

describe("parseTimeline", () => {
  it("正常系: days を日付昇順に並べる", () =>
    expect(parseTimeline(sample)).toEqual({
      title: "T",
      days: [{ date: "2025-10-03", events: ["a", "b"] }, { date: "2026-01-01", events: ["x"] }],
    }));
  it("days 省略は空配列", () => expect(parseTimeline(`title = "T"`)).toEqual({ title: "T", days: [] }));
  it.each([
    ["title 無し", `[[days]]\ndate = "2025-10-03"\nevents = ["a"]`],
    ["title が文字列でない", `title = 1`],
    ["days が配列でない", `title = "T"\ndays = 1`],
    ["date 形式不正", `title = "T"\n[[days]]\ndate = "2025/10/03"\nevents = ["a"]`],
    ["events 空", `title = "T"\n[[days]]\ndate = "2025-10-03"\nevents = []`],
    ["events に非文字列", `title = "T"\n[[days]]\ndate = "2025-10-03"\nevents = [1]`],
    ["events に空文字列", `title = "T"\n[[days]]\ndate = "2025-10-03"\nevents = [""]`],
    ["TOML 構文エラー", `title = `],
  ])("%s は throw", (_, t) => expect(() => parseTimeline(t)).toThrow(Error));
});

describe("mergeTimelines", () => {
  it("同日 events を連結し昇順", () => {
    const a = `title = "A"\n[[days]]\ndate = "2025-11-01"\nevents = ["n"]\n[[days]]\ndate = "2025-10-03"\nevents = ["a"]`;
    const b = `title = "B"\n[[days]]\ndate = "2025-10-03"\nevents = ["b"]`;
    expect(mergeTimelines("M", [a, b])).toEqual({
      title: "M",
      days: [{ date: "2025-10-03", events: ["a", "b"] }, { date: "2025-11-01", events: ["n"] }],
    });
  });
  it("入力無しは空", () => expect(mergeTimelines("M", [])).toEqual({ title: "M", days: [] }));
});

describe("toToml", () => {
  it("parseTimeline と往復一致", () => {
    const t = parseTimeline(sample);
    expect(parseTimeline(toToml(t))).toEqual(t);
  });
});
