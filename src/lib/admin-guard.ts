/**
 * Strict Admin API Isolation
 * ทุก /api/admin/* ต้อง verify session + require admin role
 * ดึง org_id จาก session เท่านั้น — ห้ามรับจาก client
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getUserById } from "@/lib/clinic-data";

const ADMIN_ROLES = ["owner"] as const; // เฉพาะ owner เป็น admin สำหรับตอนนี้

export interface AdminSession {
  org_id: string;
  user_id: string;
  email: string;
  role: string;
}

/**
 * ตรวจ session + admin role
 * คืนค่า session payload หรือ null ถ้าไม่ผ่าน
 */
export async function requireAdminSession(): Promise<{
  ok: true;
  session: AdminSession;
} | { ok: false; response: NextResponse }> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const org_id = session.org_id;
  if (!org_id) {
    return { ok: false, response: NextResponse.json({ error: "Organization required" }, { status: 403 }) };
  }
  const user_id = session.user_id ?? session.clinicId;
  if (!user_id) {
    return { ok: false, response: NextResponse.json({ error: "User required" }, { status: 403 }) };
  }
  const user = await getUserById(user_id);
  if (user) {
    if (user.org_id !== org_id) {
      return { ok: false, response: NextResponse.json({ error: "User not found" }, { status: 403 }) };
    }
    if (!ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
      return { ok: false, response: NextResponse.json({ error: "Admin role required" }, { status: 403 }) };
    }
  } else {
    const { db } = await import("@/lib/firebase-admin");
    const orgDoc = await db.collection("organizations").doc(org_id).get();
    const orgData = orgDoc.data();
    if (!orgDoc.exists || orgData?.email?.toLowerCase() !== session.email?.toLowerCase()) {
      return { ok: false, response: NextResponse.json({ error: "Admin role required" }, { status: 403 }) };
    }
  }
  return {
    ok: true,
    session: { org_id, user_id, email: session.email, role: user?.role ?? "owner" },
  };
}
