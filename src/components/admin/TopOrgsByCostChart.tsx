"use client";

import useSWR from "swr";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface OrgCostRow {
  orgId: string;
  orgName: string;
  totalCost7d: number;
  dailyCosts: Array<{ date: string; totalCost: number }>;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

export function TopOrgsByCostChart() {
  const { data, isLoading } = useSWR<{ rows: OrgCostRow[] }>(
    "/api/admin/top-orgs-cost",
    fetcher,
    { refreshInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="luxury-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-cream-200 rounded mb-4" />
        <div className="h-64 bg-cream-200 rounded-xl" />
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const chartData = rows.slice(0, 20).map((r) => ({
    name: (r.orgName ?? r.orgId).slice(0, 20),
    cost: r.totalCost7d,
    orgId: r.orgId,
  }));

  if (chartData.length === 0) {
    return (
      <div className="luxury-card p-6">
        <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">Top 20 Orgs by AI Cost (7d)</h3>
        <p className="font-body text-sm text-mauve-500">ยังไม่มีข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="luxury-card p-6">
      <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">Top 20 Orgs by AI Cost (7d)</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cream-300)" horizontal={true} vertical={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${v.toFixed(0)}`} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) => [v != null ? `฿${Number(v).toFixed(2)}` : "—", "Cost"]}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload;
                return p ? `Org: ${p.orgId ?? ""}` : "";
              }}
            />
            <Bar dataKey="cost" fill="var(--color-rg-400)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
