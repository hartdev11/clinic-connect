/**
 * Enterprise: ส่งอีเมลยืนยันที่อยู่/โทรศัพท์ (FRANCHISE-MODEL-SPEC)
 * POST — ต้อง login, สิทธิ์ owner/manager
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { isAddressPhoneVerificationEnabled } from "@/lib/feature-flags";
import { createAddressPhoneVerificationToken } from "@/lib/verification-address-phone";
import { sendAddressPhoneVerificationEmail } from "@/lib/email";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["owner", "manager"] as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";

export async function POST() {
  if (!isAddressPhoneVerificationEnabled()) {
    return NextResponse.json(
      { error: "ฟีเจอร์ยืนยันที่อยู่/โทรศัพท์ยังไม่เปิดใช้" },
      { status: 403 }
    );
  }
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, [...ALLOWED_ROLES])) {
    return NextResponse.json(
      { error: "เฉพาะ Owner และ Manager เท่านั้นที่ส่งอีเมลยืนยันได้" },
      { status: 403 }
    );
  }

  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const orgData = orgSnap.data()!;
  const orgName = (orgData.name as string) ?? "";
  const orgEmail = (orgData.email as string) ?? "";
  const orgPhone = (orgData.phone as string) ?? null;
  if (!orgEmail) {
    return NextResponse.json(
      { error: "องค์กรยังไม่มีอีเมล ไม่สามารถส่งลิงก์ยืนยันได้" },
      { status: 400 }
    );
  }

  const branchesSnap = await db.collection("branches").where("org_id", "==", orgId).limit(1).get();
  const firstBranchAddress = branchesSnap.empty
    ? null
    : (branchesSnap.docs[0].data().address as string) ?? null;

  const token = await createAddressPhoneVerificationToken(orgId);
  const now = new Date().toISOString();
  await orgRef.update({
    address_phone_verification_sent_at: now,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const verificationLink = `${APP_URL.replace(/\/$/, "")}/verify-address-phone?token=${encodeURIComponent(token)}`;
  const sent = await sendAddressPhoneVerificationEmail({
    to: orgEmail,
    orgName,
    address: firstBranchAddress,
    phone: orgPhone,
    verificationLink,
  });

  if (!sent.success) {
    return NextResponse.json({
      success: false,
      message: "สร้างลิงก์ยืนยันแล้ว แต่ส่งอีเมลไม่สำเร็จ",
      error: sent.error,
    }, { status: 200 });
  }
  return NextResponse.json({
    success: true,
    message: "ส่งอีเมลยืนยันที่อยู่และเบอร์โทรแล้ว กรุณาตรวจสอบอีเมล",
  });
}
