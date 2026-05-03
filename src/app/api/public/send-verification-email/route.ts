/**
 * Enterprise: ส่งลิงก์ยืนยันอีเมลใหม่ (กรณีลูกค้าเคยซื้อแต่ยังไม่ยืนยัน)
 */
import { NextRequest, NextResponse } from "next/server";
import { getPurchaseRecordByEmail, setVerificationToken } from "@/lib/purchase-record";
import { sendVerificationEmail, buildVerificationLink } from "@/lib/email";
import crypto from "crypto";
import { checkDistributedRateLimit, getClientIp } from "@/lib/distributed-rate-limit";

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
  const ip = getClientIp(request);
  const byIp = await checkDistributedRateLimit(`public:verify-email:ip:${ip}`, 10, 60 * 10);
  if (!byIp.allowed) {
    return NextResponse.json(
      { success: true, message: "ถ้าอีเมลนี้มีอยู่ในระบบ จะส่งลิงก์ยืนยันให้อีกครั้ง" },
      { status: 200 }
    );
  }
  const byEmail = await checkDistributedRateLimit(`public:verify-email:email:${email.toLowerCase()}`, 3, 60 * 30);
  if (!byEmail.allowed) {
    return NextResponse.json(
      { success: true, message: "ถ้าอีเมลนี้มีอยู่ในระบบ จะส่งลิงก์ยืนยันให้อีกครั้ง" },
      { status: 200 }
    );
  }
  const record = await getPurchaseRecordByEmail(email);
  if (!record) {
    return NextResponse.json({
      success: true,
      message: "ถ้าอีเมลนี้มีอยู่ในระบบ จะส่งลิงก์ยืนยันให้อีกครั้ง",
    });
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
