// All data lives in localStorage — no backend, no signup, no setup.
// Each roommate's browser shares nothing with others, so one person
// should be the "source of truth" device, OR everyone logs their own
// turns from their own phone (the turn list merges by timestamp on load).

export const ROOMMATES = [
  { id: "r1", name: "Ahmed",  emoji: "🧑", color: "#38bdf8" },
  { id: "r2", name: "Hassan", emoji: "👨", color: "#34d399" },
  { id: "r3", name: "Usman",  emoji: "🧔", color: "#a78bfa" },
  { id: "r4", name: "Bilal",  emoji: "👦", color: "#fbbf24" },
  { id: "r5", name: "Zain",   emoji: "🙋", color: "#f87171" },
];

export type Roommate = typeof ROOMMATES[number];

export interface Turn {
  id: string;
  roommateId: string;
  timestamp: number; // Date.now()
  date: string;      // "YYYY-MM-DD"
}

export interface DayData {
  date: string;
  attendance: Record<string, "present" | "away">; // roommateId → status
  missedCarry: Record<string, number>;             // roommateId → fractional missed turns
}

// ── helpers ────────────────────────────────────────────────────────────────

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function key(k: string) {
  return `aq_${k}`;
}

function load<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(k: string, val: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(k), JSON.stringify(val));
}

// ── current user ───────────────────────────────────────────────────────────

export function getSavedUser(): Roommate | null {
  const id = load<string | null>("user", null);
  return ROOMMATES.find((r) => r.id === id) ?? null;
}

export function saveUser(r: Roommate | null) {
  save("user", r?.id ?? null);
}

// ── turns ──────────────────────────────────────────────────────────────────

export function getAllTurns(): Turn[] {
  return load<Turn[]>("turns", []);
}

export function getTurnsForDate(date: string): Turn[] {
  return getAllTurns().filter((t) => t.date === date);
}

export function addTurn(roommateId: string): Turn {
  const turn: Turn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roommateId,
    timestamp: Date.now(),
    date: today(),
  };
  const all = getAllTurns();
  save("turns", [...all, turn]);
  return turn;
}

// ── day data (attendance + carry) ─────────────────────────────────────────

export function getDayData(date: string): DayData {
  return load<DayData>(`day_${date}`, {
    date,
    attendance: {},
    missedCarry: {},
  });
}

export function setAttendance(date: string, roommateId: string, status: "present" | "away") {
  const d = getDayData(date);
  d.attendance[roommateId] = status;
  save(`day_${date}`, d);
}

export function getAttendanceStatus(date: string, roommateId: string): "present" | "away" {
  return getDayData(date).attendance[roommateId] ?? "present";
}

// ── missed carry ───────────────────────────────────────────────────────────

export function getMissedCarry(date: string): Record<string, number> {
  return getDayData(date).missedCarry;
}

export function runMidnightCalc(date: string) {
  // Only run once per date
  const alreadyRan = load<boolean>(`midnight_${date}`, false);
  if (alreadyRan) return;

  const turns = getTurnsForDate(date);
  const day = getDayData(date);
  const presentIds = ROOMMATES
    .filter((r) => (day.attendance[r.id] ?? "present") === "present")
    .map((r) => r.id);

  if (presentIds.length === 0 || turns.length === 0) {
    save(`midnight_${date}`, true);
    return;
  }

  const fairShare = turns.length / presentIds.length;
  const newCarry: Record<string, number> = {};

  // Carry forward from yesterday
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate = yesterday.toISOString().slice(0, 10);
  const prevCarry = getMissedCarry(yDate);

  presentIds.forEach((id) => {
    const myTurns = turns.filter((t) => t.roommateId === id).length;
    const deficit = fairShare - myTurns;
    const carried = prevCarry[id] ?? 0;
    const total = deficit + carried;
    if (total > 0.05) newCarry[id] = Math.round(total * 10) / 10;
  });

  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tDate = tomorrow.toISOString().slice(0, 10);
  const tomorrowData = getDayData(tDate);
  tomorrowData.missedCarry = newCarry;
  save(`day_${tDate}`, tomorrowData);
  save(`midnight_${date}`, true);
}

// ── fairness scores ────────────────────────────────────────────────────────

export interface Score {
  roommate: Roommate;
  turns: number;
  pending: number;
  priority: number; // lower → should go next
  isPresent: boolean;
}

export function getScores(date: string): Score[] {
  const turns = getTurnsForDate(date);
  const carry = getMissedCarry(date);
  const day = getDayData(date);

  return ROOMMATES.map((r) => {
    const myTurns = turns.filter((t) => t.roommateId === r.id).length;
    const pending = carry[r.id] ?? 0;
    const isPresent = (day.attendance[r.id] ?? "present") === "present";
    // Lower priority score = should go next.
    // Pending duties push priority down (= higher urgency).
    const priority = isPresent ? myTurns - pending * 2 : Infinity;
    return { roommate: r, turns: myTurns, pending, priority, isPresent };
  });
}

export function getSuggestedNext(scores: Score[]): Score | null {
  const present = scores.filter((s) => s.isPresent);
  if (!present.length) return null;
  return present.reduce((a, b) => (b.priority < a.priority ? b : a));
}
