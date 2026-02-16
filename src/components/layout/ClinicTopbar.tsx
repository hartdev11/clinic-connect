"use client";

import { usePathname } from "next/navigation";
import { useClinicContext } from "@/contexts/ClinicContext";
import { NotificationBell } from "@/components/clinic/NotificationBell";

const pageTitles: Record<string, string> = {
  "/clinic": "Dashboard",
  "/clinic/customers": "Customers & Chat",
  "/clinic/booking": "Booking",
  "/clinic/promotions": "Promotions",
  "/clinic/insights": "Insights",
  "/clinic/finance": "Finance",
  "/clinic/settings": "Clinic Settings",
  "/clinic/slot-settings": "การตั้งค่าคิว",
  "/clinic/queue-display": "หน้าจอคิว",
  "/clinic/users": "User & Roles",
};

export function ClinicTopbar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Admin";
  const {
    currentOrg,
    currentBranch,
    setSelectedBranchId,
  } = useClinicContext();
  const clinicName = currentOrg?.name ?? "Clinic Connect";
  const branches = currentOrg?.branches ?? [];
  const hasMultipleBranches = branches.length > 1;

  return (
    <header className="h-14 flex-shrink-0 bg-white/90 backdrop-blur-sm border-b border-primary-200/50 flex items-center justify-between px-6 print:hidden">
      <div>
        <h1 className="text-base font-semibold text-surface-800">{title}</h1>
        <p className="text-xs text-primary-700/70 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{clinicName}</span>
          {currentBranch && (
            <>
              <span>—</span>
              {hasMultipleBranches ? (
                <select
                  value={currentBranch.id}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  className="bg-transparent text-surface-600 font-medium cursor-pointer focus:outline-none focus:ring-0 border-0 p-0"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{currentBranch.name}</span>
              )}
            </>
          )}
          <span>— ระบบหลังบ้าน</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-medium border border-primary-200/60 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          AI ตอบแชท 24 ชม.
        </div>
        <NotificationBell />
        <div
          className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm border border-primary-200/60"
          title="Admin"
        >
          A
        </div>
      </div>
    </header>
  );
}
