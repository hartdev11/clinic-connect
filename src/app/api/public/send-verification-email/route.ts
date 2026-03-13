/**
 * Enterprise: ส่งลิงก์ยืนยันอีเมลใหม่ (กรณีลูกค้าเคยซื้อแต่ยังไม่ยืนยัน)
 */
import { NextRequest, NextResponse } from "next/server";
import { getPurchaseRecordByEmail, setVerificationToken } from "@/lib/purchase-record";
import { sendVerificationEmail, buildVerificationLink } from "@/lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body ไม่ถูกต้อง" }, { status: 400 });
  }
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
  }
  const record = await getPurchaseRecordByEmail(email);
  if (!record) {
    return NextResponse.json(
      { error: "ไม่พบการซื้อแพ็คเกจด้วยอีเมลนี้" },
      { status: 404 }
    );
  }
  if (record.email_verified) {
    return NextResponse.json({
      success: true,
      message: "อีเมลนี้ยืนยันแล้ว สามารถเข้าสู่ระบบได้",
    });
  }
  const newToken = crypto.randomBytes(32).toString("hex");
  await setVerificationToken(record.id, newToken);
  const link = buildVerificationLink(newToken);
  const sent = await sendVerificationEmail({ to: record.email, verificationLink: link });
  if (!sent.success) {
    return NextResponse.json(
      { error: sent.error ?? "ส่งอีเมลไม่สำเร็จ" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    message: "ส่งลิงก์ยืนยันอีเมลไปที่กล่องจดหมายแล้ว",
  });
}
