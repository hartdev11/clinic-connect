/**
 * E7.1–E7.4 — Stripe Webhook Handler
 * Idempotency: เก็บ event.id ไว้ ไม่ process ซ้ำ
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { db } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import type { OrgPlan } from "@/types/organization";

const COLLECTION = "stripe_events";

/** E7.4 — Idempotency: ตรวจว่าเคย process event นี้แล้วหรือยัง */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const doc = await db.collection(COLLECTION).doc(eventId).get();
  return doc.exists;
}

const STRIPE_EVENT_TTL_DAYS = 7;

async function markEventProcessed(eventId: string): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + STRIPE_EVENT_TTL_DAYS);
  await db.collection(COLLECTION).doc(eventId).set({
    processed_at: FieldValue.serverTimestamp(),
    expires_at: expiresAt,
  });
}

function mapStripeStatus(stripeStatus: string): "active" | "past_due" | "cancelled" | "trialing" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return stripeStatus as "active" | "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "cancelled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "active";
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orgId = session.client_reference_id ?? session.metadata?.org_id;
  const plan = (session.metadata?.plan ?? "professional") as OrgPlan;
  const stripeSubId = typeof session.subscription === "string" ? session.subscription : null;
  if (!orgId) {
    console.warn("[Stripe Webhook] checkout.session.completed: no org_id");
    return;
  }

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  const { createSubscription } = await import("@/lib/clinic-data");
  const { PLAN_MAX_BRANCHES } = await import("@/types/subscription");
  await createSubscription({
    org_id: orgId,
    plan,
    status: "active",
    max_branches: PLAN_MAX_BRANCHES[plan],
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    stripe_subscription_id: stripeSubId,
  });

  const { FieldValue } = await import("firebase-admin/firestore");
  await db.collection("organizations").doc(orgId).update({
    plan,
    updatedAt: FieldValue.serverTimestamp(),
  });

  writeAuditLog({
    event: "subscription_change",
    org_id: orgId,
    details: { plan, stripe_subscription_id: stripeSubId, trigger: "checkout_completed" },
  }).catch(() => {});
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const { updateSubscriptionByStripeId } = await import("@/lib/clinic-data");
  const { PLAN_MAX_BRANCHES } = await import("@/types/subscription");
  const status = mapStripeStatus(sub.status);
  const plan = (sub.metadata?.plan ?? "professional") as OrgPlan;
  const maxBranches = PLAN_MAX_BRANCHES[plan];
  const subExt = sub as { current_period_start?: number; current_period_end?: number };
  const start = subExt.current_period_start
    ? new Date(subExt.current_period_start * 1000).toISOString()
    : undefined;
  const end = subExt.current_period_end
    ? new Date(subExt.current_period_end * 1000).toISOString()
    : undefined;
  const result = await updateSubscriptionByStripeId(sub.id, {
    status,
    plan,
    max_branches: maxBranches,
    current_period_start: start,
    current_period_end: end,
  });
  if (result && typeof result === "object" && result.orgId) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const prevPlan = result.previousPlan;
    const event: "plan_upgrade" | "plan_downgrade" | "subscription_change" =
      prevPlan && plan !== prevPlan
        ? planRank(plan) > planRank(prevPlan)
          ? "plan_upgrade"
          : "plan_downgrade"
        : "subscription_change";
    const orgId = result.orgId;
    await db.collection("organizations").doc(orgId).update({
      plan,
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAuditLog({
      event,
      org_id: orgId,
      details: { plan, status, previous_plan: prevPlan, trigger: "subscription_updated" },
    }).catch(() => {});
  }
}

function planRank(p: OrgPlan): number {
  const r: Record<OrgPlan, number> = {
    starter: 1,
    professional: 2,
    multi_branch: 2.5,
    enterprise: 3,
  };
  return r[p] ?? 0;
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const { updateSubscriptionByStripeId } = await import("@/lib/clinic-data");
  const result = await updateSubscriptionByStripeId(sub.id, { status: "cancelled" });
  if (result && typeof result === "object" && result.orgId) {
    writeAuditLog({
      event: "subscription_change",
      org_id: result.orgId,
      details: { status: "cancelled", trigger: "subscription_deleted" },
    }).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature") ?? "";
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[Stripe Webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleCheckoutSessionCompleted(session);
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      default:
    }
    await markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Handler error" },
      { status: 500 }
    );
  }
}
