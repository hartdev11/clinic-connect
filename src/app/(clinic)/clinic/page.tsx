"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import { useClinicContext } from "@/contexts/ClinicContext";
import {
  AreaChart,
  Area,
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
import {
  BanknotesIcon,
  CalendarDaysIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  TagIcon,
  ChartBarIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { BranchSelector } from "@/components/clinic/BranchSelector";
import { RevenueImpactChart } from "@/components/clinic/charts/RevenueImpactChart";
import { BranchComparisonChart } from "@/components/clinic/charts/BranchComparisonChart";
import { AlertsPanel, buildSmartAlerts } from "@/components/clinic/AlertsPanel";
import { apiFetcher } from "@/lib/api-fetcher";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { cn } from "@/lib/utils";

/* Phase 3 — Rose Gold × Cream chart colors (semantic tokens, no hex) */
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
  barPrimary: CHART_COLORS[0],
  barSecondary: CHART_COLORS[1],
  grid: "var(--cream-300)",
  text: "var(--cream-500)",
};
const PIE_COLORS = CHART_COLORS;

const LUXURY_TOOLTIP = {
  background: "rgba(250, 247, 244, 0.95)",
  border: "1px solid rgba(201, 149, 108, 0.2)",
  borderRadius: "1rem",
  boxShadow: "0 8px 32px rgba(201,149,108,0.15)",
  fontFamily: "DM Sans",
  fontSize: "12px",
  color: "var(--mauve-600)",
  padding: "8px 12px",
};

type DashboardResponse = {
  stats: {
    chatsToday: number;
    newCustomers: number;
    bookingsToday: number;
    bookingsTomorrow: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
  };
  aiAlerts?: Array<{
    id: string;
    type: "warning" | "info";
    message: string;
    time: string;
    actionUrl?: string;
  }>;
  bookingsByDate: Array<{
    dateLabel: string;
    date: string;
    total: number;
    items: Array<{
      id: string;
      customer: string;
      service: string;
      time: string;
      status: string;
    }>;
  }>;
  chartData: {
    revenueByDay: Array<{ day: string; revenue: number }>;
    activityByDay: Array<{ day: string; chats: number; bookings: number }>;
  };
  fetchedAt?: string;
  activePromotionsCount?: number;
  pendingBookingsCount?: number;
  unlabeledFeedbackCount?: number;
  chatsWoW?: { thisWeek: number; lastWeek: number };
  bookingsWoW?: { thisWeek: number; lastWeek: number };
  usage_percentage?: number;
  pending_handoffs?: number;
  hot_leads_count?: number;
  hotLeads?: Array<{
    id: string;
    name: string;
    leadScore?: number;
    lastChatAt?: string;
    pictureUrl?: string | null;
    source?: string;
  }>;
};

export default function ClinicDashboardPage() {
  const { branch_id, currentOrg } = useClinicContext();
  const [branchFilter, setBranchFilter] = React.useState<string | null>(null);
  const effectiveBranchId = branchFilter ?? branch_id;
  const dashboardKey = effectiveBranchId
    ? `/api/clinic/dashboard?branchId=${effectiveBranchId}`
    : "/api/clinic/dashboard";
  const overviewKey = effectiveBranchId
    ? `/api/clinic/analytics/overview?branchId=${effectiveBranchId}&range=7d`
    : "/api/clinic/analytics/overview?range=7d";
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardResponse>(
    dashboardKey,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000, keepPreviousData: true }
  );
  const { data: overview } = useSWR<{
    conversionRate: number;
    aiCloseRate: number;
    totalChats: number;
    totalBookings: number;
    bookings_today?: number;
    bookings_this_month?: number;
    estimated_revenue_month?: number;
    ai_assisted_revenue?: number;
    booking_conversion_rate?: number;
  }>(overviewKey, apiFetcher, { revalidateOnFocus: true, dedupingInterval: 30_000 });

  const branchesKey = "/api/clinic/branches";
  const { data: branchesData } = useSWR<{ items: Array<{ id: string; name: string }> }>(
    branchesKey,
    apiFetcher,
    { revalidateOnFocus: false }
  );
  const branches = branchesData?.items ?? [];
  const showBranchComparison = !effectiveBranchId && branches.length > 1;
  const realtime = useDashboardRealtime();

  const handleRefresh = useCallback(() => mutate(), [mutate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        (e.key === "r" || e.key === "R") &&
        t.tagName !== "INPUT" &&
        t.tagName !== "TEXTAREA" &&
        !t.isContentEditable
      ) {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRefresh]);

  const handleExportPdf = useCallback(async () => {
    const el = document.getElementById("dashboard-export-area");
    if (!el) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "var(--cream-100)",
      });
      const imgData = canvas.toDataURL("image/png", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const h = Math.min(imgH, pageH);
      const w = imgH > pageH ? (pageH * canvas.width) / canvas.height : pageW;
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Export PDF failed:", err);
    }
  }, []);

  const d = data?.stats ?? {
    chatsToday: 0,
    newCustomers: 0,
    bookingsToday: 0,
    bookingsTomorrow: 0,
    revenueThisMonth: 0,
    revenueLastMonth: 0,
  };
  const revenueLast = d.revenueLastMonth || 1;
  const revenueChangeRaw =
    ((d.revenueThisMonth - d.revenueLastMonth) / revenueLast) * 100;
  const revenueChange = Math.round(revenueChangeRaw * 10) / 10;
  const bookingsByDate = data?.bookingsByDate ?? [];
  const chartData = data?.chartData ?? {
    revenueByDay: [],
    activityByDay: [],
  };
  const hasRevenueData = chartData.revenueByDay.some((r) => r.revenue > 0);
  const hasActivityData = chartData.activityByDay.some(
    (a) => a.chats > 0 || a.bookings > 0
  );
  const revenueByDay =
    chartData.revenueByDay.length > 0
      ? chartData.revenueByDay
      : [{ day: "-", revenue: 0 }];
  const activityByDay =
    chartData.activityByDay.length > 0
      ? chartData.activityByDay
      : [{ day: "-", chats: 0, bookings: 0 }];

  const chatsWoW = data?.chatsWoW ?? { thisWeek: 0, lastWeek: 0 };
  const chatsWoWChange =
    chatsWoW.lastWeek > 0
      ? Math.round(((chatsWoW.thisWeek - chatsWoW.lastWeek) / chatsWoW.lastWeek) * 100 * 10) / 10
      : null;
  const bookingsWoW = data?.bookingsWoW ?? { thisWeek: 0, lastWeek: 0 };
  const bookingsWoWChange =
    bookingsWoW.lastWeek > 0
      ? Math.round(((bookingsWoW.thisWeek - bookingsWoW.lastWeek) / bookingsWoW.lastWeek) * 100 * 10) / 10
      : null;

  const pieData = useMemo(() => {
    const promo = data?.activePromotionsCount ?? 0;
    return [
      { name: "แชทวันนี้", value: d.chatsToday },
      { name: "ลูกค้าใหม่", value: d.newCustomers },
      { name: "จองวันนี้", value: d.bookingsToday },
      { name: "จองพรุ่งนี้", value: d.bookingsTomorrow },
      { name: "โปรโมชัน", value: promo },
    ].filter((x) => x.value > 0);
  }, [
    d.chatsToday,
    d.newCustomers,
    d.bookingsToday,
    d.bookingsTomorrow,
    data?.activePromotionsCount,
  ]);

  const formattedFetchedAt = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;
  const fetchedAtMs = data?.fetchedAt ? new Date(data.fetchedAt).getTime() : 0;
  const isStale = fetchedAtMs > 0 && Date.now() - fetchedAtMs > 5 * 60 * 1000;

  const todayLabel = new Date().toLocaleDateString("th-TH", {
    dateStyle: "long",
  });

  const recentBookings = useMemo(
    () =>
      bookingsByDate.flatMap((g) =>
        g.items.map((it) => ({ ...it, dateLabel: g.dateLabel }))
      ).slice(0, 5),
    [bookingsByDate]
  );

  const activities = useMemo(
    () =>
      (data?.aiAlerts ?? []).map((a) => ({
        description: a.message,
        time: a.time,
      })),
    [data?.aiAlerts]
  );

  if (error) {
    return (
      <EmptyState
        icon={<ExclamationTriangleIcon className="w-12 h-12 text-amber-500" />}
        title="ไม่สามารถโหลดข้อมูลได้"
        description={error.message ?? "กรุณาลองใหม่อีกครั้ง"}
        action={
          <Button variant="primary" onClick={() => mutate()}>
            ลองใหม่
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-16 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-cream-200 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-cream-200 animate-pulse" />
          <div
            className="h-72 rounded-2xl bg-cream-200 animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100/50">
      <div id="dashboard-export-area" className="space-y-8 print:block">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="font-display text-xl font-semibold text-mauve-800">
              สวัสดี {currentOrg?.name?.trim() || "คลินิก"}
            </h1>
            <p className="font-body text-sm text-mauve-500 mt-1">
              {todayLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BranchSelector value={branchFilter} onChange={setBranchFilter} />
            {realtime.isLive && (
              <span className="flex items-center gap-1 text-xs font-medium text-rg-500" title="Real-time updates">
                <span className="w-1.5 h-1.5 rounded-full bg-rg-400 animate-pulse" aria-hidden />
                LIVE
              </span>
            )}
            {formattedFetchedAt && (
              <span
                className={cn(
                  "text-xs tabular-nums font-body",
                  isStale ? "text-amber-600 font-medium" : "text-mauve-400"
                )}
                aria-live="polite"
              >
                {isStale ? "ข้อมูลอาจเก่า" : `อัปเดต ${formattedFetchedAt}`}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isValidating}
              aria-label="โหลดข้อมูลใหม่"
            >
              {isValidating ? "กำลังโหลด..." : "รีเฟรช"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              shimmer
              onClick={handleExportPdf}
              aria-label="ส่งออก PDF"
            >
              ส่งออก PDF
            </Button>
          </div>
        </motion.div>

        <div className="divider-rg mb-8" aria-hidden />

        {/* Hot Leads Widget */}
        {(data?.hotLeads?.length ?? 0) > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-8"
          >
            <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4 flex items-center gap-2">
              🔥 Hot Leads
            </h2>
            <div className="luxury-card p-4">
              <div className="flex flex-wrap gap-4">
                {data!.hotLeads!.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/clinic/customers?select=${encodeURIComponent(lead.id)}`}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-cream-100/60 hover:bg-cream-200/60 transition-colors min-w-0 max-w-[280px]"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center text-white font-display font-semibold flex-shrink-0 overflow-hidden">
                      {lead.pictureUrl ? (
                        <img
                          src={lead.pictureUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        (lead.name || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body font-medium text-mauve-800 truncate">{lead.name || "ลูกค้า"}</p>
                      <p className="text-xs text-mauve-500">
                        Score {(lead.leadScore ?? 0).toFixed(2)} •
                        {lead.lastChatAt
                          ? ` ล่าสุด ${new Date(lead.lastChatAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`
                          : " —"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[color:var(--ent-danger)]/10 text-[var(--ent-danger)] flex-shrink-0">
                      🔥
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="รายได้เดือนนี้"
            value={new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(d.revenueThisMonth)}
            subtext={`${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% เดือน`}
            icon={<BanknotesIcon className="w-6 h-6 text-rg-500" />}
            trend={{
              value: Math.abs(Math.round(revenueChange * 10) / 10),
              positive: revenueChange >= 0,
            }}
            delay={0}
            shimmer
          />
          <StatCard
            label="การจองวันนี้"
            value={`${d.bookingsToday} / ${d.bookingsTomorrow}`}
            subtext={
              bookingsWoWChange != null
                ? `${bookingsWoWChange >= 0 ? "+" : ""}${bookingsWoWChange.toFixed(1)}% สัปดาห์`
                : undefined
            }
            icon={<CalendarDaysIcon className="w-6 h-6 text-rg-500" />}
            trend={
              bookingsWoWChange != null
                ? {
                    value: Math.abs(bookingsWoWChange),
                    positive: bookingsWoWChange >= 0,
                  }
                : undefined
            }
            delay={0.08}
          />
          <StatCard
            label="ลูกค้าใหม่"
            value={d.newCustomers}
            subtext={undefined}
            icon={<UserPlusIcon className="w-6 h-6 text-rg-500" />}
            delay={0.16}
          />
          <StatCard
            label="แชทวันนี้"
            value={d.chatsToday}
            subtext={
              chatsWoWChange != null
                ? `${chatsWoWChange >= 0 ? "+" : ""}${chatsWoWChange.toFixed(1)}% สัปดาห์`
                : undefined
            }
            icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-rg-500" />}
            trend={
              chatsWoWChange != null
                ? {
                    value: Math.abs(chatsWoWChange),
                    positive: chatsWoWChange >= 0,
                  }
                : undefined
            }
            delay={0.24}
          />
          <StatCard
            label="อัตราตอบโดย AI"
            value={
              overview && overview.totalChats > 0
                ? `${overview.aiCloseRate}%`
                : "—"
            }
            subtext={
              overview && overview.totalChats > 0
                ? "แชทที่ AI ตอบสำเร็จ (labeled)"
                : undefined
            }
            icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-[var(--ent-accent)]" />}
            delay={0.32}
          />
          <StatCard
            label="Conversion Rate"
            value={
              overview && overview.totalChats > 0
                ? `${overview.conversionRate}%`
                : "—"
            }
            subtext={
              overview && overview.totalChats > 0
                ? "แชท → การจอง"
                : undefined
            }
            icon={<ChartBarIcon className="w-6 h-6 text-[var(--ent-accent)]" />}
            delay={0.4}
          />
        </div>

        {/* Phase 21: Revenue KPI Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {!overview ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="luxury-card p-6 animate-pulse">
                <div className="h-3 w-20 bg-cream-300 rounded mb-3" />
                <div className="h-8 w-24 bg-cream-200 rounded mt-2" />
                <div className="h-3 w-16 bg-cream-200 rounded mt-2" />
              </div>
            ))
          ) : (
          <>
          <StatCard
            label="จองวันนี้"
            value={
              realtime.isLive && realtime.todayMetrics?.bookings != null
                ? realtime.todayMetrics.bookings
                : overview?.bookings_today ?? "—"
            }
            subtext={typeof overview?.bookings_this_month === "number" ? `${overview.bookings_this_month} เดือนนี้` : undefined}
            icon={<CalendarDaysIcon className="w-6 h-6 text-rg-500" />}
            delay={0}
          />
          <StatCard
            label="รายได้โดยประมาณ"
            value={
              typeof overview?.estimated_revenue_month === "number"
                ? new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(overview.estimated_revenue_month)
                : "—"
            }
            subtext="เดือนนี้"
            icon={<BanknotesIcon className="w-6 h-6 text-rg-500" />}
            delay={0.08}
            shimmer={!overview}
          />
          <StatCard
            label="AI ช่วยปิดยอด"
            value={
              typeof overview?.ai_assisted_revenue === "number"
                ? new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(overview.ai_assisted_revenue)
                : "—"
            }
            subtext={
              typeof overview?.estimated_revenue_month === "number" && overview.estimated_revenue_month > 0 && typeof overview?.ai_assisted_revenue === "number"
                ? `${Math.round((overview.ai_assisted_revenue / overview.estimated_revenue_month) * 100)}% ของรายได้`
                : undefined
            }
            icon={<ChatBubbleLeftRightIcon className="w-6 h-6 text-[var(--ent-accent)]" />}
            delay={0.16}
          />
          <StatCard
            label="Hot Lead Conversion"
            value={
              typeof overview?.booking_conversion_rate === "number"
                ? `${overview.booking_conversion_rate}%`
                : "—"
            }
            subtext="Hot Leads → Booking"
            icon={<ChartBarIcon className="w-6 h-6 text-[var(--ent-accent)]" />}
            delay={0.24}
          />
          </>
          )}
        </div>

        {/* Charts + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="luxury-card p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display text-xl font-semibold text-mauve-800">
                    รายได้รายวัน (บาท)
                  </h3>
                  <p className="text-xs font-body text-mauve-400 mt-0.5">
                    7 วันล่าสุด
                  </p>
                </div>
              </div>
              <div className="w-full min-h-[240px] h-60">
                {!hasRevenueData ? (
                  <div
                    className="flex flex-col items-center justify-center h-60 text-mauve-400 bg-cream-200/50 rounded-2xl border border-dashed border-cream-300 font-body text-sm"
                    role="status"
                  >
                    ยังไม่มีข้อมูลรายได้
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={revenueByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="rgGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                        <stop
                          offset="5%"
                          stopColor={CHART.primary}
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART.primary}
                          stopOpacity={0}
                        />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="var(--cream-300)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--cream-500)",
                          fontSize: 11,
                          fontFamily: "DM Sans",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--cream-500)",
                          fontSize: 11,
                          fontFamily: "DM Sans",
                        }}
                        tickFormatter={(v) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                      />
                      <Tooltip
                        contentStyle={LUXURY_TOOLTIP}
                        formatter={(v) => [
                          `฿${Number(v ?? 0).toLocaleString()}`,
                          "รายได้",
                        ]}
                        labelFormatter={(l) => `วัน${l}`}
                        cursor={{
                          stroke: "var(--color-rg-400)",
                          strokeWidth: 1,
                          strokeDasharray: "4 4",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={CHART.primary}
                        strokeWidth={2}
                        fill="url(#rgGradient)"
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="luxury-card p-6 h-full flex flex-col">
              <h3 className="font-display text-xl font-semibold text-mauve-800 mb-5">
                Quick Actions
              </h3>
              <div className="flex flex-col gap-3 flex-1">
                {[
                  {
                    label: "เพิ่มการจองใหม่",
                    Icon: CalendarDaysIcon,
                    href: "/clinic/booking",
                    variant: "primary",
                  },
                  {
                    label: "ลูกค้า & แชท",
                    Icon: UserGroupIcon,
                    href: "/clinic/customers",
                    variant: "secondary",
                  },
                  {
                    label: "โปรโมชัน",
                    Icon: TagIcon,
                    href: "/clinic/promotions",
                    variant: "secondary",
                  },
                  {
                    label: "ดู Insights",
                    Icon: ChartBarIcon,
                    href: "/clinic/insights",
                    variant: "ghost",
                  },
                ].map((action, i) => (
                  <motion.div
                    key={action.label}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                  >
                    <Link href={action.href}>
                      <span
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-2xl",
                          "font-body text-sm font-medium transition-all duration-200",
                          "border group cursor-pointer inline-block",
                          action.variant === "primary"
                            ? "bg-gradient-to-br from-rg-400 to-rg-600 text-white border-transparent shadow-luxury hover:shadow-luxury-lg hover:from-rg-300 hover:to-rg-500"
                            : action.variant === "secondary"
                              ? "bg-cream-100 text-mauve-700 border-cream-300 hover:bg-rg-50 hover:border-rg-300"
                              : "bg-transparent text-mauve-500 border-cream-200 hover:bg-cream-200 hover:text-mauve-700"
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-xl text-sm flex-shrink-0",
                            action.variant === "primary"
                              ? "bg-white/20 text-white"
                              : "bg-rg-100 text-rg-500"
                          )}
                        >
                          <action.Icon className="w-5 h-5" />
                        </span>
                        <span className="flex-1 text-left">{action.label}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                          →
                        </span>
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-cream-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-glow-pulse" />
                    <span className="text-xs font-body text-mauve-500">
                      AI Bot Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Phase 21: Revenue Impact + Branch Comparison */}
        <div className={cn("grid gap-6 mb-6", showBranchComparison ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <RevenueImpactChart branchId={effectiveBranchId} />
          </motion.div>
          {showBranchComparison && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <BranchComparisonChart />
            </motion.div>
          )}
        </div>

        {/* Phase 21: Smart Alerts */}
        <AlertsPanel
          alerts={buildSmartAlerts({
            usage_percentage: data?.usage_percentage,
            pending_handoffs: realtime.isLive ? realtime.pendingHandoffs : data?.pending_handoffs,
            hot_leads_count: realtime.isLive ? realtime.hotLeadsCount : data?.hot_leads_count,
            booking_conversion_rate: overview?.booking_conversion_rate,
          })}
        />

        {/* Recent Bookings + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="luxury-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-cream-200">
                <h3 className="font-display text-xl font-semibold text-mauve-800">
                  การจองล่าสุด
                </h3>
                <Link
                  href="/clinic/booking"
                  className="text-sm font-body text-rg-500 hover:text-rg-600 transition-colors"
                >
                  ดูทั้งหมด →
                </Link>
              </div>
              <div className="divide-y divide-cream-200">
                {recentBookings.length === 0 ? (
                  <EmptyState
                    icon={<CalendarIcon className="w-10 h-10 text-rg-500" />}
                    title="ยังไม่มีการจอง"
                    description="การจองใหม่จะแสดงที่นี่"
                  />
                ) : (
                  recentBookings.map((booking, i) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.06 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-cream-100/60 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rg-100 to-rg-200 flex items-center justify-center flex-shrink-0 text-rg-600 text-sm font-medium">
                        {(booking.customer || "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-mauve-700 truncate">
                          {booking.customer}
                        </p>
                        <p className="font-body text-xs text-mauve-400 truncate">
                          {booking.service} · {booking.time}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-body text-xs text-mauve-500">
                          {booking.time}
                        </p>
                      </div>
                      <Badge
                        variant={
                          booking.status === "confirmed"
                            ? "success"
                            : booking.status === "pending"
                              ? "warning"
                              : booking.status === "cancelled"
                                ? "danger"
                                : "default"
                        }
                        dot
                        size="sm"
                      >
                        {booking.status === "confirmed"
                          ? "ยืนยัน"
                          : booking.status === "pending"
                            ? "รอ"
                            : booking.status}
                      </Badge>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="luxury-card p-6 h-full">
              <h3 className="font-display text-xl font-semibold text-mauve-800 mb-5">
                กิจกรรมล่าสุด
              </h3>
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <p className="text-sm font-body text-mauve-400 text-center py-8">
                    ยังไม่มีกิจกรรม
                  </p>
                ) : (
                  activities.map((activity, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.05 }}
                      className="flex items-start gap-3"
                    >
                      <div className="flex flex-col items-center flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-rg-400" />
                        {i < activities.length - 1 && (
                          <div className="w-px flex-1 bg-cream-300 mt-1 min-h-[20px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <p className="font-body text-sm text-mauve-700 leading-snug">
                          {activity.description}
                        </p>
                        <p className="font-body text-xs text-mauve-400 mt-0.5">
                          {activity.time}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bookings by date (existing section — restyled) */}
        <section
          className="animate-fade-in-up"
          style={{
            animationDuration: "320ms",
            animationFillMode: "forwards",
          }}
          aria-label="การจองถึงวันที่"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-mauve-400 mb-3">
            การจองถึงวันที่
          </p>
          <div className="grid lg:grid-cols-3 gap-6">
            {(isLoading
              ? [
                  {
                    date: "today",
                    dateLabel: "วันนี้",
                    total: 0,
                    items: [] as typeof bookingsByDate[0]["items"],
                  },
                  {
                    date: "tomorrow",
                    dateLabel: "พรุ่งนี้",
                    total: 0,
                    items: [] as typeof bookingsByDate[0]["items"],
                  },
                  {
                    date: "day-after",
                    dateLabel: "มะรืน",
                    total: 0,
                    items: [] as typeof bookingsByDate[0]["items"],
                  },
                ]
              : bookingsByDate
            ).map((dayGroup) => (
              <div
                key={dayGroup.date}
                className="luxury-card overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
                  <h3 className="text-sm font-medium text-mauve-800">
                    {dayGroup.dateLabel}
                  </h3>
                  <span className="text-xs font-semibold text-mauve-600 tabular-nums">
                    {dayGroup.total} คน
                  </span>
                </div>
                <ul className="flex-1 min-h-[100px] divide-y divide-cream-200">
                  {dayGroup.items.length === 0 && !isLoading ? (
                    <li className="px-5 py-6 text-xs font-body text-mauve-400">
                      ยังไม่มีรายการจอง
                    </li>
                  ) : (
                    dayGroup.items.map((item) => (
                      <li
                        key={item.id}
                        className="px-5 py-3 hover:bg-cream-100/60 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-mauve-800 truncate">
                              {item.customer}
                            </p>
                            <p className="text-xs text-mauve-400 mt-0.5">
                              {item.service} · {item.time}
                            </p>
                          </div>
                          <Badge
                            variant={
                              item.status === "confirmed"
                                ? "success"
                                : item.status === "pending"
                                  ? "warning"
                                  : "default"
                            }
                            className="flex-shrink-0 text-[10px]"
                          >
                            {item.status === "confirmed"
                              ? "ยืนยัน"
                              : item.status === "pending"
                                ? "รอ"
                                : item.status}
                          </Badge>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div className="px-5 py-3 border-t border-cream-200">
                  <Link
                    href="/clinic/booking"
                    className="inline-flex items-center gap-1 text-xs font-medium text-rg-500 hover:text-rg-600 transition-colors"
                  >
                    ดูปฏิทิน
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bar chart + Line + Pie — keep for export area */}
        <section
          className="animate-fade-in-up"
          style={{
            animationDuration: "320ms",
            animationFillMode: "forwards",
          }}
          aria-label="กราฟภาพรวม"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-mauve-400 mb-3">
            กราฟภาพรวม
          </p>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="luxury-card p-5 sm:p-6 overflow-hidden">
              <h3 className="text-sm font-medium text-mauve-800">
                แชท vs การจอง (รายวัน)
              </h3>
              <p className="text-xs text-mauve-400 mt-0.5">7 วันล่าสุด</p>
              <div className="mt-4 w-full min-h-[240px] h-60">
                {!hasActivityData ? (
                  <div
                    className="flex flex-col items-center justify-center h-60 text-mauve-400 bg-cream-200/50 rounded-2xl border border-dashed border-cream-300 font-body text-sm"
                    role="status"
                  >
                    ยังไม่มีข้อมูลกิจกรรม
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={activityByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      barGap={6}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={CHART.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fill: CHART.text,
                          fontFamily: "DM Sans",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: CHART.text,
                          fontFamily: "DM Sans",
                        }}
                      />
                      <Tooltip
                        contentStyle={LUXURY_TOOLTIP}
                        formatter={(v, n) => [
                          v ?? 0,
                          n === "chats" ? "แชท" : "การจอง",
                        ]}
                        labelFormatter={(l) => `วัน${l}`}
                      />
                      <Legend
                        formatter={(v) => (v === "chats" ? "แชท" : "การจอง")}
                        wrapperStyle={{ fontSize: 11 }}
                        iconType="circle"
                        iconSize={6}
                      />
                      <Bar
                        dataKey="chats"
                        name="chats"
                        fill={CHART.barPrimary}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Bar
                        dataKey="bookings"
                        name="bookings"
                        fill={CHART.barSecondary}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                        animationBegin={150}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="luxury-card p-5 sm:p-6 overflow-hidden">
              <h3 className="text-sm font-medium text-mauve-800">
                สัดส่วนกิจกรรม (จาก KPI)
              </h3>
              <p className="text-xs text-mauve-400 mt-0.5">
                แชท · ลูกค้าใหม่ · จอง · โปรโมชัน
              </p>
              <div className="mt-4 w-full min-h-[240px] h-60 flex items-center justify-center">
                {pieData.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center h-60 text-mauve-400 bg-cream-200/50 rounded-2xl border border-dashed border-cream-300 w-full font-body text-sm"
                    role="status"
                  >
                    ยังไม่มีข้อมูล
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive
                        animationDuration={600}
                        animationEasing="ease-out"
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={LUXURY_TOOLTIP}
                        formatter={(v) => [v, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* AI Status & Alerts — redesigned */}
        <section
          className="animate-fade-in-up"
          style={{
            animationDuration: "320ms",
            animationFillMode: "forwards",
          }}
          aria-label="AI Status และแจ้งเตือน"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-mauve-400 mb-3">
            AI Status & Alerts
          </p>
          <div className="space-y-3">
            {(data?.aiAlerts ?? []).length === 0 ? (
              <div className="rounded-2xl border border-cream-200 bg-white px-5 py-4 border-l-4 border-l-mauve-400">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 font-body text-sm font-medium text-mauve-600">
                    <span className="w-2 h-2 rounded-full bg-mauve-400" aria-hidden />
                    ไม่มีข้อมูลสถานะ
                  </span>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const alerts = data?.aiAlerts ?? [];
                  const hasWarning = alerts.some((a) => a.type === "warning");
                  const primaryAlert = hasWarning
                    ? alerts.find((a) => a.type === "warning") ?? alerts[0]
                    : alerts.find((a) => a.id === "status-ok") ?? alerts[0];
                  return (
                    <div
                      className={cn(
                        "rounded-2xl border bg-white px-5 py-4 border-l-4",
                        hasWarning
                          ? "border-cream-200 border-l-amber-500 bg-amber-50/30"
                          : "border-cream-200 border-l-emerald-500 bg-emerald-50/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span
                          className={cn(
                            "flex items-center gap-2 font-body text-sm font-semibold",
                            hasWarning ? "text-amber-800" : "text-emerald-800"
                          )}
                        >
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              hasWarning ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            aria-hidden
                          />
                          {primaryAlert?.message ?? (hasWarning ? "ต้องตรวจสอบ" : "ระบบ AI ปกติ")}
                        </span>
                        <span className="text-sm text-mauve-400 font-body tabular-nums shrink-0">
                          {primaryAlert?.time ?? ""}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const alerts = data?.aiAlerts ?? [];
                  const hasWarning = alerts.some((a) => a.type === "warning");
                  const primaryId = hasWarning
                    ? alerts.find((a) => a.type === "warning")?.id
                    : alerts.find((a) => a.id === "status-ok")?.id;
                  const restAlerts = alerts.filter((a) => a.id !== primaryId && a.id !== "status-ok");
                  return restAlerts.length > 0;
                })() && (
                  <div className="space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
                    {(data?.aiAlerts ?? [])
                      .filter((a) => {
                        const alerts = data?.aiAlerts ?? [];
                        const hasWarning = alerts.some((x) => x.type === "warning");
                        const primaryId = hasWarning
                          ? alerts.find((x) => x.type === "warning")?.id
                          : alerts.find((x) => x.id === "status-ok")?.id;
                        return a.id !== primaryId && a.id !== "status-ok";
                      })
                      .map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-xl px-4 py-3 border-l-4",
                            alert.type === "warning"
                              ? "border-l-amber-500 bg-amber-50/50"
                              : "border-l-rg-400 bg-rg-50/30"
                          )}
                        >
                          {alert.actionUrl ? (
                            <Link
                              href={alert.actionUrl}
                              className="flex flex-1 min-w-0 items-center justify-between gap-4 hover:opacity-90 transition-opacity"
                            >
                              <span
                                className={cn(
                                  "font-body text-sm font-medium truncate",
                                  alert.type === "warning" ? "text-amber-800" : "text-mauve-800"
                                )}
                              >
                                {alert.message}
                              </span>
                              <span className="text-sm text-mauve-400 tabular-nums shrink-0">
                                {alert.time}
                              </span>
                            </Link>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  "flex-1 font-body text-sm font-medium",
                                  alert.type === "warning" ? "text-amber-800" : "text-mauve-800"
                                )}
                              >
                                {alert.message}
                              </span>
                              <span className="text-sm text-mauve-400 tabular-nums shrink-0">
                                {alert.time}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* AI LINE */}
        <section
          className="animate-fade-in-up"
          style={{
            animationDuration: "320ms",
            animationFillMode: "forwards",
          }}
          aria-label="AI ส่งสรุปไป LINE"
        >
          <div className="luxury-card px-5 py-4">
            <p className="text-xs font-body text-mauve-500">
              AI ใช้ข้อมูล Dashboard วิเคราะห์และส่งสรุปไป LINE คลินิก ·
              ตั้งค่า{" "}
              <Link
                href="/clinic/settings"
                className="font-medium text-rg-500 hover:text-rg-600 underline underline-offset-2"
              >
                Settings → LINE Connection
              </Link>
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
