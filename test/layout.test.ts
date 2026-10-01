import { describe, expect, it } from "vitest";
import { helixPosition, matchDay, monthGroups, monthKey, nodeSize, stepIndex } from "../src/layout";

const day = (date: string, events: string[] = ["x"]) => ({ date, events });

describe("helixPosition", () => {
  it("keeps a constant radius", () => {
    const rs = [0, 1, 50, 99].map((i) => {
      const p = helixPosition(i, 100);
      return Math.hypot(p.x, p.z);
    });
    for (const r of rs) expect(r).toBeCloseTo(rs[0]);
  });
  it("increases y monotonically with index", () => {
    let prev = -Infinity;
    for (let i = 0; i < 365; i++) {
      const { y } = helixPosition(i, 365);
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
  });
  it("handles a single node without NaN", () => {
    const p = helixPosition(0, 1);
    expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
  });
});

describe("monthKey", () => {
  it("returns YYYY-MM", () => expect(monthKey("2025-10-03")).toBe("2025-10"));
});

describe("monthGroups", () => {
  it("is empty for no days", () => expect(monthGroups([])).toEqual([]));
  it("groups consecutive days by month", () => {
    const days = [day("2025-10-03"), day("2025-10-20"), day("2025-11-15"), day("2026-01-01")];
    expect(monthGroups(days)).toEqual([
      { month: "2025-10", startIndex: 0, count: 2 },
      { month: "2025-11", startIndex: 2, count: 1 },
      { month: "2026-01", startIndex: 3, count: 1 },
    ]);
  });
});

describe("matchDay", () => {
  it("matches everything on blank query", () => expect(matchDay(day("2025-10-03"), "  ")).toBe(true));
  it("matches event text case-insensitively", () =>
    expect(matchDay(day("2025-10-03", ["Nostr の海"]), "nostr")).toBe(true));
  it("rejects when no event contains the query", () =>
    expect(matchDay(day("2025-10-03", ["パン"]), "おせち")).toBe(false));
});

describe("stepIndex", () => {
  it("moves within range", () => expect(stepIndex(1, 1, 3)).toBe(2));
  it("wraps forward and backward", () => {
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
  });
  it("starts at 0 from no selection", () => expect(stepIndex(-1, 1, 3)).toBe(0));
});

describe("nodeSize", () => {
  it("grows with event count and caps", () => {
    expect(nodeSize(2)).toBeGreaterThan(nodeSize(1));
    expect(nodeSize(100)).toBe(nodeSize(50));
  });
});
