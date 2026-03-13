/**
 * E7.1–E7.8 — createCheckoutSession + Proration & Upgrade mid-cycle
 * Phase 17 — Billing idempotency
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getSubscriptionByOrgId } from "@/lib/clinic-data";
import { getStripe } from "@/lib/stripe";
import { getCouponByCode } from "@/lib/coupons";
import {
  checkBillingIdempotency,
  setBillingIdempotencyResult,
} from "@/lib/billing-idempotency";

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
    const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : "";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const successUrl = body.successUrl ?? `${baseUrl}/clinic/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancelUrl ?? `${baseUrl}/clinic/settings?checkout=cancelled`;

    let stripeCouponId: string | null = null;
    let trialDays = 0;
    if (couponCode) {
      const coupon = await getCouponByCode(couponCode);
      if (!coupon || !coupon.isActive) {
        return NextResponse.json({ error: "คูปองไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });
      }
      const now = new Date();
      if (new Date(coupon.validFrom) > now || new Date(coupon.validUntil) < now) {
        return NextResponse.json({ error: "คูปองหมดอายุแล้ว" }, { status: 400 });
      }
      if (coupon.maxTotalUses > 0 && coupon.currentUses >= coupon.maxTotalUses) {
        return NextResponse.json({ error: "คูปองถูกใช้ครบแล้ว" }, { status: 400 });
      }
      const stripe = getStripe();
      if (coupon.discountType === "free_trial") {
        trialDays = Math.max(0, Math.floor(coupon.discountValue));
      } else {
        const couponParams =
          coupon.discountType === "percentage"
            ? { percent_off: Math.min(100, Math.max(0, coupon.discountValue)) }
            : { amount_off: Math.min(9999999, Math.max(0, Math.round(coupon.discountValue * 100))), currency: "thb" as const };
        const created = await stripe.coupons.create({
          ...couponParams,
          name: coupon.couponCode,
          metadata: { source: "clinic_connect" },
        });
        stripeCouponId = created.id;
      }
    }

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
      const period = `upgrade-${plan}-${new Date().toISOString().slice(0, 7)}`; // YYYY-MM
      const idem = await checkBillingIdempotency(orgId, period);
      if (idem.duplicate && idem.result) {
        return NextResponse.json(idem.result);
      }
      await upgradeSubscription(stripeSubId, planConfig.priceId, orgId, plan);
      const upgradeResult = {
        upgraded: true,
        plan,
        message: "อัปเกรดสำเร็จ — Stripe จะคิดเงินส่วนต่าง (proration) ทันที",
      };
      await setBillingIdempotencyResult(orgId, period, upgradeResult);
      return NextResponse.json({
        ...upgradeResult,
      });
    }

    const period = `checkout-${plan}-${new Date().toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
    const idem = await checkBillingIdempotency(orgId, period);
    if (idem.duplicate && idem.result) {
      return NextResponse.json(idem.result);
    }

    const stripe = getStripe();
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
      metadata: { org_id: orgId, plan, coupon_code: couponCode || "" },
      subscription_data: {
        metadata: { org_id: orgId, plan },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
    };
    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    const result = { url: checkoutSession.url, sessionId: checkoutSession.id };
    await setBillingIdempotencyResult(orgId, period, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/clinic/checkout:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
