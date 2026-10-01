export type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

export type Day = { date: string; events: string[] };
export type Timeline = { title: string; days: Day[] };
