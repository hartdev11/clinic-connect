/**
 * FE-2 — Branch-scoped Permission Component
 * ซ่อน UI ตาม branch access
 */
"use client";

import { type ReactNode } from "react";
import { useRequireBranchAccess } from "@/hooks/usePermissions";

interface RequireBranchAccessProps {
  branchId?: string | null;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireBranchAccess({
  branchId,
  children,
  fallback = null,
}: RequireBranchAccessProps) {
  const hasAccess = useRequireBranchAccess(branchId ?? null);
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
