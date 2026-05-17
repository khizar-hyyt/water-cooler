import { NextResponse } from "next/server";
import { createSessionToken, hashPassword, verifyPassword } from "@/lib/auth";
import { getAuthData, roommateHasPassword, setAuthData } from "@/lib/auth-store";
import { getServerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, roommateId, password } = body as {
      type: "admin" | "roommate";
      roommateId?: string;
      password?: string;
    };

    const auth = await getAuthData();
    const state = await getServerState();

    if (type === "admin") {
      if (auth.adminPasswordHash) {
        if (!password || !verifyPassword(password, auth.adminPasswordHash)) {
          return NextResponse.json({ error: "Wrong admin password" }, { status: 401 });
        }
      } else if (password && password.length >= 4) {
        auth.adminPasswordHash = hashPassword(password);
        await setAuthData(auth);
      }
      const token = createSessionToken({ role: "admin" });
      return NextResponse.json({
        token,
        role: "admin",
        roommate: null,
        needsPasswordSetup: !auth.adminPasswordHash,
      });
    }

    if (type === "roommate") {
      if (!roommateId) {
        return NextResponse.json({ error: "Roommate required" }, { status: 400 });
      }
      const roommate = state.roommates.find((r) => r.id === roommateId);
      if (!roommate) {
        return NextResponse.json({ error: "Roommate not found" }, { status: 404 });
      }
      if (roommateHasPassword(auth, roommateId)) {
        const hash = auth.roommatePasswords[roommateId];
        if (!password || !verifyPassword(password, hash)) {
          return NextResponse.json({ error: "Wrong password" }, { status: 401 });
        }
      } else if (password && password.length >= 4) {
        auth.roommatePasswords[roommateId] = hashPassword(password);
        await setAuthData(auth);
      }
      const token = createSessionToken({ role: "roommate", roommateId });
      return NextResponse.json({
        token,
        role: "roommate",
        roommate,
        needsPasswordSetup: !roommateHasPassword(auth, roommateId),
      });
    }

    return NextResponse.json({ error: "Invalid login type" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/auth/login", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
