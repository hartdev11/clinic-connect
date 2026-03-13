"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiFetcher } from "@/lib/api-fetcher";
import { ChartSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { cn } from "@/lib/utils";

const COLORS = [
  "var(--color-rg-400)",
  "var(--ent-accent)",
  "var(--color-rg-600)",
  "var(--color-mauve-400)",
];

interface BranchComparisonChartProps {
  className?: string;
}

export function BranchComparisonChart({ className }: BranchComparisonChartProps) {
  const { data, error, isLoading } = useSWR<{
    data: Array<{ branch_name: string; conversations: number; hot_leads: number; bookings: number }>;
  }>("/api/clinic/analytics/branch-comparison", apiFetcher, { revalidateOnFocus: true });

  const chartData = useMemo(() => data?.data ?? [], [data?.data]);

  if (error) {
    return (
      <div className={cn("luxury-card p-6 min-h-[280px] flex items-center justify-center", className)}>
        <p className="text-sm text-mauve-500">โหลดกราฟไม่ได้</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("luxury-card p-6 min-h-[280px]", className)}>
        <h3 className="text-sm font-medium text-mauve-600 mb-4">เปรียบเทียบสาขา</h3>
        <ChartSkeleton />
      </div>
    );
  }

  const hasData = chartData.some((d) => d.conversations > 0 || d.hot_leads > 0 || d.bookings > 0);

  return (
    <div className={cn("luxury-card p-6", className)}>
      <h3 className="text-sm font-medium text-mauve-600 mb-4">เปรียบเทียบสาขา (30 วัน)</h3>
      {!hasData ? (
        <div className="min-h-[240px] flex items-center justify-center text-mauve-400 text-sm">ยังไม่มีข้อมูล</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 48)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" horizontal={true} vertical={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--mauve-500)" }} />
            <YAxis
              type="category"
              dataKey="branch_name"
              width={100}
              tick={{ fontSize: 11, fill: "var(--mauve-600)" }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(250, 247, 244, 0.98)",
                border: "1px solid rgba(201, 149, 108, 0.2)",
                borderRadius: "1rem",
              }}
            />
            <Legend />
            <Bar dataKey="conversations" fill={COLORS[0]} name="แชท" radius={[0, 4, 4, 0]} />
            <Bar dataKey="hot_leads" fill={COLORS[1]} name="Hot Leads" radius={[0, 4, 4, 0]} />
            <Bar dataKey="bookings" fill={COLORS[2]} name="การจอง" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
