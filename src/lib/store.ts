import type { ActivityEntry, AppState, DayData, Roommate, TimelineItem, Turn } from "./types";

export type { AppState, DayData, Roommate, Turn } from "./types";
export { DEFAULT_ROOMMATES, EMOJI_OPTIONS, COLOR_OPTIONS, createDefaultState } from "./types";

/** YYYY-MM-DD in the user's local timezone (not UTC). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return formatLocalDate(new Date());
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

export function addTurnToState(state: AppState, roommateId: string): AppState {
  const turn: Turn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roommateId,
    timestamp: Date.now(),
    date: today(),
  };
  return { ...state, turns: [...state.turns, turn] };
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

export function runMidnightCalcOnState(state: AppState, date: string): AppState {
  if (state.midnightRan.includes(date)) return state;

  const turns = getTurnsForDate(state, date);
  const day = getDayData(state, date);
  const presentIds = state.roommates
    .filter((r) => (day.attendance[r.id] ?? "present") === "present")
    .map((r) => r.id);

  let next = state;

  if (presentIds.length === 0 || turns.length === 0) {
    return { ...next, midnightRan: [...next.midnightRan, date] };
  }

  const fairShare = turns.length / presentIds.length;
  const newCarry: Record<string, number> = {};

  const yDate = addDays(date, -1);
  const prevCarry = getMissedCarry(state, yDate);

  presentIds.forEach((id) => {
    const myTurns = turns.filter((t) => t.roommateId === id).length;
    const deficit = fairShare - myTurns;
    const carried = prevCarry[id] ?? 0;
    const total = deficit + carried;
    if (total > 0.05) newCarry[id] = Math.round(total * 10) / 10;
  });

  const tDate = addDays(date, 1);
  const tomorrowData = getDayData(state, tDate);
  next = setDayData(next, tDate, { ...tomorrowData, missedCarry: newCarry });
  return { ...next, midnightRan: [...next.midnightRan, date] };
}

export interface Score {
  roommate: Roommate;
  turns: number;
  pending: number;
  priority: number;
  isPresent: boolean;
}

export function getScores(state: AppState, date: string): Score[] {
  const turns = getTurnsForDate(state, date);
  const carry = getMissedCarry(state, date);
  const day = getDayData(state, date);

  return state.roommates.map((r) => {
    const myTurns = turns.filter((t) => t.roommateId === r.id).length;
    const pending = carry[r.id] ?? 0;
    const isPresent = (day.attendance[r.id] ?? "present") === "present";
    const priority = isPresent ? myTurns - pending * 2 : Infinity;
    return { roommate: r, turns: myTurns, pending, priority, isPresent };
  });
}

export function getSuggestedNext(scores: Score[]): Score | null {
  const present = scores.filter((s) => s.isPresent);
  if (!present.length) return null;
  return present.reduce((a, b) => (b.priority < a.priority ? b : a));
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
