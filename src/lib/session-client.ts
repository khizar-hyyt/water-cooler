import type { Roommate } from "./types";
import type { SessionRole } from "./auth";

const SESSION_KEY = "aq_session";

export interface ClientSession {
  token: string;
  role: SessionRole;
  roommate: Roommate | null;
}

export function loadSession(): ClientSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ClientSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: ClientSession | null) {
  if (typeof window === "undefined") return;
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

export const ADMIN_PROFILE = {
  id: "__admin__",
  name: "Admin",
  emoji: "🔐",
  color: "#e879f9",
} as const;
