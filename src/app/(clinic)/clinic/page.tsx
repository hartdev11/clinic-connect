"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useClinicContext } from "@/contexts/ClinicContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RequireRole } from "@/components/rbac/RequireRole";
import { apiFetcher } from "@/lib/api-fetcher";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import { KpiPanelSkeleton, ChartSkeleton, PieSkeleton } from "@/components/dashboard/DashboardSkeleton";

/* สีกราฟตามคู่มือ: ฟ้าอ่อน, เขียวมิ้นต์, ส้มพีช, เหลืองอ่อน, เทาอ่อน */
const CHART = {
  primary: "#a1c6ea",       /* Light Blue — เส้นหลัก (Line/Area) */
  secondary: "#a3d9c7",     /* Mint Green — เส้นรอง */
  barPrimary: "#ffb6a2",    /* Peach Orange — แท่งเน้น */
  barSecondary: "#f9d342",  /* Soft Yellow — แท่งรอง */
  grid: "#d1d1d1",          /* Light Gray — กริด / ไม่เน้น */
  text: "#534e4a",
};
const PIE_COLORS = ["#a1c6ea", "#a3d9c7", "#ffb6a2", "#f9d342", "#d1d1d1"];

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
};

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  padding: "8px 12px",
};

export default function ClinicDashboardPage() {
  const { branch_id } = useClinicContext();
  const dashboardKey = branch_id
    ? `/api/clinic/dashboard?branchId=${branch_id}`
    : "/api/clinic/dashboard";
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardResponse>(
    dashboardKey,
    apiFetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000, keepPreviousData: true }
  );

  const handleRefresh = useCallback(() => mutate(), [mutate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.key === "r" || e.key === "R") && t.tagName !== "INPUT" && t.tagName !== "TEXTAREA" && !t.isContentEditable) {
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
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#faf9f7" });
      const imgData = canvas.toDataURL("image/png", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
  const revenueChange = ((d.revenueThisMonth - d.revenueLastMonth) / revenueLast) * 100;
  const bookingsByDate = data?.bookingsByDate ?? [];
  const chartData = data?.chartData ?? { revenueByDay: [], activityByDay: [] };
  const hasRevenueData = chartData.revenueByDay.some((r) => r.revenue > 0);
  const hasActivityData = chartData.activityByDay.some((a) => a.chats > 0 || a.bookings > 0);
  const revenueByDay =
    chartData.revenueByDay.length > 0 ? chartData.revenueByDay : [{ day: "-", revenue: 0 }];
  const activityByDay =
    chartData.activityByDay.length > 0 ? chartData.activityByDay : [{ day: "-", chats: 0, bookings: 0 }];

  const chatsWoW = data?.chatsWoW ?? { thisWeek: 0, lastWeek: 0 };
  const chatsWoWChange =
    chatsWoW.lastWeek > 0 ? ((chatsWoW.thisWeek - chatsWoW.lastWeek) / chatsWoW.lastWeek) * 100 : null;
  const bookingsWoW = data?.bookingsWoW ?? { thisWeek: 0, lastWeek: 0 };
  const bookingsWoWChange =
    bookingsWoW.lastWeek > 0 ? ((bookingsWoW.thisWeek - bookingsWoW.lastWeek) / bookingsWoW.lastWeek) * 100 : null;

  const pieData = useMemo(() => {
    const promo = data?.activePromotionsCount ?? 0;
    return [
      { name: "แชทวันนี้", value: d.chatsToday },
      { name: "ลูกค้าใหม่", value: d.newCustomers },
      { name: "จองวันนี้", value: d.bookingsToday },
      { name: "จองพรุ่งนี้", value: d.bookingsTomorrow },
      { name: "โปรโมชัน", value: promo },
    ].filter((x) => x.value > 0);
  }, [d.chatsToday, d.newCustomers, d.bookingsToday, d.bookingsTomorrow, data?.activePromotionsCount]);

  const statCells = [
    {
      label: "แชทวันนี้",
      value: d.chatsToday,
      display: "number",
      sub: chatsWoWChange != null ? `${chatsWoWChange >= 0 ? "+" : ""}${chatsWoWChange.toFixed(0)}% สัปดาห์` : undefined,
      positive: chatsWoWChange != null ? chatsWoWChange >= 0 : undefined,
      link: "/clinic/customers",
      linkLabel: "ดูทั้งหมด",
    },
    {
      label: "ลูกค้าใหม่",
      value: d.newCustomers,
      display: "number",
    },
    {
      label: "จองวันนี้ / พรุ่งนี้",
      valueToday: d.bookingsToday,
      valueTomorrow: d.bookingsTomorrow,
      display: "pair",
      sub: bookingsWoWChange != null ? `${bookingsWoWChange >= 0 ? "+" : ""}${bookingsWoWChange.toFixed(0)}% สัปดาห์` : undefined,
      positive: bookingsWoWChange != null ? bookingsWoWChange >= 0 : undefined,
      link: "/clinic/booking",
      linkLabel: "ดูปฏิทิน",
    },
    {
      label: "รายได้เดือนนี้",
      value: d.revenueThisMonth,
      display: "currency",
      sub: `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% เดือน`,
      positive: revenueChange >= 0,
    },
    {
      label: "โปรโมชันที่ใช้งาน",
      value: data?.activePromotionsCount ?? 0,
      display: "number",
      link: "/clinic/promotions",
      linkLabel: "ดูโปรโมชัน",
    },
  ];

  const fetchedAtMs = data?.fetchedAt ? new Date(data.fetchedAt).getTime() : 0;
  const isStale = fetchedAtMs > 0 && Date.now() - fetchedAtMs > 5 * 60 * 1000;
  const formattedFetchedAt = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  if (error) {
    return (
      <div className="space-y-6 p-8">
        <h1 className="text-xl font-semibold text-surface-900">Dashboard</h1>
        <Card padding="lg" className="border-red-200 bg-red-50/50">
          <p className="text-red-800 font-medium">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-100 text-red-800 font-medium hover:bg-red-200 transition-colors duration-250"
          >
            ลองใหม่
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50/80">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden mb-8">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-600 max-w-xl">
            ภาพรวมธุรกิจ · AI ใช้ข้อมูลนี้วิเคราะห์และส่งสรุปไป LINE คลินิก
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {formattedFetchedAt && !isLoading && (
            <span className={`text-xs tabular-nums ${isStale ? "text-amber-600 font-medium" : "text-surface-500"}`} aria-live="polite">
              {isStale ? "ข้อมูลอาจเก่า" : `อัปเดต ${formattedFetchedAt}`}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isValidating}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-surface-200 bg-white text-surface-600 hover:bg-surface-50 hover:border-surface-300 transition-all duration-250 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400 focus-visible:ring-offset-2"
            aria-label="โหลดข้อมูลใหม่"
          >
            <svg className={`w-4 h-4 ${isValidating ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isLoading}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-surface-200 bg-white text-surface-600 hover:bg-surface-50 hover:border-surface-300 transition-all duration-250 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400 focus-visible:ring-offset-2"
            aria-label="ส่งออก PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div id="dashboard-export-area" className="space-y-8">
        <h2 className="text-base font-semibold text-surface-800 pb-2 border-b border-surface-200">
          รายงาน — {new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}
        </h2>

        {/* KPI Panel — single panel */}
        <section
          className="animate-fade-in-up animate-delay-50"
          style={{ animationDuration: "320ms", animationFillMode: "forwards" }}
          aria-label="ภาพรวมธุรกิจ"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">ภาพรวมธุรกิจ</p>
          {isLoading ? (
            <KpiPanelSkeleton />
          ) : (
            <div className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-elevation-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-surface-100">
                {statCells.map((cell, i) => (
                  <div
                    key={i}
                    className="flex flex-col min-w-0 p-5 sm:p-6 hover:bg-surface-50/80 transition-colors duration-250"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-surface-500 truncate">{cell.label}</p>
                    <div className="mt-2 text-xl sm:text-2xl font-semibold text-surface-900 tabular-nums tracking-tight">
                      {cell.display === "number" && (
                        <AnimatedCounter value={cell.value as number} start={!isLoading} format={(n) => String(Math.round(n))} />
                      )}
                      {cell.display === "currency" && (
                        <AnimatedCounter
                          value={cell.value as number}
                          start={!isLoading}
                          format={(n) => `฿${Math.round(n).toLocaleString()}`}
                        />
                      )}
                      {cell.display === "pair" && (
                        <>
                          <AnimatedCounter value={(cell as { valueToday: number }).valueToday} start={!isLoading} />
                          {" / "}
                          <AnimatedCounter value={(cell as { valueTomorrow: number }).valueTomorrow} start={!isLoading} />
                        </>
                      )}
                    </div>
                    {cell.sub && (
                      <p className={`mt-1.5 text-[11px] font-medium ${cell.positive ? "text-emerald-600" : "text-rose-600"}`}>
                        {cell.positive ? "↑ " : "↓ "}
                        {cell.sub}
                      </p>
                    )}
                    {cell.link && (
                      <Link
                        href={cell.link!}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-surface-500 hover:text-surface-800 transition-colors duration-250"
                        aria-label={cell.linkLabel}
                      >
                        {cell.linkLabel}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Charts — Area, Bar, Line, Pie */}
        <section
          className="animate-fade-in-up animate-delay-100"
          style={{ animationDuration: "320ms", animationFillMode: "forwards" }}
          aria-label="กราฟภาพรวม"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">กราฟภาพรวม</p>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Area */}
            <div className="rounded-xl border border-surface-200 bg-white p-5 sm:p-6 shadow-elevation-1 card-hover-elevation overflow-hidden">
              <h3 className="text-sm font-medium text-surface-800">รายได้รายวัน (บาท)</h3>
              <p className="text-[11px] text-surface-500 mt-0.5">7 วันล่าสุด</p>
              <div className="mt-4 w-full min-h-[240px] h-60">
                {isLoading ? (
                  <ChartSkeleton />
                ) : !hasRevenueData ? (
                  <div className="flex flex-col items-center justify-center h-60 text-surface-500 bg-surface-50/50 rounded-lg border border-dashed border-surface-200" role="status">
                    <p className="text-sm">ยังไม่มีข้อมูลรายได้</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={revenueByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={CHART.primary} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART.text }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART.text }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`฿${Number(v ?? 0).toLocaleString()}`, "รายได้"]} labelFormatter={(l) => `วัน${l}`} />
                      <Area type="monotone" dataKey="revenue" stroke={CHART.primary} strokeWidth={2} fill="url(#revenueGrad)" isAnimationActive animationDuration={800} animationEasing="ease-out" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bar */}
            <div className="rounded-xl border border-surface-200 bg-white p-5 sm:p-6 shadow-elevation-1 card-hover-elevation overflow-hidden">
              <h3 className="text-sm font-medium text-surface-800">แชท vs การจอง (รายวัน)</h3>
              <p className="text-[11px] text-surface-500 mt-0.5">7 วันล่าสุด</p>
              <div className="mt-4 w-full min-h-[240px] h-60">
                {isLoading ? (
                  <ChartSkeleton />
                ) : !hasActivityData ? (
                  <div className="flex flex-col items-center justify-center h-60 text-surface-500 bg-surface-50/50 rounded-lg border border-dashed border-surface-200" role="status">
                    <p className="text-sm">ยังไม่มีข้อมูลกิจกรรม</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={activityByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={6} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART.text }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART.text }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v ?? 0, n === "chats" ? "แชท" : "การจอง"]} labelFormatter={(l) => `วัน${l}`} />
                      <Legend formatter={(v) => (v === "chats" ? "แชท" : "การจอง")} wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={6} />
                      <Bar dataKey="chats" name="chats" fill={CHART.barPrimary} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                      <Bar dataKey="bookings" name="bookings" fill={CHART.barSecondary} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" animationBegin={150} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Line */}
            <div className="rounded-xl border border-surface-200 bg-white p-5 sm:p-6 shadow-elevation-1 card-hover-elevation overflow-hidden">
              <h3 className="text-sm font-medium text-surface-800">แนวโน้มรายได้ (บาท)</h3>
              <p className="text-[11px] text-surface-500 mt-0.5">7 วันล่าสุด</p>
              <div className="mt-4 w-full min-h-[240px] h-60">
                {isLoading ? (
                  <ChartSkeleton />
                ) : !hasRevenueData ? (
                  <div className="flex flex-col items-center justify-center h-60 text-surface-500 bg-surface-50/50 rounded-lg border border-dashed border-surface-200" role="status">
                    <p className="text-sm">ยังไม่มีข้อมูล</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={revenueByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: CHART.text }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART.text }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`฿${Number(v ?? 0).toLocaleString()}`, "รายได้"]} labelFormatter={(l) => `วัน${l}`} />
                      <Line type="monotone" dataKey="revenue" stroke={CHART.primary} strokeWidth={2} dot={{ fill: CHART.primary, r: 3 }} activeDot={{ r: 4 }} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Donut/Pie from stats */}
            <div className="rounded-xl border border-surface-200 bg-white p-5 sm:p-6 shadow-elevation-1 card-hover-elevation overflow-hidden">
              <h3 className="text-sm font-medium text-surface-800">สัดส่วนกิจกรรม (จาก KPI)</h3>
              <p className="text-[11px] text-surface-500 mt-0.5">แชท · ลูกค้าใหม่ · จอง · โปรโมชัน</p>
              <div className="mt-4 w-full min-h-[240px] h-60 flex items-center justify-center">
                {isLoading ? (
                  <PieSkeleton />
                ) : pieData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-surface-500 bg-surface-50/50 rounded-lg border border-dashed border-surface-200 w-full" role="status">
                    <p className="text-sm">ยังไม่มีข้อมูล</p>
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
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Bookings by date */}
        <section
          className="animate-fade-in-up animate-delay-150"
          style={{ animationDuration: "320ms", animationFillMode: "forwards" }}
          aria-label="การจองถึงวันที่"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">การจองถึงวันที่</p>
          <div className="grid lg:grid-cols-3 gap-6">
            {(isLoading ? [{ date: "today", dateLabel: "วันนี้", total: 0, items: [] }, { date: "tomorrow", dateLabel: "พรุ่งนี้", total: 0, items: [] }, { date: "day-after", dateLabel: "มะรืน", total: 0, items: [] }] : bookingsByDate).map((dayGroup) => (
              <div key={dayGroup.date} className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-elevation-1 card-hover-elevation flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                  <h3 className="text-sm font-medium text-surface-800">{dayGroup.dateLabel}</h3>
                  <span className="text-xs font-semibold text-surface-700 tabular-nums">{dayGroup.total} คน</span>
                </div>
                <ul className="flex-1 min-h-[100px] divide-y divide-surface-100">
                  {dayGroup.items.length === 0 && !isLoading ? (
                    <li className="px-5 py-6 text-[11px] text-surface-500">ยังไม่มีรายการจอง</li>
                  ) : (
                    dayGroup.items.map((item) => (
                      <li key={item.id} className="px-5 py-3 hover:bg-surface-50/80 transition-colors duration-250">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-surface-800 truncate">{item.customer}</p>
                            <p className="text-[11px] text-surface-500 mt-0.5">{item.service} · {item.time}</p>
                          </div>
                          <Badge variant={item.status === "confirmed" ? "success" : item.status === "pending" ? "warning" : "default"} className="flex-shrink-0 text-[10px]">
                            {item.status === "confirmed" ? "ยืนยัน" : item.status === "pending" ? "รอ" : item.status}
                          </Badge>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div className="px-5 py-3 border-t border-surface-100">
                  <Link href="/clinic/booking" className="inline-flex items-center gap-1 text-[11px] font-medium text-surface-600 hover:text-surface-800 transition-colors duration-250">
                    ดูปฏิทิน
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alerts */}
        <section
          className="animate-fade-in-up animate-delay-200"
          style={{ animationDuration: "320ms", animationFillMode: "forwards" }}
          aria-label="AI Status และแจ้งเตือน"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">AI Status & Alerts</p>
          <div className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-elevation-1">
            <div className="divide-y divide-surface-100">
              {isLoading ? (
                <div className="px-5 py-4 text-[11px] text-surface-500 animate-pulse">กำลังโหลด...</div>
              ) : (data?.aiAlerts ?? []).length === 0 ? (
                <div className="px-5 py-4 text-[11px] text-surface-500">ไม่มีแจ้งเตือน</div>
              ) : (
                (data?.aiAlerts ?? []).map((alert) => {
                  const border = alert.type === "warning" ? "border-l-4 border-l-amber-500 bg-amber-50/40" : "border-l-4 border-l-slate-400 bg-slate-50/40";
                  const content = (
                    <>
                      <span className={alert.type === "warning" ? "text-amber-900 font-medium text-sm" : "text-slate-800 font-medium text-sm"}>{alert.message}</span>
                      <span className="text-[11px] text-surface-500 flex-shrink-0">{alert.time}</span>
                    </>
                  );
                  return alert.actionUrl ? (
                    <Link key={alert.id} href={alert.actionUrl} className={`flex items-center justify-between gap-4 px-5 py-3 transition-opacity duration-250 hover:opacity-90 ${border}`}>
                      {content}
                    </Link>
                  ) : (
                    <div key={alert.id} className={`flex items-center justify-between gap-4 px-5 py-3 ${border}`}>{content}</div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* AI LINE */}
        <section
          className="animate-fade-in-up animate-delay-250"
          style={{ animationDuration: "320ms", animationFillMode: "forwards" }}
          aria-label="AI ส่งสรุปไป LINE"
        >
          <div className="rounded-xl border border-surface-200 bg-white px-5 py-4 shadow-elevation-1">
            <p className="text-[11px] text-surface-600">
              AI ใช้ข้อมูล Dashboard วิเคราะห์และส่งสรุปไป LINE คลินิก · ตั้งค่า{" "}
              <Link href="/clinic/settings" className="font-medium text-surface-700 hover:text-surface-900 underline underline-offset-2">
                Settings → LINE Connection
              </Link>
            </p>
          </div>
        </section>

        {/* Quick actions */}
        <section
          className="animate-fade-in-up animate-delay-300"
          style={{ animationDuration: "320ms", animationFillMode: "forwards" }}
          aria-label="หน้าหลักของระบบ"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">หน้าหลักของระบบ</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" role="navigation" aria-label="ลิงก์ไปหน้าหลักของระบบ">
            <Link href="/clinic/customers" className="rounded-xl border border-surface-200 bg-white p-5 shadow-elevation-1 card-hover-elevation focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400 focus-visible:ring-offset-2">
              <h3 className="text-sm font-medium text-surface-800">Customers & Chat</h3>
              <p className="mt-1 text-[11px] text-surface-500">จัดการแชทและลูกค้า · ประวัติแชท · AI</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-surface-600">เปิด</span>
            </Link>
            <Link href="/clinic/booking" className="rounded-xl border border-surface-200 bg-white p-5 shadow-elevation-1 card-hover-elevation focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400 focus-visible:ring-offset-2">
              <h3 className="text-sm font-medium text-surface-800">Booking</h3>
              <p className="mt-1 text-[11px] text-surface-500">ปฏิทินการจอง · นัด · บริการ · สถานะ</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-surface-600">เปิด</span>
            </Link>
            <RequireRole allowed={["owner", "manager"]}>
              <Link href="/clinic/finance" className="rounded-xl border border-surface-200 bg-white p-5 shadow-elevation-1 card-hover-elevation focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400 focus-visible:ring-offset-2">
                <h3 className="text-sm font-medium text-surface-800">Finance</h3>
                <p className="mt-1 text-[11px] text-surface-500">รายได้ · LLM cost — Owner/Manager</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-surface-600">เปิด</span>
              </Link>
            </RequireRole>
          </div>
        </section>
      </div>
    </div>
  );
}
