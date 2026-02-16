"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";
import type { DatePeriod } from "@/lib/financial-data/executive";

type ExecutiveFinanceData = {
  dataClassification: string;
  range: { from: string; to: string; previousFrom: string; previousTo: string; label: string };
  totalRevenue: number;
  totalRevenuePrevious: number;
  growthPercent: number;
  netRevenue: number;
  averageTicketSize: number;
  revenuePerCustomer: number;
  bookingToRevenueConversionPercent: number;
  topPerformingService: string;
  topPerformingServiceRevenue: number;
  revenueStabilityScore: number;
  riskAlert: string | null;
  revenueTrends12Months: Array<{ month: string; revenue: number; yearMonth: string }>;
  byService: Array<{ serviceName: string; revenue: number; count: number }>;
  byDoctor: Array<{ doctorName: string; revenue: number; count: number }>;
  byBranch: Array<{ branchId: string; branchName: string; revenue: number; count: number }>;
  byChannel: Array<{ channel: string; revenue: number; count: number }>;
  financialHealth: {
    refundRatePercent: number;
    cancellationRatePercent: number;
    noShowRatePercent: number;
    revenueVolatilityIndex: number;
    repeatCustomerRevenuePercent: number;
    customerLifetimeValueBaht: number;
    revenueConcentrationTopServicePercent: number;
    revenueConcentrationRiskTriggered: boolean;
  };
};

const CHART_COLORS = ["#334155", "#475569", "#64748b", "#94a3b8", "#0f766e", "#0d9488"];

function KpiCard({
  title,
  value,
  subValue,
  trend,
  trendLabel,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}) {
  return (
    <Card padding="lg" className="flex flex-col">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {subValue != null && <p className="mt-1 text-sm text-slate-600">{subValue}</p>}
      {trendLabel != null && (
        <p
          className={`mt-2 text-sm font-medium ${
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-500"
          }`}
        >
          {trendLabel}
        </p>
      )}
    </Card>
  );
}

