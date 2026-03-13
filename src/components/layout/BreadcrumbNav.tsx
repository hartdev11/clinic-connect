"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const pathLabels: Record<string, string> = {
  clinic: "Dashboard",
  customers: "ลูกค้า & แชท",
  booking: "การจอง",
  promotions: "โปรโมชัน",
  knowledge: "Knowledge Base",
  "knowledge-brain": "AI Brain",
  "knowledge-health": "Knowledge Health",
  "ai-agents": "AI Agents",
  insights: "Insights",
  finance: "การเงิน",
  settings: "ตั้งค่า",
  users: "ผู้ใช้งาน",
  "slot-settings": "ตั้งค่าสล็อต",
  "admin-monitoring": "Admin Monitor",
  "ai-cost-monitor": "AI Cost",
  feedback: "Feedback",
  "franchise-requests": "Franchise",
  new: "สร้างใหม่",
  edit: "แก้ไข",
};

export function BreadcrumbNav() {
  const pathname = usePathname();

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: pathLabels[seg] ?? seg,
      href: "/" + arr.slice(0, i + 1).join("/"),
      isLast: i === arr.length - 1,
    }));

  if (segments.length <= 1) {
    return (
      <h2 className="font-display text-lg font-semibold text-mauve-800">
        {segments[0]?.label ?? "Dashboard"}
      </h2>
    );
  }

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1.5 min-w-0 flex-wrap"
    >
      {segments.map((seg, i) => (
        <motion.span
          key={seg.href}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="flex items-center gap-1.5 min-w-0"
        >
          {i > 0 && (
            <span className="text-cream-400 text-xs flex-shrink-0">›</span>
          )}
          {seg.isLast ? (
            <span
              className={cn(
                "font-body text-sm font-medium truncate",
                "text-mauve-800"
              )}
            >
              {seg.label}
            </span>
          ) : (
            <Link
              href={seg.href}
              className="font-body text-sm text-mauve-400 hover:text-rg-500 transition-colors truncate"
            >
              {seg.label}
            </Link>
          )}
        </motion.span>
      ))}
    </nav>
  );
}
