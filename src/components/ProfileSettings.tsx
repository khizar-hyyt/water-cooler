"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/AppStateContext";
import { EMOJI_OPTIONS } from "@/lib/types";
import { Lock, Shield, UserCircle } from "lucide-react";

export default function ProfileSettings({ isAdmin }: { isAdmin: boolean }) {
  const { session, changePassword, updateRoommate, state, saving } = useAppState();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const me = session?.roommate;
  const live = me ? state.roommates.find((r) => r.id === me.id) : null;
  const [displayName, setDisplayName] = useState(live?.name ?? me?.name ?? "");
  const [emoji, setEmoji] = useState(live?.emoji ?? me?.emoji ?? "💧");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (live) {
      setDisplayName(live.name);
      setEmoji(live.emoji);
    }
  }, [live?.name, live?.emoji]);

  const name = isAdmin ? "Admin" : live?.name ?? me?.name ?? "You";

  const handleSavePassword = async () => {
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
    setSavingPw(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage("Password updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSavingPw(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!me) return;
    setProfileError(null);
    setProfileMessage(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileError("Enter a name");
      return;
    }
    setSavingProfile(true);
    try {
      await updateRoommate(me.id, { name: trimmed, emoji });
      setProfileMessage("Profile updated for everyone.");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-lg font-bold text-white">Profile</h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Signed in as {name}. {isAdmin ? "Admin account." : "Update how you appear on the board."}
        </p>
      </div>

      {!isAdmin && me && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <UserCircle className="w-4 h-4 text-sky-400" />
            <p className="text-slate-400 text-xs uppercase tracking-widest">Your display</p>
          </div>

          <label className="text-slate-500 text-xs block mb-1">Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm mb-4"
          />

          <p className="text-slate-500 text-xs mb-2">Emoji</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-10 h-10 rounded-xl text-lg border transition-all ${
                  emoji === e
                    ? "bg-sky-500/20 border-sky-500/50 scale-110"
                    : "bg-slate-800 border-slate-700 hover:border-slate-500"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {profileError && (
            <p className="text-rose-400 text-xs mb-3 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {profileError}
            </p>
          )}
          {profileMessage && (
            <p className="text-emerald-400 text-xs mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {profileMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile || saving}
            className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save name & emoji"}
          </button>
        </div>
      )}

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
          onClick={handleSavePassword}
          disabled={savingPw || !next}
          className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm disabled:opacity-50"
        >
          {savingPw ? "Saving…" : "Save password"}
        </button>
      </div>
    </div>
  );
}
