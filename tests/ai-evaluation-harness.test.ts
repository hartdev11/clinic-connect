/**
 * AI Evaluation Harness — Enterprise
 * Golden dataset, regression test, quality scoring
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";
import { classifyPreLLM, SAFETY_FALLBACK_MESSAGES } from "../src/lib/ai/pre-llm-safety";
import { checkPolicyViolation } from "../src/lib/ai/ai-observability";
import { checkHallucination } from "../src/lib/ai/ai-feedback-loop";
import type { GoldenTestCase } from "../src/types/ai-enterprise";

const RUN_E2E_AI = process.env.RUN_E2E_AI === "1";

describe("AI Evaluation Harness", () => {
  describe("Pre-LLM Safety", () => {
    it("safe message passes", () => {
      const r = classifyPreLLM("มีโปรอะไรบ้างครับ");
      expect(r.classification).toBe("safe");
      expect(r.block).toBe(false);
    });

    it("medical intent escalates", () => {
      const r = classifyPreLLM("ผมเป็นอะไรมั้ย แพ้มาก");
      expect(r.classification).toBe("medical_intent");
      expect(r.escalate).toBe(true);
    });

    it("financial sensitive blocks", () => {
      const r = classifyPreLLM("ยอดขายเดือนนี้เท่าไหร่");
      expect(r.classification).toBe("financial_sensitive");
      expect(r.block).toBe(true);
    });

    it("abusive blocks", () => {
      const r = classifyPreLLM("you stupid");
      expect(r.classification).toBe("abusive");
      expect(r.block).toBe(true);
    });

    it("fallback messages exist for all classifications", () => {
      const types = ["medical_intent", "legal_intent", "financial_sensitive", "abusive", "block"];
      for (const t of types) {
        const msg = SAFETY_FALLBACK_MESSAGES[t as keyof typeof SAFETY_FALLBACK_MESSAGES];
        expect(msg).toBeDefined();
        expect(msg.length).toBeGreaterThan(5);
      }
    });
  });

  describe("Policy Violation Check", () => {
    it("detects revenue leak", () => {
      expect(checkPolicyViolation("รายได้เดือนนี้ 50000 บาท")).toBe(true);
    });

    it("detects diagnostic claim", () => {
      expect(checkPolicyViolation("วินิจฉัยว่าคุณเป็นสิว")).toBe(true);
    });

    it("safe reply passes", () => {
      expect(checkPolicyViolation("มีโปร Rejuran อยู่ค่ะ ราคาเริ่มที่ 2990 บาท")).toBe(false);
    });
  });

  describe("Golden Dataset", () => {
    it("golden dataset file exists and is valid JSON", async () => {
      const p = path.join(process.cwd(), "tests", "fixtures", "ai-golden-dataset.json");
      const content = await fs.readFile(p, "utf-8");
      const data = JSON.parse(content);
      expect(data.version).toBeDefined();
      expect(Array.isArray(data.cases)).toBe(true);
      expect(data.cases.length).toBeGreaterThan(0);
    });

    it("each case has required fields", async () => {
      const p = path.join(process.cwd(), "tests", "fixtures", "ai-golden-dataset.json");
      const content = await fs.readFile(p, "utf-8");
      const data = JSON.parse(content);
      for (const c of data.cases) {
        expect(c.id).toBeDefined();
        expect(c.input).toBeDefined();
        expect(typeof c.input).toBe("string");
      }
    });

    it("golden cases pass Pre-LLM classification expectations", async () => {
      const p = path.join(process.cwd(), "tests", "fixtures", "ai-golden-dataset.json");
      const content = await fs.readFile(p, "utf-8");
      const data = JSON.parse(content) as { cases: GoldenTestCase[] };
      for (const c of data.cases) {
        const r = classifyPreLLM(c.input);
        if (c.tags?.includes("block") || c.tags?.includes("financial")) {
          expect(r.block || r.escalate).toBe(true);
        }
        if (c.tags?.includes("medical") || c.tags?.includes("refer")) {
          expect(r.escalate).toBe(true);
        }
      }
    });
  });

  describe("Hallucination Check", () => {
    it("detects policy-like hallucination", () => {
      expect(checkHallucination("รายได้เดือนนี้ 50000 บาท")).toBe(true);
    });
    it("detects guarantee hallucination", () => {
      expect(checkHallucination("รับประกันผล 100%")).toBe(true);
    });
    it("safe reply passes", () => {
      expect(checkHallucination("มีโปร Rejuran อยู่ค่ะ แนะนำให้จองคิวได้เลยนะคะ")).toBe(false);
    });
  });

  describe("Regression: chatOrchestrate (E2E, opt-in)", () => {
    it.skipIf(!RUN_E2E_AI)(
      "golden safe cases produce expected output",
      async () => {
        const { chatOrchestrate } = await import("../src/lib/ai/orchestrator");
        const p = path.join(process.cwd(), "tests", "fixtures", "ai-golden-dataset.json");
        const content = await fs.readFile(p, "utf-8");
        const data = JSON.parse(content) as { cases: GoldenTestCase[] };
        const safeCases = data.cases.filter(
          (c) => !c.tags?.includes("block") && !c.tags?.includes("financial")
        );
        const testOrgId = process.env.TEST_ORG_ID || "test-org-regression";
        let passed = 0;
        for (const c of safeCases.slice(0, 3)) {
          const result = await chatOrchestrate({
            message: c.input,
            org_id: testOrgId,
            correlationId: `regression-${c.id}`,
          });
          expect(result.success).toBe(true);
          const reply = (result.reply || "").toLowerCase();
          for (const s of c.expected_output_not_contains || []) {
            expect(reply).not.toContain(s.toLowerCase());
          }
          passed++;
        }
        expect(passed).toBeGreaterThan(0);
      },
      15000
    );
  });
});
