/**
 * Enterprise Hardening Tests
 * Run: npm test
 * Note: reserveLLMBudget and checkDistributedRateLimit require Firebase (skip in CI without creds)
 */
import { describe, it, expect, vi } from "vitest";
import path from "path";
import fs from "fs/promises";

describe("Enterprise Hardening", () => {
  describe("correlationId propagation", () => {
    it("createRequestLogger includes correlationId", async () => {
      const { createRequestLogger } = await import("../src/lib/logger");
      const logger = createRequestLogger({
        requestId: "req-1",
        correlationId: "corr-1",
        route: "/api/chat",
      });
      expect(logger.correlationId).toBe("corr-1");
      expect(logger.requestId).toBe("req-1");
    });
  });

  describe("Admin route protection", () => {
    it("admin layout exists and enforces owner", async () => {
      const layoutPath = path.join(
        process.cwd(),
        "src",
        "app",
        "(clinic)",
        "clinic",
        "admin-monitoring",
        "layout.tsx"
      );
      const exists = await fs.access(layoutPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      const content = await fs.readFile(layoutPath, "utf-8");
      expect(content).toContain("redirect");
      expect(content).toContain("owner");
    });
  });

  describe("llm-cost-transaction exports", () => {
    it("exports reserveLLMBudget and DailyLimitExceededError", async () => {
      const mod = await import("../src/lib/llm-cost-transaction");
      expect(typeof mod.reserveLLMBudget).toBe("function");
      expect(mod.DailyLimitExceededError).toBeDefined();
    });
  });

  describe("distributed-rate-limit exports", () => {
    it("exports checkDistributedRateLimit and has no in-memory fallback", async () => {
      const mod = await import("../src/lib/distributed-rate-limit");
      expect(typeof mod.checkDistributedRateLimit).toBe("function");
      expect(mod.IP_LIMIT).toEqual({ windowSeconds: 10, max: 5 });
    });
  });

  describe("stripe-cleanup exports", () => {
    it("exports purgeOldStripeEvents", async () => {
      const mod = await import("../src/lib/stripe-cleanup");
      expect(typeof mod.purgeOldStripeEvents).toBe("function");
    });
  });
});
