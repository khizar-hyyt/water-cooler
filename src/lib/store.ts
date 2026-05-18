import type { ActivityEntry, AppState, DayData, Roommate, TimelineItem, Turn } from "./types";
import { calendarToday, resolveTimeZone } from "./timezone";

export type { AppState, DayData, Roommate, Turn } from "./types";
export { DEFAULT_ROOMMATES, EMOJI_OPTIONS, COLOR_OPTIONS, createDefaultState } from "./types";
export { calendarToday, resolveTimeZone, TZ_HEADER } from "./timezone";

/** YYYY-MM-DD from a Date in local JS timezone (used only for addDays math anchor). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar today in the household timezone (see NEXT_PUBLIC_AQUASHIFT_TZ or browser TZ). */
export function today(timeZone?: string): string {
  return calendarToday(timeZone ?? resolveTimeZone());
}

/** Add days to a YYYY-MM-DD string (local calendar). */
export function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return formatLocalDate(d);
}

function lsKey(k: string) {
  return `aq_${k}`;
}

export function getSavedUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lsKey("user"));
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

export function saveUserId(id: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(lsKey("user"), JSON.stringify(id));
}

export function getSavedUser(roommates: Roommate[]): Roommate | null {
  const id = getSavedUserId();
  return roommates.find((r) => r.id === id) ?? null;
}

export function getTurnsForDate(state: AppState, date: string): Turn[] {
  return state.turns.filter((t) => t.date === date);
}

export function getDayData(state: AppState, date: string): DayData {
  return (
    state.days[date] ?? {
      date,
      attendance: {},
      missedCarry: {},
    }
  );
}

export function setDayData(state: AppState, date: string, data: DayData): AppState {
  return {
    ...state,
    days: { ...state.days, [date]: data },
  };
}

export function addTurnToState(state: AppState, roommateId: string, date: string): AppState {
  const turn: Turn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roommateId,
    timestamp: Date.now(),
    date,
  };
  return { ...state, turns: [...state.turns, turn] };
}

/** Remove this person's most recent fill for the day (undo mistaken mark). */
export function removeLastTurnFromState(
  state: AppState,
  roommateId: string,
  date: string
): AppState {
  const mine = getTurnsForDate(state, date).filter((t) => t.roommateId === roommateId);
  if (!mine.length) return state;
  const last = mine.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  return { ...state, turns: state.turns.filter((t) => t.id !== last.id) };
}

export function setAttendanceInState(
  state: AppState,
  date: string,
  roommateId: string,
  status: "present" | "away"
): AppState {
  const d = getDayData(state, date);
  return setDayData(state, date, {
    ...d,
    attendance: { ...d.attendance, [roommateId]: status },
  });
}

export function getAttendanceStatus(state: AppState, date: string, roommateId: string): "present" | "away" {
  return getDayData(state, date).attendance[roommateId] ?? "present";
}

export function getMissedCarry(state: AppState, date: string): Record<string, number> {
  return getDayData(state, date).missedCarry;
}

function intBalance(n: number): number {
  return Math.round(n);
}

/** Whole-fill target for the day: round(total fills ÷ present people). */
export function fairTargetForDay(totalAmongPresent: number, presentCount: number): number {
  if (presentCount === 0) return 0;
  return Math.round(totalAmongPresent / presentCount);
}

/**
 * Signed balance in whole fills: positive = owes buckets, negative = credit buckets.
 *
 * - Above daily target → credit (whole fills ahead)
 * - At target → no change from today (past carry only)
 * - Below target → owed (whole fills behind), stacks across days
 *
 * Away: balance frozen until present again; midnight copies carry unchanged.
 */
export function computeBalance(
  baseCarry: number,
  myTurns: number,
  totalAmongPresent: number,
  presentCount: number,
  isPresent: boolean
): number {
  const base = intBalance(baseCarry);
  if (!isPresent) return base;
  if (presentCount === 0) return base;

  const target = fairTargetForDay(totalAmongPresent, presentCount);
  const owedToday = Math.max(0, target - myTurns);
  const creditToday = Math.max(0, myTurns - target);
  return base + owedToday - creditToday;
}

function rollCarryToNextDay(state: AppState, date: string, newCarry: Record<string, number>): AppState {
  const tDate = addDays(date, 1);
  const tomorrowData = getDayData(state, tDate);
  return setDayData(state, tDate, { ...tomorrowData, missedCarry: newCarry });
}

