/**
 * Phase 18 — Stripe webhook processing (shared by route + retry worker)
 */
import Stripe from "stripe";
import { db } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import type { OrgPlan } from "@/types/organization";

const COLLECTION = "stripe_events";

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const doc = await db.collection(COLLECTION).doc(eventId).get();
  return doc.exists;
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
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

async function handleTopupCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orgId = session.client_reference_id ?? session.metadata?.org_id;
  const amount = parseInt(String(session.metadata?.amount ?? "0"), 10);
  if (!orgId || !amount || ![100, 500, 1000].includes(amount)) return;
  const { incrementSubscriptionConversations } = await import("@/lib/clinic-data");
  await incrementSubscriptionConversations(orgId, amount);
  writeAuditLog({
    event: "topup_completed",
    org_id: orgId,
    details: { amount, sessionId: session.id, trigger: "checkout_completed" },
  }).catch(() => {});
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orgId = session.client_reference_id ?? session.metadata?.org_id;
  const plan = (session.metadata?.plan ?? "professional") as OrgPlan;
  const stripeSubId = typeof session.subscription === "string" ? session.subscription : null;
  if (!orgId) return;
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  const { createSubscription } = await import("@/lib/clinic-data");
  const { PLAN_MAX_BRANCHES } = await import("@/types/subscription");
  const subscriptionId = await createSubscription({
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

  // Phase 20: agency commission
  const amount = session.amount_total ?? 0;
  if (amount > 0) {
    const { recordCommission } = await import("@/lib/agency-commission");
    recordCommission(orgId, subscriptionId, amount).catch((e) =>
      console.warn("[Stripe] recordCommission:", (e as Error)?.message?.slice(0, 60))
    );
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

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subRef = (invoice as { subscription?: string | null }).subscription;
  const stripeSubId = typeof subRef === "string" ? subRef : null;
  const amount = invoice.amount_paid ?? 0;
  if (!stripeSubId || amount <= 0) return;
  const { getSubscriptionByStripeId } = await import("@/lib/clinic-data");
  const sub = await getSubscriptionByStripeId(stripeSubId);
  if (!sub) return;
  const { recordCommission } = await import("@/lib/agency-commission");
  recordCommission(sub.org_id, sub.id, amount).catch((e) =>
    console.warn("[Stripe] recordCommission invoice:", (e as Error)?.message?.slice(0, 60))
  );
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const invoiceId = (charge as { invoice?: string | null }).invoice;
  if (!invoiceId) return;
  const stripe = (await import("@/lib/stripe")).getStripe();
  const invoice = await stripe.invoices.retrieve(invoiceId as string);
  const subRef = (invoice as { subscription?: string | null }).subscription;
  const stripeSubId = typeof subRef === "string" ? subRef : null;
  const amount = invoice.amount_paid ?? charge.amount ?? 0;
  if (!stripeSubId) return;
  const { getSubscriptionByStripeId } = await import("@/lib/clinic-data");
  const sub = await getSubscriptionByStripeId(stripeSubId);
  if (!sub) return;
  const { findCommissionToReverse, reverseCommission } = await import("@/lib/agency-commission");
  const commissionId = await findCommissionToReverse(sub.org_id, sub.id, amount);
  if (commissionId) {
    await reverseCommission(commissionId, "Stripe charge refunded").catch((e) =>
      console.warn("[Stripe] reverseCommission:", (e as Error)?.message?.slice(0, 60))
    );
  }
}

/** Process Stripe event — used by webhook route and retry worker */
export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  if (await isStripeEventProcessed(event.id)) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await handleCheckoutSessionCompleted(session);
      } else if (session.mode === "payment" && session.metadata?.type === "topup") {
        await handleTopupCompleted(session);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(charge);
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
  await markStripeEventProcessed(event.id);
}
