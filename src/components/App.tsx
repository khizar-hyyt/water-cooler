"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Roommate, Turn, Score,
  getSavedUser, saveUserId,
  getAttendanceStatus, getTurnsForDate,
  getScores, getSuggestedNext, getMissedCarry,
  findRoommate, today,
} from "@/lib/store";
import { useAppState } from "@/lib/AppStateContext";
import ManageUsers from "@/components/ManageUsers";
import {
  Droplets, CheckCircle2, Home, Plane, Crown,
  RefreshCw, LogOut, LayoutDashboard, Calendar,
  ChevronLeft, ChevronRight, AlertCircle, Zap,
  Users, Cloud, CloudOff,
} from "lucide-react";

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString([], {
    weekday: "long", day: "numeric", month: "long",
  });
}

function clx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

function SelectScreen({ onSelect }: { onSelect: (r: Roommate) => void }) {
  const { state, loading, error, storage } = useAppState();

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
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-sky-500 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/30">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">AquaShift</h1>
          <p className="text-slate-400 text-sm text-center">Water cooler duty tracker</p>
        </div>

        {error && (
          <p className="text-rose-400 text-xs text-center mb-3 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-3 text-center">
            Who are you?
          </p>
          <div className="space-y-2">
            {state.roommates.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all"
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: r.color + "25", border: `1px solid ${r.color}40` }}
                >
                  {r.emoji}
                </span>
                <span className="font-semibold text-white">{r.name}</span>
                <span className="ml-auto text-slate-500 text-sm">→</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-slate-500 text-xs mt-4 flex items-center justify-center gap-1">
          {storage === "kv" ? (
            <>
              <Cloud className="w-3 h-3" /> Synced across all devices
            </>
          ) : (
            <>
              <CloudOff className="w-3 h-3" /> Shared on this server (local dev)
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Dashboard({ user }: { user: Roommate }) {
  const { state, addTurn, setAttendance, runMidnightCalc } = useAppState();
  const [scores, setScores] = useState<Score[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [myStatus, setMyStatus] = useState<"present" | "away">("present");
  const [justMarked, setJustMarked] = useState(false);
  const [marking, setMarking] = useState(false);
  const date = today();

  const refresh = useCallback(() => {
    setScores(getScores(state, date));
    setTurns(getTurnsForDate(state, date));
    setMyStatus(getAttendanceStatus(state, date, user.id));
  }, [state, date, user.id]);

  useEffect(() => {
    refresh();
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0);
    const timer = setTimeout(() => {
      runMidnightCalc(date).then(refresh);
    }, midnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [refresh, date, runMidnightCalc]);

  const handleAttendance = async (status: "present" | "away") => {
    await setAttendance(date, user.id, status);
    setMyStatus(status);
  };

  const handleMark = async () => {
    if (marking || myStatus === "away") return;
    setMarking(true);
    await new Promise((r) => setTimeout(r, 300));
    await addTurn(user.id);
    refresh();
    setJustMarked(true);
    setMarking(false);
    setTimeout(() => setJustMarked(false), 2000);
  };

  const suggested = getSuggestedNext(scores);
  const myTurns = turns.filter((t) => t.roommateId === user.id).length;
  const myPending = getMissedCarry(state, date)[user.id] ?? 0;
  const presentCount = scores.filter((s) => s.isPresent).length;
  const maxTurns = Math.max(...scores.map((s) => s.turns), 1);

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-lg font-bold text-white">{fmtDate(date)}</h2>
        <p className="text-slate-500 text-xs">{presentCount} roommates present today</p>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Your Status</p>
        <div className="flex gap-2">
          {(["present", "away"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleAttendance(s)}
              className={clx(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border",
                myStatus === s
                  ? s === "present"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
              )}
            >
              {s === "present" ? <Home className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
              {s === "present" ? "Present" : "Away"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-0.5">My fills today</p>
            <p className="text-4xl font-bold text-white">{myTurns}</p>
          </div>
          {myPending > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-full px-3 py-1 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {myPending.toFixed(1)} owed
            </div>
          )}
        </div>
        <button
          onClick={handleMark}
          disabled={myStatus === "away"}
          className={clx(
            "w-full py-4 rounded-xl font-bold text-base transition-all duration-200 active:scale-95",
            justMarked
              ? "bg-emerald-500 text-white"
              : myStatus === "away"
              ? "bg-slate-800 text-slate-600 cursor-not-allowed"
              : "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25"
          )}
        >
          {justMarked ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Logged!
            </span>
          ) : marking ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Saving…
            </span>
          ) : myStatus === "away" ? (
            "Mark yourself present first"
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Droplets className="w-5 h-5" /> Mark My Turn Complete
            </span>
          )}
        </button>
      </div>

      {suggested && (
        <div
          className={clx(
            "rounded-2xl p-4 border",
            suggested.roommate.id === user.id
              ? "bg-sky-500/10 border-sky-500/30"
              : "bg-slate-900 border-slate-800"
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs text-slate-400 uppercase tracking-widest">Suggested next</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: suggested.roommate.color + "25", border: `1px solid ${suggested.roommate.color}40` }}
            >
              {suggested.roommate.emoji}
            </span>
            <div>
              <p className="font-semibold text-white">
                {suggested.roommate.name}
                {suggested.roommate.id === user.id && (
                  <span className="ml-2 text-sky-400 text-xs font-normal">← you!</span>
                )}
              </p>
              <p className="text-slate-500 text-xs">
                {suggested.turns} turns · {suggested.pending > 0 ? `${suggested.pending.toFixed(1)} owed` : "balanced"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Today's Board</p>
        <div className="space-y-3">
          {[...scores].sort((a, b) => b.turns - a.turns).map((s, i) => (
            <div key={s.roommate.id} className="flex items-center gap-3">
              <span className="text-slate-600 text-xs w-4 text-center">{i + 1}</span>
              <span
                className={clx("w-8 h-8 rounded-xl flex items-center justify-center text-sm", !s.isPresent && "opacity-40")}
                style={{ background: s.roommate.color + "25", border: `1px solid ${s.roommate.color}40` }}
              >
                {s.roommate.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm font-medium text-white">{s.roommate.name}</span>
                  {i === 0 && s.turns > 0 && <Crown className="w-3 h-3 text-amber-400" />}
                  {!s.isPresent && <Plane className="w-3 h-3 text-slate-600" />}
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(s.turns / maxTurns) * 100}%`,
                      background: s.roommate.color,
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-white text-lg">{s.turns}</span>
                {s.pending > 0 && (
                  <p className="text-rose-400 text-xs">+{s.pending.toFixed(1)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {turns.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Recent</p>
          <div className="space-y-2">
            {[...turns].reverse().slice(0, 6).map((t) => {
              const r = findRoommate(state, t.roommateId);
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-base">{r?.emoji ?? "💧"}</span>
                  <span className="text-white text-sm flex-1">{r?.name ?? "Removed"} filled water</span>
                  <span className="text-slate-500 text-xs">{fmt(t.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function History() {
  const { state } = useAppState();
  const [date, setDate] = useState(today);

  const turns = getTurnsForDate(state, date);
  const scores = getScores(state, date);

  const move = (dir: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + dir);
    const next = d.toISOString().slice(0, 10);
    if (next <= today()) setDate(next);
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between">
          <button onClick={() => move(-1)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-white">{date === today() ? "Today" : fmtDate(date)}</p>
            <p className="text-slate-500 text-xs">{date}</p>
          </div>
          <button
            onClick={() => move(1)}
            disabled={date === today()}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Fills", value: turns.length, color: "text-sky-400" },
          { label: "Present", value: scores.filter((s) => s.isPresent).length, color: "text-emerald-400" },
          {
            label: "Pending",
            value: scores.reduce((s, x) => s + x.pending, 0).toFixed(1),
            color: "text-rose-400",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800">
            <p className={`font-bold text-2xl ${color}`}>{value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Breakdown</p>
        <div className="space-y-3">
          {[...scores].sort((a, b) => b.turns - a.turns).map((s) => (
            <div key={s.roommate.id} className="flex items-center gap-3">
              <span
                className={clx("w-9 h-9 rounded-xl flex items-center justify-center text-lg", !s.isPresent && "opacity-40")}
                style={{ background: s.roommate.color + "25", border: `1px solid ${s.roommate.color}40` }}
              >
                {s.roommate.emoji}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.roommate.name}</span>
                  {!s.isPresent && <span className="text-xs text-amber-400">Away</span>}
                </div>
                {s.pending > 0 && <p className="text-rose-400 text-xs">{s.pending.toFixed(1)} owed</p>}
              </div>
              <span className="font-bold text-xl text-white">{s.turns}</span>
            </div>
          ))}
        </div>
      </div>

      {turns.length > 0 ? (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Timeline</p>
          <div className="space-y-2">
            {turns.map((t, i) => {
              const r = findRoommate(state, t.roommateId);
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-slate-600 text-xs w-5 text-center">{i + 1}</span>
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                    style={{ background: (r?.color ?? "#64748b") + "25", border: `1px solid ${(r?.color ?? "#64748b")}40` }}
                  >
                    {r?.emoji ?? "💧"}
                  </span>
                  <span className="text-white text-sm flex-1">{r?.name ?? "Removed"}</span>
                  <span className="text-slate-500 text-xs">{fmt(t.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-2xl p-8 text-center border border-slate-800">
          <Droplets className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No turns recorded for this day</p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { state, loading, error, saving } = useAppState();
  const [user, setUser] = useState<Roommate | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [view, setView] = useState<"dash" | "history" | "users">("dash");

  useEffect(() => {
    setUser(getSavedUser(state.roommates));
    setUserLoaded(true);
  }, [state.roommates]);

  useEffect(() => {
    if (!user) return;
    const still = state.roommates.find((r) => r.id === user.id);
    if (!still) {
      saveUserId(null);
      setUser(null);
    } else if (still.name !== user.name || still.emoji !== user.emoji || still.color !== user.color) {
      setUser(still);
    }
  }, [state.roommates, user]);

  if (loading || !userLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Droplets className="w-8 h-8 text-sky-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <SelectScreen
        onSelect={(r) => {
          saveUserId(r.id);
          setUser(r);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-white text-sm">AquaShift</span>
          {saving && <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium max-w-[120px] truncate"
            style={{ background: user.color + "25", color: user.color }}
          >
            {user.emoji} {user.name}
          </span>
          <button
            onClick={() => { saveUserId(null); setUser(null); }}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors"
            title="Switch user"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && (
        <p className="text-center text-rose-400 text-xs py-2 px-4 bg-rose-500/10 border-b border-rose-500/20">
          {error}
        </p>
      )}

      <main className="flex-1 px-4 pt-5 overflow-y-auto">
        {view === "dash" && <Dashboard user={user} />}
        {view === "history" && <History />}
        {view === "users" && <ManageUsers />}
      </main>

      <nav className="sticky bottom-0 bg-slate-950/90 backdrop-blur border-t border-slate-800 flex h-16">
        {([
          { id: "dash" as const, label: "Dashboard", Icon: LayoutDashboard },
          { id: "history" as const, label: "History", Icon: Calendar },
          { id: "users" as const, label: "People", Icon: Users },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              view === id ? "text-sky-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
