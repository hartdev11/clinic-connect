"use client";

import { useMemo, useState, useCallback } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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

const CHART_COLORS = ["var(--rg-500)", "var(--mauve-500)", "var(--rg-300)", "var(--mauve-300)", "var(--rg-400)", "var(--cream-300)"];

/** Minimal shape for invoice list row — extend when list API returns data */
type InvoiceListItem = {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  grand_total_satang?: number;
  customer_id?: string | null;
  created_at?: string | null;
};

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
  const [invoiceFilter, setInvoiceFilter] = useState<"ทั้งหมด" | "รอชำระ" | "ชำระแล้ว" | "ยกเลิก">("ทั้งหมด");
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);

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

  const handleExportPdf = useCallback(() => {
    // Placeholder: wire to PDF export when implemented
  }, []);
  const handleCreateInvoice = useCallback(() => {
    // Placeholder: navigate or open modal when create-invoice flow exists
  }, []);
  const handleInvoiceRowClick = useCallback((invoice: InvoiceListItem) => {
    // Keep: navigate to detail when implemented — e.g. router.push(`/clinic/finance/invoices/${invoice.id}`)
  }, []);

  const executiveBrief = briefData?.brief ?? null;
  const formatBaht = (v: number) => `฿${v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="การเงิน"
        subtitle="ภาพรวมรายรับ ใบแจ้งหนี้ และการชำระเงิน"
        shimmer
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={handleExportPdf}>
              ส่งออก PDF
            </Button>
            <Button variant="primary" size="sm" shimmer onClick={handleCreateInvoice}>
              + สร้างใบแจ้งหนี้
            </Button>
          </div>
        }
      />

      <RequireRole
        allowed={["owner", "manager"]}
        fallback={
          <div className="luxury-card p-6 border-amber-200 bg-amber-50/50">
            <p className="font-body font-medium text-amber-800">Finance — จำกัดสิทธิ์เฉพาะ Owner / Manager</p>
            <p className="mt-1 font-body text-sm text-amber-700">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </div>
        }
      >
        {/* Period selector */}
        <div className="luxury-card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-body text-sm font-medium text-mauve-700">ช่วงเวลา</span>
            <select
              value={period}
              onChange={(e) => {
                const p = e.target.value as DatePeriod;
                setPeriod(p);
                setPeriodValue(
                  p === "month" ? defaultMonth : p === "quarter" ? defaultQuarter : defaultYear
                );
              }}
              className="rounded-xl border border-cream-200 bg-white px-3 py-2 font-body text-sm text-mauve-800 focus:border-rg-400 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
            >
              <option value="month">เดือน</option>
              <option value="quarter">ไตรมาส</option>
              <option value="year">ปี</option>
            </select>
            <select
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              className="rounded-xl border border-cream-200 bg-white px-3 py-2 font-body text-sm text-mauve-800 focus:border-rg-400 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="luxury-card p-6 border-red-200 bg-red-50/50">
            <p className="font-body text-red-700">{error.message}</p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-cream-200" />
            ))}
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {/* Finance KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="รายรับเดือนนี้"
                value={formatBaht(data.totalRevenue)}
                trend={{ value: data.growthPercent, positive: data.growthPercent >= 0 }}
                icon={<span>◻</span>}
                delay={0}
                shimmer
              />
              <StatCard
                label="รอชำระ"
                value="—"
                icon={<span>○</span>}
                delay={0.08}
              />
              <StatCard
                label="ชำระแล้ว"
                value="—"
                icon={<span>✓</span>}
                delay={0.16}
              />
              <StatCard
                label="ยอดรวมปีนี้"
                value={formatBaht(data.totalRevenue)}
                trend={{ value: data.growthPercent, positive: data.growthPercent >= 0 }}
                icon={<span>△</span>}
                delay={0.24}
              />
            </div>

            {/* Executive Brief (AI) */}
            {executiveBrief && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="luxury-card p-6 shimmer-border mb-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-mauve-400 to-mauve-600 flex items-center justify-center text-white flex-shrink-0 animate-glow-pulse">
                    ✦
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-display text-lg font-semibold text-mauve-800">Executive Brief</h3>
                      <Badge variant="premium" size="sm">AI</Badge>
                    </div>
                    <p className="font-body text-sm text-mauve-600 leading-relaxed whitespace-pre-wrap">
                      {executiveBrief}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Invoice List */}
            <div className="luxury-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-cream-200">
                <h3 className="font-display text-lg font-semibold text-mauve-800">ใบแจ้งหนี้</h3>
                <div className="flex gap-1 p-1 bg-cream-100 rounded-xl">
                  {(["ทั้งหมด", "รอชำระ", "ชำระแล้ว", "ยกเลิก"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setInvoiceFilter(s)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-body font-medium transition-all duration-200",
                        invoiceFilter === s
                          ? "bg-white text-mauve-700 shadow-sm"
                          : "text-mauve-400 hover:text-mauve-600"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-cream-200">
                {invoices
                  .filter((inv) => {
                    if (invoiceFilter === "ทั้งหมด") return true;
                    if (invoiceFilter === "รอชำระ") return inv.status === "PENDING" || inv.status === "pending";
                    if (invoiceFilter === "ชำระแล้ว") return inv.status === "PAID" || inv.status === "paid";
                    if (invoiceFilter === "ยกเลิก") return inv.status === "CANCELLED" || inv.status === "cancelled";
                    return true;
                  })
                  .map((invoice, i) => (
                    <motion.div
                      key={invoice.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-cream-50 transition-colors cursor-pointer group"
                      onClick={() => handleInvoiceRowClick(invoice)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-rg-400 text-sm">◻</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-mauve-800">
                          #{invoice.invoiceNumber ?? invoice.id?.slice(-6)}
                        </p>
                        <p className="font-body text-xs text-mauve-400">
                          {invoice.created_at
                            ? new Date(invoice.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </p>
                      </div>
                      <p className="font-display text-base font-semibold text-mauve-800 flex-shrink-0">
                        {invoice.grand_total_satang != null
                          ? formatBaht(invoice.grand_total_satang / 100)
                          : "—"}
                      </p>
                      <Badge
                        variant={
                          invoice.status === "PAID" || invoice.status === "paid"
                            ? "success"
                            : invoice.status === "PENDING" || invoice.status === "pending"
                              ? "warning"
                              : invoice.status === "CANCELLED" || invoice.status === "cancelled"
                                ? "danger"
                                : "default"
                        }
                        dot
                        size="sm"
                      >
                        {invoice.status === "PAID" || invoice.status === "paid"
                          ? "ชำระแล้ว"
                          : invoice.status === "PENDING" || invoice.status === "pending"
                            ? "รอชำระ"
                            : invoice.status === "CANCELLED" || invoice.status === "cancelled"
                              ? "ยกเลิก"
                              : invoice.status}
                      </Badge>
                      <span className="text-mauve-300 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </motion.div>
                  ))}
              </div>
              {(!invoices || invoices.length === 0) && (
                <EmptyState
                  icon={<span className="text-2xl">◻</span>}
                  title="ยังไม่มีใบแจ้งหนี้"
                  description="ใบแจ้งหนี้จะแสดงที่นี่"
                />
              )}
            </div>

            {/* Section — Executive Summary (extra KPIs) */}
            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Executive Summary</h2>
              <p className="font-body text-sm text-mauve-500 mb-4">ตัวชี้วัดหลัก — เทียบกับช่วงก่อนหน้า</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Net Revenue</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800 tabular-nums">{formatBaht(data.netRevenue)}</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Average Ticket</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800 tabular-nums">{formatBaht(data.averageTicketSize)}</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Revenue per Customer</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800 tabular-nums">{formatBaht(data.revenuePerCustomer)}</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Booking → Revenue</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800 tabular-nums">{data.bookingToRevenueConversionPercent}%</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Top Service</p>
                  <p className="mt-2 font-display text-lg font-semibold text-mauve-800">{data.topPerformingService}</p>
                  <p className="font-body text-sm text-mauve-500">{formatBaht(data.topPerformingServiceRevenue)}</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Stability Score</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800 tabular-nums">{data.revenueStabilityScore}</p>
                  <p className="font-body text-xs text-mauve-400">0–100 (สูง = มั่นคง)</p>
                </div>
                {data.riskAlert && (
                  <div className="col-span-2 md:col-span-3 lg:col-span-4">
                    <div className="luxury-card p-4 border-amber-200 bg-amber-50/50">
                      <p className="font-body text-xs font-medium uppercase tracking-wider text-amber-700">Risk Alert</p>
                      <p className="mt-1 font-body text-sm text-amber-800">{data.riskAlert}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Revenue Analytics */}
            <section>
              <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Revenue Analytics</h2>
              <p className="font-body text-sm text-mauve-500 mb-4">แนวโน้มและสัดส่วนตามช่วงที่เลือก</p>
              <div className="space-y-6">
                <div className="luxury-card p-6">
                  <h3 className="font-display text-base font-semibold text-mauve-800">12-Month Revenue Trend</h3>
                  <p className="font-body text-xs text-mauve-400 mt-0.5">รายได้รายเดือน (บาท)</p>
                  <div className="h-72 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.revenueTrends12Months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--cream-500)" }} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--cream-500)" }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                          formatter={(v: number | undefined) => [v != null ? `฿${Number(v).toLocaleString()}` : "—", "Revenue"]}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="var(--rg-500)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="luxury-card p-6">
                    <h3 className="font-display text-base font-semibold text-mauve-800">Revenue by Service</h3>
                    <p className="font-body text-xs text-mauve-400 mt-0.5">บาท</p>
                    <div className="h-64 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byService.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" />
                          <XAxis type="number" tick={{ fill: "var(--cream-500)" }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="serviceName" width={78} tick={{ fontSize: 10, fill: "var(--cream-500)" }} />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                            formatter={(v: number | undefined) => [v != null ? `฿${Number(v).toLocaleString()}` : "—", "Revenue"]}
                          />
                          <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                            {data.byService.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="luxury-card p-6">
                    <h3 className="font-display text-base font-semibold text-mauve-800">Revenue by Doctor</h3>
                    <p className="font-body text-xs text-mauve-400 mt-0.5">บาท</p>
                    <div className="h-64 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byDoctor.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" />
                          <XAxis type="number" tick={{ fill: "var(--cream-500)" }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="doctorName" width={78} tick={{ fontSize: 10, fill: "var(--cream-500)" }} />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                            formatter={(v: number | undefined) => [v != null ? `฿${Number(v).toLocaleString()}` : "—", "Revenue"]}
                          />
                          <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                            {data.byDoctor.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {data.byBranch.length > 1 && (
                    <div className="luxury-card p-6">
                      <h3 className="font-display text-base font-semibold text-mauve-800">Revenue by Branch</h3>
                      <p className="font-body text-xs text-mauve-400 mt-0.5">บาท</p>
                      <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.byBranch.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" />
                            <XAxis type="number" tick={{ fill: "var(--cream-500)" }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="branchName" width={78} tick={{ fontSize: 10, fill: "var(--cream-500)" }} />
                            <Tooltip
                              contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                              formatter={(v: number | undefined) => [v != null ? `฿${Number(v).toLocaleString()}` : "—", "Revenue"]}
                            />
                            <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                              {data.byBranch.slice(0, 8).map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  <div className="luxury-card p-6">
                    <h3 className="font-display text-base font-semibold text-mauve-800">Revenue by Channel</h3>
                    <p className="font-body text-xs text-mauve-400 mt-0.5">LINE, Walk-in, Other (บาท)</p>
                    <div className="h-64 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byChannel.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" />
                          <XAxis type="number" tick={{ fill: "var(--cream-500)" }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="channel" width={78} tick={{ fontSize: 10, fill: "var(--cream-500)" }} />
                          <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "1px solid var(--cream-200)", fontFamily: "var(--font-body)" }}
                            formatter={(v: number | undefined) => [v != null ? `฿${Number(v).toLocaleString()}` : "—", "Revenue"]}
                          />
                          <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                            {data.byChannel.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Financial Health Metrics */}
            <section>
              <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Financial Health Metrics</h2>
              <p className="font-body text-sm text-mauve-500 mb-4">ตัวชี้วัดสำหรับการตัดสินใจ</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Refund Rate</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{data.financialHealth.refundRatePercent}%</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Cancellation Rate</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{data.financialHealth.cancellationRatePercent}%</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">No-show Rate</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{data.financialHealth.noShowRatePercent}%</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Revenue Volatility</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{data.financialHealth.revenueVolatilityIndex.toFixed(2)}</p>
                  <p className="font-body text-xs text-mauve-400">Std dev (6 months)</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Repeat Customer Revenue %</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{data.financialHealth.repeatCustomerRevenuePercent}%</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Customer Lifetime Value</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{formatBaht(data.financialHealth.customerLifetimeValueBaht)}</p>
                </div>
                <div className="luxury-card p-6">
                  <p className="font-body text-xs font-medium uppercase tracking-wider text-mauve-400">Revenue Concentration (Top Service)</p>
                  <p className="mt-2 font-display text-xl font-semibold text-mauve-800">{data.financialHealth.revenueConcentrationTopServicePercent}%</p>
                  {data.financialHealth.revenueConcentrationRiskTriggered && (
                    <p className="font-body text-xs text-amber-600 mt-1">ความเสี่ยง: &gt;40%</p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </RequireRole>
    </div>
  );
}
