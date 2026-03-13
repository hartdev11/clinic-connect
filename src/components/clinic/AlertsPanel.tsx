"use client";

import Link from "next/link";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export interface AlertItem {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

interface AlertsPanelProps {
  alerts: AlertItem[];
  className?: string;
}

export function AlertsPanel({ alerts, className }: AlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-mauve-600 flex items-center gap-2">
        <ChartBarIcon className="w-4 h-4" />
        Smart Alerts
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const bgClass =
    alert.type === "error"
      ? "bg-[color:var(--ent-danger)]/8 border-l-[color:var(--ent-danger)]"
      : alert.type === "warning"
        ? "bg-[color:var(--ent-warning)]/8 border-l-[color:var(--ent-warning)]"
        : "bg-rg-100/80 border-l-rg-400";
  const content = (
    <div
      className={cn(
        "luxury-card p-4 border-l-4",
        bgClass
      )}
    >
      <p className="text-sm font-medium text-mauve-700">{alert.message}</p>
      {alert.actionUrl && (
        <Link
          href={alert.actionUrl}
          className="mt-2 inline-block text-xs font-medium text-rg-600 hover:text-rg-700"
        >
          {alert.actionLabel ?? "ดูเพิ่มเติม →"}
        </Link>
      )}
    </div>
  );
  if (alert.actionUrl && !alert.actionLabel?.includes("→")) {
    return (
      <Link href={alert.actionUrl} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export function buildSmartAlerts(opts: {
  usage_percentage?: number;
  pending_handoffs?: number;
  hot_leads_count?: number;
  booking_conversion_rate?: number;
  estimated_revenue_month?: number;
}): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (typeof opts.usage_percentage === "number" && opts.usage_percentage > 80) {
    alerts.push({
      id: "quota",
      type: "warning",
      message: "โควต้าใกล้หมด",
      actionUrl: "/clinic/settings?tab=billing",
      actionLabel: "จัดการบัญชี →",
    });
  }
  if (typeof opts.pending_handoffs === "number" && opts.pending_handoffs > 10) {
    alerts.push({
      id: "handoffs",
      type: "error",
      message: "ลูกค้ารอตอบเยอะ",
      actionUrl: "/clinic/handoff",
      actionLabel: "ไป Handoff →",
    });
  }
  if (typeof opts.hot_leads_count === "number" && opts.hot_leads_count > 5) {
    alerts.push({
      id: "hot-leads",
      type: "info",
      message: "Hot Leads รอติดตาม",
      actionUrl: "/clinic/customers?filter=hot",
      actionLabel: "ติดตาม →",
    });
  }
  if (
    typeof opts.booking_conversion_rate === "number" &&
    opts.booking_conversion_rate > 0 &&
    opts.booking_conversion_rate < 15
  ) {
    alerts.push({
      id: "conversion",
      type: "warning",
      message: "Conversion ต่ำกว่าปกติ",
      actionUrl: "/clinic/insights",
      actionLabel: "ดู Insights →",
    });
  }
  return alerts;
}
