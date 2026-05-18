import { NextResponse } from "next/server";
import { getBearerToken, verifySessionToken } from "@/lib/auth";
import { syncCarryChain } from "@/lib/store";
import { calendarToday, resolveTimeZone } from "@/lib/timezone";
import { getServerState, isPersistentStorage, saveServerState, setServerState, storageMode } from "@/lib/server-state";
import { normalizeState, type AppState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const calToday = calendarToday(resolveTimeZone(request));
    const raw = normalizeState(await getServerState());
    const maintained = syncCarryChain(raw, calToday);
    const state =
      JSON.stringify(maintained) !== JSON.stringify(raw)
        ? await saveServerState({
            ...maintained,
            revision: (raw.revision ?? 0) + 1,
          })
        : raw;
    return NextResponse.json(
      { state, storage: storageMode(), persistent: isPersistentStorage() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("GET /api/state", err);
    return NextResponse.json({ error: "Failed to load state" }, { status: 500 });
  }
}

/** Admin-only full state replace (rare). Prefer /api/mutate. */
export async function PUT(request: Request) {
  try {
    const session = verifySessionToken(getBearerToken(request));
    if (session?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = (await request.json()) as AppState;
    if (!body || !Array.isArray(body.roommates) || !Array.isArray(body.turns)) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
    const state = normalizeState(body);
    if (state.roommates.length === 0) {
      return NextResponse.json({ error: "At least one roommate required" }, { status: 400 });
    }
    await setServerState(state);
    return NextResponse.json({ state, storage: storageMode() });
  } catch (err) {
    console.error("PUT /api/state", err);
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }
}
