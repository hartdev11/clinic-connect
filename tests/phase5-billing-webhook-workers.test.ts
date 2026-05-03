/**
 * Phase 5 — Billing lifecycle + webhook/worker coverage
 * Domain-oriented file to keep release-gate checks maintainable.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";

async function read(relPath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relPath), "utf-8");
}

describe("Phase 5 billing + webhook + workers", () => {
  describe("stripe billing lifecycle", () => {
    it("stripe webhook handler covers paid/refund/subscription lifecycle handlers", async () => {
      const content = await read("src/lib/stripe-webhook-handler.ts");
      expect(content).toContain("case \"invoice.paid\"");
      expect(content).toContain("case \"charge.refunded\"");
      expect(content).toContain("case \"customer.subscription.updated\"");
      expect(content).toContain("case \"customer.subscription.deleted\"");
    });

    it("commission events are idempotent by externalRef for checkout and invoice", async () => {
      const content = await read("src/lib/stripe-webhook-handler.ts");
      expect(content).toContain("externalRef: `checkout:${session.id}`");
      expect(content).toContain("externalRef: `invoice:${invoice.id}`");
      expect(content).toContain("findCommissionToReverse");
      expect(content).toContain("reverseCommission(");
    });
  });

  describe("webhook retry domain", () => {
    it("stripe webhook route enqueues retry payload on failure", async () => {
      const content = await read("src/app/api/webhooks/stripe/route.ts");
      expect(content).toContain("enqueueWebhookRetry({");
      expect(content).toContain("source: \"stripe\"");
      expect(content).toContain("eventId: event.id");
      expect(content).toContain("correlationId");
    });

    it("webhook retry queue uses deterministic job key with retry options", async () => {
      const content = await read("src/lib/webhook-retry-queue.ts");
      expect(content).toContain("buildRetryJobOptions(`${data.source}-${data.eventId}`");
      expect(content).toContain("attempts: 4");
      expect(content).toContain("backoffDelayMs: 60_000");
    });

    it("webhook retry worker processes both stripe and line sources", async () => {
      const content = await read("src/worker/webhook-retry-worker.ts");
      expect(content).toContain("if (source === \"stripe\")");
      expect(content).toContain("if (source === \"line\")");
      expect(content).toContain("processStripeWebhookEvent(event, { correlationId })");
      expect(content).toContain("sendWebhookDeadLetterEmail");
    });
  });

  describe("billing workers and idempotency", () => {
    it("billing renew logic handles active sync and past_due fallback", async () => {
      const content = await read("src/lib/run-billing-renew.ts");
      expect(content).toContain("if (sub.status === \"active\" || sub.status === \"trialing\")");
      expect(content).toContain("if (sub.status === \"past_due\" || sub.status === \"unpaid\")");
      expect(content).toContain("await updateSubscriptionByStripeId(stripeSubId, { status: \"past_due\" })");
      expect(content).toContain("updateSubscriptionAiBlocked");
    });

    it("billing idempotency caches result with redis TTL", async () => {
      const content = await read("src/lib/billing-idempotency.ts");
      expect(content).toContain("const BILLING_TTL_SEC = 48 * 60 * 60");
      expect(content).toContain("checkBillingIdempotency(");
      expect(content).toContain("setBillingIdempotencyResult(");
      expect(content).toContain("await client.set(key, JSON.stringify(result), \"EX\", BILLING_TTL_SEC)");
    });

    it("billing workers schedule repeatable jobs and fail fast without redis", async () => {
      const renewWorker = await read("src/worker/billing-worker.ts");
      const reminderWorker = await read("src/worker/billing-reminder-worker.ts");
      const renewQueue = await read("src/lib/billing-renew-queue.ts");

      expect(renewWorker).toContain("[Billing Worker] REDIS_URL required");
      expect(reminderWorker).toContain("[Billing Reminder Worker] REDIS_URL required");
      expect(renewWorker).toContain("ensureBillingRenewRepeatableJob()");
      expect(reminderWorker).toContain("ensureBillingReminderRepeatableJob()");
      expect(renewQueue).toContain("const CRON_00_BANGKOK = \"0 17 * * *\"");
    });
  });
});
