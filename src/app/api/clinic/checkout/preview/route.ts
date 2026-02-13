/**
 * E7.5–E7.8 — Proration preview ก่อน upgrade
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getSubscriptionByOrgId } from "@/lib/clinic-data";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const PLANS: Record<string, { priceId: string }> = {
  professional: { priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? "" },
  multi_branch: { priceId: process.env.STRIPE_PRICE_MULTI_BRANCH ?? "" },
  enterprise: { priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? "" },
};

/** GET — preview proration amount สำหรับ upgrade */
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

    const plan = request.nextUrl.searchParams.get("plan") ?? "";
    const planConfig = PLANS[plan];
    if (!planConfig?.priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const subscription = await getSubscriptionByOrgId(orgId);
    const stripeSubId = subscription?.stripe_subscription_id;
    if (!stripeSubId || subscription?.status !== "active" || subscription?.plan === plan) {
      return NextResponse.json({
        prorationAmount: 0,
        currency: "thb",
        message: subscription?.plan === plan ? "เป็นแผนปัจจุบันอยู่แล้ว" : "ไม่สามารถ preview ได้",
      });
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(stripeSubId);
    const item = sub.items.data[0];
    if (!item) {
      return NextResponse.json({ error: "No subscription item" }, { status: 400 });
    }

    const prorationDate = Math.floor(Date.now() / 1000);
    const invoice = await stripe.invoices.createPreview({
      subscription: stripeSubId,
      subscription_details: {
        items: [{ id: item.id, price: planConfig.priceId }],
        proration_date: prorationDate,
        proration_behavior: "always_invoice",
      },
    });

    return NextResponse.json({
      amountDue: invoice.amount_due,
      amountRemaining: invoice.amount_remaining,
      currency: invoice.currency ?? "thb",
      prorationAmount: invoice.amount_due,
    });
  } catch (err) {
    console.error("GET /api/clinic/checkout/preview:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
