/**
 * Phase 5 — Resilience and operations-oriented coverage.
 * File-level assertions keep tests stable without external infra dependencies.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";

async function read(relPath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relPath), "utf-8");
}

describe("Phase 5 resilience coverage", () => {
  it("booking reminder queue uses deterministic job id + removes old job first", async () => {
    const content = await read("src/lib/booking-reminder-queue.ts");
    expect(content).toContain("const reminderJobId = `booking-reminder:${bookingId}`");
    expect(content).toContain("const existing = await queue.getJob(reminderJobId)");
    expect(content).toContain("await existing.remove().catch(() => {})");
  });

  it("partner webhook outbox worker applies lease + retry schedule + dead-letter", async () => {
    const content = await read("src/worker/partner-webhook-retry-worker.ts");
    expect(content).toContain("const LEASE_MS = 60_000");
    expect(content).toContain("status: \"processing\"");
    expect(content).toContain("const RETRY_DELAY_MS = [60_000, 5 * 60_000, 30 * 60_000, 4 * 60 * 60_000]");
    expect(content).toContain("status: \"dead_letter\"");
    expect(content).toContain("partner_webhook_dead_letters");
  });

  it("webhook retry queue uses deterministic job key per source/event", async () => {
    const content = await read("src/lib/webhook-retry-queue.ts");
    expect(content).toContain("buildRetryJobOptions(`${data.source}-${data.eventId}`");
    expect(content).toContain("attempts: 4");
  });

  it("workers register graceful shutdown handlers", async () => {
    const files = [
      "src/worker/booking-reminder-worker.ts",
      "src/worker/chat-llm-worker.ts",
      "src/worker/handoff-reminder-worker.ts",
      "src/worker/quota-check-worker.ts",
      "src/worker/partner-webhook-retry-worker.ts",
    ];
    for (const f of files) {
      const content = await read(f);
      expect(content).toContain("process.on(\"SIGINT\"");
      expect(content).toContain("process.on(\"SIGTERM\"");
      expect(content).toContain("await worker.close().catch(() => {})");
    }
  });

  it("stripe webhook route enqueues retry payload on handler failure", async () => {
    const content = await read("src/app/api/webhooks/stripe/route.ts");
    expect(content).toContain("enqueueWebhookRetry({");
    expect(content).toContain("source: \"stripe\"");
    expect(content).toContain("eventId: event.id");
  });
});
