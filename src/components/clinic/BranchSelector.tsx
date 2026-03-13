"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { apiFetcher } from "@/lib/api-fetcher";
import { cn } from "@/lib/utils";

export interface Branch {
  id: string;
  name: string;
  address?: string;
}

type BranchSelectorProps = {
  value: string | null;
  onChange: (branchId: string | null) => void;
  className?: string;
};

export function BranchSelector({ value, onChange, className }: BranchSelectorProps) {
  const { data, isLoading } = useSWR<{ items: Branch[] }>("/api/clinic/branches", apiFetcher);
  const branches = data?.items ?? [];
  const showSelector = branches.length > 1;

  const options = useMemo(() => {
    const all = { id: "all", name: "ทุกสาขา", value: null as string | null };
    const branchOpts = branches.map((b) => ({ id: b.id, name: b.name, value: b.id as string }));
    return [all, ...branchOpts];
  }, [branches]);

  if (!showSelector) return null;

  return (
    <div className={cn("relative", className)}>
      {isLoading ? (
        <div className="h-10 w-32 rounded-xl bg-rg-100 animate-pulse" />
      ) : (
        <select
          value={value ?? "all"}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "all" ? null : v);
          }}
          className="luxury-card px-4 py-2.5 pr-10 appearance-none cursor-pointer text-sm font-medium text-mauve-700 bg-cream-50/80 border border-rg-200 hover:border-rg-300 focus:border-rg-400 focus:outline-none focus:ring-2 focus:ring-rg-200/50 rounded-xl min-w-[140px]"
          aria-label="เลือกสาขา"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      )}
      {!isLoading && (
        <ChevronDownIcon
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mauve-400 pointer-events-none"
          aria-hidden
        />
      )}
    </div>
  );
}
