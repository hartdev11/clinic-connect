/**
 * Phase 10 — Staff magic link invites
 * Firestore: organizations/{orgId}/invites/{token}
 */
import { db } from "@/lib/firebase-admin";
import type { UserRole } from "@/types/organization";

const INVITES_SUB = "invites";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export interface StaffInvite {
  token: string;
  email: string;
  role: UserRole;
  branchId?: string | null;
  branch_ids?: string[] | null;
  branch_roles?: Record<string, "manager" | "staff"> | null;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

function invitesRef(orgId: string) {
  return db.collection("organizations").doc(orgId).collection(INVITES_SUB);
}

/** Create invite doc — token encodes orgId for fast lookup */
export async function createStaffInvite(
  orgId: string,
  data: {
    email: string;
    role: UserRole;
    branchId?: string | null;
    branch_ids?: string[] | null;
    branch_roles?: Record<string, "manager" | "staff"> | null;
  }
): Promise<string> {
  const unique = crypto.randomUUID() + Date.now().toString(36);
  const token = orgId + "--" + unique;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  await invitesRef(orgId).doc(token).set({
    email: data.email.trim().toLowerCase(),
    role: data.role,
    branchId: data.branchId ?? null,
    branch_ids: data.branch_ids ?? null,
    branch_roles: data.branch_roles ?? null,
    expiresAt,
    used: false,
    createdAt: now,
  });
  return token;
}

/** Get invite by token — token format: orgId--uuidTimestamp */
export async function getInviteByToken(
  token: string
): Promise<{ orgId: string; invite: StaffInvite } | null> {
  const sep = token.indexOf("--");
  if (sep <= 0) return null;
  const orgId = token.slice(0, sep);
  const inviteDoc = await invitesRef(orgId).doc(token).get();
  if (!inviteDoc.exists) return null;
  const d = inviteDoc.data()!;
  const invite: StaffInvite = {
    token,
    email: (d.email as string) ?? "",
    role: (d.role as UserRole) ?? "staff",
    branchId: (d.branchId as string) ?? null,
    branch_ids: (d.branch_ids as string[]) ?? null,
    branch_roles: (d.branch_roles as Record<string, "manager" | "staff">) ?? null,
    expiresAt: toISO(d.expiresAt),
    used: !!(d.used ?? false),
    createdAt: toISO(d.createdAt),
  };
  if (!invite.used && new Date(invite.expiresAt) > new Date()) {
    return { orgId, invite };
  }
  return null;
}

/** Mark invite as used */
export async function markInviteUsed(orgId: string, token: string): Promise<boolean> {
  const ref = invitesRef(orgId).doc(token);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({ used: true });
  return true;
}
