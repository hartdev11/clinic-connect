"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

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
  handoffTotal: number;
  handoffMedical: number;
  handoffBookingIntent: number;
  handoffComplaint: number;
  handoffLowAiConfidence: number;
}

interface OrgPipelineMetrics {
  handoffTotal: number;
  handoffMedical: number;
  handoffBookingIntent: number;
  handoffComplaint: number;
  handoffLowAiConfidence: number;
}

export default function AICostMonitorPage() {
  type SortBy = "cost" | "handoff_total" | "handoff_medical" | "handoff_booking" | "handoff_complaint" | "handoff_low_conf";
  const COMPLAINT_ALERT_RATIO = 0.3;
  const MIN_HANDOFF_FOR_ALERT = 5;

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [aggregate, setAggregate] = useState<AggregateMetrics | null>(null);
  const [pipelineMetrics, setPipelineMetrics] = useState<Record<string, OrgPipelineMetrics>>({});
  const [sortBy, setSortBy] = useState<SortBy>("cost");
  const [onlyWithHandoff, setOnlyWithHandoff] = useState(false);
  const [onlyComplaintRisk, setOnlyComplaintRisk] = useState(false);
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
          if (data.pipelineMetrics && typeof data.pipelineMetrics === "object") {
            setPipelineMetrics(data.pipelineMetrics as Record<string, OrgPipelineMetrics>);
          }
        } else setError(data.error ?? "โหลดไม่สำเร็จ");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleRows = orgs
    .filter((row) => {
      if (!onlyWithHandoff) return true;
      const m = pipelineMetrics[row.orgId];
      return (m?.handoffTotal ?? 0) > 0;
    })
    .filter((row) => {
      if (!onlyComplaintRisk) return true;
      const m = pipelineMetrics[row.orgId];
      const total = m?.handoffTotal ?? 0;
      const complaint = m?.handoffComplaint ?? 0;
      const complaintRatio = total > 0 ? complaint / total : 0;
      return total >= MIN_HANDOFF_FOR_ALERT && complaintRatio > COMPLAINT_ALERT_RATIO;
    })
    .sort((a, b) => {
      const am = pipelineMetrics[a.orgId];
      const bm = pipelineMetrics[b.orgId];
      const by = (m: OrgPipelineMetrics | undefined, key: SortBy) => {
        if (!m) return 0;
        if (key === "handoff_total") return m.handoffTotal ?? 0;
        if (key === "handoff_medical") return m.handoffMedical ?? 0;
        if (key === "handoff_booking") return m.handoffBookingIntent ?? 0;
        if (key === "handoff_complaint") return m.handoffComplaint ?? 0;
        if (key === "handoff_low_conf") return m.handoffLowAiConfidence ?? 0;
        return 0;
      };
      if (sortBy === "cost") return b.totalCost7d - a.totalCost7d;
      return by(bm, sortBy) - by(am, sortBy);
    });

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
        <div className="space-y-4">
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

          <div className="luxury-card p-4 border-l-4 border-amber-400">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-body text-mauve-500 uppercase tracking-wide">Handoff Breakdown (เดือนนี้)</p>
              <p className="text-xs text-mauve-500">รวมทั้งหมด {aggregate.handoffTotal.toLocaleString()} ครั้ง</p>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                {
                  label: "Medical",
                  value: aggregate.handoffMedical,
                  variant: "warning" as const,
                },
                {
                  label: "Booking Intent",
                  value: aggregate.handoffBookingIntent,
                  variant: "info" as const,
                },
                {
                  label: "Complaint",
                  value: aggregate.handoffComplaint,
                  variant: "error" as const,
                },
                {
                  label: "Low AI Confidence",
                  value: aggregate.handoffLowAiConfidence,
                  variant: "outline" as const,
                },
              ].map((item) => {
                const ratio =
                  aggregate.handoffTotal > 0 ? Math.round((item.value / aggregate.handoffTotal) * 1000) / 10 : 0;
                return (
                  <div key={item.label} className="rounded-md border border-surface-200 p-3 bg-white/50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-surface-600">{item.label}</p>
                      <Badge variant={item.variant}>{ratio}%</Badge>
                    </div>
                    <p className="mt-1 text-xl font-display font-semibold text-surface-800 tabular-nums">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {error && (
        <Card padding="lg" className="border-red-200 bg-red-50">
          <p className="text-red-800">{error}</p>
        </Card>
      )}

      <div className="luxury-card overflow-hidden p-6">
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="sortBy" className="text-xs text-surface-600">
              เรียงตาม
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-md border border-surface-200 bg-white px-2 py-1 text-sm text-surface-700"
            >
              <option value="cost">ต้นทุน 7 วัน</option>
              <option value="handoff_total">handoff รวม</option>
              <option value="handoff_complaint">handoff complaint</option>
              <option value="handoff_booking">handoff booking intent</option>
              <option value="handoff_medical">handoff medical</option>
              <option value="handoff_low_conf">handoff low confidence</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-surface-700">
              <input
                type="checkbox"
                checked={onlyWithHandoff}
                onChange={(e) => setOnlyWithHandoff(e.target.checked)}
                className="h-4 w-4 rounded border-surface-300"
              />
              แสดงเฉพาะคลินิกที่มี handoff
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-surface-700">
              <input
                type="checkbox"
                checked={onlyComplaintRisk}
                onChange={(e) => setOnlyComplaintRisk(e.target.checked)}
                className="h-4 w-4 rounded border-surface-300"
              />
              แสดงเฉพาะ Complaint Risk
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="py-3 px-2 font-semibold text-surface-800">คลินิก</th>
                <th className="py-3 px-2 font-semibold text-surface-800 text-right">ต้นทุน 7 วัน (บาท)</th>
                <th className="py-3 px-2 font-semibold text-surface-800">แบ่งตาม workload</th>
                <th className="py-3 px-2 font-semibold text-surface-800">Handoff ต่อคลินิก</th>
                <th className="py-3 px-2 font-semibold text-surface-800">7-day trend</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-surface-500">
                    ยังไม่มีข้อมูลการใช้ AI
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const m = pipelineMetrics[row.orgId];
                  const total = m?.handoffTotal ?? 0;
                  const complaint = m?.handoffComplaint ?? 0;
                  const complaintRatio = total > 0 ? complaint / total : 0;
                  const isComplaintRisk =
                    total >= MIN_HANDOFF_FOR_ALERT && complaintRatio > COMPLAINT_ALERT_RATIO;
                  return (
                  <tr
                    key={row.orgId}
                    className={cn(
                      "border-b border-surface-100",
                      isComplaintRisk && "bg-red-50/60"
                    )}
                  >
                    <td className="py-3 px-2">
                      <span className="font-medium text-surface-800">{row.orgName || row.orgId}</span>
                      <span className="ml-1 text-xs text-surface-400">{row.orgId.slice(0, 8)}</span>
                      {isComplaintRisk && (
                        <Badge variant="error" className="ml-2">
                          Complaint Risk
                        </Badge>
                      )}
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
                      {(() => {
                        const m = pipelineMetrics[row.orgId];
                        if (!m) {
                          return <span className="text-surface-400">—</span>;
                        }
                        const total = m.handoffTotal ?? 0;
                        const percent = (value: number) =>
                          total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">รวม {total.toLocaleString()}</Badge>
                            <Badge variant="warning">M {m.handoffMedical} ({percent(m.handoffMedical)}%)</Badge>
                            <Badge variant="info">B {m.handoffBookingIntent} ({percent(m.handoffBookingIntent)}%)</Badge>
                            <Badge variant="error">C {m.handoffComplaint} ({percent(m.handoffComplaint)}%)</Badge>
                            <Badge variant="outline">L {m.handoffLowAiConfidence} ({percent(m.handoffLowAiConfidence)}%)</Badge>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-0.5">
                        {row.dailyCosts.map((d) => (
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
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
