import { parseArgs } from "node:util";
import { npubToHex } from "./nostr";

export const DEFAULT_RELAYS = ["wss://yabu.me", "wss://relay.ditto.pub"];

export function parseFetchArgs(args: string[]) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { relay: { type: "string", multiple: true }, since: { type: "string" } } });
  if (!positionals[0]) throw new Error("usage: pnpm run fetch:posts <npub> [--relay wss://... ...] [--since YYYY-MM-DD]");
  const relays = values.relay ?? DEFAULT_RELAYS;
  const bad = relays.find((r) => !r.startsWith("wss://"));
  if (bad) throw new Error(`relay must start with wss://: ${bad}`);
  if (values.since && !/^\d{4}-\d{2}-\d{2}$/.test(values.since)) throw new Error(`since must be YYYY-MM-DD: ${values.since}`);
  // 日付は JST の 0 時として扱う
  const since = values.since ? Math.floor(Date.parse(`${values.since}T00:00:00+09:00`) / 1000) : undefined;
  if (since !== undefined && Number.isNaN(since)) throw new Error(`invalid date: ${values.since}`);
  return { pubkey: npubToHex(positionals[0]), relays, since };
}

export function parseMergeArgs(args: string[]) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { name: { type: "string" }, title: { type: "string" } } });
  if (!values.name) throw new Error("usage: pnpm merge --name <名前> [--title <タイトル>] [入力ディレクトリ]");
  return { name: values.name, title: values.title ?? `伝説の男・${values.name}の年表`, dir: positionals[0] ?? "tasks/summary/output" };
}
