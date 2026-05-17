import { NextResponse } from "next/server";
import { getBearerToken, verifySessionToken } from "@/lib/auth";
import { applyMutation, authorizeMutation, type MutateAction } from "@/lib/mutations";
import { getAuthData, setAuthData } from "@/lib/auth-store";
import { getServerState, saveServerState } from "@/lib/server-state";
import { normalizeState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = verifySessionToken(getBearerToken(request));
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await request.json();
    let action = body.action as MutateAction;

    if (action?.type === "updateRoommate" && session.role !== "admin") {
      action = {
        type: "updateRoommate",
        id: action.id,
        patch: {
          ...(action.patch.name !== undefined ? { name: action.patch.name } : {}),
          ...(action.patch.emoji !== undefined ? { emoji: action.patch.emoji } : {}),
        },
      };
    }

    if (!action?.type) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const denied = authorizeMutation(session, action);
    if (denied) {
      return NextResponse.json({ error: denied }, { status: 403 });
    }

    const state = normalizeState(await getServerState());
    const applied = applyMutation(state, action);
    const next = normalizeState({
      ...applied,
      revision: (state.revision ?? 0) + 1,
    });

    if (action.type === "removeRoommate" && next.roommates.length === 0) {
      return NextResponse.json({ error: "At least one roommate required" }, { status: 400 });
    }

    const stored = await saveServerState(next);

    if (action.type === "removeRoommate") {
      const auth = await getAuthData();
      delete auth.roommatePasswords[action.id];
      await setAuthData(auth);
    }

    return NextResponse.json(
      { state: stored },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("POST /api/mutate", err);
    return NextResponse.json({ error: "Mutation failed" }, { status: 500 });
  }
}