function closingCarryForDay(state: AppState, date: string): Record<string, number> {
  const turns = getTurnsForDate(state, date);
  const day = getDayData(state, date);
  const prevCarry = getMissedCarry(state, date);
  const presentIds = state.roommates
    .filter((r) => (day.attendance[r.id] ?? "present") === "present")
    .map((r) => r.id);

  const newCarry: Record<string, number> = {};

  if (turns.length === 0 || presentIds.length === 0) {
    state.roommates.forEach((r) => {
      const prev = intBalance(prevCarry[r.id] ?? 0);
      if (prev !== 0) newCarry[r.id] = prev;
    });
    return newCarry;
  }

  const totalAmongPresent = presentIds.reduce(
    (sum, id) => sum + turns.filter((t) => t.roommateId === id).length,
    0
  );
  const presentCount = presentIds.length;

  presentIds.forEach((id) => {
    const myTurns = turns.filter((t) => t.roommateId === id).length;
    const balance = computeBalance(
      prevCarry[id] ?? 0,
      myTurns,
      totalAmongPresent,
      presentCount,
      true
    );
    if (balance !== 0) newCarry[id] = balance;
  });

  state.roommates.forEach((r) => {
    if (presentIds.includes(r.id)) return;
    const prev = intBalance(prevCarry[r.id] ?? 0);
    if (prev !== 0) newCarry[r.id] = prev;
  });

  return newCarry;
}

function carryMapsEqual(
  expected: Record<string, number>,
  actual: Record<string, number>,
  roommateIds: string[]
): boolean {
  for (const id of roommateIds) {
    if (intBalance(expected[id] ?? 0) !== intBalance(actual[id] ?? 0)) return false;
  }
  return true;
}

/** Close one day: write end-of-day owed/credit into the next day's opening carry. */
export function closeDayCarry(state: AppState, date: string): AppState {
  const newCarry = closingCarryForDay(state, date);
  let next = rollCarryToNextDay(state, date, newCarry);
  const ran = next.midnightRan.includes(date) ? next.midnightRan : [...next.midnightRan, date];
  return { ...next, midnightRan: ran };
}

export function runMidnightCalcOnState(
  state: AppState,
  date: string,
  options?: { force?: boolean }
): AppState {
  const ids = state.roommates.map((r) => r.id);
  const expected = closingCarryForDay(state, date);
  const actual = getMissedCarry(state, addDays(date, 1));

  if (!options?.force && state.midnightRan.includes(date) && carryMapsEqual(expected, actual, ids)) {
    return state;
  }

  return closeDayCarry(state, date);
}

export function firstActivityDate(state: AppState): string | null {
  let min: string | null = null;
  for (const t of state.turns) {
    if (!min || t.date < min) min = t.date;
  }
  for (const d of Object.keys(state.days)) {
    if (!min || d < min) min = d;
  }
  return min;
}

/**
 * Ensure each past day's closing owed/credit is stored as the next day's opening carry.
 * Re-runs when carry is missing/wrong (fixes midnight skips and server UTC vs local day).
 */
export function syncCarryChain(state: AppState, asOfToday?: string): AppState {
  const end = asOfToday ?? today();
  const first = firstActivityDate(state);
  if (!first) return state;

  const ids = state.roommates.map((r) => r.id);
  let next = state;
  let d = first;

  while (d < end) {
    const expected = closingCarryForDay(next, d);
    const tDate = addDays(d, 1);
    const actual = getMissedCarry(next, tDate);

    if (!carryMapsEqual(expected, actual, ids)) {
      next = rollCarryToNextDay(next, d, expected);
    }
    if (!next.midnightRan.includes(d)) {
      next = { ...next, midnightRan: [...next.midnightRan, d] };
    }
    d = addDays(d, 1);
  }

  return next;
}

/** @deprecated Use syncCarryChain */
export function ensureMidnightCaughtUp(state: AppState, asOfToday?: string): AppState {
  return syncCarryChain(state, asOfToday);
}

