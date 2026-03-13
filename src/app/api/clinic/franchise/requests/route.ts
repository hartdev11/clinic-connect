/**
 * Franchise: รายการคำขอเข้าร่วมที่รออนุมัติ (สาขาหลักเท่านั้น)
 * GET — ต้อง login และเป็น org ที่ franchise_role=main
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getPendingFranchiseJoinRequests, isFranchiseMain } from "@/lib/franchise";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.org_id) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const isMain = await isFranchiseMain(session.org_id);
    if (!isMain) {
      return NextResponse.json(
        { error: "เฉพาะสาขาหลักเท่านั้นที่ดูคำขอเข้าร่วมได้" },
        { status: 403 }
      );
    }

    const requests = await getPendingFranchiseJoinRequests(session.org_id);
    return NextResponse.json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        sub_name: r.sub_name,
        sub_address: r.sub_address,
        sub_phone: r.sub_phone,
        sub_email: r.sub_email,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Franchise requests GET error:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? detail : "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
