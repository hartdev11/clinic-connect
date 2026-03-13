/**
 * Phase 18 — Subscription Auto-Renew logic
 * ดึง subscriptions ที่ current_period_end = วันนี้ AND auto_renew = true
 * Stripe: sync from Stripe, pay open invoice if any. On failure → past_due, aiBlocked
 */
import { db } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe";
import {
  updateSubscriptionByStripeId,
  updateSubscriptionAiBlocked,
} from "@/lib/clinic-data";
import { getBangkokDateKey, dateKeyToISOStart, dateKeyToISOEnd } from "@/lib/timezone";

export interface BillingRenewSummary {
  processed: number;
  synced: number;
  failed: number;
  errors: string[];
}

export async function runBillingRenew(): Promise<BillingRenewSummary> {
  const today = getBangkokDateKey(0);
  const rangeStart = dateKeyToISOStart(today);
  const rangeEnd = dateKeyToISOEnd(today);

  const snap = await db
    .collection("subscriptions")
    .where("status", "in", ["active", "trialing"])
    .where("current_period_end", ">=", rangeStart)
    .where("current_period_end", "<=", rangeEnd)
    .get();

  const summary: BillingRenewSummary = { processed: snap.size, synced: 0, failed: 0, errors: [] };

  const stripe = getStripe();

  for (const doc of snap.docs) {
    const d = doc.data();
    const stripeSubId = d.stripe_subscription_id as string | null;
    const autoRenew = d.auto_renew !== false;

    if (!autoRenew) continue;
    if (!stripeSubId) {
      summary.errors.push(`Org ${d.org_id}: no Stripe subscription, skip`);
      continue;
    }

    try {
      const sub = await stripe.subscriptions.retrieve(stripeSubId, {
        expand: ["latest_invoice"],
      });

      if (sub.status === "active" || sub.status === "trialing") {
        const subExt = sub as { current_period_start?: number; current_period_end?: number };
        const start = subExt.current_period_start
          ? new Date(subExt.current_period_start * 1000).toISOString()
          : undefined;
        const end = subExt.current_period_end
          ? new Date(subExt.current_period_end * 1000).toISOString()
          : undefined;
        await updateSubscriptionByStripeId(stripeSubId, {
          status: sub.status as "active" | "trialing",
          current_period_start: start,
          current_period_end: end,
        });
        summary.synced++;
        continue;
      }

      if (sub.status === "past_due" || sub.status === "unpaid") {
        const latestInvoice = sub.latest_invoice;
        const invoiceId =
          typeof latestInvoice === "object" && latestInvoice?.id
            ? latestInvoice.id
            : typeof latestInvoice === "string"
              ? latestInvoice
              : null;
        if (invoiceId) {
          try {
            await stripe.invoices.pay(invoiceId);
            const subRetry = await stripe.subscriptions.retrieve(stripeSubId);
            if (subRetry.status === "active") {
              const subRetryExt = subRetry as {
                current_period_start?: number;
                current_period_end?: number;
              };
              const end = subRetryExt.current_period_end
                ? new Date(subRetryExt.current_period_end * 1000).toISOString()
                : undefined;
              const start = subRetryExt.current_period_start
                ? new Date(subRetryExt.current_period_start * 1000).toISOString()
                : undefined;
              await updateSubscriptionByStripeId(stripeSubId, {
                status: "active",
                current_period_start: start,
                current_period_end: end,
              });
              summary.synced++;
              continue;
            }
          } catch (payErr) {
            summary.errors.push(
              `Org ${d.org_id}: invoice pay failed: ${(payErr as Error)?.message?.slice(0, 60)}`
            );
          }
        }
        await updateSubscriptionByStripeId(stripeSubId, { status: "past_due" });
        const subDoc = await db
          .collection("subscriptions")
          .where("stripe_subscription_id", "==", stripeSubId)
          .limit(1)
          .get();
        if (!subDoc.empty) {
          await updateSubscriptionAiBlocked(subDoc.docs[0].id, true);
        }
        summary.failed++;
      }
    } catch (err) {
      summary.errors.push(
        `Org ${d.org_id}: ${(err as Error)?.message?.slice(0, 80)}`
      );
      summary.failed++;
    }
  }

  return summary;
}
