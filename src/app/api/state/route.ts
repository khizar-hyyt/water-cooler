import { NextResponse } from "next/server";
import { AppState, createDefaultState } from "@/lib/types";
import { getServerState, setServerState, storageMode } from "@/lib/server-state";

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

export async function PUT(request: Request) {
  try {
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

export async function POST() {
  try {
    const existing = await getServerState();
    const isEmpty =
      existing.turns.length === 0 &&
      Object.keys(existing.days).length === 0 &&
      existing.roommates.every((r, i) => {
        const d = createDefaultState().roommates[i];
        return d && r.id === d.id && r.name === d.name;
      });
    if (!isEmpty) {
      return NextResponse.json({ state: existing, storage: storageMode() });
    }
    const state = createDefaultState();
    await setServerState(state);
    return NextResponse.json({ state, storage: storageMode() });
  } catch (err) {
    console.error("POST /api/state", err);
    return NextResponse.json({ error: "Failed to init state" }, { status: 500 });
  }
}
