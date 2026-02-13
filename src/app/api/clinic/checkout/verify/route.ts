/**
 * FE-7 — Payment Flow: ยืนยัน transaction จาก backend
 * Frontend ไม่ถือ logic การเงิน — ทุก transaction ต้อง confirm จาก backend
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export type PaymentVerifyStatus = "success" | "pending" | "failed";

/** GET — ตรวจสอบสถานะ Stripe Checkout Session จาก session_id */
export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
    if (!sessionId) {
      return NextResponse.json(
        { status: "failed" as PaymentVerifyStatus, message: "ไม่มี session_id" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // ตรวจว่า session นี้เป็นของ org นี้
    const sessionOrgId = checkoutSession.client_reference_id ?? checkoutSession.metadata?.org_id;
    if (sessionOrgId !== orgId) {
      return NextResponse.json(
        { status: "failed" as PaymentVerifyStatus, message: "ไม่พบรายการที่ตรงกับองค์กรของคุณ" },
        { status: 403 }
      );
    }

    const status = checkoutSession.status; // "complete" | "expired" | "open"
    const paymentStatus = checkoutSession.payment_status; // "paid" | "unpaid" | "no_payment_required"

    let resultStatus: PaymentVerifyStatus;
    let message: string;

    if (status === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required")) {
      resultStatus = "success";
      message = "ชำระเงินสำเร็จ";
    } else if (status === "open" || paymentStatus === "unpaid") {
      resultStatus = "pending";
      message = "รอการชำระเงิน หรือกำลังดำเนินการ";
    } else {
      resultStatus = "failed";
      message = status === "expired" ? "หมดเวลาชำระเงิน" : "การชำระเงินไม่สำเร็จ";
    }

    return NextResponse.json({
      status: resultStatus,
      message,
      plan: checkoutSession.metadata?.plan ?? undefined,
    });
  } catch (err) {
    console.error("GET /api/clinic/checkout/verify:", err);
    return NextResponse.json(
      {
        status: "failed" as PaymentVerifyStatus,
        message: process.env.NODE_ENV === "development" ? String(err) : "ไม่สามารถตรวจสอบได้",
      },
      { status: 500 }
    );
  }
}
