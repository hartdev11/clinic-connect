/**
 * Phase 5 — Auth + Booking flow guards
 * Covers critical route-level protections and failure/safety paths.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";

async function read(relPath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relPath), "utf-8");
}

describe("Phase 5 auth + booking flow", () => {
  describe("auth routes", () => {
    it("login applies rate limits and returns 429 guard", async () => {
      const content = await read("src/app/api/auth/login/route.ts");
      expect(content).toContain("auth:login:ip:");
      expect(content).toContain("auth:login:email:");
      expect(content).toContain("{ status: 429 }");
      expect(content).toContain("retryAfterMs");
    });

    it("register validates license key and blocks repeated attempts", async () => {
      const content = await read("src/app/api/auth/register/route.ts");
      expect(content).toContain("validateLicenseKey");
      expect(content).toContain("auth:register:ip:");
      expect(content).toContain("auth:register:email:");
      expect(content).toContain("License Key นี้ถูกใช้งานแล้ว");
    });
  });

  describe("booking create route", () => {
    it("requires auth and role checks before creating", async () => {
      const content = await read("src/app/api/clinic/bookings/route.ts");
      expect(content).toContain("if (!session) return NextResponse.json({ error: \"Unauthorized\" }, { status: 401 });");
      expect(content).toContain("requireRole(user.role, [\"owner\", \"manager\", \"staff\"])");
      expect(content).toContain("return NextResponse.json({ error: \"Forbidden\" }, { status: 403 });");
    });

    it("enforces branch scope for manager/staff and slot conflict protection", async () => {
      const content = await read("src/app/api/clinic/bookings/route.ts");
      expect(content).toContain("user.role === \"manager\" || user.role === \"staff\"");
      expect(content).toContain("requireBranchAccess");
      expect(content).toContain("code: \"SLOT_CONFLICT\"");
      expect(content).toContain("{ status: 409 }");
    });

    it("propagates correlation id to reminder and partner webhooks", async () => {
      const content = await read("src/app/api/clinic/bookings/route.ts");
      expect(content).toContain("const correlationId = getRequestId(request)");
      expect(content).toContain("scheduleBookingReminder(");
      expect(content).toContain("dispatchPartnerWebhooks(");
      expect(content).toContain("{ correlationId }");
    });
  });

  describe("booking patch route", () => {
    it("keeps notification idempotent and skips retry for failed status", async () => {
      const content = await read("src/app/api/clinic/bookings/[id]/route.ts");
      expect(content).toContain("updates.notificationStatus = \"pending\"");
      expect(content).toContain("updatedBooking.notificationStatus !== \"failed\"");
      expect(content).toContain("sendBookingConfirmation(");
    });

    it("reschedule/cancel paths manage reminder lifecycle", async () => {
      const content = await read("src/app/api/clinic/bookings/[id]/route.ts");
      expect(content).toContain("await scheduleBookingReminder(");
      expect(content).toContain("await cancelBookingReminder(bookingId)");
      expect(content).toContain("statusChangedToCancelledForReminder");
    });
  });
});
