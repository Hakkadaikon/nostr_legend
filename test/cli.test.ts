import { describe, expect, it } from "vitest";
import { DEFAULT_RELAYS, parseFetchArgs, parseMergeArgs } from "../src/cli";

const NPUB = "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg";
const HEX = "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";

describe("parseFetchArgs", () => {
  it("npub を hex にし、リレー省略時は既定値", () =>
    expect(parseFetchArgs([NPUB])).toEqual({ pubkey: HEX, relays: DEFAULT_RELAYS }));
  it("--relay を複数指定できる", () =>
    expect(parseFetchArgs([NPUB, "--relay", "wss://a.example", "--relay", "wss://b.example"]).relays)
      .toEqual(["wss://a.example", "wss://b.example"]));
  it("公開鍵が無ければ使い方を示して throw", () => expect(() => parseFetchArgs([])).toThrow(/usage/i));
  it("npub でなければ throw", () => expect(() => parseFetchArgs(["nsec1xxx"])).toThrow());
  it("wss:// 以外のリレーは throw", () => expect(() => parseFetchArgs([NPUB, "--relay", "http://x"])).toThrow(/wss/));
});

describe("parseMergeArgs", () => {
  it("--name からタイトルを作る", () =>
    expect(parseMergeArgs(["--name", "LEGEND"])).toEqual({ name: "LEGEND", title: "伝説の男・LEGENDの年表", dir: "tasks/summary/output" }));
  it("--title と入力ディレクトリを上書きできる", () =>
    expect(parseMergeArgs(["--name", "N", "--title", "T", "out"])).toEqual({ name: "N", title: "T", dir: "out" }));
  it("--name が無ければ throw", () => expect(() => parseMergeArgs([])).toThrow(/usage/i));
});