function buildPeriodOptions(period: DatePeriod): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  if (period === "month") {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      options.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${y}-${String(m).padStart(2, "0")}` });
    }
  } else if (period === "quarter") {
    const y = now.getFullYear();
    for (let q = 1; q <= 4; q++) options.push({ value: `${y}-Q${q}`, label: `${y} Q${q}` });
    for (let q = 1; q <= 4; q++) options.push({ value: `${y - 1}-Q${q}`, label: `${y - 1} Q${q}` });
  } else {
    for (let i = 0; i < 3; i++) {
      const y = now.getFullYear() - i;
      options.push({ value: String(y), label: String(y) });
    }
  }
  return options;
}

export default function FinancePage() {
  const { branch_id } = useClinicContext();
  const [period, setPeriod] = useState<DatePeriod>("month");
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defaultQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const defaultYear = String(now.getFullYear());
  const [periodValue, setPeriodValue] = useState(
    period === "month" ? defaultMonth : period === "quarter" ? defaultQuarter : defaultYear
  );

  const periodOptions = useMemo(() => buildPeriodOptions(period), [period]);
  const financeUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("periodValue", periodValue);
    if (branch_id) params.set("branchId", branch_id);
    return `/api/clinic/finance?${params.toString()}`;
  }, [period, periodValue, branch_id]);
  const briefUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("periodValue", periodValue);
    if (branch_id) params.set("branchId", branch_id);
    return `/api/clinic/finance/executive-brief?${params.toString()}`;
  }, [period, periodValue, branch_id]);

  const { data, error, isLoading } = useSWR<ExecutiveFinanceData>(financeUrl, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const { data: briefData } = useSWR<{ brief: string }>(briefUrl, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });

  const growthTrend: "up" | "down" | "neutral" =
    data?.growthPercent == null ? "neutral" : data.growthPercent > 0 ? "up" : data.growthPercent < 0 ? "down" : "neutral";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="Executive Finance Control Center — สุขภาพการเงินและแนวโน้มสำหรับการตัดสินใจ"
      />

      <RequireRole
        allowed={["owner", "manager"]}
        fallback={
          <Card padding="lg" className="border-amber-200 bg-amber-50/50">
            <p className="font-medium text-amber-800">Finance — จำกัดสิทธิ์เฉพาะ Owner / Manager</p>
            <p className="mt-1 text-sm text-amber-700">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </Card>
        }
      >
        {/* Global date selector — single control */}
        <Card padding="md" className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-slate-700">ช่วงเวลา</span>
            <select
              value={period}
              onChange={(e) => {
                const p = e.target.value as DatePeriod;
                setPeriod(p);
                setPeriodValue(
                  p === "month" ? defaultMonth : p === "quarter" ? defaultQuarter : defaultYear
                );
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="month">เดือน</option>
              <option value="quarter">ไตรมาส</option>
              <option value="year">ปี</option>
            </select>
            <select
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {error && (
          <Card padding="lg" className="border-red-200 bg-red-50/50">
            <p className="text-red-700">{error.message}</p>
          </Card>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {/* Section 1 — Executive Summary KPIs */}
            <section>
              <SectionHeader
                title="Executive Summary"
                description="ตัวชี้วัดหลัก — เทียบกับช่วงก่อนหน้า"
              />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <KpiCard
                  title="Total Revenue (ช่วงที่เลือก)"
                  value={`฿${data.totalRevenue.toLocaleString()}`}
                  trend={growthTrend}
                  trendLabel={`${data.growthPercent >= 0 ? "+" : ""}${data.growthPercent}% เทียบช่วงก่อน`}
                />
                <KpiCard
                  title="Growth %"
                  value={`${data.growthPercent >= 0 ? "+" : ""}${data.growthPercent}%`}
                  trend={growthTrend}
                  trendLabel="เทียบช่วงก่อนหน้า"
                />
                <KpiCard
                  title="Net Revenue (หลังหักคืนเงิน)"
                  value={`฿${data.netRevenue.toLocaleString()}`}
                />
                <KpiCard
                  title="Average Ticket Size"
                  value={`฿${data.averageTicketSize.toLocaleString()}`}
                />
                <KpiCard
                  title="Revenue per Customer"
                  value={`฿${data.revenuePerCustomer.toLocaleString()}`}
                />
                <KpiCard
                  title="Booking → Revenue Conversion"
                  value={`${data.bookingToRevenueConversionPercent}%`}
                />
                <KpiCard
                  title="Top Performing Service"
                  value={data.topPerformingService}
                  subValue={`฿${data.topPerformingServiceRevenue.toLocaleString()}`}
                />
                <KpiCard
                  title="Revenue Stability Score"
                  value={data.revenueStabilityScore}
                  subValue="0–100 (สูง = มั่นคง)"
                />
                {data.riskAlert && (
                  <div className="col-span-2 md:col-span-3 lg:col-span-4">
                    <Card padding="md" className="border-amber-200 bg-amber-50/50">
                      <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                        Risk Alert
                      </p>
                      <p className="mt-1 text-sm text-amber-800">{data.riskAlert}</p>
                    </Card>
                  </div>
                )}
              </div>
            </section>

            {/* Section 2 — Revenue Analytics */}
            <section>
              <SectionHeader
                title="Revenue Analytics"
                description="แนวโน้มและสัดส่วนตามช่วงที่เลือก"
              />
              <div className="space-y-6">
                <Card padding="lg">
                  <CardHeader title="12-Month Revenue Trend" subtitle="รายได้รายเดือน (บาท)" />
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.revenueTrends12Months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number | undefined) => [v != null ? `฿${v.toLocaleString()}` : "—", "Revenue"]} />
                        <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card padding="lg">
                    <CardHeader title="Revenue by Service" subtitle="บาท" />
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byService.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="serviceName" width={78} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number | undefined) => [v != null ? `฿${v.toLocaleString()}` : "—", "Revenue"]} />
                          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                            {data.byService.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card padding="lg">
                    <CardHeader title="Revenue by Doctor" subtitle="บาท" />
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byDoctor.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="doctorName" width={78} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number | undefined) => [v != null ? `฿${v.toLocaleString()}` : "—", "Revenue"]} />
                          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                            {data.byDoctor.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  {data.byBranch.length > 1 && (
                    <Card padding="lg">
                      <CardHeader title="Revenue by Branch" subtitle="บาท" />
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.byBranch.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="branchName" width={78} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: number | undefined) => [v != null ? `฿${v.toLocaleString()}` : "—", "Revenue"]} />
                            <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                              {data.byBranch.slice(0, 8).map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}
                  <Card padding="lg">
                    <CardHeader title="Revenue by Channel" subtitle="LINE, Walk-in, Other (บาท)" />
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byChannel.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="channel" width={78} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number | undefined) => [v != null ? `฿${v.toLocaleString()}` : "—", "Revenue"]} />
                          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                            {data.byChannel.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            </section>

            {/* Section 3 — Financial Health Metrics */}
            <section>
              <SectionHeader
                title="Financial Health Metrics"
                description="ตัวชี้วัดสำหรับการตัดสินใจ"
              />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <KpiCard title="Refund Rate" value={`${data.financialHealth.refundRatePercent}%`} />
                <KpiCard title="Cancellation Rate" value={`${data.financialHealth.cancellationRatePercent}%`} />
                <KpiCard title="No-show Rate" value={`${data.financialHealth.noShowRatePercent}%`} />
                <KpiCard
                  title="Revenue Volatility Index"
                  value={data.financialHealth.revenueVolatilityIndex.toFixed(2)}
                  subValue="Std dev (6 months)"
                />
                <KpiCard
                  title="Repeat Customer Revenue %"
                  value={`${data.financialHealth.repeatCustomerRevenuePercent}%`}
                />
                <KpiCard
                  title="Customer Lifetime Value"
                  value={`฿${data.financialHealth.customerLifetimeValueBaht.toLocaleString()}`}
                />
                <KpiCard
                  title="Revenue Concentration (Top Service)"
                  value={`${data.financialHealth.revenueConcentrationTopServicePercent}%`}
                  trendLabel={
                    data.financialHealth.revenueConcentrationRiskTriggered ? "ความเสี่ยง: >40%" : undefined
                  }
                />
              </div>
            </section>

            {/* Section 4 — AI Executive Brief (INTERNAL ONLY) */}
            <section>
              <SectionHeader
                title="AI Executive Brief"
                description="การตีความและข้อเสนอแนะเชิงกลยุทธ์ — ข้อมูลภายในเท่านั้น"
              />
              <Card padding="lg" className="border-slate-300 bg-slate-50/50">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  INTERNAL EXECUTIVE ANALYSIS — NOT CUSTOMER FACING
                </p>
                {briefData?.brief ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {briefData.brief}
                  </p>
                ) : (
                  <div className="h-20 animate-pulse rounded bg-slate-200" />
                )}
              </Card>
            </section>
          </>
        )}
      </RequireRole>
    </div>
  );
}
