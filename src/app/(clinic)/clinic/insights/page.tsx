"use client";

import React, { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { useClinicContext } from "@/contexts/ClinicContext";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetcher } from "@/lib/api-fetcher";

/* Phase 3 — semantic chart colors (no hex) */
const CHART_COLORS = [
  "var(--color-rg-400)",
  "var(--color-rg-600)",
  "var(--color-cream-500)",
  "var(--color-mauve-400)",
  "var(--ent-accent)",
];
const CHART = {
  primary: CHART_COLORS[0],
  secondary: CHART_COLORS[1],
  grid: "var(--cream-300)",
  axis: "var(--cream-500)",
};
const PIE_COLORS = CHART_COLORS;

type DateRangeKey = "7d" | "30d" | "90d" | "custom";

type OverviewRes = {
  revenue: number;
  conversionRate: number;
  aiCloseRate: number;
  escalationRate: number;
  totalChats: number;
  totalBookings: number;
  from: string;
  to: string;
  preset: string;
};

type RevenueRes = {
  trend: Array<{ date: string; dayLabel: string; revenue: number }>;
  byService: Array<{ serviceName: string; revenue: number; count: number }>;
  total: number;
  from: string;
  to: string;
};

type ConversationRes = {
  intentDistribution: Array<{ intent: string; count: number }>;
  topQuestions: Array<{ text: string; count: number }>;
  totalConversations: number;
  avgPerDay: number;
  from: string;
  to: string;
};

type AIPerfRes = {
  accuracyScore: number;
  humanOverrideRate: number;
  totalLabeled: number;
  successCount: number;
  failCount: number;
  totalConversations: number;
  topFailedQueries: Array<{ userMessage: string; count: number }>;
  from: string;
  to: string;
};

type OperationalRes = {
  chatPeakHeatmap: Array<{ hour: number; dayOfWeek: number; count: number }>;
  bookingPeakByHour: Array<{ hour: number; count: number }>;
  bookingHeatmap?: Array<{ hour: number; dayOfWeek: number; count: number }>;
  escalationHeatmap?: Array<{ hour: number; dayOfWeek: number; count: number }>;
  totalChats: number;
  totalBookings: number;
  from: string;
  to: string;
};

type KnowledgeRes = {
  totalDocuments: number;
  activeDocuments: number;
  coverageNote: string;
  unansweredCount?: number;
  topMissingTopics?: Array<{ text: string; count: number }>;
  coveragePercent?: number;
};

type ExecutiveRes = { summary: string | null; message?: string; from: string; to: string };

type AlertsRes = {
  alerts: Array<{ type: string; severity: "high" | "medium"; message: string; recommendation: string }>;
  from: string;
  to: string;
};

type ComparisonRes = {
  revenue: { current: number; previous: number; percentChange: number; direction: "up" | "down" | "flat" };
  conversionRate: { current: number; previous: number; percentChange: number; direction: "up" | "down" | "flat" };
  aiCloseRate: { current: number; previous: number; percentChange: number; direction: "up" | "down" | "flat" };
  escalationRate: { current: number; previous: number; percentChange: number; direction: "up" | "down" | "flat" };
  accuracy: { current: number; previous: number; percentChange: number; direction: "up" | "down" | "flat" };
};

type BranchPerformanceRes = {
  branches: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    growthPercent: number;
    conversionRate: number;
    aiCloseRate: number;
    escalationRate: number;
    performanceScore: number;
    status: "Strong" | "Monitor" | "Critical";
  }>;
  from: string;
  to: string;
};

