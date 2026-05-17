import { NextResponse } from "next/server";
import { getAuthData, roommateHasPassword } from "@/lib/auth-store";
import { getServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthData();
    const state = await getServerState();
    const roommateLocks: Record<string, boolean> = {};
    for (const r of state.roommates) {
      roommateLocks[r.id] = roommateHasPassword(auth, r.id);
    }
    return NextResponse.json({
      adminConfigured: Boolean(auth.adminPasswordHash),
      roommateLocks,
    });
  } catch (err) {
    console.error("GET /api/auth/status", err);
    return NextResponse.json({ error: "Failed to load auth status" }, { status: 500 });
  }
}
