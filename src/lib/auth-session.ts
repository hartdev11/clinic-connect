import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/session";

/**
 * E1.6 — Session payload สำหรับ RBAC / Subscription
 * - user_id: ผู้ใช้ (null จนกว่าจะมี RBAC)
 * - org_id: องค์กร
 * - branch_id: สาขา (optional)
 * - clinicId: legacy (sub) — ใช้ fallback ถ้า org_id ยังไม่มี
 */
export interface SessionPayload {
  clinicId: string;
  email: string;
  org_id: string | null;
  branch_id: string | null;
  user_id: string | null;
}

function toSessionPayload(payload: Awaited<ReturnType<typeof verifyToken>>): SessionPayload | null {
  if (!payload) return null;
  return {
    clinicId: payload.sub,
    email: payload.email,
    org_id: payload.org_id ?? null,
    branch_id: payload.branch_id ?? null,
    user_id: payload.user_id ?? null,
  };
}

/**
 * ดึง session จาก request (API route) — ใช้ cookie clinic_session
 * Return null ถ้าไม่มี token หรือ verify ไม่ผ่าน
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return toSessionPayload(payload);
}

/**
 * ดึง session จาก Next.js cookies() (server component / server action)
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return toSessionPayload(payload);
}

