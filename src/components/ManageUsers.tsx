"use client";

import { useState } from "react";
import { useAppState } from "@/lib/AppStateContext";
import { COLOR_OPTIONS, EMOJI_OPTIONS } from "@/lib/store";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";

function clx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

export default function ManageUsers() {
  const { state, addRoommate, updateRoommate, removeRoommate, saving } = useAppState();
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState(EMOJI_OPTIONS[0]);
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setMessage(null);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateRoommate(id, { name: editName });
    setEditingId(null);
    setMessage(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setMessage("Enter a name");
      return;
    }
    await addRoommate(newName, newEmoji, newColor);
    setNewName("");
    setMessage(null);
  };

  const handleRemove = async (id: string, name: string) => {
    if (state.roommates.length <= 1) {
      setMessage("You need at least one person");
      return;
    }
    if (!confirm(`Remove ${name}? Their past turns stay in history.`)) return;
    const ok = await removeRoommate(id);
    if (!ok) setMessage("Could not remove — keep at least one person");
    else setMessage(null);
  };

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-lg font-bold text-white">Roommates</h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Changes sync to every phone and browser using this app.
        </p>
      </div>

      {message && (
        <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {message}
        </p>
      )}

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-2">
        {state.roommates.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: r.color + "25", border: `1px solid ${r.color}40` }}
            >
              {r.emoji}
            </span>
            {editingId === r.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(r.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <button
                  onClick={() => saveEdit(r.id)}
                  disabled={saving}
                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-2 rounded-lg bg-slate-800 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium text-white text-sm">{r.name}</span>
                <button
                  onClick={() => startEdit(r.id, r.name)}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleRemove(r.id, r.name)}
                  disabled={state.roommates.length <= 1 || saving}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Add person</p>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm mb-3"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <p className="text-slate-500 text-xs mb-2">Emoji</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setNewEmoji(e)}
              className={clx(
                "w-10 h-10 rounded-xl text-lg border transition-all",
                newEmoji === e ? "border-sky-500 bg-sky-500/20" : "border-slate-700 bg-slate-800"
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <p className="text-slate-500 text-xs mb-2">Color</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={clx(
                "w-8 h-8 rounded-full border-2 transition-all",
                newColor === c ? "border-white scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add roommate
        </button>
      </div>
    </div>
  );
}