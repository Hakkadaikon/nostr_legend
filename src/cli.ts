import { parseArgs } from "node:util";
import { npubToHex } from "./nostr";

export const DEFAULT_RELAYS = ["wss://yabu.me", "wss://relay.ditto.pub"];

export function parseFetchArgs(args: string[]) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { relay: { type: "string", multiple: true } } });
  if (!positionals[0]) throw new Error("usage: pnpm run fetch:posts <npub> [--relay wss://... ...]");
  const relays = values.relay ?? DEFAULT_RELAYS;
  const bad = relays.find((r) => !r.startsWith("wss://"));
  if (bad) throw new Error(`relay must start with wss://: ${bad}`);
  return { pubkey: npubToHex(positionals[0]), relays };
}

export function parseMergeArgs(args: string[]) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { name: { type: "string" }, title: { type: "string" } } });
  if (!values.name) throw new Error("usage: pnpm merge --name <名前> [--title <タイトル>] [入力ディレクトリ]");
  return { name: values.name, title: values.title ?? `伝説の男・${values.name}の年表`, dir: positionals[0] ?? "tasks/summary/output" };
}
