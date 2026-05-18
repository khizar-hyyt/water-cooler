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
import { createDefaultState, normalizeState } from "./types";
import type { MutateAction } from "./mutations";
import type { SessionRole } from "./auth";
import {
  loadSession,
  saveSession,
  type ClientSession,
} from "./session-client";
import { collectLegacyLocalState, markLegacyMigrated, today } from "./store";
import { resolveTimeZone, TZ_HEADER } from "./timezone";

function apiHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    [TZ_HEADER]: resolveTimeZone(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface AppStateContextValue {
  state: AppState;
  session: ClientSession | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  storage: "kv" | "file" | null;
  persistent: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  login: (
    type: SessionRole,
    roommateId: string | null,
    password: string
  ) => Promise<{ needsPasswordSetup: boolean }>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  mutate: (action: MutateAction) => Promise<void>;
  addTurn: (roommateId: string, date?: string) => Promise<void>;
  removeLastTurn: (roommateId: string, date?: string) => Promise<void>;
  setAttendance: (date: string, roommateId: string, status: "present" | "away") => Promise<void>;
  runMidnightCalc: (date: string) => Promise<void>;
  resetDay: (date: string) => Promise<void>;
  setTurnCount: (date: string, roommateId: string, count: number) => Promise<void>;
  setBalance: (date: string, roommateId: string, balance: number) => Promise<void>;
  recalculateFromDate: (fromDate: string) => Promise<void>;
  addRoommate: (name: string, emoji: string, color: string) => Promise<Roommate | null>;
  updateRoommate: (
    id: string,
    patch: Partial<Pick<Roommate, "name" | "emoji" | "color">>
  ) => Promise<void>;
  removeRoommate: (id: string) => Promise<boolean>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function shouldApplyRemote(local: AppState, remote: AppState, force: boolean): boolean {
  if (force) return true;
  const localRev = local.revision ?? 0;
  const remoteRev = remote.revision ?? 0;
  if (remoteRev > localRev) return true;
  if (remote.turns.length > local.turns.length) return true;
  if (remoteRev < localRev) return false;
  return true;
}

async function fetchState(): Promise<{ state: AppState; storage: "kv" | "file"; persistent: boolean }> {
  const res = await fetch(`/api/state?_=${Date.now()}`, {
    cache: "no-store",
    headers: { [TZ_HEADER]: resolveTimeZone() },
  });
  if (!res.ok) throw new Error("Could not load shared data");
  const data = await res.json();
  return {
    state: normalizeState(data.state),
    storage: data.storage,
    persistent: data.persistent !== false,
  };
}

async function postMutate(token: string, action: MutateAction): Promise<AppState> {
  const res = await fetch("/api/mutate", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...apiHeaders(token),
    },
    body: JSON.stringify({ action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save");
  return normalizeState(data.state);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createDefaultState);
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<"kv" | "file" | null>(null);
  const [persistent, setPersistent] = useState(true);
  const stateRef = useRef(state);
  const sessionRef = useRef(session);
  const savingRef = useRef(false);
  stateRef.current = state;
  sessionRef.current = session;

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const refreshInternal = useCallback(async (force = false) => {
    if (savingRef.current && !force) return stateRef.current;

    const { state: remote, storage: mode, persistent: ok } = await fetchState();
    if (!shouldApplyRemote(stateRef.current, remote, force)) return stateRef.current;

    setState(remote);
    setStorage(mode);
    setPersistent(ok);
    setError(null);

    const sess = sessionRef.current;
    if (sess?.roommate) {
      const updated = remote.roommates.find((r) => r.id === sess.roommate!.id);
      if (
        updated &&
        (updated.name !== sess.roommate.name ||
          updated.emoji !== sess.roommate.emoji ||
          updated.color !== sess.roommate.color)
      ) {
        const nextSession = { ...sess, roommate: updated };
        saveSession(nextSession);
        setSession(nextSession);
      }
    }

    return remote;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await refreshInternal(true);
    } catch {
      setError("Could not load shared data");
    } finally {
      setLoading(false);
    }
  }, [refreshInternal]);

  const mutate = useCallback(async (action: MutateAction) => {
    const tok = sessionRef.current?.token;
    if (!tok) throw new Error("Not signed in");
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await postMutate(tok, action);
      setState(saved);
      if (action.type === "updateRoommate" && sessionRef.current?.roommate?.id === action.id) {
        const updated = saved.roommates.find((r) => r.id === action.id);
        if (updated) {
          const nextSession = { ...sessionRef.current, roommate: updated };
          saveSession(nextSession);
          setSession(nextSession);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save";
      setError(msg);
      throw e;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  const login = useCallback(
    async (type: SessionRole, roommateId: string | null, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          roommateId: type === "roommate" ? roommateId : undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      const clientSession: ClientSession = {
        token: data.token,
        role: data.role,
        roommate: data.roommate ?? null,
      };
      saveSession(clientSession);
      setSession(clientSession);
      setError(null);
      await refreshInternal(true);
      return { needsPasswordSetup: Boolean(data.needsPasswordSetup) };
    },
    [refreshInternal]
  );

  const logout = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const tok = sessionRef.current?.token;
      if (!tok) throw new Error("Not signed in");
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update password");
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        let { state: remote, storage: mode, persistent: ok } = await fetchState();

        const legacy = collectLegacyLocalState();
        if (legacy) {
          const hasRemoteData =
            remote.turns.length > 0 ||
            Object.keys(remote.days).length > 0 ||
            (remote.activities?.length ?? 0) > 0;
          if (!hasRemoteData) {
            const res = await fetch("/api/migrate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ legacy }),
            });
            if (res.ok) {
              const data = await res.json();
              remote = normalizeState(data.state);
            }
          }
          markLegacyMigrated();
        }

        if (!cancelled) {
          setState(normalizeState(remote));
          setStorage(mode);
          setPersistent(ok);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load shared data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const onFocus = () => refreshInternal().catch(() => {});
    const interval = setInterval(() => refreshInternal().catch(() => {}), 8000);
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
    session,
    loading,
    saving,
    error,
    storage,
    persistent,
    isAdmin: session?.role === "admin",
    refresh,
    login,
    logout,
    changePassword,
    mutate,
    addTurn: (roommateId, date = today()) => mutate({ type: "addTurn", roommateId, date }),
    removeLastTurn: (roommateId, date = today()) =>
      mutate({ type: "removeLastTurn", roommateId, date }),
    setAttendance: (date, roommateId, status) =>
      mutate({ type: "setAttendance", date, roommateId, status }),
    runMidnightCalc: (date) => mutate({ type: "runMidnightCalc", date }),
    resetDay: (date) => mutate({ type: "resetDay", date }),
    setTurnCount: (date, roommateId, count) =>
      mutate({ type: "setTurnCount", date, roommateId, count }),
    setBalance: (date, roommateId, balance) =>
      mutate({ type: "setBalance", date, roommateId, balance }),
    recalculateFromDate: (fromDate) => mutate({ type: "recalculateFromDate", fromDate }),
    addRoommate: async (name, emoji, color) => {
      await mutate({ type: "addRoommate", name, emoji, color });
      const added = stateRef.current.roommates[stateRef.current.roommates.length - 1] ?? null;
      return added;
    },
    updateRoommate: (id, patch) => mutate({ type: "updateRoommate", id, patch }),
    removeRoommate: async (id) => {
      if (stateRef.current.roommates.length <= 1) return false;
      await mutate({ type: "removeRoommate", id });
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
