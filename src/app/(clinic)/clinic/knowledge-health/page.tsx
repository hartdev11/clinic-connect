"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";

const CHART = {
  primary: "var(--color-rg-400)",
  grid: "var(--cream-300)",
  axis: "var(--cream-500)",
};

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
  knowledge_gaps?: Array<{ query: string; count: number; date: string }>;
  rag_quality?: {
    avg_relevance_score: number;
    low_score_warning: boolean;
  };
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

type TabId = "health" | "learning";
type LearningSubTab = "approved" | "pending" | "rejected";

interface LearningStats {
  itemsLearnedThisMonth: number;
  handoffsMarkedForLearning: number;
  averageConfidence: number;
  recentItems: Array<{
    id: string;
    learnedAt: string;
    questionPreview: string;
    handoffId: string;
    confidence: number;
    type: string;
  }>;
  totalLearned: number;
}

interface LearningMetrics {
  autoApprovedRatePct: number;
  avgQualityScore: number;
  faqCount: number;
  autoApprovedCount: number;
  queuedCount: number;
  rejectedCount: number;
}

interface LearningQueueItem {
  id: string;
  question: string;
  answer: string;
  qualityScore: number;
  evaluatedAt: string;
  handoffId: string;
  learnedId?: string | null;
  reason?: string;
  source?: string;
}

