"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Roommate, Score,
  getAttendanceStatus, getTurnsForDate,
  getScores, getSuggestedNext, getDayTimeline,
  findRoommate, today, addDays,
} from "@/lib/store";
import type { TimelineItem } from "@/lib/types";
import { useAppState } from "@/lib/AppStateContext";
import LoginScreen from "@/components/LoginScreen";
import ManageUsers from "@/components/ManageUsers";
import ProfileSettings from "@/components/ProfileSettings";
import { ADMIN_PROFILE } from "@/lib/session-client";
import {
  Droplets, CheckCircle2, Home, Plane, Crown,
  RefreshCw, LogOut, LayoutDashboard, Calendar,
  ChevronLeft, ChevronRight, AlertCircle, Zap,
  Users, Shield, UserCircle, RotateCcw, Minus, Plus,
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

function balanceLabel(s: Score) {
  if (s.credit > 0) return `${s.credit} fill${s.credit === 1 ? "" : "s"} credit`;
  if (s.pending > 0) return `${s.pending} fill${s.pending === 1 ? "" : "s"} owed`;
  return "even";
}

function balanceClass(s: Score) {
  if (s.credit > 0) return "text-emerald-400";
  if (s.pending > 0) return "text-rose-400";
  return "text-slate-500";
}

function AdminBalanceAdjust({
  score,
  disabled,
  onChange,
}: {
  score: Score;
  disabled?: boolean;
  onChange: (balance: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(score.balance - 1)}
        disabled={disabled}
        aria-label={`Less owed / more credit for ${score.roommate.name}`}
        className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-30"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className={clx("text-[10px] font-bold w-16 text-center tabular-nums leading-tight", balanceClass(score))}>
        {balanceLabel(score)}
      </span>
      <button
        type="button"
        onClick={() => onChange(score.balance + 1)}
        disabled={disabled}
        aria-label={`More owed / less credit for ${score.roommate.name}`}
        className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-30"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function PendingForAll({ scores, highlightId }: { scores: Score[]; highlightId?: string }) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Balance (everyone)</p>
      <div className="space-y-2">
        {scores.map((s) => (
          <div
            key={s.roommate.id}
            className={clx(
              "flex items-center gap-3 rounded-xl px-3 py-2 border",
              s.roommate.id === highlightId ? "border-sky-500/40 bg-sky-500/10" : "border-slate-800 bg-slate-800/50"
            )}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: s.roommate.color + "25", border: `1px solid ${s.roommate.color}40` }}
            >
              {s.roommate.emoji}
            </span>
            <span className="flex-1 text-sm text-white font-medium">{s.roommate.name}</span>
            <span className={clx("text-sm font-bold tabular-nums", balanceClass(s))}>
              {balanceLabel(s)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminAttendance({ scores, onSet }: {
  scores: Score[];
  onSet: (id: string, status: "present" | "away") => void;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-violet-500/30">
      <p className="text-violet-300 text-xs uppercase tracking-widest mb-3 flex items-center gap-1">
        <Shield className="w-3.5 h-3.5" /> Everyone&apos;s status (admin)
      </p>
      <div className="space-y-2">
        {scores.map((s) => (
          <div key={s.roommate.id} className="flex items-center gap-2">
            <span className="text-sm text-white flex-1 truncate">{s.roommate.emoji} {s.roommate.name}</span>
            {(["present", "away"] as const).map((st) => (
              <button
                key={st}
                onClick={() => onSet(s.roommate.id, st)}
                className={clx(
                  "px-2.5 py-1 rounded-lg text-xs border",
                  (s.isPresent ? "present" : "away") === st
                    ? st === "present"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-500 border-slate-700"
                )}
              >
                {st === "present" ? "In" : "Away"}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentTimeline({ items, state }: { items: TimelineItem[]; state: ReturnType<typeof useAppState>["state"] }) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Recent</p>
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => {
          if (item.type === "activity") {
            return (
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/15 border border-violet-500/30">
                  <Shield className="w-4 h-4 text-violet-300" />
                </span>
                <span className="text-violet-200 text-sm flex-1">{item.message}</span>
                <span className="text-slate-500 text-xs shrink-0">{fmt(item.timestamp)}</span>
              </div>
            );
          }
          const r = findRoommate(state, item.roommateId);
          return (
            <div key={item.id} className="flex items-center gap-3">
              <span className="text-base">{r?.emoji ?? "💧"}</span>
              <span className="text-white text-sm flex-1">{r?.name ?? "Removed"} filled water</span>
              <span className="text-slate-500 text-xs">{fmt(item.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard({ user, isAdmin }: { user: Roommate; isAdmin: boolean }) {
  const { state, addTurn, removeLastTurn, setAttendance, runMidnightCalc, resetDay, setTurnCount, setBalance, refresh, saving } =
    useAppState();
  const [justMarked, setJustMarked] = useState(false);
  const [marking, setMarking] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const date = today();

  const scores = useMemo(() => getScores(state, date), [state, date]);
  const timeline = useMemo(() => getDayTimeline(state, date), [state, date]);
  const myStatus = useMemo(
    () => getAttendanceStatus(state, date, user.id),
    [state, date, user.id]
  );

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0);
    const timer = setTimeout(() => {
      const dayJustEnded = addDays(today(), -1);
      runMidnightCalc(dayJustEnded)
        .then(() => refresh())
        .catch(() => {});
    }, midnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [runMidnightCalc, refresh]);

  const handleAttendance = async (status: "present" | "away") => {
    await setAttendance(date, user.id, status);
  };

  const handleMark = async () => {
    if (marking || myStatus === "away") return;
    setMarking(true);
    await new Promise((r) => setTimeout(r, 300));
    await addTurn(user.id, date);
    setJustMarked(true);
    setMarking(false);
    setTimeout(() => setJustMarked(false), 2000);
  };

  const handleUndoLast = async () => {
    if (undoing || myTurns <= 0 || myStatus === "away") return;
    if (!confirm("Remove your most recent fill for today?")) return;
    setUndoing(true);
    try {
      await removeLastTurn(user.id, date);
    } finally {
      setUndoing(false);
    }
  };

  const suggested = getSuggestedNext(scores);
  const myScore = scores.find((s) => s.roommate.id === user.id);
  const myTurns = myScore?.turns ?? 0;
  const myPending = myScore?.pending ?? 0;
  const myCredit = myScore?.credit ?? 0;
  const presentCount = scores.filter((s) => s.isPresent).length;

  const setAnyoneAttendance = async (id: string, status: "present" | "away") => {
    await setAttendance(date, id, status);
  };

  const handleResetDay = async () => {
    if (!confirm("Reset today? All turns and attendance will be cleared for everyone.")) return;
    setResetting(true);
    try {
      await resetDay(date);
    } finally {
      setResetting(false);
    }
  };

  const handleAdjustTurns = async (roommateId: string, count: number) => {
    await setTurnCount(date, roommateId, Math.max(0, count));
  };

  const handleSetBalance = async (roommateId: string, balance: number) => {
    await setBalance(date, roommateId, balance);
  };

  const maxTurns = Math.max(...scores.map((s) => s.turns), 1);

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-lg font-bold text-white">{fmtDate(date)}</h2>
        <p className="text-slate-500 text-xs">{presentCount} roommates present today</p>
      </div>

      {isAdmin && <AdminAttendance scores={scores} onSet={setAnyoneAttendance} />}

      {isAdmin && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-violet-500/30">
          <p className="text-violet-300 text-xs uppercase tracking-widest mb-3 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Day controls
          </p>
          <button
            type="button"
            onClick={handleResetDay}
            disabled={resetting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
          >
            <RotateCcw className={clx("w-4 h-4", resetting && "animate-spin")} />
            {resetting ? "Resetting…" : "Reset today"}
          </button>
          <p className="text-slate-500 text-xs mt-2">
            Use +/− on fills or owed/credit under each name. Set someone owed or in credit even at 0 fills. Changes sync for everyone.
          </p>
        </div>
      )}

      {!isAdmin && (
      <>
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
        {myStatus === "away" && (myCredit > 0 || myPending > 0) && (
          <p className="text-amber-300/90 text-xs mt-3">
            Your owed/credit is frozen while away. It only updates at midnight after you&apos;re back as present.
          </p>
        )}
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
              {myPending} owed
            </div>
          )}
          {myCredit > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-1 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {myCredit} credit
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
        {myTurns > 0 && myStatus === "present" && (
          <button
            type="button"
            onClick={handleUndoLast}
            disabled={undoing || saving}
            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {undoing ? "Removing…" : "Undo last fill"}
          </button>
        )}
      </div>
      </>
      )}

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
                {suggested.turns} turns · {balanceLabel(suggested)}
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
              {isAdmin ? (
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 w-8">Fills</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustTurns(s.roommate.id, s.turns - 1)}
                      disabled={s.turns <= 0 || saving}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-30"
                      aria-label={`Decrease ${s.roommate.name} turns`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-white text-lg w-6 text-center tabular-nums">{s.turns}</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustTurns(s.roommate.id, s.turns + 1)}
                      disabled={saving}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 disabled:opacity-30"
                      aria-label={`Increase ${s.roommate.name} fills`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <AdminBalanceAdjust
                    score={s}
                    disabled={saving}
                    onChange={(bal) => handleSetBalance(s.roommate.id, bal)}
                  />
                </div>
              ) : (
                <div className="text-right shrink-0">
                  <span className="font-bold text-white text-lg">{s.turns}</span>
                  <p className={clx("text-xs", balanceClass(s))}>{balanceLabel(s)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <PendingForAll scores={scores} highlightId={isAdmin ? undefined : user.id} />

      {timeline.length > 0 && <RecentTimeline items={timeline} state={state} />}
    </div>
  );
}

function History({ isAdmin }: { isAdmin: boolean }) {
  const { state, setTurnCount, setAttendance, setBalance, recalculateFromDate, saving } = useAppState();
  const [date, setDate] = useState(today);
  const [recalculating, setRecalculating] = useState(false);

  const turns = getTurnsForDate(state, date);
  const scores = getScores(state, date);
  const presentCount = scores.filter((s) => s.isPresent).length;
  const totalFills = turns.length;
  const dayTarget = presentCount > 0 ? Math.round(totalFills / presentCount) : 0;
  const isPastDay = date < today();

  const move = (dir: number) => {
    const next = addDays(date, dir);
    if (next <= today()) setDate(next);
  };

  const handleAdjust = async (roommateId: string, count: number) => {
    await setTurnCount(date, roommateId, Math.max(0, count));
  };

  const handleSetBalance = async (roommateId: string, balance: number) => {
    await setBalance(date, roommateId, balance);
  };

  const handleAttendance = async (id: string, status: "present" | "away") => {
    await setAttendance(date, id, status);
  };

  const handleRecalc = async () => {
    if (!confirm(`Recalculate everyone's owed/credit from ${date} through today?`)) return;
    setRecalculating(true);
    try {
      await recalculateFromDate(date);
    } finally {
      setRecalculating(false);
    }
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

      {isAdmin && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-violet-500/30">
          <p className="text-violet-300 text-xs uppercase tracking-widest mb-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Edit this day (admin)
          </p>
          <p className="text-slate-500 text-xs mb-3">
            Adjust fills, owed/credit (+/−), or attendance. Past-day edits auto-update today&apos;s balances. Target
            {presentCount > 0 ? `: target ${dayTarget} fill${dayTarget === 1 ? "" : "s"} each` : ": n/a"}.
          </p>
          {isPastDay && (
            <button
              type="button"
              onClick={handleRecalc}
              disabled={recalculating || saving}
              className="w-full py-2 rounded-xl text-sm font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50"
            >
              {recalculating ? "Recalculating…" : "Recalculate owed/credit from this day → today"}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Fills", value: turns.length, color: "text-sky-400" },
          { label: "Present", value: scores.filter((s) => s.isPresent).length, color: "text-emerald-400" },
          {
            label: "Pending",
            value: scores.reduce((s, x) => s + x.pending, 0),
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
                {(s.pending > 0 || s.credit > 0) && (
                  <p className={clx("text-xs", balanceClass(s))}>{balanceLabel(s)}</p>
                )}
                {isAdmin && (
                  <div className="flex gap-1 mt-2">
                    {(["present", "away"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleAttendance(s.roommate.id, st)}
                        className={clx(
                          "px-2 py-0.5 rounded text-[10px] border",
                          (s.isPresent ? "present" : "away") === st
                            ? st === "present"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-slate-800 text-slate-500 border-slate-700"
                        )}
                      >
                        {st === "present" ? "In" : "Away"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin ? (
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAdjust(s.roommate.id, s.turns - 1)}
                      disabled={s.turns <= 0 || saving}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 disabled:opacity-30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-white text-lg w-6 text-center tabular-nums">{s.turns}</span>
                    <button
                      type="button"
                      onClick={() => handleAdjust(s.roommate.id, s.turns + 1)}
                      disabled={saving}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <AdminBalanceAdjust
                    score={s}
                    disabled={saving}
                    onChange={(bal) => handleSetBalance(s.roommate.id, bal)}
                  />
                </div>
              ) : (
                <span className="font-bold text-xl text-white shrink-0">{s.turns}</span>
              )}
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
  const { state, loading, error, saving, session, isAdmin, persistent, logout } = useAppState();
  const [view, setView] = useState<"dash" | "history" | "users" | "profile">("dash");
  const [setupPassword, setSetupPassword] = useState(false);

  const user: Roommate = isAdmin
    ? { id: ADMIN_PROFILE.id, name: ADMIN_PROFILE.name, emoji: ADMIN_PROFILE.emoji, color: ADMIN_PROFILE.color }
    : session?.roommate!;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Droplets className="w-8 h-8 text-sky-500 animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onLoggedIn={(needsSetup) => {
          setView("dash");
          if (needsSetup) setSetupPassword(true);
        }}
      />
    );
  }

  if (!isAdmin && session.roommate && !state.roommates.find((r) => r.id === session.roommate!.id)) {
    logout();
    return null;
  }

  const navItems = isAdmin
    ? ([
        { id: "dash" as const, label: "Dashboard", Icon: LayoutDashboard },
        { id: "history" as const, label: "History", Icon: Calendar },
        { id: "users" as const, label: "People", Icon: Users },
        { id: "profile" as const, label: "Admin", Icon: Shield },
      ] as const)
    : ([
        { id: "dash" as const, label: "Dashboard", Icon: LayoutDashboard },
        { id: "history" as const, label: "History", Icon: Calendar },
        { id: "profile" as const, label: "Profile", Icon: UserCircle },
      ] as const);

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
            onClick={() => logout()}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {setupPassword && (
        <p className="text-center text-amber-300 text-xs py-2 px-4 bg-amber-500/10 border-b border-amber-500/20">
          Set a password in Profile to secure your account.
          <button className="ml-2 underline" onClick={() => setSetupPassword(false)}>Dismiss</button>
        </p>
      )}

      {!persistent && (
        <p className="text-center text-amber-300 text-xs py-2 px-4 bg-amber-500/10 border-b border-amber-500/20">
          Shared storage is not connected. Connect Upstash Redis in Vercel → Storage, then redeploy.
        </p>
      )}

      {error && (
        <p className="text-center text-rose-400 text-xs py-2 px-4 bg-rose-500/10 border-b border-rose-500/20">
          {error}
        </p>
      )}

      <main className="flex-1 px-4 pt-5 overflow-y-auto">
        {view === "dash" && <Dashboard user={user} isAdmin={isAdmin} />}
        {view === "history" && <History isAdmin={isAdmin} />}
        {view === "users" && isAdmin && <ManageUsers />}
        {view === "profile" && <ProfileSettings isAdmin={isAdmin} />}
      </main>

      <nav className="sticky bottom-0 bg-slate-950/90 backdrop-blur border-t border-slate-800 flex h-16">
        {navItems.map(({ id, label, Icon }) => (
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
