/**
 * Enterprise: ยืนยันที่อยู่/โทรจากลิงก์ในอีเมล (GET) — ใช้ token แล้ว redirect
 */
import { NextRequest, NextResponse } from "next/server";
import { getOrgIdByAddressPhoneToken, consumeAddressPhoneToken } from "@/lib/verification-address-phone";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";
const SUCCESS_PATH = "/login";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  const baseUrl = APP_URL || request.nextUrl.origin;
  const successUrl = new URL(SUCCESS_PATH, baseUrl);
  successUrl.searchParams.set("address_phone_verified", "1");
  const failUrl = new URL(SUCCESS_PATH, baseUrl);
  failUrl.searchParams.set("error", "invalid_address_phone_token");

  if (!token) {
    return NextResponse.redirect(failUrl);
  }

  const orgId = await getOrgIdByAddressPhoneToken(token);
  if (!orgId) {
    return NextResponse.redirect(failUrl);
  }

  const now = new Date().toISOString();
  await db.collection("organizations").doc(orgId).update({
    address_phone_verified_at: now,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await consumeAddressPhoneToken(token);
  writeAuditLog({
    event: "address_phone_verified",
    org_id: orgId,
    details: { verified_at: now },
  }).catch(() => {});

  return NextResponse.redirect(successUrl);
}
