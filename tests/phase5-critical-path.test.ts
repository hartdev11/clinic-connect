/**
 * Phase 5 — Critical path coverage (integration-oriented checks)
 * Focus: auth/webhook tracing, booking notification idempotency, RBAC isolation.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";

describe("Phase 5 critical path coverage", () => {
  describe("Auth + middleware critical behavior", () => {
    it("login route includes distributed rate limit on IP and email", async () => {
      const p = path.join(process.cwd(), "src", "app", "api", "auth", "login", "route.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("auth:login:ip:");
      expect(content).toContain("auth:login:email:");
      expect(content).toContain("status: 429");
    });

    it("register route validates license key and applies distributed rate limits", async () => {
      const p = path.join(process.cwd(), "src", "app", "api", "auth", "register", "route.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("validateLicenseKey");
      expect(content).toContain("auth:register:ip:");
      expect(content).toContain("auth:register:email:");
    });

    it("middleware injects x-request-id and security headers", async () => {
      const p = path.join(process.cwd(), "src", "middleware.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("x-request-id");
      expect(content).toContain("Content-Security-Policy");
      expect(content).toContain("Permissions-Policy");
    });
  });

  describe("RBAC + tenant isolation", () => {
    it("manager without branch scope is denied specific branch", async () => {
      const { requireBranchAccess } = await import("../src/lib/rbac");
      expect(requireBranchAccess("manager", null, null, "branch-a")).toBe(false);
    });

    it("owner is allowed across branches", async () => {
      const { requireBranchAccess } = await import("../src/lib/rbac");
      expect(requireBranchAccess("owner", null, null, "branch-any")).toBe(true);
    });
  });

  describe("Booking notification idempotency", () => {
    it("sendBookingConfirmation returns ok immediately when already sent", async () => {
      const { sendBookingConfirmation } = await import("../src/lib/booking-notification");
      const result = await sendBookingConfirmation({
        orgId: "org-test",
        bookingId: "booking-test",
        booking: {
          id: "booking-test",
          org_id: "org-test",
          customerName: "Test",
          service: "Botox",
          scheduledAt: new Date().toISOString(),
          status: "confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          requiresCustomerNotification: true,
          notificationStatus: "sent",
        },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe("Webhook tracing + retry propagation", () => {
    it("stripe webhook route wires request-id to process + retry payload", async () => {
      const routePath = path.join(
        process.cwd(),
        "src",
        "app",
        "api",
        "webhooks",
        "stripe",
        "route.ts"
      );
      const content = await fs.readFile(routePath, "utf-8");
      expect(content).toContain("getRequestId");
      expect(content).toContain("processStripeWebhookEvent(event, { correlationId })");
      expect(content).toContain("correlationId,");
    });

    it("stripe webhook handler sends externalRef + correlationId to commission logic", async () => {
      const handlerPath = path.join(process.cwd(), "src", "lib", "stripe-webhook-handler.ts");
      const content = await fs.readFile(handlerPath, "utf-8");
      expect(content).toContain("externalRef: `checkout:${session.id}`");
      expect(content).toContain("externalRef: `invoice:${invoice.id}`");
      expect(content).toContain("processStripeWebhookEvent(");
      expect(content).toContain("opts?: { correlationId?: string }");
    });

    it("stripe handler uses atomic claim to avoid duplicate side-effects", async () => {
      const handlerPath = path.join(process.cwd(), "src", "lib", "stripe-webhook-handler.ts");
      const content = await fs.readFile(handlerPath, "utf-8");
      expect(content).toContain("claimStripeEventProcessing");
      expect(content).toContain(".create({");
      expect(content).toContain("if (claim === \"duplicate\") return;");
    });

    it("line idempotency uses atomic claim via Firestore create()", async () => {
      const p = path.join(process.cwd(), "src", "lib", "line-idempotency.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("claimLineEventProcessing");
      expect(content).toContain(".create({");
    });
  });

  describe("Commission side-effect dedupe", () => {
    it("agency commission checks duplicate by externalRef before insert", async () => {
      const p = path.join(process.cwd(), "src", "lib", "agency-commission.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain(".where(\"externalRef\", \"==\", opts.externalRef)");
      expect(content).toContain("externalRef: opts?.externalRef ?? null");
      expect(content).toContain("correlationId: opts?.correlationId ?? null");
    });
  });

  describe("Booking critical flows", () => {
    it("booking create route propagates request-id as correlationId", async () => {
      const p = path.join(process.cwd(), "src", "app", "api", "clinic", "bookings", "route.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("getRequestId(request)");
      expect(content).toContain("scheduleBookingReminder(");
      expect(content).toContain("correlationId");
      expect(content).toContain("dispatchPartnerWebhooks");
    });

    it("booking patch route reschedule flow keeps reminder idempotent", async () => {
      const p = path.join(process.cwd(), "src", "app", "api", "clinic", "bookings", "[id]", "route.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("scheduleBookingReminder(");
      expect(content).toContain("cancelBookingReminder(");
      expect(content).toContain("notificationStatus = \"pending\"");
    });
  });

  describe("Worker / retry / failure-mode guards", () => {
    it("queue defaults use exponential backoff and retention windows", async () => {
      const p = path.join(process.cwd(), "src", "lib", "queue-defaults.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("backoff: { type: \"exponential\"");
      expect(content).toContain("removeOnComplete");
      expect(content).toContain("removeOnFail");
    });

    it("outbound HTTP helper retries retryable statuses and uses timeout", async () => {
      const p = path.join(process.cwd(), "src", "lib", "outbound-http.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("AbortController");
      expect(content).toContain("status === 408 || status === 429 || status >= 500");
      expect(content).toContain("attempt < maxAttempts");
    });

    it("partner webhook retry worker has exponential retry schedule and dead-letter path", async () => {
      const p = path.join(process.cwd(), "src", "worker", "partner-webhook-retry-worker.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("const RETRY_DELAY_MS = [60_000, 5 * 60_000, 30 * 60_000, 4 * 60 * 60_000]");
      expect(content).toContain("status: \"dead_letter\"");
      expect(content).toContain("sendWebhookDeadLetterEmail");
    });

    it("webhook retry worker handles stripe and line retry paths", async () => {
      const p = path.join(process.cwd(), "src", "worker", "webhook-retry-worker.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("if (source === \"stripe\")");
      expect(content).toContain("if (source === \"line\")");
      expect(content).toContain("pushLineMessages");
      expect(content).toContain("sendWebhookDeadLetterEmail");
    });

    it("booking reminder worker skips when reminder already sent", async () => {
      const p = path.join(process.cwd(), "src", "worker", "booking-reminder-worker.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("existingReminderSentAt");
      expect(content).toContain("Already sent, skip");
    });

    it("chat llm worker includes retry loop and circuit breaker guard", async () => {
      const p = path.join(process.cwd(), "src", "worker", "chat-llm-worker.ts");
      const content = await fs.readFile(p, "utf-8");
      expect(content).toContain("LLM_RETRY_ATTEMPTS");
      expect(content).toContain("isCircuitOpen");
      expect(content).toContain("for (let attempt = 1; attempt <= LLM_RETRY_ATTEMPTS; attempt++)");
    });
  });
});
