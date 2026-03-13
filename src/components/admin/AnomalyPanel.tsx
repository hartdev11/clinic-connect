"use client";

import useSWR from "swr";
import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface AnomalyItem {
  id: string;
  orgId: string;
  orgName: string;
  metric: string;
  severity: "HIGH" | "MEDIUM";
  actualValue: number;
  expectedValue: number;
  deviationPct: number;
  timestamp: string;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

export function AnomalyPanel() {
  const { data, isLoading } = useSWR<{ anomalies: AnomalyItem[] }>(
    "/api/admin/anomalies",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  const anomalies = data?.anomalies ?? [];

  if (isLoading) {
    return (
      <div className="luxury-card p-6 animate-pulse">
        <div className="h-5 w-40 bg-cream-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-cream-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="luxury-card p-6">
        <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5" />
          Anomaly Detection
        </h3>
        <p className="font-body text-sm text-mauve-500">ไม่พบความผิดปกติ</p>
      </div>
    );
  }

  return (
    <div className="luxury-card p-6">
      <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4 flex items-center gap-2">
        <ExclamationTriangleIcon className="w-5 h-5" />
        Anomaly Detection
      </h3>
      <div className="space-y-3">
        {anomalies.slice(0, 10).map((a) => (
          <div
            key={a.id}
            className={`p-4 rounded-xl border-l-4 ${
              a.severity === "HIGH"
                ? "border-[color:var(--ent-danger)] bg-[color:var(--ent-danger)]/5"
                : "border-[color:var(--ent-warning)] bg-[color:var(--ent-warning)]/5"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-body font-medium text-mauve-800">{a.metric}</p>
                <p className="font-body text-sm text-mauve-600">
                  {a.orgName} — Actual: {a.actualValue.toFixed(0)} | Expected: {a.expectedValue.toFixed(0)} | {a.deviationPct > 0 ? "+" : ""}{a.deviationPct}%
                </p>
              </div>
              <Link
                href={`/clinic/admin-monitoring?org=${a.orgId}`}
                className="text-xs font-medium text-rg-600 hover:text-rg-700 shrink-0"
              >
                Investigate
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
