"use client";

import { useEffect, useState } from "react";

interface HealthChecks {
  status: "ok" | "degraded";
  checks: Record<string, { ok: boolean; message?: string }>;
}

interface LLMMetrics {
  byOrg: Record<string, { avgLatencyMs: number; p95LatencyMs: number; errorRate: number; totalRequests: number }>;
  global: { avgLatencyMs: number; p95LatencyMs: number; errorRate: number } | null;
}

interface LLMCost {
  dailyCost: number;
  limit: number;
  percent: number;
}

export default function AdminMonitoringPage() {
  const [health, setHealth] = useState<HealthChecks | null>(null);
  const [llmMetrics, setLlmMetrics] = useState<LLMMetrics | null>(null);
  const [llmCost, setLlmCost] = useState<LLMCost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [healthRes, metricsRes, costRes] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/admin/llm-metrics-advanced"),
          fetch("/api/admin/llm-cost"),
        ]);
        if (healthRes.ok) setHealth(await healthRes.json());
        if (metricsRes.ok) setLlmMetrics(await metricsRes.json());
        if (costRes.ok) {
          const c = await costRes.json();
          setLlmCost({
            dailyCost: c.dailyCost ?? 0,
            limit: c.limit ?? 500,
            percent: c.percent ?? 0,
          });
        }
      } catch {
        // ignore
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
    <div className="p-8 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-surface-900">Admin Monitoring</h1>

      {health?.checks?.ai?.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⛔ Global AI disabled — GLOBAL_AI_DISABLED is set
        </div>
      )}
      {health?.checks?.ai?.ok === true && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          AI ทำงานปกติ
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">Health Status</h2>
        {health ? (
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm font-medium text-surface-700 mb-2">
              Status: <span className={health.status === "ok" ? "text-green-600" : "text-amber-600"}>{health.status}</span>
            </p>
            <ul className="space-y-1 text-sm text-surface-600">
              {Object.entries(health.checks).map(([k, v]) => (
                <li key={k}>
                  {k}: {v.ok ? "✓" : "✗"} {v.message && `(${v.message})`}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-surface-500 text-sm">ไม่สามารถโหลดได้</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">LLM Usage & Cost</h2>
        {llmCost && (
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm">Daily Cost: ฿{llmCost.dailyCost.toFixed(2)} / ฿{llmCost.limit}</p>
            <div className="mt-2 h-2 rounded-full bg-surface-100 overflow-hidden">
              <div
                className={`h-full ${llmCost.percent >= 80 ? "bg-amber-500" : "bg-primary-500"}`}
                style={{ width: `${Math.min(llmCost.percent, 100)}%` }}
              />
            </div>
            {llmCost.percent >= 80 && (
              <p className="mt-2 text-sm text-amber-600">⚠️ ใกล้ถึงขีดจำกัด</p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">LLM Latency Metrics</h2>
        {llmMetrics?.global && (
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm">Avg: {llmMetrics.global.avgLatencyMs}ms | p95: {llmMetrics.global.p95LatencyMs}ms | Error rate: {(llmMetrics.global.errorRate * 100).toFixed(1)}%</p>
          </div>
        )}
        {!llmMetrics?.global && <p className="text-surface-500 text-sm">ยังไม่มีข้อมูล</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">Quick Links</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/clinic/admin-monitoring/ai-cost-monitor" className="text-primary-600 hover:underline">
              AI Cost Monitor — ต้นทุน AI ต่อคลินิก (7 วัน)
            </a>
          </li>
          <li>
            <a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              GET /api/health
            </a>
          </li>
          <li>
            <a href="/api/admin/llm-metrics-advanced" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              GET /api/admin/llm-metrics-advanced
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