/** Replay carry from a past date through today so owed/credit match edits. */
export function recalculateBalancesFromDate(
  state: AppState,
  fromDate: string,
  asOfToday?: string
): AppState {
  const end = asOfToday ?? today();
  if (fromDate >= end) return state;

  let next: AppState = {
    ...state,
    midnightRan: state.midnightRan.filter((d) => d < fromDate),
  };

  const newDays = { ...next.days };
  for (const key of Object.keys(newDays)) {
    if (key > fromDate) {
      newDays[key] = { ...getDayData(next, key), missedCarry: {} };
    }
  }
  next = { ...next, days: newDays };
  next = syncCarryChain(next, end);

  return appendActivity(
    next,
    fromDate,
    `Admin recalculated balances from ${fromDate} through today`,
    "admin_recalc"
  );
}

export interface Score {
  roommate: Roommate;
  turns: number;
  /** Fills still owed (from past + falling behind today). */
  pending: number;
  /** Extra fills banked — can skip until others catch up. */
  credit: number;
  /** Signed: +owe, −credit (used for suggestions). */
  balance: number;
  priority: number;
  isPresent: boolean;
}

export function getScores(state: AppState, date: string): Score[] {
  const turns = getTurnsForDate(state, date);
  const carry = getMissedCarry(state, date);
  const day = getDayData(state, date);

  const presentTurns = state.roommates
    .filter((r) => (day.attendance[r.id] ?? "present") === "present")
    .map((r) => turns.filter((t) => t.roommateId === r.id).length);

  const presentCount = presentTurns.length;
  const totalAmongPresent = presentTurns.reduce((sum, n) => sum + n, 0);

  return state.roommates.map((r) => {
    const myTurns = turns.filter((t) => t.roommateId === r.id).length;
    const isPresent = (day.attendance[r.id] ?? "present") === "present";
    const balance = computeBalance(
      carry[r.id] ?? 0,
      myTurns,
      totalAmongPresent,
      presentCount,
      isPresent
    );
    const pending = Math.max(0, balance);
    const credit = Math.max(0, -balance);
    // Lower priority value = more urgent; owed lowers it, credit raises it
    const priority = isPresent ? myTurns - balance * 2 : Infinity;
    return { roommate: r, turns: myTurns, pending, credit, balance, priority, isPresent };
  });
}

function dayBalanceContext(state: AppState, date: string) {
  const turns = getTurnsForDate(state, date);
  const day = getDayData(state, date);
  const presentIds = state.roommates
    .filter((r) => (day.attendance[r.id] ?? "present") === "present")
    .map((r) => r.id);
  const presentCount = presentIds.length;
  const totalAmongPresent = presentIds.reduce(
    (sum, id) => sum + turns.filter((t) => t.roommateId === id).length,
    0
  );
  const target = fairTargetForDay(totalAmongPresent, presentCount);
  return { target, presentCount };
}

/** Admin: set total signed balance (+owe / −credit) for a person on a date. */
export function setRoommateBalanceInState(
  state: AppState,
  date: string,
  roommateId: string,
  desiredBalance: number
): AppState {
  const desired = intBalance(desiredBalance);
  const day = getDayData(state, date);
  const myTurns = getTurnsForDate(state, date).filter((t) => t.roommateId === roommateId).length;
  const isPresent = (day.attendance[roommateId] ?? "present") === "present";
  const { target } = dayBalanceContext(state, date);

  const carry = isPresent ? desired - (target - myTurns) : desired;

  const missedCarry = { ...day.missedCarry };
  const stored = intBalance(carry);
  if (stored === 0) delete missedCarry[roommateId];
  else missedCarry[roommateId] = stored;

  const name = findRoommate(state, roommateId)?.name ?? "Roommate";
  const label =
    desired > 0 ? `${desired} fills owed` : desired < 0 ? `${-desired} fills credit` : "even";

  return appendActivity(
    setDayData(state, date, { ...day, missedCarry }),
    date,
    `Admin set ${name} to ${label} on ${date}`,
    "admin_balance"
  );
}

export function getSuggestedNext(scores: Score[]): Score | null {
  const present = scores.filter((s) => s.isPresent);
  if (!present.length) return null;

  const owing = present.filter((s) => s.pending > 0);
  const pool = owing.length > 0 ? owing : present.filter((s) => s.credit === 0);
  const candidates = pool.length > 0 ? pool : present;

  return candidates.reduce((a, b) => {
    if (b.priority !== a.priority) return b.priority < a.priority ? b : a;
    return b.turns < a.turns ? b : a;
  });
}

export function findRoommate(state: AppState, id: string): Roommate | undefined {
  return state.roommates.find((r) => r.id === id);
}

