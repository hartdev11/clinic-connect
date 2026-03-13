/**
 * Phase 9 — Stripe Billing Portal (customer portal)
 * POST: create session, return URL for updating payment method
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getSubscriptionByOrgId } from "@/lib/clinic-data";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const subscription = await getSubscriptionByOrgId(orgId);
    const stripeSubId = subscription?.stripe_subscription_id;
    if (!stripeSubId) {
      return NextResponse.json(
        { error: "No Stripe subscription found" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(stripeSubId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl.replace(/\/$/, "")}/clinic/settings?tab=billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("POST /api/clinic/billing-portal:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
