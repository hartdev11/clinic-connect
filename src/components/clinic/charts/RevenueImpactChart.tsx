"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  ComposedChart,
  Bar,
  Line,
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

const BAR_FILL = "var(--color-rg-400)";
const LINE_STROKE = "var(--ent-accent)";

interface RevenueImpactChartProps {
  branchId: string | null;
  className?: string;
}

export function RevenueImpactChart({ branchId, className }: RevenueImpactChartProps) {
  const params = new URLSearchParams({ days: "30" });
  if (branchId) params.set("branchId", branchId);
  const url = `/api/clinic/analytics/revenue-impact?${params}`;
  const { data, error, isLoading } = useSWR<{ data: Array<{ date: string; bookings: number; revenue: number }> }>(
    url,
    apiFetcher,
    { revalidateOnFocus: true }
  );

  const chartData = useMemo(() => {
    const raw = data?.data ?? [];
    return raw.map((d) => ({
      ...d,
      dateShort: d.date.slice(5),
      revenueFmt: new Intl.NumberFormat("th-TH", { style: "decimal", maximumFractionDigits: 0 }).format(d.revenue),
    }));
  }, [data?.data]);

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
        <h3 className="text-sm font-medium text-mauve-600 mb-4">Revenue Impact (30 วัน)</h3>
        <ChartSkeleton />
      </div>
    );
  }

  const hasData = chartData.some((d) => d.bookings > 0 || d.revenue > 0);

  return (
    <div className={cn("luxury-card p-6", className)}>
      <h3 className="text-sm font-medium text-mauve-600 mb-4">Revenue Impact (30 วัน)</h3>
      {!hasData ? (
        <div className="min-h-[240px] flex items-center justify-center text-mauve-400 text-sm">ยังไม่มีข้อมูล</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" vertical={false} />
            <XAxis
              dataKey="dateShort"
              tick={{ fontSize: 11, fill: "var(--mauve-500)" }}
              axisLine={{ stroke: "var(--cream-300)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "var(--mauve-500)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--mauve-500)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `฿${(v / 1000).toFixed(0)}k` : `฿${v}`)}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(250, 247, 244, 0.98)",
                border: "1px solid rgba(201, 149, 108, 0.2)",
                borderRadius: "1rem",
                boxShadow: "0 8px 32px rgba(201,149,108,0.15)",
              }}
              formatter={(value, name) => {
                const v = (value ?? 0) as number;
                const n = name ?? "";
                if (n === "revenue") return [`฿${v.toLocaleString("th-TH")}`, "รายได้"];
                return [v, "การจอง"];
              }}
              labelFormatter={(label) => `วันที่ ${label}`}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(val) => (val === "revenue" ? "รายได้ (฿)" : "การจอง")}
            />
            <Bar yAxisId="left" dataKey="bookings" fill={BAR_FILL} name="bookings" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke={LINE_STROKE}
              strokeWidth={2}
              dot={{ r: 2 }}
              name="revenue"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
