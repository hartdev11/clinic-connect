"use client";

/**
 * FE-1 — App Context (รองรับ E1–E7)
 * currentOrg, currentBranch, currentUser, subscriptionPlan
 * org_id, branch_id มาจาก backend/token
 */
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import useSWR from "swr";
import type { OrgPlan, UserRole } from "@/types/organization";

export interface BranchInfo {
  id: string;
  name: string;
  address: string;
}

export interface OrgInfo {
  id: string;
  name: string;
  plan: OrgPlan;
  branchesCount: number;
  branches: BranchInfo[];
}

export interface UserInfo {
  role: UserRole;
  branch_ids: string[] | null;
  branch_roles: Record<string, string> | null;
  permissions: { role: UserRole };
}

export interface SubscriptionPlanInfo {
  plan: OrgPlan;
  status: string;
  maxBranches: number;
}

export interface ClinicContextValue {
  org_id: string | null;
  branch_id: string | null;
  currentOrg: OrgInfo | null;
  currentBranch: BranchInfo | null;
  currentUser: UserInfo | null;
  subscriptionPlan: SubscriptionPlanInfo | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Unauthorized");
    return r.json();
  });

const ClinicContext = createContext<ClinicContextValue | null>(null);

export function ClinicContextProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/clinic/context",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    null
  );

  const setSelectedBranchId = useCallback((id: string | null) => {
    setSelectedBranchIdState(id);
  }, []);

  const effectiveBranchId =
    selectedBranchId ?? data?.branch_id ?? data?.currentBranch?.id ?? null;

  const currentBranch = useMemo(() => {
    if (!data?.currentOrg?.branches) return data?.currentBranch ?? null;
    if (effectiveBranchId) {
      const b = data.currentOrg.branches.find((x: BranchInfo) => x.id === effectiveBranchId);
      return b ?? data.currentBranch ?? null;
    }
    return data.currentBranch ?? null;
  }, [data, effectiveBranchId]);

  const value: ClinicContextValue = useMemo(
    () => ({
      org_id: data?.org_id ?? null,
      branch_id: effectiveBranchId,
      currentOrg: data?.currentOrg ?? null,
      currentBranch,
      currentUser: data?.currentUser ?? null,
      subscriptionPlan: data?.subscriptionPlan ?? null,
      selectedBranchId: effectiveBranchId,
      setSelectedBranchId,
      isLoading,
      error: error ?? null,
      mutate,
    }),
    [data, effectiveBranchId, currentBranch, selectedBranchId, isLoading, error, mutate, setSelectedBranchId]
  );

  return (
    <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
  );
}

export function useClinicContext(): ClinicContextValue {
  const ctx = useContext(ClinicContext);
  if (!ctx) {
    throw new Error("useClinicContext must be used within ClinicContextProvider");
  }
  return ctx;
}