export default function KnowledgeHealthPage() {
  const [data, setData] = useState<KnowledgeHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("health");
  const [learningData, setLearningData] = useState<LearningStats | null>(null);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics | null>(null);
  const [learningQueue, setLearningQueue] = useState<Record<LearningSubTab, LearningQueueItem[]>>({
    approved: [],
    pending: [],
    rejected: [],
  });
  const [learningSubTab, setLearningSubTab] = useState<LearningSubTab>("approved");
  const [learningLoading, setLearningLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [reevaluatingId, setReevaluatingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<LearningQueueItem | null>(null);
  const [handoffRateData, setHandoffRateData] = useState<{
    weeks: Array<{ week: string; handoffs: number; conversations: number; handoffRate: number }>;
    currentHandoffRate: number;
    targetRate: number;
    improvement: number | null;
  } | null>(null);

  const fetchLearning = useCallback(async () => {
    setLearningLoading(true);
    try {
      const [statsRes, metricsRes] = await Promise.all([
        fetch("/api/clinic/learning-stats", { credentials: "include" }),
        fetch("/api/clinic/learning-metrics", { credentials: "include" }),
      ]);
      if (statsRes.ok) setLearningData(await statsRes.json());
      if (metricsRes.ok) setLearningMetrics(await metricsRes.json());
    } finally {
      setLearningLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async (tab: LearningSubTab) => {
    setQueueLoading(true);
    try {
      const res = await fetch(`/api/clinic/learning-queue?tab=${tab}`, { credentials: "include" });
      if (res.ok) {
        const { items } = await res.json();
        setLearningQueue((prev) => ({ ...prev, [tab]: items ?? [] }));
      }
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchAllQueues = useCallback(async () => {
    setQueueLoading(true);
    try {
      const tabs: LearningSubTab[] = ["approved", "pending", "rejected"];
      const results = await Promise.all(
        tabs.map((tab) =>
          fetch(`/api/clinic/learning-queue?tab=${tab}`, { credentials: "include" }).then((r) =>
            r.ok ? r.json() : { items: [] }
          )
        )
      );
      setLearningQueue({
        approved: results[0]?.items ?? [],
        pending: results[1]?.items ?? [],
        rejected: results[2]?.items ?? [],
      });
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchHandoffRate = useCallback(async () => {
    try {
      const res = await fetch("/api/clinic/learning-handoff-rate", { credentials: "include" });
      if (res.ok) setHandoffRateData(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeTab === "learning") fetchLearning();
  }, [activeTab, fetchLearning]);

  useEffect(() => {
    if (activeTab === "learning") fetchHandoffRate();
  }, [activeTab, fetchHandoffRate]);

  useEffect(() => {
    if (activeTab === "learning") fetchQueue(learningSubTab);
  }, [activeTab, learningSubTab, fetchQueue]);

  const handleDeleteLearned = useCallback(
    async (id: string) => {
      if (!confirm("ต้องการลบรายการนี้ออกจาก knowledge base จริงหรือไม่?")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/clinic/learned-knowledge/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          fetchLearning();
          fetchAllQueues();
        }
      } finally {
        setDeletingId(null);
      }
    },
    [fetchLearning, fetchAllQueues]
  );

  const handleBatchApprove = useCallback(async () => {
    setApproving(true);
    try {
      const res = await fetch("/api/clinic/learning-queue/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: true, minScore: 0.8 }),
      });
      if (res.ok) {
        fetchLearning();
        fetchAllQueues();
      }
    } finally {
      setApproving(false);
    }
  }, [fetchLearning, fetchAllQueues]);

  const handleApproveIds = useCallback(
    async (ids: string[]) => {
      setApproving(true);
      try {
        const res = await fetch("/api/clinic/learning-queue/approve", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (res.ok) {
          fetchLearning();
          fetchAllQueues();
        }
      } finally {
        setApproving(false);
      }
    },
    [fetchLearning, fetchAllQueues]
  );

  const handleReevaluate = useCallback(
    async (id: string) => {
      setReevaluatingId(id);
      try {
        const res = await fetch("/api/clinic/learning-queue/reevaluate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          fetchLearning();
          fetchAllQueues();
        }
      } finally {
        setReevaluatingId(null);
      }
    },
    [fetchLearning, fetchAllQueues]
  );

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

  const healthScore = data?.knowledge_health_score ?? 0;

  if (loading) {
    return (
      <div className="p-8 max-w-5xl space-y-8">
        <PageHeader title="Knowledge Health" subtitle="กำลังโหลด..." />
        <div className="h-48 rounded-2xl bg-cream-200 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <PageHeader
        title="AI Brain"
        subtitle="ตรวจสอบคุณภาพและสุขภาพของ Knowledge Base"
        shimmer
      />

      <div className="flex gap-2 border-b border-cream-300 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2 rounded-xl text-sm font-body ${
            activeTab === "health" ? "bg-rg-100 text-rg-700" : "text-mauve-600 hover:bg-cream-200"
          }`}
        >
          Knowledge Health
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("learning")}
          className={`px-4 py-2 rounded-xl text-sm font-body ${
            activeTab === "learning" ? "bg-rg-100 text-rg-700" : "text-mauve-600 hover:bg-cream-200"
          }`}
        >
          การเรียนรู้ AI
        </button>
      </div>

      {activeTab === "learning" && (
        <LearningDashboard
          data={learningData}
          metrics={learningMetrics}
          queue={learningQueue}
          subTab={learningSubTab}
          onSubTabChange={setLearningSubTab}
          loading={learningLoading}
          queueLoading={queueLoading}
          deletingId={deletingId}
          approving={approving}
          reevaluatingId={reevaluatingId}
          viewingItem={viewingItem}
          onView={(item) => setViewingItem(item)}
          onCloseView={() => setViewingItem(null)}
          handoffRateData={handoffRateData}
          onRefresh={() => {
            fetchLearning();
            fetchAllQueues();
            fetchHandoffRate();
          }}
          onDelete={handleDeleteLearned}
          onBatchApprove={handleBatchApprove}
          onApproveIds={handleApproveIds}
          onReevaluate={handleReevaluate}
        />
      )}

      {activeTab === "health" && data?.knowledge_health_score != null && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-8 shimmer-border"
        >
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="relative flex-shrink-0">
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(var(--ent-accent) ${healthScore}%, var(--cream-300) 0%)`,
                }}
              >
                <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center">
                  <p className="font-display text-3xl font-bold text-mauve-800">{healthScore}%</p>
                  <p className="font-body text-[10px] text-mauve-400">Health</p>
                </div>
              </div>
            </div>
            {data.health_metric && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                {[
                  { label: "Quality avg", value: data.health_metric.average_quality_score, icon: "◇" },
                  { label: "Drift", value: `${data.health_metric.drift_rate}%`, icon: "○" },
                  { label: "Hallucination", value: `${data.health_metric.hallucination_rate}%`, icon: "◎" },
                  { label: "Rejection", value: `${data.health_metric.approval_rejection_rate}%`, icon: "✕" },
                  { label: "Duplicate", value: `${data.health_metric.duplicate_rate}%`, icon: "⬢" },
                ].map((s, i) => (
                  <div key={i} className="text-center p-4 rounded-2xl bg-cream-100">
                    <p className="text-xl text-rg-400 mb-1">{s.icon}</p>
                    <p className="font-display text-2xl font-semibold text-mauve-800">{s.value}</p>
                    <p className="font-body text-[10px] text-mauve-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      )}

      {activeTab === "health" && data?.rag_quality && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-6 shimmer-border"
        >
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">RAG Quality</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-2xl bg-cream-100">
              <p className="font-body text-[10px] text-mauve-400">Avg Relevance Score</p>
              <p className="font-display text-2xl font-semibold text-mauve-800">
                {(data.rag_quality.avg_relevance_score * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-cream-100">
              <p className="font-body text-[10px] text-mauve-400">Cache Hit Rate</p>
              <p className="font-display text-2xl font-semibold text-mauve-600">—</p>
              <p className="font-body text-[10px] text-mauve-400">(tracking soon)</p>
            </div>
            {data.rag_quality.low_score_warning && (
              <div className="md:col-span-2 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="font-body text-sm text-amber-800">
                  ⚠️ &gt;20% of RAG searches have relevance score &lt;0.7 — พิจารณาเพิ่มความรู้
                </p>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {activeTab === "health" && (
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Metrics Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="luxury-card p-4 text-center">
            <p className="font-body text-[10px] text-mauve-400">Low Confidence Rate</p>
            <p className="font-display text-xl font-semibold text-mauve-800">
              {data?.low_confidence_rate_pct ?? 0}%
            </p>
          </div>
          <div className="luxury-card p-4 text-center">
            <p className="font-body text-[10px] text-mauve-400">Recent Policy Violations</p>
            <p className="font-display text-xl font-semibold text-mauve-800">
              {data?.policy_violation_summary?.recent_count ?? 0}
            </p>
          </div>
          <div className="luxury-card p-4 text-center">
            <p className="font-body text-[10px] text-mauve-400">Expiring Alerts</p>
            <p className="font-display text-xl font-semibold text-amber-600">
              {data?.expiring_knowledge_alerts?.length ?? 0}
            </p>
          </div>
          <div className="luxury-card p-4 text-center">
            <p className="font-body text-[10px] text-mauve-400">Top Low-Quality Orgs</p>
            <p className="font-display text-xl font-semibold text-mauve-800">
              {data?.top_low_quality_clinics?.length ?? 0}
            </p>
          </div>
        </div>
      </section>
      )}

      {activeTab === "health" && data?.knowledge_gaps && data.knowledge_gaps.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">
            คำถามที่ตอบไม่ได้ (7 วันล่าสุด)
          </h2>
          <div className="luxury-card overflow-hidden">
            <ul className="divide-y divide-cream-200">
              {data.knowledge_gaps.map((g, i) => (
                <li key={`${g.query}-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="font-body text-sm text-mauve-700 truncate flex-1" title={g.query}>
                    {g.query || "(ไม่มีข้อความ)"}
                  </span>
                  <span className="font-body text-xs text-mauve-400 flex-shrink-0">
                    {g.count} ครั้ง · {g.date}
                  </span>
                  <a
                    href={`/clinic/knowledge/new?query=${encodeURIComponent(g.query || "")}`}
                    className="flex-shrink-0 text-sm text-ent-accent hover:underline"
                  >
                    เพิ่มความรู้
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {activeTab === "health" && (
      <>
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Top Low-Quality Clinics</h2>
        {data?.top_low_quality_clinics?.length ? (
          <div className="luxury-card overflow-hidden">
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100">
                <tr>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">Org ID</th>
                  <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.top_low_quality_clinics.map((r) => (
                  <tr key={r.org_id} className="border-t border-cream-200">
                    <td className="px-4 py-2 font-mono text-sm text-mauve-800">{r.org_id}</td>
                    <td className="px-4 py-2 font-body text-sm text-right text-red-600">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-body text-sm text-mauve-400">ไม่มีข้อมูล</p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Most Duplicated Services</h2>
        {data?.most_duplicated_services?.length ? (
          <div className="luxury-card overflow-hidden">
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100">
                <tr>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">Org ID</th>
                  <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.most_duplicated_services.map((r) => (
                  <tr key={r.org_id} className="border-t border-cream-200">
                    <td className="px-4 py-2 font-mono text-sm text-mauve-800">{r.org_id}</td>
                    <td className="px-4 py-2 font-body text-sm text-right text-amber-600">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-body text-sm text-mauve-400">ไม่มีข้อมูล</p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Expiring Knowledge Alerts</h2>
        {data?.expiring_knowledge_alerts?.length ? (
          <div className="luxury-card overflow-hidden border-amber-200/60 bg-amber-50/30">
            <table className="min-w-full divide-y divide-amber-200/60">
              <thead className="bg-amber-100/50">
                <tr>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">Org</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">Service ID</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring_knowledge_alerts.map((a) => (
                  <tr key={a.id} className="border-t border-amber-100">
                    <td className="px-4 py-2 font-mono text-sm text-mauve-800">{a.org_id}</td>
                    <td className="px-4 py-2 font-body text-sm text-mauve-700">{a.base_service_id}</td>
                    <td className="px-4 py-2 font-body text-sm text-mauve-600">
                      {new Date(a.updated_at).toLocaleDateString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-body text-sm text-mauve-400">ไม่มีข้อมูลหมดอายุ</p>
        )}
      </section>
      </>
      )}

      {activeTab === "health" && data?.by_org && typeof data.by_org === "object" && (
        <section>
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Your Clinic Summary</h2>
          <div className="luxury-card p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-2xl bg-cream-100">
                <p className="font-body text-[10px] text-mauve-400">Low Quality</p>
                <p className="font-display text-lg font-semibold text-red-600">
                  {Object.values(data.by_org)[0]?.low_quality_count ?? 0}
                </p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-cream-100">
                <p className="font-body text-[10px] text-mauve-400">Duplicates</p>
                <p className="font-display text-lg font-semibold text-amber-600">
                  {Object.values(data.by_org)[0]?.duplicate_count ?? 0}
                </p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-cream-100">
                <p className="font-body text-[10px] text-mauve-400">Needs Review</p>
                <p className="font-display text-lg font-semibold text-blue-600">
                  {Object.values(data.by_org)[0]?.needs_review_count ?? 0}
                </p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-cream-100">
                <p className="font-body text-[10px] text-mauve-400">Expiring Soon</p>
                <p className="font-display text-lg font-semibold text-amber-600">
                  {Object.values(data.by_org)[0]?.expiring_count ?? 0}
                </p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-cream-100">
                <p className="font-body text-[10px] text-mauve-400">High Failure</p>
                <p className="font-display text-lg font-semibold text-red-600">
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

function LearningDashboard({
  data, // Used for loading-state parent; metrics provide displayed values
  metrics,
  queue,
  subTab,
  onSubTabChange,
  loading,
  queueLoading,
  deletingId,
  approving,
  reevaluatingId,
  viewingItem,
  onView,
  onCloseView,
  handoffRateData,
  onRefresh,
  onDelete,
  onBatchApprove,
  onApproveIds,
  onReevaluate,
}: {
  data: LearningStats | null;
  metrics: LearningMetrics | null;
  queue: Record<LearningSubTab, LearningQueueItem[]>;
  subTab: LearningSubTab;
  onSubTabChange: (t: LearningSubTab) => void;
  loading: boolean;
  queueLoading: boolean;
  deletingId: string | null;
  approving: boolean;
  reevaluatingId: string | null;
  viewingItem: LearningQueueItem | null;
  onView: (item: LearningQueueItem) => void;
  onCloseView: () => void;
  handoffRateData: {
    weeks: Array<{ week: string; handoffs: number; conversations: number; handoffRate: number }>;
    currentHandoffRate: number;
    targetRate: number;
    improvement: number | null;
  } | null;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onBatchApprove: () => void;
  onApproveIds: (ids: string[]) => void;
  onReevaluate: (id: string) => void;
}) {
  const items = queue[subTab] ?? [];
  const sortedApproved = [...items].sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="luxury-card p-6 h-24 rounded-2xl bg-cream-200 animate-pulse" />
          ))}
        </div>
        <div className="luxury-card p-6 h-64 rounded-2xl bg-cream-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">คุณภาพความรู้ AI</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="luxury-card p-6 text-center">
                <p className="font-body text-[10px] text-mauve-400">Auto-approved rate</p>
                <p className="font-display text-2xl font-semibold text-mauve-800">
                  {(metrics?.autoApprovedRatePct ?? 0)}%
                </p>
              </div>
              <div className="luxury-card p-6 text-center">
                <p className="font-body text-[10px] text-mauve-400">Average quality score</p>
                <p className="font-display text-2xl font-semibold text-mauve-800">
                  {(metrics?.avgQualityScore ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="luxury-card p-6 text-center">
                <p className="font-body text-[10px] text-mauve-400">Knowledge coverage</p>
                <p className="font-display text-2xl font-semibold text-mauve-800">
                  {metrics?.faqCount ?? 0} FAQ items
                </p>
                {data?.itemsLearnedThisMonth != null && data.itemsLearnedThisMonth > 0 && (
                  <p className="font-body text-[10px] text-mauve-500 mt-1">เรียนรู้ในเดือนนี้: {data.itemsLearnedThisMonth}</p>
                )}
              </div>
              <div className="luxury-card p-6 text-center">
                <p className="font-body text-[10px] text-mauve-400">รอตรวจสอบ</p>
                <p className="font-display text-2xl font-semibold text-amber-600">
                  {metrics?.queuedCount ?? 0}
                </p>
              </div>
        </div>
      </section>

      {/* 3 sub-tabs */}
      <div className="flex gap-2 border-b border-cream-300 pb-2">
        {(["approved", "pending", "rejected"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onSubTabChange(t)}
            className={`px-4 py-2 rounded-xl text-sm font-body ${
              subTab === t ? "bg-rg-100 text-rg-700" : "text-mauve-600 hover:bg-cream-200"
            }`}
          >
            {t === "approved" ? "อนุมัติแล้ว" : t === "pending" ? "รอตรวจสอบ" : "ถูกปฏิเสธ"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="font-body text-sm text-mauve-600" />
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={queueLoading}>
          รีเฟรช
        </Button>
      </div>

      {/* Tab 1: Approved */}
      {subTab === "approved" && (
        <div className="luxury-card overflow-hidden">
          {queueLoading ? (
            <div className="p-8 animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-cream-200 rounded" />
              ))}
            </div>
          ) : sortedApproved.length === 0 ? (
            <div className="p-8 text-center text-mauve-500 font-body">ยังไม่มีรายการที่อนุมัติแล้ว</div>
          ) : (
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100">
                <tr>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">คำถาม</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">คำตอบ</th>
                  <th className="px-4 py-2 text-center font-body text-sm font-medium text-mauve-700">Quality</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">วันที่</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">Source</th>
                  <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedApproved.map((item) => (
                  <tr key={item.id} className="border-t border-cream-200">
                    <td className="px-4 py-2 font-body text-sm text-mauve-700 max-w-[200px] truncate" title={item.question}>
                      {item.question}
                    </td>
                    <td className="px-4 py-2 font-body text-sm text-mauve-600 max-w-[240px] truncate" title={item.answer}>
                      {item.answer}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant={item.qualityScore >= 0.9 ? "success" : "default"} size="sm">
                        {(item.qualityScore * 100).toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-body text-sm text-mauve-600">
                      {new Date(item.evaluatedAt).toLocaleDateString("th-TH")}
                    </td>
                    <td className="px-4 py-2 font-body text-xs text-mauve-500">{item.source ?? "auto_learning"}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => onView(item)}>
                          ดู
                        </Button>
                        {item.learnedId && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === item.learnedId}
                            onClick={() => onDelete(item.learnedId!)}
                          >
                            {deletingId === item.learnedId ? "..." : "ลบ"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Pending */}
      {subTab === "pending" && (
        <div className="luxury-card overflow-hidden">
          <div className="p-4 border-b border-cream-200 flex justify-between items-center">
            <span className="font-body text-sm text-mauve-600">
              รายการที่ score &gt; 0.85 พร้อมอนุมัติได้
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={approving || queue.pending.length === 0}
              onClick={onBatchApprove}
            >
              {approving ? "กำลังอนุมัติ..." : "อนุมัติทั้งหมดที่ score > 0.8"}
            </Button>
          </div>
          {queueLoading ? (
            <div className="p-8 animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-cream-200 rounded" />
              ))}
            </div>
          ) : queue.pending.length === 0 ? (
            <div className="p-8 text-center text-mauve-500 font-body">ไม่มีรายการรอตรวจสอบ</div>
          ) : (
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100">
                <tr>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">คำถาม</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">คำตอบ</th>
                  <th className="px-4 py-2 text-center font-body text-sm font-medium text-mauve-700">Quality</th>
                  <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.pending.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-cream-200 ${item.qualityScore >= 0.85 ? "bg-emerald-50/40" : ""}`}
                  >
                    <td className="px-4 py-2 font-body text-sm text-mauve-700 max-w-[240px] truncate" title={item.question}>
                      {item.question}
                    </td>
                    <td className="px-4 py-2 font-body text-sm text-mauve-600 max-w-[240px] truncate" title={item.answer}>
                      {item.answer}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Badge
                        variant={item.qualityScore >= 0.85 ? "success" : item.qualityScore >= 0.7 ? "info" : "warning"}
                        size="sm"
                      >
                        {(item.qualityScore * 100).toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={approving}
                        onClick={() => onApproveIds([item.id])}
                      >
                        อนุมัติ
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Rejected */}
      {subTab === "rejected" && (
        <div className="luxury-card overflow-hidden">
          {queueLoading ? (
            <div className="p-8 animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-cream-200 rounded" />
              ))}
            </div>
          ) : queue.rejected.length === 0 ? (
            <div className="p-8 text-center text-mauve-500 font-body">ไม่มีรายการที่ถูกปฏิเสธ</div>
          ) : (
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100">
                <tr>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">คำถาม</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">คำตอบ</th>
                  <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">เหตุผลปฏิเสธ</th>
                  <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.rejected.map((item) => (
                  <tr key={item.id} className="border-t border-cream-200">
                    <td className="px-4 py-2 font-body text-sm text-mauve-700 max-w-[200px] truncate" title={item.question}>
                      {item.question}
                    </td>
                    <td className="px-4 py-2 font-body text-sm text-mauve-600 max-w-[200px] truncate" title={item.answer}>
                      {item.answer}
                    </td>
                    <td className="px-4 py-2 font-body text-sm text-amber-700 max-w-[200px]">
                      {item.reason || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reevaluatingId === item.id}
                        onClick={() => onReevaluate(item.id)}
                      >
                        {reevaluatingId === item.id ? "..." : "ดูอีกครั้ง"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* View Q&A Modal */}
      <Dialog open={!!viewingItem} onClose={onCloseView} title="รายละเอียด Q&A">
        {viewingItem && (
          <div className="p-5 space-y-4">
            <div>
              <p className="font-body text-[10px] text-mauve-400 mb-1">คำถาม</p>
              <p className="font-body text-sm text-mauve-800">{viewingItem.question}</p>
            </div>
            <div>
              <p className="font-body text-[10px] text-mauve-400 mb-1">คำตอบ</p>
              <p className="font-body text-sm text-mauve-700 whitespace-pre-wrap">{viewingItem.answer}</p>
            </div>
            <div className="flex gap-2 items-center text-mauve-500 font-body text-xs">
              <span>Quality: {(viewingItem.qualityScore * 100).toFixed(0)}%</span>
              {viewingItem.source && <span>• Source: {viewingItem.source}</span>}
            </div>
          </div>
        )}
      </Dialog>

      {/* ผลกระทบการเรียนรู้ */}
      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">ผลกระทบการเรียนรู้</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="luxury-card p-6">
            <h3 className="font-display text-base font-semibold text-mauve-800 mb-2">เป้าหมาย Handoff Rate</h3>
            {handoffRateData ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold text-mauve-800">
                    {handoffRateData.currentHandoffRate.toFixed(1)}%
                  </span>
                  <span className="font-body text-sm text-mauve-500">อัตรา handoff ปัจจุบัน</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm text-mauve-600">เป้าหมาย: &lt; {handoffRateData.targetRate}%</span>
                  {handoffRateData.improvement != null && (
                    <Badge variant={handoffRateData.improvement > 0 ? "success" : "default"} size="sm">
                      {handoffRateData.improvement > 0 ? "ดีขึ้น" : "ลดลง"} {Math.abs(handoffRateData.improvement)}% จากสัปดาห์ก่อน
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-24 rounded-2xl bg-cream-200 animate-pulse" />
            )}
          </div>
          <div className="luxury-card p-6">
            <h3 className="font-display text-base font-semibold text-mauve-800 mb-4">Handoff Rate ตามสัปดาห์</h3>
            {handoffRateData?.weeks?.length ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={handoffRateData.weeks}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="handoffGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: CHART.axis }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: CHART.axis }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, "auto"]}
                    />
                    <ReferenceLine y={15} stroke="var(--ent-danger)" strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid var(--cream-200)",
                        fontFamily: "var(--font-body)",
                      }}
                      formatter={(v, name) => [
                        name === "handoffRate" ? `${Number(v ?? 0).toFixed(1)}%` : String(v ?? 0),
                        name === "handoffRate" ? "Handoff Rate" : (name as string),
                      ]}
                      labelFormatter={(label) => `สัปดาห์ ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="handoffRate"
                      stroke={CHART.primary}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      fill="url(#handoffGradient)"
                      name="Handoff Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="font-body text-[10px] text-mauve-400 mt-2">
                  เส้นประสีแดง = เป้าหมาย 15%
                </p>
              </div>
            ) : (
              <div className="h-48 rounded-2xl bg-cream-200 animate-pulse flex items-center justify-center">
                <span className="font-body text-sm text-mauve-500">ยังไม่มีข้อมูล handoff rate</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
