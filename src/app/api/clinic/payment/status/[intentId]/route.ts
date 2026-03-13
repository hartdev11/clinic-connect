/**
 * Phase 17 — Polling endpoint for PromptPay PaymentIntent status
 * GET /api/clinic/payment/status/[intentId]
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getPaymentIntentStatus } from "@/lib/stripe-promptpay";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { intentId } = await params;
  if (!intentId) return NextResponse.json({ error: "Missing intentId" }, { status: 400 });

  try {
    const { status } = await getPaymentIntentStatus(intentId);
    return NextResponse.json({ status });
  } catch (err) {
    console.error("GET /api/clinic/payment/status/[intentId]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
