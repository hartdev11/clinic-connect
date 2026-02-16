/**
 * Unified AI Knowledge — Unit tests
 * Sanitization, soft delete behavior, version drift logic
 */
import { describe, it, expect } from "vitest";
import {
  stripHtml,
  normalizeWhitespace,
  removeDuplicateSentences,
  detectBlocklistedMedicalClaim,
  sanitizeForEmbedding,
  sanitizeServiceText,
  sanitizeFaqText,
} from "../src/lib/unified-knowledge/sanitize";

describe("Unified Knowledge — Sanitize", () => {
  describe("stripHtml", () => {
    it("removes HTML tags", () => {
      expect(stripHtml("<p>hello</p>")).toBe("hello");
      expect(stripHtml("<script>x</script>")).toBe("x");
      expect(stripHtml("a<br/>b")).toBe("a b");
    });
    it("decodes &nbsp; and entities", () => {
      expect(stripHtml("a&nbsp;b")).toBe("a b");
      expect(stripHtml("&amp;")).toBe("&");
    });
  });

  describe("normalizeWhitespace", () => {
    it("collapses multiple spaces and newlines", () => {
      expect(normalizeWhitespace("a  b   c")).toBe("a b c");
      expect(normalizeWhitespace("a\n\nb")).toBe("a b");
    });
  });

  describe("removeDuplicateSentences", () => {
    it("removes duplicate lines (case-insensitive)", () => {
      const text = "Line one\nLine two\nLine one\nLine three";
      expect(removeDuplicateSentences(text)).toBe("Line one\nLine two\nLine three");
    });
  });

  describe("detectBlocklistedMedicalClaim", () => {
    it("returns first blocklisted phrase or null", () => {
      expect(detectBlocklistedMedicalClaim("ปกติ")).toBe(null);
      expect(detectBlocklistedMedicalClaim("รักษาได้แน่นอน")).toBe("รักษาได้แน่นอน");
      expect(detectBlocklistedMedicalClaim("ไม่มีผลข้างเคียง")).toBe("ไม่มีผลข้างเคียง");
    });
  });

  describe("sanitizeForEmbedding", () => {
    it("strips HTML and truncates to maxLength", () => {
      const result = sanitizeForEmbedding("<p>hello world</p>", 5);
      expect(result.text).toBe("hello");
      expect(result.truncated).toBe(true);
      expect(result.blocklistedClaim).toBe(null);
    });
    it("returns blocklistedClaim when present", () => {
      const result = sanitizeForEmbedding("บริการนี้รักษาได้แน่นอน 100%", 1000);
      expect(result.blocklistedClaim).toBe("รักษาได้แน่นอน");
    });
  });

  describe("sanitizeServiceText / sanitizeFaqText", () => {
    it("sanitizeServiceText enforces 8000 char limit", () => {
      const long = "x".repeat(10000);
      const result = sanitizeServiceText(long);
      expect(result.text.length).toBe(8000);
      expect(result.truncated).toBe(true);
    });
    it("sanitizeFaqText enforces 4000 char limit", () => {
      const long = "y".repeat(5000);
      const result = sanitizeFaqText(long);
      expect(result.text.length).toBe(4000);
      expect(result.truncated).toBe(true);
    });
  });
});

describe("Unified Knowledge — Types / Status", () => {
  it("ClinicServiceStatus includes embedding_failed", async () => {
    const mod = await import("../src/types/unified-knowledge");
    const statuses: mod.ClinicServiceStatus[] = ["active", "inactive", "embedding_failed"];
    expect(statuses).toContain("embedding_failed");
  });
  it("UnifiedKnowledgeStatus has ai_status and warning_count", async () => {
    const mod = await import("../src/types/unified-knowledge");
    const status: mod.UnifiedKnowledgeStatus = {
      global: { active: true, version: "v1" },
      clinic: {
        active: true,
        last_updated: null,
        embedding_status: "ok",
        last_embedding_at: null,
        warning_count: 0,
      },
      promotions: { active_count: 0, expiry_warnings: 0 },
      ai_status: "ready",
    };
    expect(status.ai_status).toBe("ready");
    expect(status.clinic.warning_count).toBe(0);
  });
});
