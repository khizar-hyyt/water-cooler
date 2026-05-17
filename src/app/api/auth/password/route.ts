import { NextResponse } from "next/server";
import { getBearerToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/auth";
import { getAuthData, roommateHasPassword, setAuthData } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = verifySessionToken(getBearerToken(request));
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    const auth = await getAuthData();

    if (session.role === "admin") {
      if (auth.adminPasswordHash) {
        if (!currentPassword || !verifyPassword(currentPassword, auth.adminPasswordHash)) {
          return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
        }
      }
      auth.adminPasswordHash = hashPassword(newPassword);
      await setAuthData(auth);
      return NextResponse.json({ ok: true });
    }

    const id = session.roommateId!;
    const existing = auth.roommatePasswords[id];
    if (existing) {
      if (!currentPassword || !verifyPassword(currentPassword, existing)) {
        return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
      }
    }

    auth.roommatePasswords[id] = hashPassword(newPassword);
    await setAuthData(auth);
    return NextResponse.json({
      ok: true,
      hasPassword: roommateHasPassword(auth, id),
    });
  } catch (err) {
    console.error("POST /api/auth/password", err);
    return NextResponse.json({ error: "Could not update password" }, { status: 500 });
  }
}
