"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

function formatBaht(satang: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(satang / 100);
}

type StatsRes = {
  total_customers: number;
  active_customers: number;
  mrr: number;
  commission_earned: number;
  commission_pending: number;
  commission_paid: number;
  healthy_customers: number;
  at_risk_customers: number;
  gross_margin_pct: number;
  avg_margin_per_customer: number;
  trend: Array<{ month: string; earned: number; paid: number }>;
  top_customers: Array<{ id: string; name: string; revenue: number }>;
  at_risk_list: Array<{ id: string; name: string; usagePct: number; lastActivity: string }>;
  agency: { id: string; name: string; commissionRate: number };
};

export default function AgencyDashboardPage() {
  const { data: statsData, error: statsError, isLoading: statsLoading, mutate } = useSWR<StatsRes>(
    "/api/agency/stats",
    fetcher,
    { revalidateOnFocus: true }
  );
  const { data: dashboardData } = useSWR<{
    clinics: Array<{ id: string; name: string; plan: string; status: string }>;
  }>("/api/agency/dashboard", fetcher, { revalidateOnFocus: true });

  const useStats = statsData != null;

  if (statsLoading && !statsData) {
    return (
      <div className="space-y-6">
        <div className="luxury-card p-6 animate-pulse">
          <div className="h-6 w-48 bg-cream-200 rounded mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-cream-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if ((statsError || !statsData) && !dashboardData) {
    return (
      <div className="space-y-6">
        <div className="luxury-card p-6">
          <p className="font-body text-sm text-red-600">
            โหลดไม่สำเร็จ — ตรวจสอบว่ามีสิทธิ์เข้าถึง Agency
          </p>
          <Link href="/clinic" className="mt-4 inline-block text-sm text-rg-600 hover:underline">
            กลับไป Clinic
          </Link>
        </div>
      </div>
    );
  }

  const agencyName = statsData?.agency?.name ?? "Agency";
  const clinics = dashboardData?.clinics ?? [];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold text-mauve-800">
            {agencyName}
          </h1>
          <p className="text-sm text-mauve-500 mt-0.5">
            Commission {((statsData?.agency?.commissionRate ?? 0) * 100).toFixed(0)}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="text-sm text-mauve-500 hover:text-mauve-700"
        >
          รีเฟรช
        </button>
      </motion.div>

      {/* Phase 21: Row 1 — Revenue KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ลูกค้าทั้งหมด"
          value={
            statsData
              ? `${statsData.total_customers} / ${statsData.active_customers}`
              : (dashboardData?.clinics?.length ?? 0) || "—"
          }
          subtext={useStats ? "ทั้งหมด / ใช้งาน" : undefined}
          icon={<span className="text-rg-500">👥</span>}
          delay={0}
        />
        <StatCard
          label="MRR รายได้เดือนนี้"
          value={useStats && statsData ? formatBaht(statsData.mrr) : "—"}
          icon={<span className="text-rg-500">💰</span>}
          delay={0.05}
        />
        <StatCard
          label="Commission รอรับ"
          value={useStats && statsData ? formatBaht(statsData.commission_pending) : "—"}
          icon={<span className="text-rg-500">⏳</span>}
          delay={0.1}
        />
        <StatCard
          label="Commission รับแล้ว"
          value={useStats && statsData ? formatBaht(statsData.commission_paid) : "—"}
          icon={<span className="text-rg-500">✅</span>}
          delay={0.15}
        />
      </div>

      {/* Phase 21: Row 2 — Business Health */}
      {useStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Gross Margin %"
            value={statsData ? `${statsData.gross_margin_pct}%` : "—"}
            icon={<span className="text-rg-500">📊</span>}
            delay={0}
          />
          <StatCard
            label="Avg margin per customer"
            value={statsData ? formatBaht(Math.round(statsData.avg_margin_per_customer * 100)) : "—"}
            icon={<span className="text-rg-500">💎</span>}
            delay={0.05}
          />
          <StatCard
            label="Customer Health"
            value={statsData ? `${statsData.healthy_customers}/${statsData.total_customers}` : "—"}
            subtext={statsData ? `⚠️ ${statsData.at_risk_customers} at risk` : undefined}
            icon={<span className="text-rg-500">⚠️</span>}
            delay={0.1}
          />
        </div>
      )}

      {/* Stats fallback when no stats */}
      {!useStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="คลินิกที่ดูแล"
            value={dashboardData?.clinics?.length ?? 0}
            icon={<span className="text-rg-500">🏥</span>}
            delay={0}
          />
        </div>
      )}

      {/* Commission trend + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {statsData?.trend && statsData.trend.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="luxury-card p-6"
          >
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">
              Commission Trend (6 เดือน)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData.trend.map((t) => ({ ...t, earned: t.earned, paid: t.paid }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--mauve-500)" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--mauve-500)" }} tickFormatter={(v) => (v / 100).toFixed(0) + "฿"} />
                  <Tooltip
                    formatter={(value: number | undefined) => [value != null ? formatBaht(value) : "—", "Commission"]}
                    labelFormatter={(label) => `เดือน ${label}`}
                  />
                  <Bar dataKey="earned" fill="var(--color-rg-400)" name="Earned" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" fill="var(--ent-accent)" name="Paid" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
        {statsData?.top_customers && statsData.top_customers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="luxury-card p-6"
          >
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">
              Top 10 Customers by Revenue
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData.top_customers} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatBaht(v)} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number | undefined) => [v != null ? formatBaht(v) : "—", "Revenue"]} />
                  <Bar dataKey="revenue" fill="var(--color-rg-400)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>

      {/* Customer Health Table — At Risk */}
      {statsData?.at_risk_list && statsData.at_risk_list.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="luxury-card overflow-hidden"
        >
          <h3 className="font-display text-lg font-semibold text-mauve-800 px-6 py-4 border-b border-cream-200">
            Customer Health — At Risk
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left font-body text-mauve-600">
                  <th className="py-3 px-4 font-medium">ชื่อคลินิก</th>
                  <th className="py-3 px-4 font-medium text-right">การใช้งาน</th>
                  <th className="py-3 px-4 font-medium text-right">กิจกรรมล่าสุด</th>
                  <th className="py-3 px-4 font-medium text-right">ความเสี่ยง</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {statsData.at_risk_list.map((row) => (
                  <tr key={row.id} className="border-b border-cream-100 last:border-0">
                    <td className="py-2.5 px-4 font-body font-medium text-mauve-800">{row.name}</td>
                    <td className="py-2.5 px-4 text-right font-body text-mauve-600">{row.usagePct}%</td>
                    <td className="py-2.5 px-4 text-right font-body text-mauve-600">{row.lastActivity}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-[color:var(--ent-danger)]/10 text-[var(--ent-danger)]">
                        at_risk
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link href={`/clinic?org=${row.id}`}>
                        <Button variant="secondary" size="sm">Reach Out</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Clinics table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="luxury-card overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-cream-200">
          <h3 className="font-display text-lg font-semibold text-mauve-800">
            คลินิกล่าสุด
          </h3>
        </div>
        <div className="divide-y divide-cream-200">
          {clinics && clinics.length > 0 ? (
            clinics.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-cream-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-rg-100 flex items-center justify-center text-rg-600 font-display font-semibold flex-shrink-0">
                  {c.name?.[0] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-mauve-800 truncate">
                    {c.name}
                  </p>
                  <p className="font-body text-xs text-mauve-400">
                    แผน: {c.plan}
                  </p>
                </div>
                <Badge
                  variant={
                    c.status === "active" ? "success" : c.status === "past_due" ? "error" : "default"
                  }
                  size="sm"
                >
                  {c.status === "active" ? "ใช้งาน" : c.status === "past_due" ? "ค้างชำระ" : c.status}
                </Badge>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<span className="text-2xl">🏥</span>}
              title="ไม่มีคลินิก"
              description="คลินิกที่อยู่ภายใต้ Agency จะแสดงที่นี่"
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
