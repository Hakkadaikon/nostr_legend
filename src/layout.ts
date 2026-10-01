import type { Day } from "./types";

export const RADIUS = 12;
const TURNS_PER_YEAR = 6;
const HEIGHT = 40;

export function helixPosition(index: number, total: number) {
  const t = total > 1 ? index / (total - 1) : 0;
  const a = t * TURNS_PER_YEAR * Math.PI * 2;
  return { x: Math.cos(a) * RADIUS, y: (t - 0.5) * HEIGHT, z: Math.sin(a) * RADIUS };
}

export const monthKey = (date: string) => date.slice(0, 7);

export function monthGroups(days: Day[]) {
  const out: { month: string; startIndex: number; count: number }[] = [];
  days.forEach((d, i) => {
    const m = monthKey(d.date);
    const last = out.at(-1);
    if (last?.month === m) last.count++;
    else out.push({ month: m, startIndex: i, count: 1 });
  });
  return out;
}

export function matchDay(day: Day, query: string) {
  const q = query.trim().toLowerCase();
  return !q || day.events.some((e) => e.toLowerCase().includes(q));
}

export const stepIndex = (cur: number, delta: number, total: number) =>
  cur < 0 ? 0 : (((cur + delta) % total) + total) % total;

export const nodeSize = (count: number) => 0.25 + Math.min(count, 10) * 0.08;
