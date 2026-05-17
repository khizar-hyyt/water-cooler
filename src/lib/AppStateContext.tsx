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
import type { MutateAction } from "./mutations";
import type { SessionRole } from "./auth";
import {
  loadSession,
  saveSession,
  type ClientSession,
} from "./session-client";
import { collectLegacyLocalState, markLegacyMigrated } from "./store";

interface AppStateContextValue {
  state: AppState;
  session: ClientSession | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  storage: "kv" | "file" | null;
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
  addTurn: (roommateId: string) => Promise<void>;
  setAttendance: (date: string, roommateId: string, status: "present" | "away") => Promise<void>;
  runMidnightCalc: (date: string) => Promise<void>;
  addRoommate: (name: string, emoji: string, color: string) => Promise<Roommate | null>;
  updateRoommate: (
    id: string,
    patch: Partial<Pick<Roommate, "name" | "emoji" | "color">>
  ) => Promise<void>;
  removeRoommate: (id: string) => Promise<boolean>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

async function fetchState(): Promise<{ state: AppState; storage: "kv" | "file" }> {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load shared data");
  return res.json();
}

async function postMutate(token: string, action: MutateAction): Promise<AppState> {
  const res = await fetch("/api/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save");
  return data.state as AppState;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createDefaultState);
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<"kv" | "file" | null>(null);
  const stateRef = useRef(state);
  const sessionRef = useRef(session);
  stateRef.current = state;
  sessionRef.current = session;

  useEffect(() => {
    setSession(loadSession());
  }, []);

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

  const mutate = useCallback(async (action: MutateAction) => {
    const tok = sessionRef.current?.token;
    if (!tok) throw new Error("Not signed in");
    setSaving(true);
    setError(null);
    try {
      const saved = await postMutate(tok, action);
      setState(saved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save";
      setError(msg);
      throw e;
    } finally {
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
      return { needsPasswordSetup: Boolean(data.needsPasswordSetup) };
    },
    []
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
        let { state: remote, storage: mode } = await fetchState();

        const legacy = collectLegacyLocalState();
        if (legacy) {
          const res = await fetch("/api/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ legacy }),
          });
          if (res.ok) {
            const data = await res.json();
            remote = data.state;
            markLegacyMigrated();
          }
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

    const onFocus = () => refreshInternal().catch(() => {});
    const interval = setInterval(() => refreshInternal().catch(() => {}), 15000);
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
    isAdmin: session?.role === "admin",
    refresh,
    login,
    logout,
    changePassword,
    mutate,
    addTurn: (roommateId) => mutate({ type: "addTurn", roommateId }),
    setAttendance: (date, roommateId, status) =>
      mutate({ type: "setAttendance", date, roommateId, status }),
    runMidnightCalc: (date) => mutate({ type: "runMidnightCalc", date }),
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
