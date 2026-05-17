import { NextResponse } from "next/server";
import { normalizeState, type AppState } from "@/lib/types";
import { getServerState, setServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

function remoteHasData(state: AppState): boolean {
  return state.turns.length > 0 || Object.keys(state.days).length > 0 || (state.activities?.length ?? 0) > 0;
}

/** One-time import of legacy localStorage — only when shared server state is still empty. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const legacy = body.legacy as Partial<AppState> | undefined;
    if (!legacy) {
      return NextResponse.json({ error: "No legacy data" }, { status: 400 });
    }

    const remote = normalizeState(await getServerState());
    if (remoteHasData(remote)) {
      return NextResponse.json({ state: remote, skipped: true });
    }

    const merged = normalizeState({
      ...remote,
      turns: legacy.turns ?? [],
      days: legacy.days ?? {},
      midnightRan: legacy.midnightRan ?? [],
      activities: legacy.activities ?? [],
    });

    await setServerState(merged);
    return NextResponse.json({ state: merged });
  } catch (err) {
    console.error("POST /api/migrate", err);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
