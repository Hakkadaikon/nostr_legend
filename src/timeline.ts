import { parse, stringify } from "smol-toml";
import type { Day, NostrEvent, Timeline } from "./types";

// JST 固定 (UTC+9)。"YYYY-MM-DDTHH:MM" を返す
const jstIso = (unixSec: number) => new Date((unixSec + 9 * 3600) * 1000).toISOString().slice(0, 16);

export const toJstDate = (unixSec: number): string => jstIso(unixSec).slice(0, 10);

export type DayPosts = { date: string; posts: { time: string; content: string }[] };

export function groupByDay(events: NostrEvent[]): DayPosts[] {
  const days = new Map<string, DayPosts["posts"]>();
  for (const e of [...events].sort((a, b) => a.created_at - b.created_at)) {
    const iso = jstIso(e.created_at);
    const date = iso.slice(0, 10);
    if (!days.has(date)) days.set(date, []);
    days.get(date)!.push({ time: iso.slice(11), content: e.content });
  }
  return [...days].map(([date, posts]) => ({ date, posts }));
}

const byDate = (a: Day, b: Day) => a.date.localeCompare(b.date);

export function parseTimeline(tomlText: string): Timeline {
  const { title, days = [] } = parse(tomlText) as { title?: unknown; days?: unknown };
  if (typeof title !== "string") throw new Error("title must be a string");
  if (!Array.isArray(days)) throw new Error("days must be an array");
  for (const d of days) {
    if (typeof d?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error(`invalid date: ${d?.date}`);
    const ev = d.events;
    if (!Array.isArray(ev) || ev.length === 0 || !ev.every((s) => typeof s === "string" && s !== ""))
      throw new Error(`invalid events on ${d.date}`);
  }
  return { title, days: days.map((d: Day) => ({ date: d.date, events: d.events })).sort(byDate) };
}

export function mergeTimelines(title: string, tomlTexts: string[]): Timeline {
  const days = new Map<string, string[]>();
  for (const d of tomlTexts.flatMap((t) => parseTimeline(t).days)) days.set(d.date, [...(days.get(d.date) ?? []), ...d.events]);
  return { title, days: [...days].map(([date, events]) => ({ date, events })).sort(byDate) };
}

export const toToml = (timeline: Timeline): string => stringify(timeline);
