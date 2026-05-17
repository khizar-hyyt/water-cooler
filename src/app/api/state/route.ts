import { NextResponse } from "next/server";
import { getBearerToken, verifySessionToken } from "@/lib/auth";
import { getServerState, setServerState, storageMode } from "@/lib/server-state";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getServerState();
    return NextResponse.json({ state, storage: storageMode() });
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
    const state: AppState = {
      roommates: body.roommates,
      turns: body.turns,
      days: body.days ?? {},
      midnightRan: body.midnightRan ?? [],
    };
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
