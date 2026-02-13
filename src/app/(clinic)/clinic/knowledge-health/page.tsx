"use client";

import { useEffect, useState } from "react";

interface KnowledgeHealthData {
  knowledge_health_score?: number | null;
  health_metric?: {
    knowledge_health_score: number;
    average_quality_score: number;
    drift_rate: number;
    hallucination_rate: number;
    approval_rejection_rate: number;
    duplicate_rate: number;
  };
  top_low_quality_clinics: Array<{ org_id: string; count: number }>;
  most_duplicated_services: Array<{ org_id: string; count: number }>;
  expiring_knowledge_alerts: Array<{
    org_id: string;
    id: string;
    base_service_id: string;
    updated_at: string;
  }>;
  policy_violation_summary: { recent_count: number };
  low_confidence_rate_pct: number;
  by_org: Record<
    string,
    {
      org_id: string;
      low_quality_count: number;
      duplicate_count: number;
      needs_review_count: number;
      expiring_count: number;
      high_failure_count: number;
    }
  > | null;
}

export default function KnowledgeHealthPage() {
  const [data, setData] = useState<KnowledgeHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/knowledge-health");
        if (res.ok) setData(await res.json());
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
    <div className="p-8 max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold text-surface-900">Knowledge Health Dashboard</h1>

      {data?.knowledge_health_score != null && (
        <section>
          <h2 className="text-lg font-semibold text-surface-800 mb-4">Knowledge Health Score</h2>
          <div className="rounded-lg border border-surface-200 bg-white p-6">
            <p className="text-4xl font-bold text-primary-600">{data.knowledge_health_score}/100</p>
            {data.health_metric && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-surface-600">
                <span>Quality avg: {data.health_metric.average_quality_score}</span>
                <span>Drift: {data.health_metric.drift_rate}%</span>
                <span>Hallucination: {data.health_metric.hallucination_rate}%</span>
                <span>Rejection: {data.health_metric.approval_rejection_rate}%</span>
                <span>Duplicate: {data.health_metric.duplicate_rate}%</span>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">Metrics Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm text-surface-500">Low Confidence Rate</p>
            <p className="text-xl font-semibold text-surface-900">
              {data?.low_confidence_rate_pct ?? 0}%
            </p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm text-surface-500">Recent Policy Violations</p>
            <p className="text-xl font-semibold text-surface-900">
              {data?.policy_violation_summary?.recent_count ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm text-surface-500">Expiring Alerts</p>
            <p className="text-xl font-semibold text-amber-600">
              {data?.expiring_knowledge_alerts?.length ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <p className="text-sm text-surface-500">Top Low-Quality Orgs</p>
            <p className="text-xl font-semibold text-surface-900">
              {data?.top_low_quality_clinics?.length ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">Top Low-Quality Clinics</h2>
        {data?.top_low_quality_clinics?.length ? (
          <div className="rounded-lg border border-surface-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-surface-700">Org ID</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-surface-700">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.top_low_quality_clinics.map((r) => (
                  <tr key={r.org_id} className="border-t border-surface-100">
                    <td className="px-4 py-2 text-sm text-surface-800 font-mono">{r.org_id}</td>
                    <td className="px-4 py-2 text-sm text-right text-red-600">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-surface-500">ไม่มีข้อมูล</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">Most Duplicated Services</h2>
        {data?.most_duplicated_services?.length ? (
          <div className="rounded-lg border border-surface-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-surface-700">Org ID</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-surface-700">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.most_duplicated_services.map((r) => (
                  <tr key={r.org_id} className="border-t border-surface-100">
                    <td className="px-4 py-2 text-sm text-surface-800 font-mono">{r.org_id}</td>
                    <td className="px-4 py-2 text-sm text-right text-amber-600">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-surface-500">ไม่มีข้อมูล</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-surface-800 mb-4">Expiring Knowledge Alerts</h2>
        {data?.expiring_knowledge_alerts?.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
            <table className="min-w-full divide-y divide-amber-200">
              <thead className="bg-amber-100">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-surface-700">Org</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-surface-700">Service ID</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-surface-700">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring_knowledge_alerts.map((a) => (
                  <tr key={a.id} className="border-t border-amber-100">
                    <td className="px-4 py-2 text-sm font-mono">{a.org_id}</td>
                    <td className="px-4 py-2 text-sm">{a.base_service_id}</td>
                    <td className="px-4 py-2 text-sm text-surface-600">
                      {new Date(a.updated_at).toLocaleDateString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-surface-500">ไม่มีข้อมูลหมดอายุ</p>
        )}
      </section>

      {data?.by_org && typeof data.by_org === "object" && (
        <section>
          <h2 className="text-lg font-semibold text-surface-800 mb-4">Your Clinic Summary</h2>
          <div className="rounded-lg border border-surface-200 bg-white p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-surface-500">Low Quality</p>
                <p className="font-semibold text-red-600">
                  {Object.values(data.by_org)[0]?.low_quality_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Duplicates</p>
                <p className="font-semibold text-amber-600">
                  {Object.values(data.by_org)[0]?.duplicate_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Needs Review</p>
                <p className="font-semibold text-blue-600">
                  {Object.values(data.by_org)[0]?.needs_review_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Expiring Soon</p>
                <p className="font-semibold text-amber-600">
                  {Object.values(data.by_org)[0]?.expiring_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-surface-500">High Failure</p>
                <p className="font-semibold text-red-600">
                  {Object.values(data.by_org)[0]?.high_failure_count ?? 0}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
