/**
 * สร้าง Firebase custom token สำหรับ client — ใช้ Realtime Listeners
 * คืนค่า token + org_id ให้ client signInWithCustomToken แล้ว query Firestore
 */
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const uid = `web_${orgId}_${session.user_id ?? session.clinicId}`;
    const auth = getAuth(getFirebaseAdmin());
    const token = await auth.createCustomToken(uid, { org_id: orgId });

    return NextResponse.json({ token, org_id: orgId });
  } catch (err) {
    console.error("GET /api/auth/firebase-token:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
