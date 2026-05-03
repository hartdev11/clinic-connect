import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user_id;
  const userDoc = userId ? await db.collection("users").doc(userId).get() : null;
  const user = userDoc?.exists ? userDoc.data() : null;
  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      email: session.email,
      org_id: session.org_id,
      branch_id: session.branch_id,
      role: session.role ?? (typeof user?.role === "string" ? user.role : null),
    },
  });
}
