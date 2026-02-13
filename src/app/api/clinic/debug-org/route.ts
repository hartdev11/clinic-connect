/**
 * Debug API — ตรวจสอบว่า LINE_ORG_ID ตรงกับ org ของ session หรือไม่
 * ใช้สำหรับแก้ปัญหา "ไม่เห็นลูกค้า/แชท ใน Customers & Chat"
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sessionOrgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    const lineOrgId = process.env.LINE_ORG_ID?.trim() || null;

    return NextResponse.json({
      sessionOrgId: sessionOrgId ?? null,
      lineOrgId,
      match: !!sessionOrgId && !!lineOrgId && sessionOrgId === lineOrgId,
      lineOrgIdSet: !!lineOrgId,
    });
  } catch (err) {
    console.error("GET /api/clinic/debug-org:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
