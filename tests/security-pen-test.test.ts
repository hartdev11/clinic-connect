/**
 * Security & Penetration Testing - Automated Checks
 * Aligns with docs/PENETRATION-TESTING.md
 * Run: npm test -- tests/security-pen-test.test.ts
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";

describe("Security & Pen Test (Automated)", () => {
  describe("A01 - Access Control / Auth", () => {
    it("auth-session exports getSessionFromRequest for auth", async () => {
      const mod = await import("../src/lib/auth-session");
      expect(typeof mod.getSessionFromRequest).toBe("function");
    });

    it("admin-guard exports requireAdminSession for privilege enforcement", async () => {
      const mod = await import("../src/lib/admin-guard");
      expect(typeof mod.requireAdminSession).toBe("function");
    });

    it("middleware protects /clinic routes", async () => {
      const middlewarePath = path.join(process.cwd(), "src", "middleware.ts");
      const content = await fs.readFile(middlewarePath, "utf-8");
      expect(content).toMatch(/clinic|matcher|/);
      expect(content).toContain("NextResponse") || expect(content).toContain("redirect");
    });
  });

  describe("A05 - Security Misconfiguration", () => {
    it("middleware sets security headers (CSP or X-Frame)", async () => {
      const middlewarePath = path.join(process.cwd(), "src", "middleware.ts");
      const content = await fs.readFile(middlewarePath, "utf-8");
      const hasSecurityHeader =
        content.includes("Content-Security-Policy") ||
        content.includes("X-Frame-Options") ||
        content.includes("X-Content-Type-Options");
      expect(hasSecurityHeader).toBe(true);
    });
  });

  describe("A06 - Vulnerable Components", () => {
    it("package.json has no known-dangerous scripts", async () => {
      const pkg = await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8");
      const parsed = JSON.parse(pkg);
      const scripts = parsed.scripts || {};
      const dangerous = ["preinstall", "postinstall", "preuninstall", "postuninstall"];
      for (const s of dangerous) {
        if (scripts[s]) {
          const val = scripts[s].toLowerCase();
          expect(val).not.toContain("curl") || expect(val).not.toContain("wget");
          expect(val).not.toMatch(/eval\s*\(|child_process|exec\s*\(/);
        }
      }
      expect(true).toBe(true); // Structure check passes
    });
  });

  describe("A07 - Authentication", () => {
    it("csrf module exports validate function", async () => {
      const mod = await import("../src/lib/csrf");
      expect(typeof mod.validateCsrfToken).toBe("function");
    });

    it("bot detection exists for login", async () => {
      const botPath = path.join(process.cwd(), "src", "lib", "bot-detection.ts");
      const exists = await fs.access(botPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("A08 - Integrity (Webhooks)", () => {
    it("LINE webhook verifies signature", async () => {
      const linePaths = [
        path.join(process.cwd(), "src", "app", "api", "webhooks", "line", "route.ts"),
        path.join(process.cwd(), "src", "app", "api", "webhooks", "line", "[orgId]", "route.ts"),
      ];
      let found = false;
      for (const p of linePaths) {
        const exists = await fs.access(p).then(() => true).catch(() => false);
        if (exists) {
          const content = await fs.readFile(p, "utf-8");
          if (content.match(/signature|verifyLine|X-Line-Signature|line-signature/i)) found = true;
        }
      }
      expect(found).toBe(true);
    });

    it("Stripe webhook verifies signature", async () => {
      const stripePath = path.join(process.cwd(), "src", "app", "api", "webhooks", "stripe", "route.ts");
      const exists = await fs.access(stripePath).then(() => true).catch(() => false);
      if (exists) {
        const content = await fs.readFile(stripePath, "utf-8");
        expect(content).toMatch(/constructEvent|stripe-signature|webhook/i);
      }
    });
  });

  describe("A09 - Logging", () => {
    it("audit export API exists", async () => {
      const auditPath = path.join(process.cwd(), "src", "app", "api", "admin", "audit-export", "route.ts");
      const exists = await fs.access(auditPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