export function addRoommateToState(state: AppState, name: string, emoji: string, color: string): AppState {
  const id = `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const roommate: Roommate = {
    id,
    name: name.trim() || "New roommate",
    emoji,
    color,
  };
  return { ...state, roommates: [...state.roommates, roommate] };
}

export function updateRoommateInState(
  state: AppState,
  id: string,
  patch: Partial<Pick<Roommate, "name" | "emoji" | "color">>
): AppState {
  return {
    ...state,
    roommates: state.roommates.map((r) => (r.id === id ? { ...r, ...patch, name: patch.name?.trim() || r.name } : r)),
  };
}

export function removeRoommateFromState(state: AppState, id: string): AppState {
  if (state.roommates.length <= 1) return state;
  return { ...state, roommates: state.roommates.filter((r) => r.id !== id) };
}

const MAX_ACTIVITIES = 200;

function appendActivity(
  state: AppState,
  date: string,
  message: string,
  kind: ActivityEntry["kind"]
): AppState {
  const entry: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    timestamp: Date.now(),
    kind,
    message,
  };
  const activities = [...(state.activities ?? []), entry];
  return {
    ...state,
    activities: activities.length > MAX_ACTIVITIES ? activities.slice(-MAX_ACTIVITIES) : activities,
  };
}

export function getActivitiesForDate(state: AppState, date: string): ActivityEntry[] {
  return (state.activities ?? []).filter((a) => a.date === date);
}

export function getDayTimeline(state: AppState, date: string): TimelineItem[] {
  const turns = getTurnsForDate(state, date).map((t) => ({
    type: "turn" as const,
    id: t.id,
    timestamp: t.timestamp,
    roommateId: t.roommateId,
  }));
  const activities = getActivitiesForDate(state, date).map((a) => ({
    type: "activity" as const,
    id: a.id,
    timestamp: a.timestamp,
    message: a.message,
    kind: a.kind,
  }));
  return [...turns, ...activities].sort((a, b) => b.timestamp - a.timestamp);
}

export function resetDayInState(state: AppState, date: string): AppState {
  const days = { ...state.days };
  delete days[date];
  const next: AppState = {
    ...state,
    turns: state.turns.filter((t) => t.date !== date),
    days,
    midnightRan: state.midnightRan.filter((d) => d !== date),
  };
  return appendActivity(next, date, "Admin reset today — all turns and attendance cleared", "admin_reset");
}

export function setRoommateTurnCountInState(
  state: AppState,
  date: string,
  roommateId: string,
  count: number
): AppState {
  const target = Math.max(0, Math.floor(count));
  const prevCount = getTurnsForDate(state, date).filter((t) => t.roommateId === roommateId).length;
  if (prevCount === target) return state;

  const otherTurns = state.turns.filter((t) => t.date !== date || t.roommateId !== roommateId);
  const base = Date.now();
  const newTurns: Turn[] = Array.from({ length: target }, (_, i) => ({
    id: `${base}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    roommateId,
    timestamp: base - (target - i) * 1000,
    date,
  }));

  const name = findRoommate(state, roommateId)?.name ?? "Roommate";
  let next: AppState = { ...state, turns: [...otherTurns, ...newTurns] };
  return appendActivity(
    next,
    date,
    `Admin set ${name}'s turns to ${target} (was ${prevCount})`,
    "admin_turns"
  );
}

// ── one-time migration from old localStorage-only data ─────────────────────

export function collectLegacyLocalState(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(lsKey("migrated"))) return null;

  const turnsRaw = localStorage.getItem(lsKey("turns"));
  const turns: Turn[] = turnsRaw ? JSON.parse(turnsRaw) : [];
  const days: Record<string, DayData> = {};
  const midnightRan: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("aq_")) continue;
    const suffix = k.slice(3);
    if (suffix.startsWith("day_")) {
      const date = suffix.slice(4);
      try {
        days[date] = JSON.parse(localStorage.getItem(k)!);
      } catch {
        /* skip */
      }
    }
    if (suffix.startsWith("midnight_")) {
      const date = suffix.slice(9);
      try {
        if (JSON.parse(localStorage.getItem(k)!)) midnightRan.push(date);
      } catch {
        /* skip */
      }
    }
  }

  if (turns.length === 0 && Object.keys(days).length === 0) return null;
  return { turns, days, midnightRan };
}

export function markLegacyMigrated() {
  if (typeof window === "undefined") return;
  localStorage.setItem(lsKey("migrated"), "1");
}
