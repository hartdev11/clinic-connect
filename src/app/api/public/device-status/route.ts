/**
 * Enterprise: ตรวจสอบสถานะเครื่อง — เคยซื้อแพ็คเกจหรือยัง, ยืนยันอีเมลหรือยัง
 * อ่าน device_id จาก cookie cc_device_id
 */
import { NextRequest, NextResponse } from "next/server";
import { getPurchaseRecordByDeviceId } from "@/lib/purchase-record";

const DEVICE_ID_COOKIE = "cc_device_id";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
    email: record.email,
    plan: record.plan,
  });
}
