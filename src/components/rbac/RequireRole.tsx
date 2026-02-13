/**
 * FE-2 — Permission-based Conditional Rendering
 * ซ่อน UI ตาม role (org-level)
 */
"use client";

import { type ReactNode } from "react";
import { useRequireRole } from "@/hooks/usePermissions";
import type { UserRole } from "@/types/organization";

interface RequireRoleProps {
  allowed: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ allowed, children, fallback = null }: RequireRoleProps) {
  const hasAccess = useRequireRole(allowed);
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
