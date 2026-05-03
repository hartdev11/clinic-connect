/**
 * Phase 5 — Billing lifecycle flow guards
 * Focuses on renewal/reminder behavior and Stripe webhook lifecycle wiring.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";

async function read(relPath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relPath), "utf-8");
}

describe("Phase 5 billing lifecycle flow", () => {
  it("renew flow queries due subscriptions and supports recover/pay path", async () => {
    const content = await read("src/lib/run-billing-renew.ts");
    expect(content).toContain(".where(\"status\", \"in\", [\"active\", \"trialing\"])");
    expect(content).toContain("const autoRenew = d.auto_renew !== false");
    expect(content).toContain("await stripe.invoices.pay(invoiceId)");
    expect(content).toContain("await updateSubscriptionByStripeId(stripeSubId, { status: \"past_due\" })");
    expect(content).toContain("await updateSubscriptionAiBlocked(subDoc.docs[0].id, true)");
  });

  it("reminder flow targets 3-day window and writes warning notifications", async () => {
    const content = await read("src/lib/run-billing-reminder.ts");
    expect(content).toContain("const endDate = getBangkokDateKey(3)");
    expect(content).toContain(".where(\"status\", \"==\", \"active\")");
    expect(content).toContain("sendBillingReminderEmail");
    expect(content).toContain("type: \"billing_reminder\"");
    expect(content).toContain("severity: \"warning\"");
  });

  it("renew and reminder queues keep deterministic Bangkok cron schedules", async () => {
    const renewQueue = await read("src/lib/billing-renew-queue.ts");
    const reminderQueue = await read("src/lib/billing-reminder-queue.ts");
    expect(renewQueue).toContain("const CRON_00_BANGKOK = \"0 17 * * *\"");
    expect(reminderQueue).toContain("const CRON_09_BANGKOK = \"0 2 * * *\"");
    expect(renewQueue).toContain("ensureBillingRenewRepeatableJob");
    expect(reminderQueue).toContain("ensureBillingReminderRepeatableJob");
  });

  it("stripe webhook lifecycle includes retry enqueue and event idempotent claim", async () => {
    const route = await read("src/app/api/webhooks/stripe/route.ts");
    const handler = await read("src/lib/stripe-webhook-handler.ts");
    expect(route).toContain("enqueueWebhookRetry({");
    expect(route).toContain("source: \"stripe\"");
    expect(handler).toContain("claimStripeEventProcessing(event.id)");
    expect(handler).toContain("await markStripeEventProcessed(event.id)");
    expect(handler).toContain("await markStripeEventFailed(event.id");
  });
});
