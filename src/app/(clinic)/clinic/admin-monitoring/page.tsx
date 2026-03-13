"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface HealthChecks {
  status: "ok" | "degraded";
  checks: Record<string, { ok: boolean; message?: string }>;
}

interface LLMMetrics {
  byOrg: Record<string, { avgLatencyMs: number; p95LatencyMs: number; errorRate: number; totalRequests: number }>;
  global: { avgLatencyMs: number; p95LatencyMs: number; errorRate: number } | null;
}

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed?: number;
}

interface ServiceStatus {
  name: string;
  ok: boolean;
  message?: string;
  lastChecked: string;
}

const REFRESH_INTERVAL_MS = 30_000;
const apiFetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

function StatusDot({ ok, checking }: { ok: boolean; checking?: boolean }) {
  const color = ok ? "bg-[var(--ent-success)]" : "bg-[var(--ent-danger)]";
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${color} ${checking ? "animate-pulse" : ""}`}
      title={ok ? "OK" : "Error"}
    />
  );
}

export default function AdminMonitoringPage() {
  const [retrainRecording, setRetrainRecording] = useState(false);
  const [retrainMessage, setRetrainMessage] = useState<string | null>(null);

  const { data: health, mutate: mutateHealth } = useSWR<HealthChecks>("/api/health", apiFetcher, {
    refreshInterval: REFRESH_INTERVAL_MS,
  });
  const { data: llmMetrics } = useSWR<LLMMetrics>("/api/admin/llm-metrics-advanced", apiFetcher, {
    refreshInterval: REFRESH_INTERVAL_MS,
  });
  const { data: llmCost } = useSWR(
    "/api/admin/llm-cost",
    (url) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    { refreshInterval: REFRESH_INTERVAL_MS }
  );
  const { data: queueData, mutate: mutateQueue } = useSWR<{ queues: QueueStatus[] }>(
    "/api/admin/queue-status",
    apiFetcher,
    { refreshInterval: REFRESH_INTERVAL_MS }
  );
  const { data: serviceData, mutate: mutateServices } = useSWR<{ services: ServiceStatus[] }>(
    "/api/admin/service-health",
    apiFetcher,
    { refreshInterval: REFRESH_INTERVAL_MS }
  );
  const { data: safetyData } = useSWR<{
    todayCount: number;
    byType: Record<string, number>;
    recentViolations: Array<{
      id: string;
      content: string;
      violationType: string;
      riskScore: number;
      actionTaken: string;
      originalText: string;
      createdAt: string;
    }>;
  }>("/api/admin/safety-audit", apiFetcher, { refreshInterval: REFRESH_INTERVAL_MS });

  const handleRefresh = useCallback(() => {
    void mutateHealth();
    void mutateQueue();
    void mutateServices();
  }, [mutateHealth, mutateQueue, mutateServices]);

  const cost = llmCost
    ? {
        dailyCost: llmCost.dailyCost ?? 0,
        limit: llmCost.limit ?? 500,
        percent: llmCost.percent ?? 0,
      }
    : null;

  const handleRecordRetrain = async () => {
    setRetrainMessage(null);
    setRetrainRecording(true);
    try {
      const res = await fetch("/api/admin/retrain-record", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setRetrainMessage(`✅ บันทึกแล้ว: ${json.last_retrain_date ?? "สำเร็จ"}`);
      } else {
        setRetrainMessage(`❌ ${json.error ?? "ล้มเหลว"}`);
      }
    } catch {
      setRetrainMessage("❌ เกิดข้อผิดพลาด");
    } finally {
      setRetrainRecording(false);
    }
  };

  const queues = queueData?.queues ?? [];
  const services = serviceData?.services ?? [];

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Admin Monitoring"
          subtitle="ตรวจสอบสุขภาพระบบ AI ค่าใช้จ่าย และ latency ระดับองค์กร"
        />
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          รีเฟรช
        </Button>
      </div>

      {health?.checks?.ai?.ok === false && (
        <div className="luxury-card p-4 border-[var(--ent-danger)] bg-[var(--ent-danger-soft)] font-body text-sm text-[var(--ent-danger)]">
          ⛔ Global AI disabled — GLOBAL_AI_DISABLED is set
        </div>
      )}
      {health?.checks?.ai?.ok === true && (
        <div className="luxury-card p-4 border-[var(--ent-success)] bg-[var(--ent-success-soft)] font-body text-sm text-[var(--ent-success)]">
          AI ทำงานปกติ
        </div>
      )}

      <section>
        <div className="luxury-card p-6">
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">Service Status</h2>
          {services.length > 0 ? (
            <ul className="space-y-2 font-body text-sm">
              {services.map((s) => (
                <li key={s.name} className="flex items-center gap-3">
                  <StatusDot ok={s.ok} />
                  <span className="text-mauve-700">{s.name}</span>
                  {s.message && <span className="text-mauve-500">— {s.message}</span>}
                  <span className="text-mauve-400 text-xs ml-auto">
                    {s.lastChecked ? new Date(s.lastChecked).toLocaleTimeString("th-TH") : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-mauve-500">กำลังโหลด...</p>
          )}
        </div>
      </section>

      <section>
        <div className="luxury-card p-6">
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">BullMQ Queue Depths</h2>
          {queues.length > 0 ? (
            <div className="space-y-4">
              {queues.map((q) => {
                const total = q.waiting + q.active + q.completed + q.failed + (q.delayed ?? 0) || 1;
                const waitingPct = Math.min(100, (q.waiting / total) * 100);
                const activePct = Math.min(100, (q.active / total) * 100);
                const failedPct = Math.min(100, (q.failed / total) * 100);
                const isUnhealthy = q.failed > 5 || q.waiting > 50;
                const isWarning = q.failed > 0 || q.waiting > 20;
                const barColor = isUnhealthy ? "bg-[var(--ent-danger)]" : isWarning ? "bg-[var(--ent-warning)]" : "bg-[var(--ent-success)]";
                return (
                  <div key={q.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-sm font-medium text-mauve-700">{q.name}</span>
                      <span className="font-body text-xs text-mauve-500">
                        w:{q.waiting} a:{q.active} c:{q.completed} f:{q.failed}
                        {q.delayed != null && q.delayed > 0 ? ` d:${q.delayed}` : ""}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-cream-200 overflow-hidden flex">
                      <div
                        className="h-full bg-mauve-300"
                        style={{ width: `${waitingPct}%` }}
                      />
                      <div
                        className={`h-full ${barColor}`}
                        style={{ width: `${activePct + failedPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-body text-sm text-mauve-500">
              {queueData === null ? "ไม่มี Redis / queue" : "กำลังโหลด..."}
            </p>
          )}
        </div>
      </section>

      {safetyData && (
        <section>
          <div className="luxury-card p-6">
            <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Safety & Compliance (Phase 15)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-4 rounded-2xl bg-cream-100 text-center">
                <p className="font-body text-[10px] text-mauve-500">Violations Today</p>
                <p className="font-display text-2xl font-semibold text-mauve-800">{safetyData.todayCount ?? 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-cream-100 text-center">
                <p className="font-body text-[10px] text-mauve-500">Rewritten</p>
                <p className="font-display text-2xl font-semibold text-amber-600">
                  {safetyData.byType?.rewritten ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-cream-100 text-center">
                <p className="font-body text-[10px] text-mauve-500">Escalated</p>
                <p className="font-display text-2xl font-semibold text-amber-600">
                  {safetyData.byType?.escalated ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-cream-100 text-center">
                <p className="font-body text-[10px] text-mauve-500">Blocked</p>
                <p className="font-display text-2xl font-semibold text-red-600">
                  {safetyData.byType?.blocked ?? 0}
                </p>
              </div>
            </div>
            <h3 className="font-body text-sm font-medium text-mauve-600 mb-2">Recent Violations (last 10)</h3>
            {safetyData.recentViolations?.length ? (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-cream-200">
                      <th className="text-left py-2 font-medium text-mauve-600">Action</th>
                      <th className="text-left py-2 font-medium text-mauve-600">Type</th>
                      <th className="text-left py-2 font-medium text-mauve-600">Content</th>
                      <th className="text-left py-2 font-medium text-mauve-600">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safetyData.recentViolations.map((v) => (
                      <tr key={v.id} className="border-b border-cream-100">
                        <td className="py-2">
                          <Badge variant="warning" size="sm">
                            {v.actionTaken}
                          </Badge>
                        </td>
                        <td className="py-2 text-mauve-600">{v.violationType}</td>
                        <td className="py-2 text-mauve-700 truncate max-w-[200px]" title={v.content}>
                          {v.content || v.originalText || "—"}
                        </td>
                        <td className="py-2 text-mauve-500 text-xs">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString("th-TH") : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="font-body text-sm text-mauve-500">ไม่มี violations ล่าสุด</p>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="luxury-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-mauve-800">Health Status</h2>
            {health && (
              <Badge variant={health.status === "ok" ? "success" : "warning"} size="sm" dot>
                {health.status}
              </Badge>
            )}
          </div>
          {health ? (
            <ul className="space-y-1 font-body text-sm text-mauve-600">
              {Object.entries(health.checks).map(([k, v]) => (
                <li key={k}>
                  {k}: {v.ok ? "✓" : "✗"} {v.message && `(${v.message})`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-mauve-500">ไม่สามารถโหลดได้</p>
          )}
        </div>
      </section>

      <section>
        <div className="luxury-card p-6">
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">LLM Usage & Cost</h2>
          {cost ? (
            <div className="space-y-2">
              <p className="font-body text-sm text-mauve-700">
                Daily Cost: ฿{cost.dailyCost.toFixed(2)} / ฿{cost.limit}
              </p>
              <div className="mt-1 h-2 rounded-full bg-cream-200 overflow-hidden">
                <div
                  className={`h-full ${
                    cost.percent >= 80 ? "bg-amber-500" : "bg-rg-500"
                  }`}
                  style={{ width: `${Math.min(cost.percent, 100)}%` }}
                />
              </div>
              {cost.percent >= 80 && (
                <p className="font-body text-xs text-amber-600">⚠️ ใกล้ถึงขีดจำกัด</p>
              )}
            </div>
          ) : (
            <p className="font-body text-sm text-mauve-500">ยังไม่มีข้อมูลค่าใช้จ่าย</p>
          )}
        </div>
      </section>

      <section>
        <div className="luxury-card p-6">
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">LLM Latency Metrics</h2>
          {llmMetrics?.global ? (
            <p className="font-body text-sm text-mauve-700">
              Avg: {llmMetrics.global.avgLatencyMs}ms | p95: {llmMetrics.global.p95LatencyMs}ms |{" "}
              Error rate: {(llmMetrics.global.errorRate * 100).toFixed(1)}%
            </p>
          ) : (
            <p className="font-body text-sm text-mauve-500">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </section>

      <section>
        <div className="luxury-card p-6">
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">Retrain Monitor (Phase 6)</h2>
          <p className="font-body text-sm text-mauve-600 mb-3">
            หลัง retrain โมเดลเสร็จ — กดปุ่มด้านล่างเพื่อบันทึก last_retrain_date (สำหรับ Retrain Monitor cron)
          </p>
          <Button
            variant="primary"
            size="sm"
            loading={retrainRecording}
            disabled={retrainRecording}
            onClick={handleRecordRetrain}
          >
            บันทึก Retrain แล้ว
          </Button>
          {retrainMessage && (
            <p className="mt-2 font-body text-sm text-mauve-600">{retrainMessage}</p>
          )}
        </div>
      </section>

      <section>
        <div className="luxury-card p-6">
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">Quick Links</h2>
          <ul className="space-y-2 font-body text-sm">
            <li>
              <a
                href="/clinic/admin-monitoring/ai-cost-monitor"
                className="text-rg-600 hover:underline"
              >
                AI Cost Monitor — ต้นทุน AI ต่อคลินิก (7 วัน)
              </a>
            </li>
            <li>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rg-600 hover:underline"
              >
                GET /api/health
              </a>
            </li>
            <li>
              <a
                href="/api/admin/llm-metrics-advanced"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rg-600 hover:underline"
              >
                GET /api/admin/llm-metrics-advanced
              </a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
