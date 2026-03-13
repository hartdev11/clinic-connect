"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useClinicContext } from "@/contexts/ClinicContext";
import { NotificationBell } from "@/components/clinic/NotificationBell";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";

export function ClinicTopbar({
  onMobileMenuOpen,
}: {
  onMobileMenuOpen?: () => void;
}) {
  const {
    currentOrg,
    currentBranch,
    setSelectedBranchId,
    currentUser,
  } = useClinicContext();
  const clinicName = currentOrg?.name ?? "Clinic Connect";
  const branches = currentOrg?.branches ?? [];
  const hasMultipleBranches = branches.length > 1;

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "h-16 flex-shrink-0 flex items-center gap-4 px-6",
        "glass-frosted border-b border-cream-300/60",
        "sticky top-0 z-30 print:hidden"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl hover:bg-cream-200 transition-colors text-mauve-600"
          onClick={onMobileMenuOpen}
          aria-label="เปิดเมนู"
        >
          <span className="text-lg">☰</span>
        </button>
        <BreadcrumbNav />
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cream-200/60 border border-cream-300/60 text-xs font-body font-medium text-mauve-600">
          <span className="w-1.5 h-1.5 rounded-full bg-rg-500 animate-pulse flex-shrink-0" />
          AI ตอบแชท 24 ชม.
        </div>
        <NotificationBell />
        {hasMultipleBranches && currentBranch != null && (
          <div className="hidden md:block">
            <select
              value={currentBranch.id}
              onChange={(e) => setSelectedBranchId(e.target.value || null)}
              className={cn(
                "flex items-center gap-2 h-9 pl-2 pr-3 rounded-xl",
                "glass border border-rg-200/60 hover:border-rg-300",
                "text-sm font-body text-mauve-600 max-w-[140px] truncate",
                "bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-rg-300/50"
              )}
              aria-label="เลือกสาขา"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!hasMultipleBranches && currentBranch != null && (
          <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-xl glass border border-rg-200/60">
            <span className="w-2 h-2 rounded-full bg-rg-500 flex-shrink-0" />
            <span className="text-sm font-body text-mauve-600 max-w-[120px] truncate">
              {currentBranch.name}
            </span>
          </div>
        )}
        <div
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center text-white text-sm font-medium shadow-luxury flex-shrink-0"
          title={clinicName}
        >
          {currentUser?.role != null
            ? String(currentUser.role).charAt(0).toUpperCase()
            : "A"}
        </div>
      </div>
    </motion.header>
  );
}
