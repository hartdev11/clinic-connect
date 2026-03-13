/**
 * Phase 10 — Validate invite token (GET)
 */
import { NextRequest, NextResponse } from "next/server";
import { getInviteByToken } from "@/lib/invites";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, error: "token required" }, { status: 400 });
  }

  const result = await getInviteByToken(token);
  if (!result) {
    return NextResponse.json({ valid: false, error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    email: result.invite.email,
    role: result.invite.role,
  });
}
