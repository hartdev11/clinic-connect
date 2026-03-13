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

interface AggregateMetrics {
  cacheHitRate: number;
  tokensSavedByCache: number;
  costSavedThb: number;
  templateResponses: number;
  avgConfidence: number;
}

export default function AICostMonitorPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [aggregate, setAggregate] = useState<AggregateMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/ai-cost-monitor", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (Array.isArray(data.orgs)) setOrgs(data.orgs);
          if (data.aggregate) setAggregate(data.aggregate);
        } else setError(data.error ?? "โหลดไม่สำเร็จ");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 p-8">
        <PageHeader
          title="AI Cost Monitor"
          description="รายการคลินิกเรียงตามต้นทุน AI 7 วันล่าสุด"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="luxury-card p-4">
              <div className="h-4 w-20 bg-cream-200 rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-cream-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="luxury-card p-6">
          <div className="space-y-4">
            <div className="h-10 bg-cream-200 rounded animate-pulse w-48" />
            <div className="h-64 bg-cream-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Cost Monitor"
        description="รายการคลินิกเรียงตามต้นทุน AI 7 วันล่าสุด แบ่งตาม workload (customer_chat, executive_brief, knowledge_assist)"
      />

      {aggregate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="luxury-card p-4 border-l-4 border-rg-400">
            <p className="text-xs font-body text-mauve-500 uppercase tracking-wide">Cache Hit Rate</p>
            <p className="font-display text-2xl font-semibold text-mauve-800 mt-1">
              {(aggregate.cacheHitRate * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-mauve-500 mt-0.5">เป้าหมาย &gt; 60%</p>
          </div>
          <div className="luxury-card p-4 border-l-4 border-cream-400">
            <p className="text-xs font-body text-mauve-500 uppercase tracking-wide">Tokens Saved (เดือนนี้)</p>
            <p className="font-display text-2xl font-semibold text-mauve-800 mt-1">
              {aggregate.tokensSavedByCache.toLocaleString()}
            </p>
          </div>
          <div className="luxury-card p-4 border-l-4 border-rg-300">
            <p className="text-xs font-body text-mauve-500 uppercase tracking-wide">ประหยัดต้นทุน ฿ (เดือนนี้)</p>
            <p className="font-display text-2xl font-semibold text-rg-600 mt-1">
              ฿{aggregate.costSavedThb.toFixed(2)}
            </p>
          </div>
          <div className="luxury-card p-4 border-l-4 border-cream-500">
            <p className="text-xs font-body text-mauve-500 uppercase tracking-wide">Template Responses (ฟรี)</p>
            <p className="font-display text-2xl font-semibold text-mauve-800 mt-1">
              {aggregate.templateResponses}
            </p>
          </div>
          <div className="luxury-card p-4 border-l-4 border-rg-300">
            <p className="text-xs font-body text-mauve-500 uppercase tracking-wide">Avg AI Confidence</p>
            <p className="font-display text-2xl font-semibold text-mauve-800 mt-1">
              {(aggregate.avgConfidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {error && (
        <Card padding="lg" className="border-red-200 bg-red-50">
          <p className="text-red-800">{error}</p>
        </Card>
      )}

      <div className="luxury-card overflow-hidden p-6">
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
      </div>
    </div>
  );
}