function buildQuery(params: {
  range: DateRangeKey;
  branchId: string | null;
  customFrom?: string;
  customTo?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("range", params.range);
  if (params.branchId) sp.set("branchId", params.branchId);
  if (params.range === "custom" && params.customFrom) sp.set("from", params.customFrom);
  if (params.range === "custom" && params.customTo) sp.set("to", params.customTo);
  return sp.toString();
}

const InsightsEmptyState = ({ message }: { message: string }) => (
  <EmptyState
    icon={<span className="text-2xl">📊</span>}
    title={message}
    description="ข้อมูลอัปเดตตามช่วงวันที่ที่เลือก"
  />
);

const SkeletonCard = () => (
  <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
);

/** Heatmap scale: var(--color-rg-200) to var(--color-rg-700) */
function getHeatmapBg(intensity: number): string {
  if (intensity <= 0) return "var(--color-rg-200)";
  if (intensity < 0.25) return "var(--color-rg-300)";
  if (intensity < 0.5) return "var(--color-rg-400)";
  if (intensity < 0.75) return "var(--color-rg-600)";
  return "var(--color-rg-700)";
}

function HeatmapGrid({
  data,
  dayLabels,
}: {
  data: Array<{ hour: number; dayOfWeek: number; count: number }>;
  dayLabels: string[];
}) {
  const cellMap = new Map<string, number>();
  data.forEach((d) => cellMap.set(`${d.hour}-${d.dayOfWeek}`, d.count));
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr>
          <th className="p-1 border border-cream-200 bg-cream-100 font-body font-medium text-mauve-600 w-8">วัน</th>
          {Array.from({ length: 24 }, (_, h) => (
            <th key={h} className="p-1 border border-cream-200 bg-cream-100 font-body font-medium text-mauve-600 w-8">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dayLabels.map((label, dayOfWeek) => (
          <tr key={dayOfWeek}>
            <td className="p-1 border border-cream-200 bg-cream-100 font-body font-medium text-mauve-600">{label}</td>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = cellMap.get(`${hour}-${dayOfWeek}`) ?? 0;
              const intensity = maxCount > 0 ? count / maxCount : 0;
              const bg = getHeatmapBg(intensity);
              return (
                <td
                  key={hour}
                  className="p-1 border border-cream-200 text-center"
                  style={{
                    backgroundColor: bg,
                    color: intensity >= 0.75 ? "white" : "inherit",
                  }}
                  title={`${label} ${hour}:00 — ${count}`}
                >
                  {count > 0 ? count : ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function InsightsPage() {
  const { branch_id, currentOrg, selectedBranchId, setSelectedBranchId, currentUser } = useClinicContext();
  const branchId = selectedBranchId ?? branch_id ?? null;
  const isOwner = currentUser?.role === "owner";
  const [range, setRange] = useState<DateRangeKey>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [heatmapOpen, setHeatmapOpen] = useState<"chat" | "booking" | null>(null);

  const query = useMemo(
    () => buildQuery({ range, branchId, customFrom: customFrom || undefined, customTo: customTo || undefined }),
    [range, branchId, customFrom, customTo]
  );
  const base = `/api/clinic/analytics`;

  const { data: overview, error: overviewError, isLoading: overviewLoading } = useSWR<OverviewRes>(
    `${base}/overview?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: revenue, isLoading: revenueLoading } = useSWR<RevenueRes>(
    `${base}/revenue?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: conversation, isLoading: conversationLoading } = useSWR<ConversationRes>(
    `${base}/conversation?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: aiPerf, isLoading: aiPerfLoading } = useSWR<AIPerfRes>(
    `${base}/ai-performance?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: operational, isLoading: operationalLoading } = useSWR<OperationalRes>(
    `${base}/operational?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: knowledge, isLoading: knowledgeLoading } = useSWR<KnowledgeRes>(
    `${base}/knowledge?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: executive, isLoading: executiveLoading } = useSWR<ExecutiveRes>(
    `${base}/executive-summary?${query}`,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: alerts } = useSWR<AlertsRes>(`${base}/alerts?${query}`, apiFetcher, { revalidateOnFocus: true, dedupingInterval: 60_000 });
  const { data: comparison } = useSWR<ComparisonRes>(`${base}/comparison?${query}`, apiFetcher, { revalidateOnFocus: true, dedupingInterval: 60_000 });
  const { data: branchPerformance } = useSWR<BranchPerformanceRes>(
    isOwner ? `${base}/branch-performance?${query}` : null,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );
  const { data: conversion } = useSWR<{
    cold: { total: number; converted: number; rate: number; avg_value: number };
    warm: { total: number; converted: number; rate: number; avg_value: number };
    hot: { total: number; converted: number; rate: number; avg_value: number };
    very_hot: { total: number; converted: number; rate: number; avg_value: number };
  }>(`${base}/conversion?${query}`, apiFetcher, { revalidateOnFocus: true, dedupingInterval: 60_000 });

  const hasAnyData = (overview?.totalChats ?? 0) > 0 || (overview?.revenue ?? 0) > 0 || (overview?.totalBookings ?? 0) > 0;
  const branches = currentOrg?.branches ?? [];

  const handleExportCsv = useCallback(() => {
    if (!overview) return;
    const rows = [
      ["Metric", "Value"],
      ["Revenue (฿)", overview.revenue.toFixed(2)],
      ["Conversion Rate (%)", overview.conversionRate.toFixed(2)],
      ["AI Close Rate (%)", overview.aiCloseRate.toFixed(2)],
      ["Total Chats", overview.totalChats],
      ["Total Bookings", overview.totalBookings],
      ["From", overview.from],
      ["To", overview.to],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insights-${overview.from.slice(0, 10)}-${overview.to.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [overview]);

  const formatRevenue = (v: number) =>
    `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Insights"
        subtitle="วิเคราะห์ข้อมูลเชิงลึกของคลินิก"
        shimmer
        actions={
          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as DateRangeKey)}
              className="h-9 px-3 rounded-xl font-body text-sm text-mauve-600 bg-white border border-cream-300 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
            >
              <option value="7d">7 วัน</option>
              <option value="30d">30 วัน</option>
              <option value="90d">90 วัน</option>
              <option value="custom">กำหนดเอง</option>
            </select>
            {range === "custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 px-2 rounded-xl border border-cream-200 font-body text-sm text-mauve-700"
                />
                <span className="font-body text-mauve-400">ถึง</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 px-2 rounded-xl border border-cream-200 font-body text-sm text-mauve-700"
                />
              </>
            )}
            {branches.length > 1 && (
              <select
                value={branchId ?? ""}
                onChange={(e) => setSelectedBranchId(e.target.value || null)}
                className="h-9 px-3 rounded-xl font-body text-sm text-mauve-600 bg-white border border-cream-300 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
              >
                <option value="">ทุกสาขา</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={!overview}>
              ส่งออก
            </Button>
          </div>
        }
      />

      {/* Alerts above fold */}
      {alerts?.alerts && alerts.alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 ${
                a.severity === "high"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-cream-50 border-cream-200"
              }`}
            >
              <p className="font-body font-medium text-mauve-900 text-sm">{a.message}</p>
              <p className="font-body text-mauve-600 text-xs mt-1">{a.recommendation}</p>
            </div>
          ))}
        </section>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : overviewError ? (
          <div className="col-span-full font-body text-sm text-amber-600">
            โหลดข้อมูลไม่สำเร็จ — ลองรีเฟรชหรือเช็กการเข้าสู่ระบบ
          </div>
        ) : overview ? (
          <>
            <StatCard
              label="รายได้รวม"
              value={formatRevenue(overview.revenue)}
              trend={comparison ? { value: comparison.revenue.percentChange, positive: comparison.revenue.direction === "up" } : undefined}
              icon={<span>◻</span>}
              delay={0}
              shimmer
            />
            <StatCard
              label="การจองทั้งหมด"
              value={overview.totalBookings}
              trend={comparison ? { value: comparison.conversionRate.percentChange, positive: comparison.conversionRate.direction === "up" } : undefined}
              icon={<span>⬡</span>}
              delay={0.08}
            />
            <StatCard
              label="ลูกค้าใหม่"
              value={overview.totalChats}
              trend={comparison ? { value: comparison.aiCloseRate.percentChange, positive: comparison.aiCloseRate.direction === "up" } : undefined}
              icon={<span>◎</span>}
              delay={0.16}
            />
            <StatCard
              label="ความพึงพอใจ"
              value={`${overview.aiCloseRate}%`}
              trend={comparison ? { value: comparison.escalationRate.percentChange, positive: comparison.escalationRate.direction === "down" } : undefined}
              icon={<span>✦</span>}
              delay={0.24}
            />
          </>
        ) : null}
      </div>

      {!hasAnyData && !overviewLoading && overview && (
        <div className="luxury-card p-6">
          <InsightsEmptyState message="เริ่มรับแชทจากลูกค้าเพื่อปลดล็อก Insights — ข้อมูลจะแสดงเมื่อมีแชท การจอง หรือรายได้ในช่วงที่เลือก" />
        </div>
      )}

      {/* Conversion Attribution (Phase 21) */}
      {conversion && (
        <section>
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Conversion Attribution</h2>
          <p className="font-body text-sm text-mauve-500 mb-4">อัตราการแปลง Lead Tier → Booking (30 วันล่าสุด)</p>
          <div className="luxury-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left font-body text-mauve-600">
                    <th className="py-3 px-4 font-medium">Lead Tier</th>
                    <th className="py-3 px-4 font-medium text-right">Total Leads</th>
                    <th className="py-3 px-4 font-medium text-right">Converted</th>
                    <th className="py-3 px-4 font-medium text-right">Rate</th>
                    <th className="py-3 px-4 font-medium text-right">Avg Booking Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "cold", label: "Cold", data: conversion.cold },
                    { key: "warm", label: "Warm", data: conversion.warm },
                    { key: "hot", label: "Hot", data: conversion.hot },
                    { key: "very_hot", label: "Very Hot", data: conversion.very_hot },
                  ].map(({ key, label, data }) => (
                    <tr
                      key={key}
                      className={`border-b border-cream-100 last:border-0 ${
                        key === "hot" || key === "very_hot" ? "bg-rg-50/50" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 font-body font-medium text-mauve-900">{label}</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">{data.total}</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">{data.converted}</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">{data.rate}%</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">
                        {data.avg_value > 0 ? formatRevenue(data.avg_value) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Branch Intelligence (Owner only) */}
      {isOwner && branchPerformance && branchPerformance.branches.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Branch Intelligence</h2>
          <p className="font-body text-sm text-mauve-500 mb-4">คะแนนประสิทธิภาพแต่ละสาขา (Owner only)</p>
          <div className="luxury-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left font-body text-mauve-600">
                    <th className="py-3 px-4 font-medium">สาขา</th>
                    <th className="py-3 px-4 font-medium text-right">คะแนน</th>
                    <th className="py-3 px-4 font-medium text-right">สถานะ</th>
                    <th className="py-3 px-4 font-medium text-right">รายได้</th>
                    <th className="py-3 px-4 font-medium text-right">Growth %</th>
                    <th className="py-3 px-4 font-medium text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {branchPerformance.branches.map((b) => (
                    <tr key={b.branchId} className="border-b border-cream-100 last:border-0">
                      <td className="py-2.5 px-4 font-body font-medium text-mauve-900">{b.branchName}</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">{b.performanceScore}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-body font-medium ${
                            b.status === "Strong"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.status === "Monitor"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">฿{b.revenue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">{b.growthPercent}%</td>
                      <td className="py-2.5 px-4 text-right font-body text-mauve-800">{b.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Charts Grid: Revenue + Booking by service + Intent + Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Revenue chart */}
        {revenueLoading ? (
          <div className="h-72 rounded-2xl bg-cream-200 animate-pulse" />
        ) : revenue && (revenue.trend.length > 0 || revenue.byService.length > 0) ? (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="luxury-card p-6">
                <h3 className="font-display text-lg font-semibold text-mauve-800 mb-5">รายได้ตามช่วงเวลา</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenue.trend.length ? revenue.trend : [{ date: "-", dayLabel: "-", revenue: 0 }]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rgGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: CHART.axis }} />
                      <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickFormatter={(v) => `฿${v}`} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                        formatter={(v: number | undefined) => [`฿${Number(v ?? 0).toLocaleString("th-TH")}`, "รายได้"]}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) ?? ""}
                      />
                      <Line type="monotone" dataKey="revenue" stroke={CHART.primary} strokeWidth={2} dot={{ r: 3 }} fill="url(#rgGradient)" name="รายได้" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="luxury-card p-6">
                <h3 className="font-display text-lg font-semibold text-mauve-800 mb-5">การจองตามบริการ</h3>
                {revenue.byService.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenue.byService.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 8, left: 80, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: CHART.axis }} tickFormatter={(v) => `฿${v}`} />
                        <YAxis type="category" dataKey="serviceName" width={75} tick={{ fontSize: 10, fill: CHART.axis }} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                          formatter={(v: number | undefined) => [`฿${Number(v ?? 0).toLocaleString("th-TH")}`, "รายได้"]}
                        />
                        <Bar dataKey="revenue" fill={CHART.primary} name="รายได้" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <InsightsEmptyState message="ยังไม่มีรายได้จากบริการในช่วงนี้" />
                )}
              </div>
            </motion.div>
          </>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="luxury-card p-6">
                <h3 className="font-display text-lg font-semibold text-mauve-800 mb-5">รายได้ตามช่วงเวลา</h3>
                <InsightsEmptyState message="ยังไม่มีข้อมูลรายได้ในช่วงที่เลือก — เมื่อมีใบแจ้งหนี้ที่ชำระแล้ว ข้อมูลจะแสดงที่นี่" />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="luxury-card p-6">
                <h3 className="font-display text-lg font-semibold text-mauve-800 mb-5">การจองตามบริการ</h3>
                <InsightsEmptyState message="ยังไม่มีรายได้จากบริการในช่วงนี้" />
              </div>
            </motion.div>
          </>
        )}

        {/* Chat intent distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="luxury-card p-6">
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-5">การกระจาย Intent แชท</h3>
            {conversationLoading ? (
              <div className="h-64 rounded-2xl bg-cream-200 animate-pulse" />
            ) : conversation && conversation.intentDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={conversation.intentDistribution}
                      dataKey="count"
                      nameKey="intent"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name ?? ""}: ${value ?? 0}`}
                    >
                      {conversation.intentDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                      formatter={(v: number | undefined) => [v ?? 0, "จำนวน"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <InsightsEmptyState message="ยังไม่มีแชทในช่วงนี้" />
            )}
          </div>
        </motion.div>

        {/* Booking heatmap */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <div className="luxury-card p-6">
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-5">Heatmap การจองตามชั่วโมง</h3>
            {operationalLoading ? (
              <div className="h-48 rounded-2xl bg-cream-200 animate-pulse" />
            ) : operational && operational.bookingHeatmap && operational.bookingHeatmap.length > 0 ? (
              <div className="overflow-x-auto">
                <HeatmapGrid data={operational.bookingHeatmap} dayLabels={DAY_LABELS} />
              </div>
            ) : operational && operational.chatPeakHeatmap && operational.chatPeakHeatmap.length > 0 ? (
              <div className="overflow-x-auto">
                <HeatmapGrid data={operational.chatPeakHeatmap} dayLabels={DAY_LABELS} />
              </div>
            ) : (
              <InsightsEmptyState message="ยังไม่มีข้อมูลการจอง/แชทตามชั่วโมงในช่วงนี้" />
            )}
          </div>
        </motion.div>
      </div>

      {/* Top questions table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="luxury-card overflow-hidden">
          <div className="px-6 py-5 border-b border-cream-200">
            <h3 className="font-display text-lg font-semibold text-mauve-800">คำถามยอดนิยม</h3>
          </div>
          <div className="divide-y divide-cream-200">
            {conversation?.topQuestions?.slice(0, 15).map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.04 }}
                className="flex items-center gap-4 px-6 py-4 hover:bg-cream-50 transition-colors"
              >
                <span className="font-display text-2xl font-bold text-rg-200 w-8 text-center flex-shrink-0">
                  {i + 1}
                </span>
                <p className="flex-1 font-body text-sm text-mauve-700">{q.text}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rg-400 to-rg-600"
                      style={{ width: `${conversation.topQuestions[0]?.count ? (q.count / conversation.topQuestions[0].count) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-body text-xs text-mauve-500 w-12 text-right">{q.count} ครั้ง</span>
                </div>
              </motion.div>
            ))}
          </div>
          {(!conversation?.topQuestions || conversation.topQuestions.length === 0) && !conversationLoading && (
            <div className="px-6 py-8">
              <InsightsEmptyState message="ยังไม่มีคำถามในช่วงนี้" />
            </div>
          )}
        </div>
      </motion.div>

      {/* AI Performance */}
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">AI Performance Intelligence</h2>
        <p className="font-body text-sm text-mauve-500 mb-4">ความแม่นยำและคำตอบที่ fail</p>
        {aiPerfLoading ? (
          <div className="h-48 rounded-2xl bg-cream-200 animate-pulse" />
        ) : aiPerf ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="luxury-card p-6">
              <h3 className="font-display text-base font-semibold text-mauve-800">AI Accuracy</h3>
              <p className="font-body text-xs text-mauve-400 mt-0.5">จาก feedback ที่ติดป้าย (ดี/แย่)</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-mauve-800">{aiPerf.accuracyScore}%</span>
                <span className="font-body text-sm text-mauve-400">
                  ({aiPerf.successCount} / {aiPerf.totalLabeled} ที่ติดป้าย)
                </span>
              </div>
              <p className="font-body text-xs text-mauve-400 mt-2">
                Human Override Rate: {aiPerf.humanOverrideRate}%
              </p>
            </div>
            <div className="luxury-card p-6">
              <h3 className="font-display text-base font-semibold text-mauve-800">คำถามที่ AI ตอบแย่ (Top Failed)</h3>
              <p className="font-body text-xs text-mauve-400 mt-0.5">จากป้าย fail ใน Golden Dataset</p>
              {aiPerf.topFailedQueries.length > 0 ? (
                <ul className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                  {aiPerf.topFailedQueries.slice(0, 8).map((q, i) => (
                    <li key={i} className="font-body text-sm text-mauve-700 truncate" title={q.userMessage}>
                      {q.userMessage}
                      <span className="ml-2 font-semibold text-mauve-900">{q.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-body text-sm text-mauve-400 mt-2">ยังไม่มีคำตอบที่ติดป้ายแย่</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* Operational: Booking Peak + Collapsible Heatmaps */}
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Operational Intelligence</h2>
        <p className="font-body text-sm text-mauve-500 mb-4">Peak Chat Time และการจอง</p>
        {operationalLoading ? (
          <div className="h-48 rounded-2xl bg-cream-200 animate-pulse" />
        ) : operational && (operational.bookingPeakByHour.some((x) => x.count > 0) || operational.chatPeakHeatmap.length > 0) ? (
          <div className="space-y-6">
            <div className="luxury-card p-6">
              <h3 className="font-display text-base font-semibold text-mauve-800">Booking Peak by Hour</h3>
              <p className="font-body text-xs text-mauve-400 mt-0.5">จำนวนการจองแยกตามชั่วโมง</p>
              <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operational.bookingPeakByHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: CHART.axis }} tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 11, fill: CHART.axis }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                      formatter={(v: number | undefined) => [v ?? 0, "การจอง"]}
                      labelFormatter={(h) => `${h}:00`}
                    />
                    <Bar dataKey="count" fill={CHART.primary} name="การจอง" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="font-body text-xs text-mauve-400 mt-2">
                แชททั้งหมด: {operational.totalChats} | การจองทั้งหมด: {operational.totalBookings}
              </p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setHeatmapOpen(heatmapOpen === "chat" ? null : "chat")}
                className="flex items-center justify-between w-full px-4 py-3 rounded-2xl border border-cream-200 bg-cream-50 font-body text-sm font-medium text-mauve-800 hover:bg-cream-100 transition-colors"
              >
                Chat Heatmap (ชั่วโมง × วัน)
                <span className="text-mauve-400">{heatmapOpen === "chat" ? "▼" : "▶"}</span>
              </button>
              {heatmapOpen === "chat" && operational.chatPeakHeatmap.length > 0 && (
                <div className="luxury-card p-4">
                  <div className="overflow-x-auto">
                    <HeatmapGrid data={operational.chatPeakHeatmap} dayLabels={DAY_LABELS} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setHeatmapOpen(heatmapOpen === "booking" ? null : "booking")}
                className="flex items-center justify-between w-full px-4 py-3 rounded-2xl border border-cream-200 bg-cream-50 font-body text-sm font-medium text-mauve-800 hover:bg-cream-100 transition-colors"
              >
                Booking Heatmap (ชั่วโมง × วัน)
                <span className="text-mauve-400">{heatmapOpen === "booking" ? "▼" : "▶"}</span>
              </button>
              {heatmapOpen === "booking" && operational.bookingHeatmap && operational.bookingHeatmap.length > 0 && (
                <div className="luxury-card p-4">
                  <div className="overflow-x-auto">
                    <HeatmapGrid data={operational.bookingHeatmap} dayLabels={DAY_LABELS} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="luxury-card p-6">
            <InsightsEmptyState message="ยังไม่มีข้อมูลแชท/การจองในช่วงนี้" />
          </div>
        )}
      </section>

      {/* Knowledge + Gap Detection */}
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Knowledge Intelligence</h2>
        <p className="font-body text-sm text-mauve-500 mb-4">ความครอบคลุมและช่องว่าง (Unanswered)</p>
        {knowledgeLoading ? (
          <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
        ) : knowledge ? (
          <div className="luxury-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium text-mauve-700">เอกสารทั้งหมด: {knowledge.totalDocuments} | เปิดใช้งาน: {knowledge.activeDocuments}</p>
                {knowledge.coveragePercent != null && (
                  <p className="font-body text-sm text-mauve-600 mt-1">Coverage: {knowledge.coveragePercent}%</p>
                )}
                {knowledge.unansweredCount != null && knowledge.unansweredCount > 0 && (
                  <p className="font-body text-sm text-amber-700 mt-1">คำถามที่ยังไม่มี Intent ชัด (other): {knowledge.unansweredCount}</p>
                )}
                <p className="font-body text-sm text-mauve-600 mt-2">{knowledge.coverageNote}</p>
              </div>
              {(knowledge.activeDocuments === 0 || (knowledge.coveragePercent != null && knowledge.coveragePercent < 100)) && (
                <a
                  href="/clinic/knowledge"
                  className="inline-flex items-center px-4 py-2 rounded-xl font-body text-sm font-medium bg-rg-500 text-white hover:bg-rg-600 transition-colors"
                >
                  เพิ่ม Knowledge
                </a>
              )}
            </div>
            {knowledge.topMissingTopics && knowledge.topMissingTopics.length > 0 && (
              <div className="mt-4 pt-4 border-t border-cream-200">
                <p className="font-body text-xs font-medium text-mauve-600 mb-2">หัวข้อที่ถามบ่อยแต่ยังไม่มี Intent ชัด (Top Missing)</p>
                <ul className="space-y-1 font-body text-sm text-mauve-700">
                  {knowledge.topMissingTopics.slice(0, 5).map((t, i) => (
                    <li key={i} className="truncate" title={t.text}>
                      {t.text} — {t.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Executive Summary (AI) */}
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Strategic AI Executive Report</h2>
        <p className="font-body text-sm text-mauve-500 mb-4">สรุปจาก AI ตามเมตริกช่วงนี้</p>
        {executiveLoading ? (
          <div className="h-32 rounded-2xl bg-cream-200 animate-pulse" />
        ) : executive ? (
          <div className="luxury-card p-6">
            {executive.summary ? (
              <div className="p-5 rounded-2xl bg-rg-50/50 border border-rg-100">
                <p className="font-body text-mauve-800 text-sm leading-relaxed whitespace-pre-wrap">{executive.summary}</p>
              </div>
            ) : (
              <p className="font-body text-sm text-mauve-400">
                {executive.message ?? "ไม่มีสรุป — ตั้งค่า GEMINI_API_KEY เพื่อสร้างสรุปจาก AI หรือเลือกช่วงที่มีข้อมูล"}
              </p>
            )}
            <p className="font-body text-xs text-mauve-400 mt-3">
              ช่วง: {executive.from?.slice(0, 10)} ถึง {executive.to?.slice(0, 10)}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
