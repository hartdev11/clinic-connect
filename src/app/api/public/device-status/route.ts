/**
 * Enterprise: ตรวจสอบสถานะเครื่อง — เคยซื้อแพ็คเกจหรือยัง, ยืนยันอีเมลหรือยัง
 * อ่าน device_id จาก cookie cc_device_id
 */
import { NextRequest, NextResponse } from "next/server";
import { getPurchaseRecordByDeviceId } from "@/lib/purchase-record";
import { checkDistributedRateLimit, getClientIp } from "@/lib/distributed-rate-limit";

const DEVICE_ID_COOKIE = "cc_device_id";

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "****";
  const name = email.slice(0, at);
  const domain = email.slice(at);
  return `${name[0]}***${name.slice(-1)}${domain}`;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = await checkDistributedRateLimit(`public:device-status:ip:${ip}`, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }
  const deviceId = request.cookies.get(DEVICE_ID_COOKIE)?.value?.trim();
  if (!deviceId) {
    return NextResponse.json({
      hasPurchased: false,
      emailVerified: false,
      email: null,
      plan: null,
    });
  }
  const record = await getPurchaseRecordByDeviceId(deviceId);
  if (!record) {
    return NextResponse.json({
      hasPurchased: false,
      emailVerified: false,
      email: null,
      plan: null,
    });
  }
  return NextResponse.json({
    hasPurchased: true,
    emailVerified: record.email_verified,
    email: maskEmail(record.email),
    plan: record.plan,
  });
}
