"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useClinicContext } from "@/contexts/ClinicContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";
import { apiFetcher } from "@/lib/api-fetcher";

const CHART_COLORS = {
  primary: "#e05c76",
  primaryLight: "#ec8295",
  primaryFill: "url(#revenueGradient)",
  accent: "#c97d47",
  accentLight: "#d99a6a",
  grid: "#e8e4e0",
  text: "#534e4a",
  textMuted: "#9c958d",
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
};

function StatCardSkeleton() {
  return (
    <Card padding="lg" className="relative animate-pulse">
      <div className="h-4 w-24 bg-surface-200 rounded mb-2" />
      <div className="h-6 w-16 bg-surface-200 rounded mt-3" />
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="w-full min-h-[256px] h-64 flex flex-col justify-center animate-pulse">
      <div className="h-4 w-32 bg-surface-200 rounded mb-4" />
      <div className="flex-1 flex items-end gap-2 px-4 pb-8">
        {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-surface-200 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ClinicDashboardPage() {
  const { branch_id } = useClinicContext();
  const dashboardKey = branch_id
    ? `/api/clinic/dashboard?branchId=${branch_id}`
    : "/api/clinic/dashboard";
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardResponse>(
    dashboardKey,
    apiFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    }
  );

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
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
        backgroundColor: "#faf9f7",
      });
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
  const chartData = data?.chartData ?? {
    revenueByDay: [],
    activityByDay: [],
  };
  const hasRevenueData = chartData.revenueByDay.some((r) => r.revenue > 0);
  const hasActivityData = chartData.activityByDay.some((a) => a.chats > 0 || a.bookings > 0);
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
      ? ((chatsWoW.thisWeek - chatsWoW.lastWeek) / chatsWoW.lastWeek) * 100
      : null;
  const bookingsWoW = data?.bookingsWoW ?? { thisWeek: 0, lastWeek: 0 };
  const bookingsWoWChange =
    bookingsWoW.lastWeek > 0
      ? ((bookingsWoW.thisWeek - bookingsWoW.lastWeek) / bookingsWoW.lastWeek) * 100
      : null;

  const statCards = [
    {
      label: "แชทวันนี้",
      value: d.chatsToday,
      link: "/clinic/customers",
      linkLabel: "ดูทั้งหมด",
      description: "จำนวนการสนทนากับลูกค้าวันนี้",
      aiAnalyze: true,
      sub:
        chatsWoWChange !== null
          ? `${chatsWoWChange >= 0 ? "+" : ""}${chatsWoWChange.toFixed(0)}% เทียบสัปดาห์ที่แล้ว`
          : undefined,
      positive: chatsWoWChange !== null ? chatsWoWChange >= 0 : undefined,
    },
    {
      label: "ลูกค้าใหม่",
      value: d.newCustomers,
      description: "ลูกค้าที่ลงทะเบียนใหม่วันนี้",
      aiAnalyze: true,
    },
    {
      label: "จองวันนี้ / พรุ่งนี้",
      value: `${d.bookingsToday} / ${d.bookingsTomorrow}`,
      link: "/clinic/booking",
      linkLabel: "ดูปฏิทิน",
      description: "จำนวนการจองคิววันนี้และพรุ่งนี้",
      aiAnalyze: true,
      sub:
        bookingsWoWChange !== null
          ? `${bookingsWoWChange >= 0 ? "+" : ""}${bookingsWoWChange.toFixed(0)}% เทียบสัปดาห์ที่แล้ว`
          : undefined,
      positive: bookingsWoWChange !== null ? bookingsWoWChange >= 0 : undefined,
    },
    {
      label: "รายได้เดือนนี้",
      value: `฿${d.revenueThisMonth.toLocaleString()}`,
      sub: `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% เทียบเดือนที่แล้ว`,
      positive: revenueChange >= 0,
      description: "รายได้รวมของคลินิกในเดือนปัจจุบัน",
      aiAnalyze: true,
    },
    {
      label: "โปรโมชันที่ใช้งาน",
      value: data?.activePromotionsCount ?? 0,
      link: "/clinic/promotions",
      linkLabel: "ดูโปรโมชัน",
      description: "โปรโมชันที่กำลังดำเนินอยู่",
      aiAnalyze: true,
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="ภาพรวมระบบหลังบ้าน" />
        <Card padding="lg" className="border-red-200 bg-red-50/50">
          <p className="text-red-800 font-medium">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-100 text-red-800 font-medium hover:bg-red-200 transition-colors"
          >
            ลองใหม่
          </button>
        </Card>
      </div>
    );
  }

  const fetchedAtMs = data?.fetchedAt ? new Date(data.fetchedAt).getTime() : 0;
  const STALE_MS = 5 * 60 * 1000;
  const isStale = fetchedAtMs > 0 && Date.now() - fetchedAtMs > STALE_MS;
  const formattedFetchedAt = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <PageHeader
          title="Dashboard"
          description="ภาพรวมระบบหลังบ้าน — สถานะธุรกิจ แชท การจอง โปรโมชัน และผลวิเคราะห์จาก AI (ส่งไป LINE คลินิกเท่านั้น ไม่ส่งหาลูกค้า)"
          aiAnalyze
        />
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {formattedFetchedAt && !isLoading && (
            <span
              className={`text-xs ${isStale ? "text-amber-600 font-medium" : "text-surface-500"}`}
              aria-live="polite"
            >
              {isStale
                ? "ข้อมูลอาจเก่า — กดโหลดใหม่"
                : `อัปเดตเมื่อ ${formattedFetchedAt}`}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="โหลดข้อมูลใหม่"
          >
            <svg
              className={`w-4 h-4 ${isValidating ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isValidating ? "กำลังโหลด..." : "โหลดใหม่"}
            <span className="hidden sm:inline text-surface-400 text-[10px] ml-0.5">(R)</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="ส่งออกเป็น PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ส่งออก PDF
          </button>
        </div>
      </div>

      <div id="dashboard-export-area" className="space-y-10">
        <div className="pb-2 border-b border-surface-200">
          <h2 className="text-lg font-bold text-surface-800">
            รายงาน Dashboard — {new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}
          </h2>
        </div>
      <section>
        <SectionHeader
          title="ภาพรวมธุรกิจ"
          description="ตัวเลขสรุปสำคัญ — AI ใช้ข้อมูลส่วนนี้วิเคราะห์และส่งสรุปไป LINE คลินิก"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map((card, i) => (
                <Card key={i} padding="lg" hover className="relative">
                  {card.aiAnalyze && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 text-[10px] font-medium border border-primary-100/80">
                      AI วิเคราะห์
                    </span>
                  )}
                  <p className="text-sm font-medium text-surface-600 pr-16">{card.label}</p>
                  {card.description && (
                    <p className="text-xs text-surface-400 mt-0.5">{card.description}</p>
                  )}
                  <p className="text-2xl font-bold text-surface-800 mt-3">{card.value}</p>
                  {card.sub && (
                    <p
                      className={`text-sm mt-2 font-medium ${
                        card.positive ? "text-primary-600" : "text-red-600"
                      }`}
                    >
                      {card.sub}
                    </p>
                  )}
                  {card.link && (
                    <Link
                      href={card.link}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline"
                    >
                      {card.linkLabel}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </Card>
              ))}
        </div>
      </section>

      {/* กราฟภาพรวม */}
      <section className="animate-fade-in-up" aria-label="กราฟภาพรวมรายได้และกิจกรรม">
        <SectionHeader
          title="กราฟภาพรวม"
          description="รายได้รายวัน 7 วันล่าสุด • แชทและการจองต่อวัน"
        />
        <div className="grid lg:grid-cols-2 gap-6">
          <Card padding="lg" className="overflow-hidden transition-all duration-500 hover:shadow-card-hover">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-surface-800">รายได้รายวัน (บาท)</h3>
              <p className="text-xs text-surface-500 mt-0.5">7 วันล่าสุด</p>
            </div>
            <div className="w-full min-h-[256px] h-64" style={{ minWidth: 200 }}>
              {isLoading ? (
                <ChartSkeleton />
              ) : !hasRevenueData ? (
                <div
                  className="flex flex-col items-center justify-center h-64 text-surface-500 bg-surface-50/50 rounded-lg border border-dashed border-surface-200"
                  role="status"
                  aria-label="ยังไม่มีข้อมูลรายได้"
                >
                  <p className="text-sm font-medium">ยังไม่มีข้อมูล 7 วันล่าสุด</p>
                  <p className="text-xs mt-1">รายได้จะแสดงเมื่อมีธุรกรรม</p>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={256} minHeight={256}>
                <AreaChart
                  data={revenueByDay}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: CHART_COLORS.textMuted }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: CHART_COLORS.textMuted }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e8e4e0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    }}
                    formatter={(value) => [`฿${Number(value ?? 0).toLocaleString()}`, "รายได้"]}
                    labelFormatter={(label) => `วัน${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2.5}
                    fill={CHART_COLORS.primaryFill}
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card padding="lg" className="overflow-hidden transition-all duration-500 hover:shadow-card-hover">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-surface-800">แชท vs การจอง (รายวัน)</h3>
              <p className="text-xs text-surface-500 mt-0.5">7 วันล่าสุด</p>
            </div>
            <div className="w-full min-h-[256px] h-64" style={{ minWidth: 200 }}>
              {isLoading ? (
                <ChartSkeleton />
              ) : !hasActivityData ? (
                <div
                  className="flex flex-col items-center justify-center h-64 text-surface-500 bg-surface-50/50 rounded-lg border border-dashed border-surface-200"
                  role="status"
                  aria-label="ยังไม่มีข้อมูลกิจกรรม"
                >
                  <p className="text-sm font-medium">ยังไม่มีข้อมูล 7 วันล่าสุด</p>
                  <p className="text-xs mt-1">แชทและการจองจะแสดงเมื่อมีกิจกรรม</p>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={256} minHeight={256}>
                <BarChart
                  data={activityByDay}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  barGap={6}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: CHART_COLORS.textMuted }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: CHART_COLORS.textMuted }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e8e4e0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    }}
                    formatter={(value, name) => [
                      value ?? 0,
                      name === "chats" ? "แชท" : "การจอง",
                    ]}
                    labelFormatter={(label) => `วัน${label}`}
                  />
                  <Legend
                    formatter={(value) => (value === "chats" ? "แชท" : "การจอง")}
                    wrapperStyle={{ fontSize: 12 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="chats"
                    name="chats"
                    fill={CHART_COLORS.primary}
                    radius={[6, 6, 0, 0]}
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="bookings"
                    name="bookings"
                    fill={CHART_COLORS.accent}
                    radius={[6, 6, 0, 0]}
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing="ease-out"
                    animationBegin={200}
                  />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* การจองถึงวันที่ */}
      <section>
        <SectionHeader
          title="การจองถึงวันที่"
          description="รายการจองแยกตามวัน — กี่คน ทำบริการอะไร เวลาไหน สถานะ"
        />
        <div className="grid lg:grid-cols-3 gap-6">
          {(isLoading ? [{ date: "today", dateLabel: "วันนี้", total: 0, items: [] }, { date: "tomorrow", dateLabel: "พรุ่งนี้", total: 0, items: [] }, { date: "day-after", dateLabel: "มะรืน", total: 0, items: [] }] : bookingsByDate).map((dayGroup) => (
            <Card key={dayGroup.date} padding="lg" className="flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-100">
                <h3 className="text-base font-semibold text-surface-800">{dayGroup.dateLabel}</h3>
                <span className="text-sm font-bold text-primary-600">{dayGroup.total} คน</span>
              </div>
              <ul className="space-y-3 flex-1 min-h-[120px]">
                {dayGroup.items.length === 0 && !isLoading ? (
                  <li className="text-sm text-surface-500 py-4">ยังไม่มีรายการจอง</li>
                ) : (
                  dayGroup.items.map((item) => (
                    <li
                      key={item.id}
                      className="p-3 rounded-xl border border-surface-100 hover:border-primary-100 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-surface-800 text-sm truncate">{item.customer}</p>
                          <p className="text-xs text-surface-600 mt-0.5">{item.service}</p>
                          <p className="text-xs text-surface-500 mt-1">{item.time}</p>
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
                          {item.status === "confirmed" ? "ยืนยัน" : item.status === "pending" ? "รอ" : item.status}
                        </Badge>
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/clinic/booking"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline"
              >
                ดูปฏิทิน
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="AI Status & Alerts"
          description="สถานะและแจ้งเตือนจากระบบ AI — ข้อมูลจริง"
        />
        <Card padding="lg">
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-sm text-surface-500 py-2">กำลังโหลด...</div>
            ) : (
              (data?.aiAlerts ?? []).map((alert) => {
                const className = `flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  alert.actionUrl ? "block " : ""
                }${
                  alert.type === "warning"
                    ? "bg-amber-50/80 border-amber-200/60"
                    : "bg-sky-50/80 border-sky-200/60"
                } ${alert.actionUrl ? "hover:opacity-90 cursor-pointer" : ""}`;
                const content = (
                  <>
                    <span
                      className={
                        alert.type === "warning"
                          ? "text-amber-800 font-medium text-sm"
                          : "text-sky-800 font-medium text-sm"
                      }
                    >
                      {alert.message}
                    </span>
                    <span className="text-xs text-surface-500 flex items-center gap-1">
                      {alert.time}
                      {alert.actionUrl && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </span>
                  </>
                );
                return alert.actionUrl ? (
                  <Link key={alert.id} href={alert.actionUrl} className={className}>
                    {content}
                  </Link>
                ) : (
                  <div key={alert.id} className={className}>
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="AI วิเคราะห์ → ส่ง LINE คลินิก"
          description="AI ตอบแชทลูกค้าทาง LINE อัตโนมัติ — ตั้งค่าได้ที่ Settings"
        />
        <Card padding="lg" className="bg-primary-50/30 border-primary-200/60">
          <p className="text-sm text-surface-700">
            เมื่อลูกค้าส่งข้อความมาที่ LINE Official Account ระบบ AI จะตอบอัตโนมัติภายในไม่กี่วินาที
            — ใช้ข้อมูลจาก Dashboard (แชท การจอง โปรโมชัน) เพื่อตอบให้ลูกค้าได้ตรงกับสถานะจริง
          </p>
          <p className="text-xs text-surface-500 mt-2">
            ตั้งค่า LINE Channel ได้ที่{" "}
            <Link href="/clinic/settings" className="font-medium text-primary-600 hover:underline">
              Settings → LINE Connection
            </Link>
          </p>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="หน้าหลักของระบบ"
          description="จัดการแชท จองคิว โปรโมชัน และตั้งค่า AI จากเมนูซ้ายหรือลิงก์ด้านล่าง"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" role="navigation" aria-label="ลิงก์ไปหน้าหลักของระบบ">
          <Link href="/clinic/customers" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg">
            <Card padding="lg" hover className="h-full">
              <h3 className="font-semibold text-surface-800">Customers & Chat</h3>
              <p className="text-sm text-surface-600 mt-1">
                จัดการแชทและลูกค้า — ประวัติแชท การตอบของ AI รับมือด้วยตนเอง
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                เปิด →
              </span>
            </Card>
          </Link>
          <Link href="/clinic/booking" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg">
            <Card padding="lg" hover className="h-full">
              <h3 className="font-semibold text-surface-800">Booking</h3>
              <p className="text-sm text-surface-600 mt-1">
                ปฏิทินการจอง — จัดการนัด ลูกค้า บริการ สถานะ
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                เปิด →
              </span>
            </Card>
          </Link>
          <Link href="/clinic/ai-agents" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg">
            <Card padding="lg" hover className="h-full">
              <h3 className="font-semibold text-surface-800">AI Agents</h3>
              <p className="text-sm text-surface-600 mt-1">
                ควบคุม 6 Agents — เปิด/ปิด แก้ Prompt ดู Activity Log
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                เปิด →
              </span>
            </Card>
          </Link>
          <RequireRole allowed={["owner", "manager"]}>
            <Link href="/clinic/finance" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg">
              <Card padding="lg" hover className="h-full">
                <h3 className="font-semibold text-surface-800">Finance</h3>
                <p className="text-sm text-surface-600 mt-1">
                  รายได้ รายงาน LLM cost — Owner/Manager เท่านั้น
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
                  เปิด →
                </span>
              </Card>
            </Link>
          </RequireRole>
        </div>
      </section>
      </div>
    </div>
  );
}
