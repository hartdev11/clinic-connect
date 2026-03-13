"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

interface PlatformIntelligenceData {
  totalApprovedThisMonth: number;
  autoApprovedRatePct: number;
  avgQualityScore: number;
  knowledgeGapCount: number;
  commonLearnings: Array<{
    questionPattern: string;
    frequency: number;
    avgQuality: number;
  }>;
  topGaps: Array<{
    query: string;
    handoffCount: number;
    orgCount: number;
  }>;
  platformConfig: {
    modelVersion: string;
    lastTrainingDate: string | null;
    nextTrainingDate: string | null;
    minQualityScoreForAutoApprove: number;
    minQualityScoreForQueue: number;
  };
}

function SkeletonCard() {
  return (
    <div className="luxury-card p-6 animate-pulse">
      <div className="h-4 bg-cream-300 rounded w-24 mb-3" />
      <div className="h-8 bg-cream-300 rounded w-20" />
    </div>
  );
}

export default function PlatformIntelligencePage() {
  const [data, setData] = useState<PlatformIntelligenceData | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minAuto, setMinAuto] = useState(0.9);
  const [minQueue, setMinQueue] = useState(0.5);
  const [prohibited, setProhibited] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [res, configRes] = await Promise.all([
          fetch("/api/admin/platform-intelligence", { credentials: "include" }),
          fetch("/api/admin/platform-config", { credentials: "include" }),
        ]);
        if (res.ok) setData(await res.json());
        if (configRes.ok) {
          const c = await configRes.json();
          setConfig(c);
          setMinAuto(c.minQualityScoreForAutoApprove ?? 0.9);
          setMinQueue(c.minQualityScoreForQueue ?? 0.5);
          setProhibited(Array.isArray(c.globalProhibitedClaims) ? c.globalProhibitedClaims : []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform-config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minQualityScoreForAutoApprove: minAuto,
          minQualityScoreForQueue: minQueue,
          globalProhibitedClaims: prohibited,
        }),
      });
      if (res.ok) setConfig(await res.json());
    } finally {
      setSaving(false);
    }
  };

  const addProhibited = () => {
    const t = newTag.trim();
    if (t && !prohibited.includes(t)) setProhibited([...prohibited, t]);
    setNewTag("");
  };

  const removeProhibited = (i: number) => {
    setProhibited(prohibited.filter((_, idx) => idx !== i));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Platform Intelligence" subtitle="กำลังโหลด..." />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Intelligence"
        subtitle="Source 1: Aggregate learnings + Knowledge gaps"
        shimmer
      />

      {/* Metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={loading ? "" : "luxury-card p-6"}>
          <p className="font-body text-sm text-mauve-500 mb-1">Total approved (this month)</p>
          <p className="font-display text-2xl font-semibold text-mauve-800">
            {data?.totalApprovedThisMonth ?? 0}
          </p>
        </div>
        <div className="luxury-card p-6">
          <p className="font-body text-sm text-mauve-500 mb-1">Auto-approve rate %</p>
          <p className="font-display text-2xl font-semibold text-mauve-800">
            {data?.autoApprovedRatePct ?? 0}%
          </p>
        </div>
        <div className="luxury-card p-6">
          <p className="font-body text-sm text-mauve-500 mb-1">Avg quality score</p>
          <p className="font-display text-2xl font-semibold text-mauve-800">
            {(data?.avgQualityScore ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="luxury-card p-6">
          <p className="font-body text-sm text-mauve-500 mb-1">Knowledge gap count</p>
          <p className="font-display text-2xl font-semibold text-amber-600">
            {data?.knowledgeGapCount ?? 0}
          </p>
        </div>
      </section>

      {/* Training pipeline status */}
      <section className="luxury-card p-6">
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">
          Training Pipeline Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="font-body text-xs text-mauve-400">Current model</p>
            <p className="font-body text-sm text-mauve-700">
              {(() => {
                const v = data?.platformConfig?.modelVersion ?? (config?.modelVersion as string | undefined);
                return typeof v === "string" ? v : "—";
              })()}
            </p>
          </div>
          <div>
            <p className="font-body text-xs text-mauve-400">Last training</p>
            <p className="font-body text-sm text-mauve-700">
              {(() => {
                const v = data?.platformConfig?.lastTrainingDate ?? (config?.lastTrainingDate as string | null | undefined);
                return typeof v === "string" ? v : "—";
              })()}
            </p>
          </div>
          <div>
            <p className="font-body text-xs text-mauve-400">Next scheduled</p>
            <p className="font-body text-sm text-mauve-700">
              {(() => {
                const v = data?.platformConfig?.nextTrainingDate ?? (config?.nextTrainingDate as string | null | undefined);
                return typeof v === "string" ? v : "—";
              })()}
            </p>
          </div>
          <div>
            <p className="font-body text-xs text-mauve-400">Training data</p>
            <p className="font-body text-sm text-mauve-700">
              {data?.totalApprovedThisMonth ?? 0} (this month)
            </p>
          </div>
        </div>
      </section>

      {/* Platform config editor */}
      <section className="luxury-card p-6">
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">
          Platform Config (Quality Thresholds)
        </h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="font-body text-sm text-mauve-600">
              Min quality for auto-approve: {minAuto.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minAuto}
              onChange={(e) => setMinAuto(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>
          <div>
            <label className="font-body text-sm text-mauve-600">
              Min quality for queue: {minQueue.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minQueue}
              onChange={(e) => setMinQueue(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>
          <div>
            <label className="font-body text-sm text-mauve-600">Global prohibited claims</label>
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {prohibited.map((p, i) => (
                <span
                  key={p}
                  className="px-2 py-1 rounded-lg bg-red-100 text-red-800 text-sm flex items-center gap-1"
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removeProhibited(i)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProhibited())}
                  placeholder="เพิ่มคำที่ห้าม"
                  className="rounded-lg border border-cream-300 px-2 py-1 text-sm"
                />
                <Button variant="outline" size="sm" onClick={addProhibited}>
                  +
                </Button>
              </div>
            </div>
          </div>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSaveConfig}>
            บันทึก
          </Button>
        </div>
      </section>

      {/* Common learnings */}
      <section className="luxury-card overflow-hidden">
        <h2 className="font-display text-lg font-semibold text-mauve-800 p-6 pb-2">
          Common Learnings (≥3 orgs learned this)
        </h2>
        <p className="font-body text-sm text-mauve-500 px-6 mb-2">
          คำถามที่หลายคลินิกเรียนรู้แล้ว — ไม่แสดงชื่อ org (anon)
        </p>
        {data?.commonLearnings?.length ? (
          <table className="min-w-full divide-y divide-cream-200">
            <thead className="bg-cream-100">
              <tr>
                <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">
                  Question pattern
                </th>
                <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">
                  Frequency (N orgs)
                </th>
                <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">
                  Avg quality
                </th>
                <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.commonLearnings.map((cl, i) => (
                <tr key={i} className="border-t border-cream-200">
                  <td className="px-4 py-2 font-body text-sm text-mauve-700" title={cl.questionPattern}>
                    {cl.questionPattern}
                  </td>
                  <td className="px-4 py-2 text-right font-body text-sm">{cl.frequency}</td>
                  <td className="px-4 py-2 text-right font-body text-sm">
                    {(cl.avgQuality * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => console.log("Add to platform knowledge — future use")}
                    >
                      เพิ่มใน Platform Knowledge (log)
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 font-body text-mauve-500">ยังไม่มี common learnings (ต้อง ≥3 orgs)</p>
        )}
      </section>

      {/* Knowledge gaps */}
      <section className="luxury-card overflow-hidden">
        <h2 className="font-display text-lg font-semibold text-mauve-800 p-6 pb-2">
          Platform Knowledge Gaps (Top 10)
        </h2>
        <p className="font-body text-sm text-mauve-500 px-6 mb-2">
          คำถามที่ทำให้ handoff บ่อยที่สุด (30 วันล่าสุด)
        </p>
        {data?.topGaps?.length ? (
          <table className="min-w-full divide-y divide-cream-200">
            <thead className="bg-cream-100">
              <tr>
                <th className="px-4 py-2 text-left font-body text-sm font-medium text-mauve-700">
                  Query
                </th>
                <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">
                  Handoff count
                </th>
                <th className="px-4 py-2 text-right font-body text-sm font-medium text-mauve-700">
                  Org count
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topGaps.map((g, i) => (
                <tr key={i} className="border-t border-cream-200">
                  <td className="px-4 py-2 font-body text-sm text-mauve-700" title={g.query}>
                    {g.query}
                  </td>
                  <td className="px-4 py-2 text-right font-body text-sm text-amber-600">
                    {g.handoffCount}
                  </td>
                  <td className="px-4 py-2 text-right font-body text-sm">{g.orgCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 font-body text-mauve-500">ไม่มี knowledge gaps</p>
        )}
      </section>
    </div>
  );
}
