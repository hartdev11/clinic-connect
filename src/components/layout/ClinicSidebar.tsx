"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Squares2X2Icon,
  UserGroupIcon,
  CalendarDaysIcon,
  TagIcon,
  ChartBarIcon,
  BanknotesIcon,
  SparklesIcon,
  BuildingStorefrontIcon,
  QueueListIcon,
  ShieldCheckIcon,
  ServerStackIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as Squares2X2IconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  TagIcon as TagIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  SparklesIcon as SparklesIconSolid,
  BuildingStorefrontIcon as BuildingStorefrontIconSolid,
  QueueListIcon as QueueListIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  ServerStackIcon as ServerStackIconSolid,
  HeartIcon as HeartIconSolid,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { useClinicContext } from "@/contexts/ClinicContext";
import { RequireRole } from "@/components/rbac/RequireRole";

type NavIconComponent = React.ComponentType<{ className?: string }>;

type NavItem = {
  href: string;
  label: string;
  IconOutline: NavIconComponent;
  IconSolid: NavIconComponent;
  allowedRoles?: ("owner" | "manager" | "staff")[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [{ href: "/clinic", label: "Dashboard", IconOutline: Squares2X2Icon, IconSolid: Squares2X2IconSolid }],
  },
  {
    label: "การดำเนินงาน",
    items: [
      { href: "/clinic/customers", label: "Customers & Chat", IconOutline: UserGroupIcon, IconSolid: UserGroupIconSolid },
      { href: "/clinic/handoff", label: "Handoff", IconOutline: QueueListIcon, IconSolid: QueueListIconSolid },
      { href: "/clinic/booking", label: "Booking", IconOutline: CalendarDaysIcon, IconSolid: CalendarDaysIconSolid },
      { href: "/clinic/promotions", label: "Promotions", IconOutline: TagIcon, IconSolid: TagIconSolid },
    ],
  },
  {
    label: "ข้อมูล & AI",
    items: [
      { href: "/clinic/insights", label: "Insights", IconOutline: ChartBarIcon, IconSolid: ChartBarIconSolid },
      {
        href: "/clinic/finance",
        label: "Finance",
        IconOutline: BanknotesIcon,
        IconSolid: BanknotesIconSolid,
        allowedRoles: ["owner", "manager"],
      },
      {
        href: "/clinic/knowledge",
        label: "ข้อมูลที่ AI ใช้ตอบลูกค้า",
        IconOutline: SparklesIcon,
        IconSolid: SparklesIconSolid,
      },
    ],
  },
  {
    label: "ตั้งค่า",
    items: [
      { href: "/clinic/settings", label: "Clinic Settings", IconOutline: BuildingStorefrontIcon, IconSolid: BuildingStorefrontIconSolid },
      {
        href: "/clinic/slot-settings",
        label: "การตั้งค่าคิว",
        IconOutline: QueueListIcon,
        IconSolid: QueueListIconSolid,
        allowedRoles: ["owner", "manager"],
      },
      {
        href: "/clinic/users",
        label: "User & Roles",
        IconOutline: ShieldCheckIcon,
        IconSolid: ShieldCheckIconSolid,
        allowedRoles: ["owner", "manager"],
      },
      {
        href: "/clinic/admin-monitoring",
        label: "Admin Monitoring",
        IconOutline: ServerStackIcon,
        IconSolid: ServerStackIconSolid,
        allowedRoles: ["owner"],
      },
      {
        href: "/clinic/knowledge-health",
        label: "Knowledge Health",
        IconOutline: HeartIcon,
        IconSolid: HeartIconSolid,
        allowedRoles: ["owner"],
      },
    ],
  },
];

const sidebarGradient =
  "linear-gradient(160deg, var(--rg-900) 0%, var(--mauve-600) 35%, var(--rg-800) 70%, var(--mauve-500) 100%)";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  multi_branch: "Multi Branch",
  enterprise: "Enterprise",
};

/* Semantic glow — mauve (violet) and rg (amber) from design system */
const VIOLET_GLOW = "rgba(196,135,159,0.4)";
const AMBER_GLOW = "rgba(201,149,108,0.5)";

type PlanShimmer = {
  background: string;
  backgroundSize: string;
  duration: number;
  filterAnimate?: [string, string, string];
  filterDuration?: number;
};

function getPlanShimmer(planName: string): PlanShimmer {
  const n = planName.trim();
  if (n === "Starter") {
    return {
      background: "linear-gradient(90deg, var(--cream-400), var(--cream-100), var(--cream-400))",
      backgroundSize: "200% auto",
      duration: 3,
    };
  }
  if (n === "Professional") {
    return {
      background: "linear-gradient(90deg, var(--mauve-300), var(--rg-300), var(--mauve-300))",
      backgroundSize: "250% auto",
      duration: 2,
      filterAnimate: [
        `drop-shadow(0 0 3px ${VIOLET_GLOW})`,
        `drop-shadow(0 0 5px ${VIOLET_GLOW})`,
        `drop-shadow(0 0 3px ${VIOLET_GLOW})`,
      ],
      filterDuration: 2.5,
    };
  }
  if (n === "Enterprise") {
    return {
      background: "linear-gradient(90deg, var(--rg-700), var(--rg-400), var(--rg-300), var(--rg-500), var(--rg-400), var(--rg-700))",
      backgroundSize: "300% auto",
      duration: 1.5,
      filterAnimate: [
        `drop-shadow(0 0 4px ${AMBER_GLOW})`,
        `drop-shadow(0 0 14px ${AMBER_GLOW})`,
        `drop-shadow(0 0 4px ${AMBER_GLOW})`,
      ],
      filterDuration: 2,
    };
  }
  return {
    background: "linear-gradient(90deg, var(--cream-400), var(--cream-100), var(--cream-400))",
    backgroundSize: "200% auto",
    duration: 3,
  };
}

function SidebarInnerContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { subscriptionPlan, currentOrg, currentUser, isLoading } = useClinicContext();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const planValue = subscriptionPlan?.plan ?? currentOrg?.plan;
  const planName = isLoading
    ? "กำลังโหลด..."
    : planValue != null
      ? (PLAN_LABELS[planValue] ?? String(planValue).replace(/_/g, " "))
      : "Free";
  const planShimmer = getPlanShimmer(planName);

  return (
    <>
      <div className="px-6 py-6 flex-shrink-0">
        <Link
          href="/clinic"
          className="flex items-center gap-3 group transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center shadow-luxury flex-shrink-0">
            <span className="text-white text-base">✦</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-cream-100 leading-tight truncate">
              Clinic Connect
            </p>
            <p className="text-[10px] font-body text-rg-300 tracking-widest uppercase truncate">
              Beauty Management
            </p>
          </div>
        </Link>

        <div className="mt-4 p-3 rounded-xl bg-white/8 border border-white/10">
          <p className="text-[10px] font-body text-rg-300 uppercase tracking-widest">
            แผนปัจจุบัน
          </p>
          <p className="text-lg font-bold font-body truncate mt-0.5">
            <motion.span
              key={planName}
              className="block bg-clip-text"
              style={{
                background: planShimmer.background,
                backgroundSize: planShimmer.backgroundSize,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%"],
                ...(planShimmer.filterAnimate && { filter: planShimmer.filterAnimate }),
              }}
              transition={
                planShimmer.filterAnimate
                  ? {
                      backgroundPosition: { duration: planShimmer.duration, repeat: Infinity, ease: "linear" },
                      filter: {
                        duration: planShimmer.filterDuration ?? 2,
                        repeat: Infinity,
                        ease: "easeInOut" as const,
                      },
                    }
                  : {
                      duration: planShimmer.duration,
                      repeat: Infinity,
                      ease: "linear",
                    }
              }
            >
              {planName}
            </motion.span>
          </p>
        </div>
      </div>

      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-rg-400/30 to-transparent flex-shrink-0" />

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navGroups.map((group, groupIdx) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-body font-medium text-rg-400/70 tracking-widest uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item, itemIdx) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/clinic" && pathname.startsWith(item.href));

                const content = (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                      "font-body text-sm transition-all duration-200",
                      "group relative overflow-hidden",
                      isActive
                        ? "bg-white/15 text-cream-100 shadow-sm"
                        : "text-cream-200/70 hover:bg-white/8 hover:text-cream-100"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-rg-400 rounded-full"
                        transition={{
                          duration: 0.3,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                      />
                    )}
                    <span
                      className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 text-sm transition-all duration-200",
                        isActive
                          ? "bg-rg-500/80 text-white shadow-sm"
                          : "bg-white/8 text-rg-300 group-hover:bg-white/12 group-hover:text-rg-200"
                      )}
                    >
                      {isActive ? (
                        <item.IconSolid className="w-5 h-5" />
                      ) : (
                        <item.IconOutline className="w-5 h-5" />
                      )}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rg-400 flex-shrink-0" />
                    )}
                  </Link>
                );

                return (
                  <motion.li
                    key={item.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: groupIdx * 0.05 + itemIdx * 0.04,
                      duration: 0.35,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    {item.allowedRoles != null ? (
                      <RequireRole allowed={item.allowedRoles}>
                        {content}
                      </RequireRole>
                    ) : (
                      content
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-rg-400/30 to-transparent flex-shrink-0" />

      <div className="px-3 py-4 flex-shrink-0 space-y-2">
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
            "text-cream-200/80 hover:bg-white/8 hover:text-cream-100",
            "transition-all duration-200 group"
          )}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-medium shadow-luxury">
            {currentUser?.role != null
              ? String(currentUser.role).charAt(0).toUpperCase()
              : "A"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-body font-medium text-cream-100 truncate">
              ผู้ใช้ระบบ
            </p>
            <p className="text-[10px] font-body text-rg-400 truncate">
              {currentUser?.role ?? "—"}
            </p>
          </div>
          <span className="text-rg-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            ออกจากระบบ →
          </span>
        </button>
      </div>
    </>
  );
}

export function ClinicSidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (mobileOpen && onMobileClose && pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      onMobileClose();
    } else {
      prevPathnameRef.current = pathname;
    }
  }, [pathname, mobileOpen, onMobileClose]);

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden lg:flex flex-col w-[280px] flex-shrink-0 h-screen sticky top-0 overflow-hidden print:hidden"
        style={{ background: sidebarGradient }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-rg-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -left-10 w-40 h-40 rounded-full bg-mauve-300/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full overflow-y-auto overflow-x-hidden">
          <SidebarInnerContent />
        </div>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-mauve-900/40 backdrop-blur-sm"
              onClick={onMobileClose}
              aria-hidden
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                duration: 0.35,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] overflow-hidden"
              style={{ background: sidebarGradient }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                  <span className="font-display text-lg font-semibold text-cream-100">
                    เมนู
                  </span>
                  <button
                    type="button"
                    onClick={onMobileClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-cream-200 hover:bg-white/10 transition-colors"
                    aria-label="ปิดเมนู"
                  >
                    ✕
                  </button>
                </div>
                <SidebarInnerContent />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
