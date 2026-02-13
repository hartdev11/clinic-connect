/**
 * Cross-Tenant Enforcement Layer
 * requireOrgIsolation(session, resourceOrgId) — ใช้ทุกที่ที่อ่าน resource by id
 * ถ้า org mismatch → throw + audit log
 *
 * Phase 2 #24: Zero Trust — org_id มาจาก session เท่านั้น ห้ามเชื่อ client-sent org_id
 */

import type { SessionPayload } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";

/** Phase 2 #24 / Phase 3 #12: Resolve org_id จาก session เท่านั้น — NEVER use client-sent org_id */
export async function resolveOrgIdFromSession(session: SessionPayload | null): Promise<string | null> {
  if (!session) return null;
  return session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
}

/** Phase 3 #12: Reject if body contains org_id — Zero Trust */
export function rejectClientSentOrgId(body: Record<string, unknown>): void {
  if (body && "org_id" in body && body.org_id !== undefined) {
    throw new Error("Zero Trust: org_id must not be sent by client.");
  }
}
import { writeAuditLog } from "@/lib/audit-log";

export class OrgIsolationError extends Error {
  constructor(
    message: string,
    public readonly sessionOrgId: string | null,
    public readonly resourceOrgId: string
  ) {
    super(message);
    this.name = "OrgIsolationError";
  }
}

/**
 * ยืนยันว่า session มีสิทธิ์เข้าถึง resource ของ org นี้
 * @throws OrgIsolationError ถ้า org ไม่ตรง
 */
export function requireOrgIsolation(
  session: SessionPayload | null,
  resourceOrgId: string,
  context?: { resource?: string; id?: string }
): asserts session is SessionPayload {
  if (!session) {
    throw new OrgIsolationError("Unauthorized", null, resourceOrgId);
  }
  const sessionOrgId = session.org_id ?? null;
  if (!sessionOrgId || sessionOrgId !== resourceOrgId) {
    writeAuditLog({
      event: "failed_auth",
      org_id: sessionOrgId ?? undefined,
      user_id: session.user_id ?? undefined,
      email: session.email,
      details: {
        reason: "org_isolation_mismatch",
        resourceOrgId,
        resource: context?.resource,
        resourceId: context?.id,
      },
    }).catch(() => {});
    throw new OrgIsolationError(
      "Access denied: organization mismatch",
      sessionOrgId,
      resourceOrgId
    );
  }
}
