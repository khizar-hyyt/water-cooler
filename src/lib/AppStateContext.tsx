"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppState, Roommate } from "./types";
import { createDefaultState } from "./types";
import {
  addRoommateToState,
  addTurnToState,
  collectLegacyLocalState,
  markLegacyMigrated,
  removeRoommateFromState,
  runMidnightCalcOnState,
  setAttendanceInState,
  updateRoommateInState,
} from "./store";

interface AppStateContextValue {
  state: AppState;
  loading: boolean;
  saving: boolean;
  error: string | null;
  storage: "kv" | "file" | null;
  refresh: () => Promise<void>;
  addTurn: (roommateId: string) => Promise<void>;
  setAttendance: (date: string, roommateId: string, status: "present" | "away") => Promise<void>;
  runMidnightCalc: (date: string) => Promise<void>;
  addRoommate: (name: string, emoji: string, color: string) => Promise<Roommate | null>;
  updateRoommate: (id: string, patch: Partial<Pick<Roommate, "name" | "emoji" | "color">>) => Promise<void>;
  removeRoommate: (id: string) => Promise<boolean>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

async function fetchState(): Promise<{ state: AppState; storage: "kv" | "file" }> {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load shared data");
  return res.json();
}

async function persistState(state: AppState): Promise<AppState> {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("Could not save");
  const data = await res.json();
  return data.state as AppState;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createDefaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<"kv" | "file" | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const applyAndSave = useCallback(
    async (updater: (s: AppState) => AppState) => {
      const next = updater(stateRef.current);
      setState(next);
      setSaving(true);
      setError(null);
      try {
        const saved = await persistState(next);
        setState(saved);
      } catch {
        setError("Failed to save — retrying…");
        try {
          const { state: remote } = await fetchState();
          setState(remote);
          setError(null);
        } catch {
          setError("Could not sync with server");
        }
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const refreshInternal = useCallback(async () => {
    const { state: remote, storage: mode } = await fetchState();
    setState(remote);
    setStorage(mode);
    setError(null);
    return remote;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await refreshInternal();
    } catch {
      setError("Could not load shared data");
    } finally {
      setLoading(false);
    }
  }, [refreshInternal]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        let { state: remote, storage: mode } = await fetchState();

        const legacy = collectLegacyLocalState();
        if (legacy) {
          const merged: AppState = {
            ...remote,
            turns: [...remote.turns, ...(legacy.turns ?? [])].sort((a, b) => a.timestamp - b.timestamp),
            days: { ...remote.days, ...(legacy.days ?? {}) },
            midnightRan: Array.from(
              new Set([...remote.midnightRan, ...(legacy.midnightRan ?? [])])
            ),
          };
          remote = await persistState(merged);
          markLegacyMigrated();
        }

        if (!cancelled) {
          setState(remote);
          setStorage(mode);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load shared data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const onFocus = () => {
      refreshInternal().catch(() => {});
    };
    const interval = setInterval(() => {
      refreshInternal().catch(() => {});
    }, 15000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshInternal]);

  const value: AppStateContextValue = {
    state,
    loading,
    saving,
    error,
    storage,
    refresh,
    addTurn: (roommateId) => applyAndSave((s) => addTurnToState(s, roommateId)),
    setAttendance: (date, roommateId, status) =>
      applyAndSave((s) => setAttendanceInState(s, date, roommateId, status)),
    runMidnightCalc: (date) => applyAndSave((s) => runMidnightCalcOnState(s, date)),
    addRoommate: async (name, emoji, color) => {
      let added: Roommate | null = null;
      await applyAndSave((s) => {
        const next = addRoommateToState(s, name, emoji, color);
        added = next.roommates[next.roommates.length - 1] ?? null;
        return next;
      });
      return added;
    },
    updateRoommate: (id, patch) => applyAndSave((s) => updateRoommateInState(s, id, patch)),
    removeRoommate: async (id) => {
      if (stateRef.current.roommates.length <= 1) return false;
      await applyAndSave((s) => removeRoommateFromState(s, id));
      return true;
    },
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
