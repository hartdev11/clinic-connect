import type { SessionPayload } from "@/lib/auth-session";

export type KnowledgeAction = "read" | "create" | "edit" | "delete" | "reindex" | "worker_trigger";

function normalizeRole(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

export function canAccessKnowledgeAction(
  action: KnowledgeAction,
  session: SessionPayload,
  effectiveRole: string | null | undefined
): boolean {
  const roles = new Set<string>([
    normalizeRole(session.role),
    normalizeRole(effectiveRole),
  ]);

  if (roles.has("platform_admin") || roles.has("super_admin")) return true;
  if (roles.has("clinic_owner") || roles.has("owner")) return true;

  if (action === "read") {
    return roles.has("clinic_manager") || roles.has("manager") || roles.has("staff");
  }
  if (action === "create" || action === "edit") {
    return roles.has("clinic_manager") || roles.has("manager");
  }
  if (action === "delete" || action === "reindex" || action === "worker_trigger") {
    return false;
  }
  return false;
}
