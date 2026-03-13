/**
 * Phase 9 — Super Admin guard
 * สำหรับ /admin/* routes — เฉพาะ super_admin เท่านั้น
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getUserById } from "@/lib/clinic-data";

export interface SuperAdminSession {
  user_id: string;
  email: string;
}

export async function requireSuperAdminSession(): Promise<
  | { ok: true; session: SuperAdminSession }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const user_id = session.user_id ?? session.clinicId;
  if (!user_id) {
    return { ok: false, response: NextResponse.json({ error: "User required" }, { status: 403 }) };
  }
  const user = await getUserById(user_id);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "User not found" }, { status: 403 }) };
  }
  if (user.role !== "super_admin") {
    return { ok: false, response: NextResponse.json({ error: "Super admin required" }, { status: 403 }) };
  }
  return {
    ok: true,
    session: { user_id, email: user.email ?? session.email ?? "" },
  };
}
