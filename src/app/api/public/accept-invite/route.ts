/**
 * Phase 10 — Accept staff invite (magic link)
 * POST: validate token, create user, mark invite used
 */
import { NextRequest, NextResponse } from "next/server";
import { getInviteByToken, markInviteUsed } from "@/lib/invites";
import { createUser } from "@/lib/clinic-data";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : null;
  const password = typeof b.password === "string" ? b.password : "";

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const result = await getInviteByToken(token);
  if (!result) {
    return NextResponse.json(
      { error: "ลิงก์ไม่ถูกต้อง หมดอายุ หรือใช้ไปแล้ว" },
      { status: 400 }
    );
  }

  const { orgId, invite } = result;

  const existing = await (async () => {
    const { getUsersByOrgId } = await import("@/lib/clinic-data");
    const users = await getUsersByOrgId(orgId);
    return users.some((u) => u.email === invite.email);
  })();

  if (existing) {
    return NextResponse.json({ error: "อีเมลนี้มีในระบบแล้ว กรุณาเข้าสู่ระบบ" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const defaultBranch =
    invite.branch_roles ? Object.keys(invite.branch_roles)[0] ?? null : invite.branch_ids?.[0] ?? invite.branchId ?? null;

  await createUser({
    org_id: orgId,
    email: invite.email,
    passwordHash,
    role: invite.role,
    name: name || null,
    branch_ids: invite.branch_ids ?? null,
    branch_roles: invite.branch_roles ?? null,
    default_branch_id: defaultBranch ?? null,
  });

  await markInviteUsed(orgId, token);

  return NextResponse.json({
    success: true,
    message: "ตั้งรหัสผ่านสำเร็จ — กรุณาเข้าสู่ระบบ",
  });
}
