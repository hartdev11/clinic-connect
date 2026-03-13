"use client";

import useSWR from "swr";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { AnomalyPanel } from "@/components/admin/AnomalyPanel";
import { TopOrgsByCostChart } from "@/components/admin/TopOrgsByCostChart";

interface PlatformMetrics {
  totalOrgs: number;
  activeOrgs: number;
  totalConversationsThisMonth: number;
  totalRevenueThisMonth: number;
  total_ai_cost?: number;
  platform_margin?: number;
  platform_margin_percentage?: number;
  avg_cost_per_org?: number;
  high_cost_orgs?: number;
}

const apiFetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

function SkeletonCard() {
  return (
    <div className="luxury-card p-6 animate-pulse">
      <div className="h-4 bg-cream-300 rounded w-24 mb-3" />
      <div className="h-8 bg-cream-300 rounded w-20" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  if (loading) return <SkeletonCard />;
  return (
    <div className="luxury-card p-6">
      <p className="font-body text-sm text-mauve-500 mb-1">{label}</p>
      <p className="font-display text-2xl font-semibold text-mauve-800">
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
      </p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: metrics, isLoading } = useSWR<PlatformMetrics>(
    "/api/admin/platform-metrics",
    apiFetcher,
    { refreshInterval: 60_000 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="ภาพรวมแพลตฟอร์ม"
      />
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Orgs" value={metrics?.totalOrgs ?? 0} loading={isLoading} />
        <MetricCard label="Active Orgs" value={metrics?.activeOrgs ?? 0} loading={isLoading} />
        <MetricCard label="Conversations (This Month)" value={metrics?.totalConversationsThisMonth ?? 0} loading={isLoading} />
        <MetricCard
          label="Revenue (This Month)"
          value={metrics != null ? `฿${metrics.totalRevenueThisMonth.toLocaleString("th-TH")}` : "฿0"}
          loading={isLoading}
        />
      </section>
      {/* Phase 21: Cost & Margin row */}
      {(metrics?.total_ai_cost != null || metrics?.platform_margin != null) && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="AI Cost เดือนนี้"
            value={metrics != null ? `฿${(metrics.total_ai_cost ?? 0).toLocaleString("th-TH")}` : "—"}
            loading={false}
          />
          <MetricCard
            label="Avg Cost per Org"
            value={metrics != null ? `฿${(metrics.avg_cost_per_org ?? 0).toFixed(0)}` : "—"}
            loading={false}
          />
          <MetricCard
            label="Platform Margin"
            value={
              metrics != null
                ? `฿${(metrics.platform_margin ?? 0).toLocaleString("th-TH")} (${(metrics.platform_margin_percentage ?? 0).toFixed(1)}%)`
                : "—"
            }
            loading={false}
          />
          <MetricCard
            label="High-Cost Orgs"
            value={metrics?.high_cost_orgs ?? 0}
            loading={false}
          />
        </section>
      )}
      {/* Phase 21: Anomaly + Top Orgs Cost */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnomalyPanel />
        <TopOrgsByCostChart />
      </section>
      <section className="luxury-card p-6">
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">
          Quick Links
        </h2>
        <ul className="space-y-2 font-body text-sm">
          <li>
            <Link href="/admin/packages" className="text-mauve-600 hover:underline">
              แพ็กเกจ
            </Link>
          </li>
          <li>
            <Link href="/admin/coupons" className="text-mauve-600 hover:underline">
              คูปอง
            </Link>
          </li>
          <li>
            <a
              href="/api/admin/export/organizations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mauve-600 hover:underline"
            >
              Export Organizations (CSV)
            </a>
          </li>
          <li>
            <Link href="/clinic/admin-monitoring" className="text-mauve-600 hover:underline">
              Admin Monitoring (Service Status, LLM)
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
