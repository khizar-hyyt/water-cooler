import { NextResponse } from "next/server";
import type { AppState } from "@/lib/types";
import { getServerState, setServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

/** One-time merge of legacy localStorage data (no auth). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const legacy = body.legacy as Partial<AppState> | undefined;
    if (!legacy) {
      return NextResponse.json({ error: "No legacy data" }, { status: 400 });
    }

    const remote = await getServerState();
    const merged: AppState = {
      ...remote,
      turns: [...remote.turns, ...(legacy.turns ?? [])].sort((a, b) => a.timestamp - b.timestamp),
      days: { ...remote.days, ...(legacy.days ?? {}) },
      midnightRan: [...remote.midnightRan, ...(legacy.midnightRan ?? [])].filter(
        (d, i, arr) => arr.indexOf(d) === i
      ),
    };

    await setServerState(merged);
    return NextResponse.json({ state: merged });
  } catch (err) {
    console.error("POST /api/migrate", err);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
