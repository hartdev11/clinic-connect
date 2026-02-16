"use client";

import React, { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
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
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { apiFetcher } from "@/lib/api-fetcher";

const CHART = { primary: "#0f766e", secondary: "#64748b", grid: "#e2e8f0", text: "#64748b" };
const PIE_COLORS = ["#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#94a3b8"];

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

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl bg-surface-50 border border-surface-100 text-center">
    <p className="text-4xl mb-3">📊</p>
    <p className="text-surface-600 text-sm font-medium">{message}</p>
    <p className="text-surface-500 text-xs mt-1">ข้อมูลอัปเดตตามช่วงวันที่ที่เลือก</p>
  </div>
);

const SkeletonCard = () => (
  <div className="h-24 rounded-xl bg-surface-100 animate-pulse" />
);

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
          <th className="p-1 border border-surface-200 bg-surface-50 font-medium text-surface-600 w-8">วัน</th>
          {Array.from({ length: 24 }, (_, h) => (
            <th key={h} className="p-1 border border-surface-200 bg-surface-50 font-medium text-surface-600 w-8">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dayLabels.map((label, dayOfWeek) => (
          <tr key={dayOfWeek}>
            <td className="p-1 border border-surface-200 bg-surface-50 font-medium text-surface-600">{label}</td>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = cellMap.get(`${hour}-${dayOfWeek}`) ?? 0;
              const intensity = maxCount > 0 ? count / maxCount : 0;
              const bg = intensity > 0 ? `rgba(15, 118, 110, ${0.2 + intensity * 0.7})` : "var(--surface-50, #f8fafc)";
              return (
                <td
                  key={hour}
                  className="p-1 border border-surface-100 text-center"
                  style={{ backgroundColor: bg }}
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

function TrendBadge({ direction, percentChange }: { direction: "up" | "down" | "flat"; percentChange: number }) {
  if (direction === "flat") return null;
  const isUp = direction === "up";
  const text = `${isUp ? "↑" : "↓"} ${Math.abs(percentChange).toFixed(1)}%`;
  return (
    <span
      className={`ml-1.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-amber-600"}`}
      title={text}
    >
      {text}
    </span>
  );
}

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

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Insights & Reports"
        description="AI Business Intelligence — รายได้ แชท AI การดำเนินงาน และคำแนะนำ"
        aiAnalyze
      />

      {/* Alerts above fold */}
      {alerts?.alerts && alerts.alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                a.severity === "high"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-surface-50 border-surface-200"
              }`}
            >
              <p className="font-medium text-surface-900 text-sm">{a.message}</p>
              <p className="text-surface-600 text-xs mt-1">{a.recommendation}</p>
            </div>
          ))}
        </section>
      )}

      {/* Sticky Top Bar: Date Range, Branch, Export, KPI */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-surface-100 -mx-4 px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-surface-600">ช่วงเวลา</span>
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? "bg-primary-600 text-white"
                  : "bg-surface-100 text-surface-700 hover:bg-surface-200"
              }`}
            >
              {r === "7d" ? "7 วัน" : r === "30d" ? "30 วัน" : "90 วัน"}
            </button>
          ))}
          {range === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-surface-200 text-sm"
              />
              <span className="text-surface-400">ถึง</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-surface-200 text-sm"
              />
            </>
          )}
          <button
            onClick={() => setRange("custom")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              range === "custom" ? "bg-primary-600 text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"
            }`}
          >
            กำหนดเอง
          </button>

          {branches.length > 1 && (
            <>
              <span className="text-surface-400 mx-1">|</span>
              <select
                value={branchId ?? ""}
                onChange={(e) => setSelectedBranchId(e.target.value || null)}
                className="px-3 py-1.5 rounded-lg border border-surface-200 text-sm bg-white"
              >
                <option value="">ทุกสาขา</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={handleExportCsv}
            disabled={!overview}
            className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-100 text-surface-700 hover:bg-surface-200 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        {/* KPI Snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {overviewLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : overviewError ? (
            <div className="col-span-full text-sm text-amber-600">
              โหลดข้อมูลไม่สำเร็จ — ลองรีเฟรชหรือเช็กการเข้าสู่ระบบ
            </div>
          ) : overview ? (
            <>
              <Card padding="md">
                <p className="text-xs text-surface-500 font-medium">รายได้</p>
                <p className="text-lg font-bold text-surface-900 mt-0.5 flex items-baseline">
                  ฿{overview.revenue.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  {comparison && <TrendBadge direction={comparison.revenue.direction} percentChange={comparison.revenue.percentChange} />}
                </p>
              </Card>
              <Card padding="md">
                <p className="text-xs text-surface-500 font-medium">Conversion (แชท→จอง)</p>
                <p className="text-lg font-bold text-surface-900 mt-0.5 flex items-baseline">
                  {overview.conversionRate}%
                  {comparison && <TrendBadge direction={comparison.conversionRate.direction} percentChange={comparison.conversionRate.percentChange} />}
                </p>
              </Card>
              <Card padding="md">
                <p className="text-xs text-surface-500 font-medium">AI Close Rate</p>
                <p className="text-lg font-bold text-surface-900 mt-0.5 flex items-baseline">
                  {overview.aiCloseRate}%
                  {comparison && <TrendBadge direction={comparison.aiCloseRate.direction} percentChange={comparison.aiCloseRate.percentChange} />}
                </p>
              </Card>
              <Card padding="md">
                <p className="text-xs text-surface-500 font-medium">Escalation Rate</p>
                <p className="text-lg font-bold text-surface-900 mt-0.5 flex items-baseline">
                  {overview.escalationRate}%
                  {comparison && <TrendBadge direction={comparison.escalationRate.direction} percentChange={comparison.escalationRate.percentChange} />}
                </p>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      {!hasAnyData && !overviewLoading && overview && (
        <Card padding="lg">
          <EmptyState message="เริ่มรับแชทจากลูกค้าเพื่อปลดล็อก Insights — ข้อมูลจะแสดงเมื่อมีแชท การจอง หรือรายได้ในช่วงที่เลือก" />
        </Card>
      )}

      {/* Branch Intelligence (Owner only) */}
      {isOwner && branchPerformance && branchPerformance.branches.length > 0 && (
        <section>
          <SectionHeader title="Branch Intelligence" description="คะแนนประสิทธิภาพแต่ละสาขา (Owner only)" />
          <Card padding="lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left text-surface-600">
                    <th className="py-3 px-2 font-medium">สาขา</th>
                    <th className="py-3 px-2 font-medium text-right">คะแนน</th>
                    <th className="py-3 px-2 font-medium text-right">สถานะ</th>
                    <th className="py-3 px-2 font-medium text-right">รายได้</th>
                    <th className="py-3 px-2 font-medium text-right">Growth %</th>
                    <th className="py-3 px-2 font-medium text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {branchPerformance.branches.map((b) => (
                    <tr key={b.branchId} className="border-b border-surface-100 last:border-0">
                      <td className="py-2.5 px-2 font-medium text-surface-900">{b.branchName}</td>
                      <td className="py-2.5 px-2 text-right">{b.performanceScore}</td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
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
                      <td className="py-2.5 px-2 text-right">฿{b.revenue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
                      <td className="py-2.5 px-2 text-right">{b.growthPercent}%</td>
                      <td className="py-2.5 px-2 text-right">{b.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* 1. Revenue Intelligence */}
      <section>
        <SectionHeader title="Revenue Intelligence" description="แนวโน้มรายได้ และรายได้แยกตามบริการ" />
        {revenueLoading ? (
          <div className="h-64 rounded-xl bg-surface-100 animate-pulse" />
        ) : revenue && (revenue.trend.length > 0 || revenue.byService.length > 0) ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Card padding="lg">
              <CardHeader title="Revenue Trend" subtitle="รายได้ต่อวัน (฿)" />
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenue.trend.length ? revenue.trend : [{ date: "-", revenue: 0 }]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: CHART.text }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART.text }} tickFormatter={(v) => `฿${v}`} />
                    <Tooltip formatter={(v: number) => [`฿${v.toLocaleString("th-TH")}`, "รายได้"]} labelFormatter={(_, payload) => payload[0]?.payload?.date} />
                    <Line type="monotone" dataKey="revenue" stroke={CHART.primary} strokeWidth={2} dot={{ r: 3 }} name="รายได้" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card padding="lg">
              <CardHeader title="Revenue by Service" subtitle="รายได้แยกตามบริการ" />
              {revenue.byService.length > 0 ? (
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue.byService.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 8, left: 80, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${v}`} />
                      <YAxis type="category" dataKey="serviceName" width={75} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`฿${v.toLocaleString("th-TH")}`, "รายได้"]} />
                      <Bar dataKey="revenue" fill={CHART.primary} name="รายได้" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="ยังไม่มีรายได้จากบริการในช่วงนี้" />
              )}
            </Card>
          </div>
        ) : (
          <Card padding="lg">
            <EmptyState message="ยังไม่มีข้อมูลรายได้ในช่วงที่เลือก — เมื่อมีใบแจ้งหนี้ที่ชำระแล้ว ข้อมูลจะแสดงที่นี่" />
          </Card>
        )}
      </section>

      {/* 2. Conversation Intelligence */}
      <section>
        <SectionHeader title="Conversation Intelligence" description="การกระจาย Intent และคำถามยอดนิยม" />
        {conversationLoading ? (
          <div className="h-64 rounded-xl bg-surface-100 animate-pulse" />
        ) : conversation && (conversation.intentDistribution.length > 0 || conversation.topQuestions.length > 0) ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Card padding="lg">
              <CardHeader title="Intent Distribution" subtitle="ประเภทคำถามจากลูกค้า" />
              {conversation.intentDistribution.length > 0 ? (
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={conversation.intentDistribution}
                        dataKey="count"
                        nameKey="intent"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ intent, count }) => `${intent}: ${count}`}
                      >
                        {conversation.intentDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, "จำนวน"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="ยังไม่มีแชทในช่วงนี้" />
              )}
            </Card>
            <Card padding="lg">
              <CardHeader title="คำถามยอดนิยม" subtitle="Top questions จากลูกค้า" />
              {conversation.topQuestions.length > 0 ? (
                <ul className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                  {conversation.topQuestions.slice(0, 15).map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-xs font-medium text-surface-500 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-surface-700 flex-1 truncate" title={q.text}>
                        {q.text}
                      </span>
                      <span className="font-semibold text-surface-900 flex-shrink-0">{q.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState message="ยังไม่มีคำถามในช่วงนี้" />
              )}
            </Card>
          </div>
        ) : (
          <Card padding="lg">
            <EmptyState message="เริ่มรับแชทจากลูกค้าเพื่อดู Intent และคำถามยอดนิยม" />
          </Card>
        )}
      </section>

      {/* 3. AI Performance */}
      <section>
        <SectionHeader title="AI Performance Intelligence" description="ความแม่นยำและคำตอบที่ fail" />
        {aiPerfLoading ? (
          <div className="h-48 rounded-xl bg-surface-100 animate-pulse" />
        ) : aiPerf ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Card padding="lg">
              <CardHeader title="AI Accuracy" subtitle="จาก feedback ที่ติดป้าย (ดี/แย่)" />
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-surface-900">{aiPerf.accuracyScore}%</span>
                <span className="text-sm text-surface-500">
                  ({aiPerf.successCount} / {aiPerf.totalLabeled} ที่ติดป้าย)
                </span>
              </div>
              <p className="text-xs text-surface-500 mt-2">
                Human Override Rate: {aiPerf.humanOverrideRate}%
              </p>
            </Card>
            <Card padding="lg">
              <CardHeader title="คำถามที่ AI ตอบแย่ (Top Failed)" subtitle="จากป้าย fail ใน Golden Dataset" />
              {aiPerf.topFailedQueries.length > 0 ? (
                <ul className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                  {aiPerf.topFailedQueries.slice(0, 8).map((q, i) => (
                    <li key={i} className="text-sm text-surface-700 truncate" title={q.userMessage}>
                      {q.userMessage}
                      <span className="ml-2 font-semibold text-surface-900">{q.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-surface-500 mt-2">ยังไม่มีคำตอบที่ติดป้ายแย่</p>
              )}
            </Card>
          </div>
        ) : null}
      </section>

      {/* 4. Operational */}
      <section>
        <SectionHeader title="Operational Intelligence" description="Peak Chat Time และการจอง" />
        {operationalLoading ? (
          <div className="h-48 rounded-xl bg-surface-100 animate-pulse" />
        ) : operational && (operational.bookingPeakByHour.some((x) => x.count > 0) || operational.chatPeakHeatmap.length > 0) ? (
          <div className="space-y-6">
            <Card padding="lg">
              <CardHeader title="Booking Peak by Hour" subtitle="จำนวนการจองแยกตามชั่วโมง" />
              <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operational.bookingPeakByHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v, "การจอง"]} labelFormatter={(h) => `${h}:00`} />
                    <Bar dataKey="count" fill={CHART.primary} name="การจอง" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-surface-500 mt-2">
                แชททั้งหมด: {operational.totalChats} | การจองทั้งหมด: {operational.totalBookings}
              </p>
            </Card>
            {/* Collapsible Heatmaps */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setHeatmapOpen(heatmapOpen === "chat" ? null : "chat")}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-left text-sm font-medium text-surface-800 hover:bg-surface-100"
              >
                Chat Heatmap (ชั่วโมง × วัน)
                <span className="text-surface-400">{heatmapOpen === "chat" ? "▼" : "▶"}</span>
              </button>
              {heatmapOpen === "chat" && operational.chatPeakHeatmap.length > 0 && (
                <Card padding="md">
                  <div className="overflow-x-auto">
                    <HeatmapGrid data={operational.chatPeakHeatmap} dayLabels={DAY_LABELS} />
                  </div>
                </Card>
              )}
              <button
                type="button"
                onClick={() => setHeatmapOpen(heatmapOpen === "booking" ? null : "booking")}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-left text-sm font-medium text-surface-800 hover:bg-surface-100"
              >
                Booking Heatmap (ชั่วโมง × วัน)
                <span className="text-surface-400">{heatmapOpen === "booking" ? "▼" : "▶"}</span>
              </button>
              {heatmapOpen === "booking" && operational.bookingHeatmap && operational.bookingHeatmap.length > 0 && (
                <Card padding="md">
                  <div className="overflow-x-auto">
                    <HeatmapGrid data={operational.bookingHeatmap} dayLabels={DAY_LABELS} />
                  </div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <Card padding="lg">
            <EmptyState message="ยังไม่มีข้อมูลแชท/การจองในช่วงนี้" />
          </Card>
        )}
      </section>

      {/* 5. Knowledge + Gap Detection */}
      <section>
        <SectionHeader title="Knowledge Intelligence" description="ความครอบคลุมและช่องว่าง (Unanswered)" />
        {knowledgeLoading ? (
          <div className="h-24 rounded-xl bg-surface-100 animate-pulse" />
        ) : knowledge ? (
          <Card padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-surface-700">เอกสารทั้งหมด: {knowledge.totalDocuments} | เปิดใช้งาน: {knowledge.activeDocuments}</p>
                {knowledge.coveragePercent != null && (
                  <p className="text-sm text-surface-600 mt-1">Coverage: {knowledge.coveragePercent}%</p>
                )}
                {knowledge.unansweredCount != null && knowledge.unansweredCount > 0 && (
                  <p className="text-sm text-amber-700 mt-1">คำถามที่ยังไม่มี Intent ชัด (other): {knowledge.unansweredCount}</p>
                )}
                <p className="text-sm text-surface-600 mt-2">{knowledge.coverageNote}</p>
              </div>
              {(knowledge.activeDocuments === 0 || (knowledge.coveragePercent != null && knowledge.coveragePercent < 100)) && (
                <a
                  href="/clinic/knowledge"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                >
                  เพิ่ม Knowledge
                </a>
              )}
            </div>
            {knowledge.topMissingTopics && knowledge.topMissingTopics.length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-100">
                <p className="text-xs font-medium text-surface-600 mb-2">หัวข้อที่ถามบ่อยแต่ยังไม่มี Intent ชัด (Top Missing)</p>
                <ul className="space-y-1 text-sm text-surface-700">
                  {knowledge.topMissingTopics.slice(0, 5).map((t, i) => (
                    <li key={i} className="truncate" title={t.text}>
                      {t.text} — {t.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ) : null}
      </section>

      {/* 6. Executive Summary (AI) */}
      <section>
        <SectionHeader title="Strategic AI Executive Report" description="สรุปจาก AI ตามเมตริกช่วงนี้" />
        {executiveLoading ? (
          <div className="h-32 rounded-xl bg-surface-100 animate-pulse" />
        ) : executive ? (
          <Card padding="lg">
            {executive.summary ? (
              <div className="p-5 rounded-xl bg-primary-50/50 border border-primary-100">
                <p className="text-surface-800 text-sm leading-relaxed whitespace-pre-wrap">{executive.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-surface-500">
                {executive.message ?? "ไม่มีสรุป — ตั้งค่า GEMINI_API_KEY เพื่อสร้างสรุปจาก AI หรือเลือกช่วงที่มีข้อมูล"}
              </p>
            )}
            <p className="text-xs text-surface-400 mt-3">
              ช่วง: {executive.from?.slice(0, 10)} ถึง {executive.to?.slice(0, 10)}
            </p>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
