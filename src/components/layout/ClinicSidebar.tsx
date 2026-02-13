"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RequireRole } from "@/components/rbac/RequireRole";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  allowedRoles?: ("owner" | "manager" | "staff")[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [{ href: "/clinic", label: "Dashboard", icon: "📊" }],
  },
  {
    label: "การดำเนินงาน",
    items: [
      { href: "/clinic/customers", label: "Customers & Chat", icon: "💬" },
      { href: "/clinic/booking", label: "Booking", icon: "📅" },
      { href: "/clinic/queue-display", label: "หน้าจอคิว", icon: "📺" },
      { href: "/clinic/promotions", label: "Promotions", icon: "🏷️" },
    ],
  },
  {
    label: "ข้อมูล & AI",
    items: [
      { href: "/clinic/insights", label: "Insights", icon: "📈" },
      { href: "/clinic/finance", label: "Finance", icon: "💰", allowedRoles: ["owner", "manager"] },
      { href: "/clinic/ai-agents", label: "AI Agents", icon: "🤖" },
      { href: "/clinic/knowledge", label: "Knowledge Input", icon: "📚" },
      { href: "/clinic/knowledge-brain", label: "Knowledge Control Center", icon: "🧠" },
    ],
  },
  {
    label: "ตั้งค่า",
    items: [
      { href: "/clinic/settings", label: "Clinic Settings", icon: "⚙️" },
      { href: "/clinic/slot-settings", label: "การตั้งค่าคิว", icon: "🕐", allowedRoles: ["owner", "manager"] },
      { href: "/clinic/users", label: "User & Roles", icon: "👥", allowedRoles: ["owner", "manager"] },
      { href: "/clinic/admin-monitoring", label: "Admin Monitoring", icon: "📡", allowedRoles: ["owner"] },
      { href: "/clinic/knowledge-health", label: "Knowledge Health", icon: "🏥", allowedRoles: ["owner"] },
    ],
  },
];

export function ClinicSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-surface-100 flex flex-col flex-shrink-0 print:hidden">
      <div className="p-5 border-b border-surface-100">
        <Link
          href="/clinic"
          className="flex items-center gap-3 group transition-colors"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white font-bold text-lg shadow-sm">
            ✦
          </span>
          <div className="min-w-0">
            <span className="block text-base font-bold text-surface-800 group-hover:text-primary-600 transition-colors truncate">
              Clinic Connect
            </span>
            <p className="text-xs text-surface-500 mt-0.5">คลินิกความงาม</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const content = (
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "bg-primary-50 text-primary-700"
                          : "text-surface-600 hover:bg-surface-50 hover:text-surface-800"
                      }
                    `}
                  >
                    <span className="text-base opacity-90" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {item.allowedRoles ? (
                      <RequireRole allowed={item.allowedRoles}>{content}</RequireRole>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-surface-100">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-surface-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
        >
          <span aria-hidden>⎋</span>
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
