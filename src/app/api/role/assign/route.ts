import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireProxySession } from "@/lib/phase-proxy";
import { db } from "@/lib/firebase-admin";
import type { UserRole } from "@/types/organization";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const role = sessionResult.context.session.role;
  const allowed = role === "clinic_owner" || role === "platform_admin" || role === "owner" || role === "super_admin";
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden", code: "INSUFFICIENT_ROLE" },
      { status: 403 }
    );
  }
  const payload = await request.json().catch(() => ({}));
  const userId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  const roleToAssign = typeof payload.role === "string" ? payload.role.trim() : "";
  if (!userId || !roleToAssign) {
    return NextResponse.json({ error: "user_id and role required" }, { status: 400 });
  }
  if (!["super_admin", "owner", "manager", "staff"].includes(roleToAssign)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  const orgId = String(userDoc.data()?.org_id ?? "");
  if (orgId !== sessionResult.context.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await userRef.update({ role: roleToAssign as UserRole, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
