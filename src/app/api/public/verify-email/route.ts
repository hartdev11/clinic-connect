/**
 * Enterprise: ยืนยันอีเมลจาก token ในลิงก์ (GET) — แล้ว redirect ไป /login
 */
import { NextRequest, NextResponse } from "next/server";
import { getPurchaseRecordByVerificationToken, markEmailVerified } from "@/lib/purchase-record";

const LOGIN_URL = "/login";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? request.nextUrl.origin;
  const loginUrl = new URL(LOGIN_URL, baseUrl);
  if (!token) {
    loginUrl.searchParams.set("error", "missing_token");
    return NextResponse.redirect(loginUrl);
  }
  const record = await getPurchaseRecordByVerificationToken(token);
  if (!record) {
    loginUrl.searchParams.set("error", "invalid_token");
    return NextResponse.redirect(loginUrl);
  }
  if (record.email_verified) {
    loginUrl.searchParams.set("verified", "1");
    return NextResponse.redirect(loginUrl);
  }
  await markEmailVerified(record.id);
  loginUrl.searchParams.set("verified", "1");
  return NextResponse.redirect(loginUrl);
}
