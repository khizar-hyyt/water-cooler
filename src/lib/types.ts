export interface Roommate {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface Turn {
  id: string;
  roommateId: string;
  timestamp: number;
  date: string;
}

export interface ActivityEntry {
  id: string;
  date: string;
  timestamp: number;
  kind: "admin_reset" | "admin_turns" | "admin_recalc" | "admin_balance";
  message: string;
}

export type TimelineItem =
  | { type: "turn"; id: string; timestamp: number; roommateId: string }
  | { type: "activity"; id: string; timestamp: number; message: string; kind: ActivityEntry["kind"] };

export interface DayData {
  date: string;
  attendance: Record<string, "present" | "away">;
  missedCarry: Record<string, number>;
}

export interface AppState {
  roommates: Roommate[];
  turns: Turn[];
  days: Record<string, DayData>;
  midnightRan: string[];
  activities?: ActivityEntry[];
  /** Incremented on every server save; used to avoid stale polls overwriting fresh mutations. */
  revision?: number;
}

export const DEFAULT_ROOMMATES: Roommate[] = [
  { id: "r1", name: "Ahmed", emoji: "🧑", color: "#38bdf8" },
  { id: "r2", name: "Hassan", emoji: "👨", color: "#34d399" },
  { id: "r3", name: "Usman", emoji: "🧔", color: "#a78bfa" },
  { id: "r4", name: "Bilal", emoji: "👦", color: "#fbbf24" },
  { id: "r5", name: "Zain", emoji: "🙋", color: "#f87171" },
];

export const EMOJI_OPTIONS = ["🧑", "👨", "🧔", "👦", "🙋", "👩", "😎", "🙂", "💧", "⭐"];
export const COLOR_OPTIONS = [
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#f87171",
  "#fb923c",
  "#e879f9",
  "#94a3b8",
];

export function createDefaultState(): AppState {
  return {
    roommates: [...DEFAULT_ROOMMATES],
    turns: [],
    days: {},
    midnightRan: [],
    activities: [],
    revision: 0,
  };
}

export function normalizeState(raw: Partial<AppState> | null | undefined): AppState {
  const base = createDefaultState();
  if (!raw) return base;
  return {
    roommates: raw.roommates?.length ? raw.roommates : base.roommates,
    turns: raw.turns ?? [],
    days: raw.days ?? {},
    midnightRan: raw.midnightRan ?? [],
    activities: raw.activities ?? [],
    revision: raw.revision ?? 0,
  };
}
