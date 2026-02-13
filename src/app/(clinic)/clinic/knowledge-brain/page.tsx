"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";
import type { GlobalKnowledge } from "@/types/knowledge-brain";

type Tab = "industry" | "clinic" | "approval" | "audit";

export default function KnowledgeBrainPage() {
  const { currentUser } = useClinicContext();
  const [tab, setTab] = useState<Tab>("industry");
  const [selectedGlobal, setSelectedGlobal] = useState<GlobalKnowledge | null>(null);
  const [form, setForm] = useState({ custom_brand: "", custom_price_range: "", custom_differentiator: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data: globalData, mutate: mutateGlobal } = useSWR<{ items: GlobalKnowledge[] }>(
    "/api/clinic/knowledge-brain/global",
    apiFetcher
  );
  const { data: clinicData, mutate: mutateClinic } = useSWR<{ items: Array<{
    id: string;
    status: string;
    base_service_id: string;
    custom_brand?: string | null;
    custom_price_range?: string | null;
    custom_differentiator?: string | null;
    global: GlobalKnowledge | null;
  }> }>(
    "/api/clinic/knowledge-brain/clinic",
    apiFetcher
  );
  const { data: auditData, mutate: mutateAudit } = useSWR<{ items: Array<{
    id: string;
    action: string;
    user_id: string;
    target_id: string;
    timestamp: string;
  }> }>(
    tab === "audit" ? "/api/clinic/knowledge-brain/audit" : null,
    apiFetcher
  );

  const globals = globalData?.items ?? [];
  const clinicItems = clinicData?.items ?? [];
  const auditItems = auditData?.items ?? [];
  const pendingItems = clinicItems.filter((c) => c.status === "pending_review");
  const isManagerOrOwner = currentUser && ["owner", "manager"].includes(currentUser.role ?? "");

  const addToClinic = async (g: GlobalKnowledge) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/clinic/knowledge-brain/clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ base_service_id: g.id, status: "draft" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.errors?.[0]?.message ?? "Error");
      setMessage({ type: "ok", text: "เพิ่มแล้ว" });
      mutateClinic();
    } catch (e) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const submitForReview = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clinic/knowledge-brain/submit/${id}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessage({ type: "ok", text: "ส่งให้รอตรวจแล้ว" });
      mutateClinic();
    } catch (e) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clinic/knowledge-brain/approve/${id}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessage({ type: "ok", text: "อนุมัติแล้ว" });
      mutateClinic();
    } catch (e) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const reject = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clinic/knowledge-brain/reject/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessage({ type: "ok", text: "ส่งกลับเป็น Draft แล้ว" });
      mutateClinic();
    } catch (e) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const reindex = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/clinic/knowledge-brain/reindex", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMessage({ type: "ok", text: `Re-index สำเร็จ ${data.reindexed ?? 0} รายการ` });
      mutateClinic();
    } catch (e) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge variant="success">Approved</Badge>;
    if (s === "pending_review") return <Badge variant="warning">Pending</Badge>;
    return <Badge variant="default">Draft</Badge>;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Knowledge Control Center"
        description="Enterprise Knowledge Brain — Industry Library • My Clinic • Approval • Audit"
      />

      <div className="flex gap-2 border-b border-surface-200 pb-2">
        {(["industry", "clinic", "approval", "audit"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t ? "bg-primary-100 text-primary-700" : "text-surface-600 hover:bg-surface-100"
            }`}
          >
            {t === "industry" && "Industry Library"}
            {t === "clinic" && "My Clinic Knowledge"}
            {t === "approval" && "Approval Panel"}
            {t === "audit" && "Audit Log"}
          </button>
        ))}
        {isManagerOrOwner && (
          <Button
            variant="secondary"
            size="sm"
            onClick={reindex}
            disabled={loading}
            className="ml-auto"
          >
            Re-index
          </Button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {tab === "industry" && (
        <section>
          <SectionHeader
            title="Industry Library"
            description="Global services — เพิ่มลงคลินิกด้วยปุ่ม Add to My Clinic"
          />
          <Card padding="lg">
            {globals.length === 0 ? (
              <p className="text-sm text-surface-500 py-4">ยังไม่มี global knowledge — ต้อง seed ข้อมูลก่อน</p>
            ) : (
              <div className="space-y-4">
                {globals.map((g) => {
                  const alreadyAdded = clinicItems.some((c) => c.base_service_id === g.id);
                  return (
                    <div
                      key={g.id}
                      className="p-4 rounded-xl border border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <h3 className="font-medium text-surface-900">{g.service_name}</h3>
                        <p className="text-sm text-surface-500 mt-1">{g.category}</p>
                        <p className="text-xs text-surface-400 mt-1 line-clamp-2">{g.description}</p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => addToClinic(g)}
                        disabled={loading || alreadyAdded}
                      >
                        {alreadyAdded ? "เพิ่มแล้ว" : "Add to My Clinic"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>
      )}

      {tab === "clinic" && (
        <section>
          <SectionHeader
            title="My Clinic Knowledge"
            description="Service ที่คลินิกใช้ — แก้ไขเฉพาะ override fields"
          />
          <Card padding="lg">
            {clinicItems.length === 0 ? (
              <p className="text-sm text-surface-500 py-4">ยังไม่มี clinic knowledge — เพิ่มจาก Industry Library</p>
            ) : (
              <div className="space-y-4">
                {clinicItems.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-surface-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h3 className="font-medium text-surface-900">{c.global?.service_name ?? c.base_service_id}</h3>
                      {statusBadge(c.status)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {c.custom_brand && <p><span className="text-surface-500">Brand:</span> {c.custom_brand}</p>}
                      {c.custom_price_range && <p><span className="text-surface-500">Price:</span> {c.custom_price_range}</p>}
                      {c.custom_differentiator && <p><span className="text-surface-500">Differentiator:</span> {c.custom_differentiator}</p>}
                    </div>
                    {c.status === "draft" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => submitForReview(c.id)}
                        disabled={loading}
                      >
                        Submit for Review
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {tab === "approval" && isManagerOrOwner && (
        <section>
          <SectionHeader
            title="Approval Panel"
            description="อนุมัติ/ส่งกลับ knowledge ที่รอตรวจ"
          />
          <Card padding="lg">
            {pendingItems.length === 0 ? (
              <p className="text-sm text-surface-500 py-4">ไม่มีรายการรออนุมัติ</p>
            ) : (
              <div className="space-y-4">
                {pendingItems.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl border border-surface-200">
                    <h3 className="font-medium text-surface-900">{c.global?.service_name ?? c.base_service_id}</h3>
                    <div className="flex gap-2 mt-2">
                      <Button variant="primary" size="sm" onClick={() => approve(c.id)} disabled={loading}>Approve</Button>
                      <Button variant="secondary" size="sm" onClick={() => reject(c.id)} disabled={loading}>Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {tab === "approval" && !isManagerOrOwner && (
        <Card padding="lg">
          <p className="text-sm text-surface-500 py-4">เฉพาะ owner/manager สามารถเข้าถึง Approval Panel</p>
        </Card>
      )}

      {tab === "audit" && (
        <section>
          <SectionHeader title="Audit Log" description="ใครแก้อะไร เมื่อไร" />
          <Card padding="lg">
            {auditItems.length === 0 ? (
              <p className="text-sm text-surface-500 py-4">ยังไม่มี audit log</p>
            ) : (
              <div className="space-y-2">
                {auditItems.map((a) => (
                  <div key={a.id} className="flex flex-wrap gap-2 py-2 border-b border-surface-100 text-sm">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-surface-500">by {a.user_id ?? "system"}</span>
                    <span className="text-surface-400">{new Date(a.timestamp).toLocaleString("th-TH")}</span>
                    {a.target_id && <span className="text-surface-500">#{a.target_id.slice(0, 8)}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
