"use client";

import { useState } from "react";
import { useAppState } from "@/lib/AppStateContext";
import { Lock, Shield } from "lucide-react";

export default function ProfileSettings({ isAdmin }: { isAdmin: boolean }) {
  const { session, changePassword } = useAppState();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const name = isAdmin ? "Admin" : session?.roommate?.name ?? "You";

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    if (next.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage("Password updated. Only you can change it again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-lg font-bold text-white">Profile</h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Signed in as {name}. {isAdmin ? "Admin" : "Only you"} can change this password.
        </p>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          {isAdmin ? (
            <Shield className="w-4 h-4 text-violet-400" />
          ) : (
            <Lock className="w-4 h-4 text-sky-400" />
          )}
          <p className="text-slate-400 text-xs uppercase tracking-widest">Change password</p>
        </div>

        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password (leave blank if none set)"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm mb-3"
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm mb-3"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm mb-3"
        />

        {error && (
          <p className="text-rose-400 text-xs mb-3 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-emerald-400 text-xs mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !next}
          className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save password"}
        </button>
      </div>
    </div>
  );
}
