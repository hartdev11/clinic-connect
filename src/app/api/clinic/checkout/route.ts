/**
 * E7.1–E7.8 — createCheckoutSession + Proration & Upgrade mid-cycle
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getSubscriptionByOrgId } from "@/lib/clinic-data";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const PLANS: Record<string, { priceId: string; name: string }> = {
  professional: {
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
    name: "Professional",
  },
  multi_branch: {
    priceId: process.env.STRIPE_PRICE_MULTI_BRANCH ?? "",
    name: "Multi Branch",
  },
  enterprise: {
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
    name: "Enterprise",
  },
};

/** E7.5–E7.8 — Upgrade mid-cycle ด้วย Stripe proration */
async function upgradeSubscription(
  stripeSubId: string,
  newPriceId: string,
  orgId: string,
  plan: string
) {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(stripeSubId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  if (!item) {
    throw new Error("No subscription item found");
  }

  await stripe.subscriptions.update(stripeSubId, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: "always_invoice",
    metadata: { org_id: orgId, plan },
  });
}

/** POST — สร้าง Stripe Checkout Session หรือ Upgrade mid-cycle */
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await request.json();
    const plan = body.plan as string;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const successUrl = body.successUrl ?? `${baseUrl}/clinic/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancelUrl ?? `${baseUrl}/clinic/settings?checkout=cancelled`;

    const planConfig = PLANS[plan];
    if (!planConfig?.priceId) {
      return NextResponse.json(
        { error: `Invalid plan or STRIPE_PRICE_${plan.toUpperCase()} not configured` },
        { status: 400 }
      );
    }

    const subscription = await getSubscriptionByOrgId(orgId);
    const stripeSubId = subscription?.stripe_subscription_id;
    const canUpgrade = stripeSubId && subscription?.status === "active";

    if (canUpgrade && subscription?.plan !== plan) {
      await upgradeSubscription(stripeSubId, planConfig.priceId, orgId, plan);
      return NextResponse.json({
        upgraded: true,
        plan,
        message: "อัปเกรดสำเร็จ — Stripe จะคิดเงินส่วนต่าง (proration) ทันที",
      });
    }

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgId,
      metadata: { org_id: orgId, plan },
      subscription_data: {
        metadata: { org_id: orgId, plan },
      },
    });

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (err) {
    console.error("POST /api/clinic/checkout:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
