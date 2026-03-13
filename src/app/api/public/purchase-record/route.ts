/**
 * Enterprise: บันทึกการซื้อแพ็คเกจ (ฟรี) + ส่งอีเมลยืนยันการซื้อและลิงก์ยืนยันอีเมล
 * Franchise: ถ้า franchiseSub + mainBranchCode → สร้าง purchase_record + franchise_join_request (pending), แจ้งสาขาหลัก
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { createPurchaseRecord } from "@/lib/purchase-record";
import { sendPurchaseConfirmation, buildVerificationLink } from "@/lib/email";
import { sendFranchiseSubPurchaseNotifyMain } from "@/lib/email";
import { getMainOrgIdByInviteCode } from "@/lib/franchise";
import { getSubscriptionByOrgId } from "@/lib/clinic-data";
import { FRANCHISE_JOIN_REQUESTS_COLLECTION } from "@/types/organization";
import type { OrgPlan } from "@/types/organization";

const DEVICE_ID_COOKIE = "cc_device_id";
const VALID_PLANS: OrgPlan[] = ["starter", "professional", "multi_branch", "enterprise"];

export const dynamic = "force-dynamic";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(request: NextRequest) {
  const deviceId = request.cookies.get(DEVICE_ID_COOKIE)?.value?.trim();
  if (!deviceId) {
    return NextResponse.json(
      { error: "ไม่พบ device_id กรุณารีเฟรชหน้าแล้วลองใหม่" },
      { status: 400 }
    );
  }
  let body: {
    email?: string;
    plan?: string;
    franchiseSub?: boolean;
    mainBranchCode?: string;
    sub_name?: string;
    sub_address?: string;
    sub_phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body ไม่ถูกต้อง" }, { status: 400 });
  }
  const email = body.email?.trim();
  const plan = (body.plan ?? "starter").toLowerCase() as OrgPlan;
  const franchiseSub = Boolean(body.franchiseSub);
  const mainBranchCode = typeof body.mainBranchCode === "string" ? body.mainBranchCode.trim().toUpperCase() : "";
  const subName = (body.sub_name ?? "").toString().trim();
  if (!email) {
    return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "แพ็คเกจไม่ถูกต้อง" }, { status: 400 });
  }
  if (franchiseSub && !mainBranchCode) {
    return NextResponse.json(
      { error: "กรุณากรอกรหัสสาขาหลักเมื่อลงทะเบียนเป็นสาขาย่อย" },
      { status: 400 }
    );
  }
  if (franchiseSub && !subName) {
    return NextResponse.json(
      { error: "กรุณากรอกชื่อสาขาเมื่อลงทะเบียนเป็นสาขาย่อย" },
      { status: 400 }
    );
  }

  try {
    const record = await createPurchaseRecord({
      device_id: deviceId,
      email,
      plan,
    });

    if (franchiseSub && mainBranchCode) {
      const mainOrgId = await getMainOrgIdByInviteCode(mainBranchCode);
      if (!mainOrgId) {
        return NextResponse.json(
          { error: "รหัสสาขาหลักไม่ถูกต้องหรือไม่มีในระบบ" },
          { status: 400 }
        );
      }
      const mainSubscription = await getSubscriptionByOrgId(mainOrgId);
      if (mainSubscription?.status === "active") {
        return NextResponse.json(
          {
            error: "สาขาหลักมีแพ็คเกจอยู่แล้ว สาขาย่อยใช้สิทธิ์จากสาขาหลัก ไม่ต้องซื้อแยก กรุณาติดต่อเจ้าของสาขาหลักเพื่อลงทะเบียนสาขาย่อย",
          },
          { status: 400 }
        );
      }
      const now = FieldValue.serverTimestamp();
      const requestRef = db.collection(FRANCHISE_JOIN_REQUESTS_COLLECTION).doc();
      await requestRef.set({
        main_org_id: mainOrgId,
        sub_name: subName,
        sub_address: (body.sub_address ?? "").toString().trim() || null,
        sub_phone: (body.sub_phone ?? "").toString().trim() || null,
        sub_email: email.trim().toLowerCase(),
        sub_password_hash: null,
        status: "pending",
        purchase_record_id: record.id,
        createdAt: now,
        updatedAt: now,
      });

      const mainOrgDoc = await db.collection("organizations").doc(mainOrgId).get();
      const mainEmail = (mainOrgDoc.data()?.email as string) ?? "";
      await sendFranchiseSubPurchaseNotifyMain({
        to: mainEmail,
        subName,
        subEmail: email,
        subPlan: plan,
      }).catch((err) => console.error("[purchase-record] Notify main failed:", err));

      return NextResponse.json({
        success: true,
        franchiseSub: true,
        message: "ส่งคำขอเข้าร่วมแฟรนไชส์แล้ว รอเจ้าของสาขาหลักอนุมัติ คุณจะได้รับอีเมลเมื่ออนุมัติ",
        recordId: record.id,
        emailSent: true,
      });
    }

    const verificationLink = buildVerificationLink(record.verification_token ?? "");
    const sent = await sendPurchaseConfirmation({
      to: record.email,
      plan: record.plan,
      licenseKey: record.license_key,
      verificationLink,
    });
    if (!sent.success) {
      console.error("[purchase-record] Email send failed:", sent.error);
      const isResendTestingLimit =
        typeof sent.error === "string" &&
        (sent.error.includes("only send testing emails to your own") ||
          sent.error.includes("verify a domain"));
      const userMessage = isResendTestingLimit
        ? "ในโหมดทดสอบ Resend ส่งได้เฉพาะไปที่อีเมลที่ใช้สมัคร Resend เท่านั้น — กรุณากรอกอีเมลนั้นใหม่เพื่อรับเมลยืนยัน หรือไป verify โดเมนที่ resend.com/domains เพื่อส่งถึงอีเมลใดก็ได้"
        : "บันทึกสำเร็จ แต่ส่งอีเมลไม่สำเร็จ — กรุณาใช้ปุ่ม ยืนยันอีเมล์ ในหน้า Login เพื่อส่งลิงก์ใหม่";
      return NextResponse.json({
        success: true,
        recordId: record.id,
        license_key: record.license_key,
        emailSent: false,
        error: userMessage,
      });
    }
    return NextResponse.json({
      success: true,
      recordId: record.id,
      license_key: record.license_key,
      emailSent: true,
    });
  } catch (err) {
    console.error("[purchase-record]", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
