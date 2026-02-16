"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface DailyCost {
  date: string;
  totalCost: number;
  byWorkloadType?: Record<string, { tokens?: number; cost?: number }>;
}

interface OrgRow {
  orgId: string;
  orgName?: string;
  totalCost7d: number;
  dailyCosts: DailyCost[];
}

export default function AICostMonitorPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/ai-cost-monitor", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.orgs)) setOrgs(data.orgs);
        else setError(data.error ?? "โหลดไม่สำเร็จ");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-surface-500">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Cost Monitor"
        description="รายการคลินิกเรียงตามต้นทุน AI 7 วันล่าสุด แบ่งตาม workload (customer_chat, executive_brief, knowledge_assist)"
      />

      {error && (
        <Card padding="lg" className="border-red-200 bg-red-50">
          <p className="text-red-800">{error}</p>
        </Card>
      )}

      <Card padding="lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="py-3 px-2 font-semibold text-surface-800">คลินิก</th>
                <th className="py-3 px-2 font-semibold text-surface-800 text-right">ต้นทุน 7 วัน (บาท)</th>
                <th className="py-3 px-2 font-semibold text-surface-800">แบ่งตาม workload</th>
                <th className="py-3 px-2 font-semibold text-surface-800">7-day trend</th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-surface-500">
                    ยังไม่มีข้อมูลการใช้ AI
                  </td>
                </tr>
              ) : (
                orgs.map((row) => (
                  <tr key={row.orgId} className="border-b border-surface-100">
                    <td className="py-3 px-2">
                      <span className="font-medium text-surface-800">{row.orgName || row.orgId}</span>
                      <span className="ml-1 text-xs text-surface-400">{row.orgId.slice(0, 8)}</span>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums">
                      {row.totalCost7d.toFixed(2)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {row.dailyCosts[0]?.byWorkloadType &&
                          Object.entries(row.dailyCosts[0].byWorkloadType).map(([w, v]) => (
                            <Badge key={w} variant="info">
                              {w}: {(v?.cost ?? 0).toFixed(2)}
                            </Badge>
                          ))}
                        {(!row.dailyCosts[0]?.byWorkloadType || Object.keys(row.dailyCosts[0].byWorkloadType).length === 0) && (
                          <span className="text-surface-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-0.5">
                        {row.dailyCosts.map((d, i) => (
                          <span
                            key={d.date}
                            className="text-xs text-surface-500"
                            title={`${d.date}: ${d.totalCost.toFixed(2)} บาท`}
                          >
                            {d.totalCost > 0 ? "●" : "○"}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
