"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/AppStateContext";
import type { Roommate } from "@/lib/types";
import { Droplets, Cloud, CloudOff, Shield, Lock, ArrowLeft } from "lucide-react";

type Step =
  | { kind: "pick" }
  | { kind: "roommate"; roommate: Roommate; needsPassword: boolean }
  | { kind: "admin"; needsPassword: boolean };

export default function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (needsPasswordSetup: boolean) => void;
}) {
  const { state, loading, error, storage, persistent, login } = useAppState();
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [adminConfigured, setAdminConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setLocks(d.roommateLocks ?? {});
        setAdminConfigured(Boolean(d.adminConfigured));
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setLoginError(null);
    try {
      if (step.kind === "admin") {
        if (!step.needsPassword && password.length > 0 && password.length < 4) {
          setLoginError("Password must be at least 4 characters");
          setSubmitting(false);
          return;
        }
        const { needsPasswordSetup } = await login("admin", null, password);
        onLoggedIn(needsPasswordSetup);
        return;
      }
      if (step.kind === "roommate") {
        const { needsPasswordSetup } = await login("roommate", step.roommate.id, password);
        onLoggedIn(needsPasswordSetup);
      }
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Droplets className="w-8 h-8 text-sky-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-sky-500 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/30">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">AquaShift</h1>
          <p className="text-slate-400 text-sm text-center">Sign in to continue</p>
        </div>

        {(error || loginError) && (
          <p className="text-rose-400 text-xs text-center mb-3 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {loginError || error}
          </p>
        )}

        {step.kind === "pick" ? (
          <>
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-3 text-center">
                Who are you?
              </p>
              <div className="space-y-2">
                {state.roommates.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setPassword("");
                      setLoginError(null);
                      setStep({
                        kind: "roommate",
                        roommate: r,
                        needsPassword: Boolean(locks[r.id]),
                      });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all"
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: r.color + "25", border: `1px solid ${r.color}40` }}
                    >
                      {r.emoji}
                    </span>
                    <span className="font-semibold text-white flex-1 text-left">{r.name}</span>
                    {locks[r.id] ? (
                      <Lock className="w-4 h-4 text-slate-500" />
                    ) : (
                      <span className="text-slate-500 text-sm">→</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setPassword("");
                setLoginError(null);
                setStep({ kind: "admin", needsPassword: adminConfigured });
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/15 border border-violet-500/40 text-violet-300 hover:bg-violet-500/25 transition-all text-sm font-medium"
            >
              <Shield className="w-4 h-4" />
              Admin sign in
            </button>
          </>
        ) : (
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
            <button
              onClick={() => setStep({ kind: "pick" })}
              className="flex items-center gap-1 text-slate-500 text-xs mb-3 hover:text-white"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <p className="text-white font-semibold mb-1 text-center">
              {step.kind === "admin" ? "Admin" : step.roommate.name}
            </p>
            <p className="text-slate-500 text-xs text-center mb-4">
              {step.kind === "admin"
                ? step.needsPassword
                  ? "Enter admin password"
                  : "First admin visit — enter a password to secure the app"
                : step.needsPassword
                ? "Enter your password"
                : "No password yet — leave blank or set one in Profile after login"}
            </p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={step.needsPassword ? "Password" : "Password (optional)"}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm mb-3"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />

            <button
              onClick={submit}
              disabled={
                submitting ||
                ((step.kind === "roommate" && step.needsPassword && !password) ||
                  (step.kind === "admin" && step.needsPassword && !password))
              }
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Continue"}
            </button>
          </div>
        )}

        <p
          className={`text-center text-xs mt-4 flex items-center justify-center gap-1 ${
            persistent ? "text-slate-500" : "text-amber-400"
          }`}
        >
          {persistent ? (
            <>
              <Cloud className="w-3 h-3" /> Synced across all devices
            </>
          ) : (
            <>
              <CloudOff className="w-3 h-3" /> Storage not connected — changes may not save
            </>
          )}
        </p>
      </div>
    </div>
  );
}
