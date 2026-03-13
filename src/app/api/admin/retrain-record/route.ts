/**
 * POST /api/admin/retrain-record
 * Phase 6: บันทึก last_retrain_date เมื่อ retrain โมเดลเสร็จ
 * อัปเดต global/model_config เพื่อให้ retrain-monitor คำนวณ days_since_last
 * อนุญาต: CRON_SECRET หรือ super_admin/owner
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { requireAdminSession } from "@/lib/admin-guard";

const GLOBAL_COLLECTION = "global";
const MODEL_CONFIG_DOC = "model_config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedCronSecret = process.env.CRON_SECRET?.trim();
  const isCronAuth = !!expectedCronSecret && cronSecret === expectedCronSecret;

  if (!isCronAuth) {
    const guard = await requireAdminSession();
    if (!guard.ok) return guard.response;
  }

  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    const now = new Date().toISOString();

    await db.collection(GLOBAL_COLLECTION).doc(MODEL_CONFIG_DOC).set(
      {
        last_retrain_date: now,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      last_retrain_date: now,
    });
  } catch (err) {
    console.error("POST /api/admin/retrain-record:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึก last_retrain_date" },
      { status: 500 }
    );
  }
}
