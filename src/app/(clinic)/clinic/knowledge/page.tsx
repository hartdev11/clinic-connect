"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type {
  UnifiedKnowledgeStatus,
  GlobalService,
  ClinicService,
  ClinicFaq,
} from "@/types/unified-knowledge";

const PAGE_TITLE = "ข้อมูลที่ AI ใช้ตอบลูกค้า";
const PAGE_SUBTITLE = "จัดการข้อมูลที่ AI ใช้ตอบลูกค้าแบบอัตโนมัติ";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Status cards ─────────────────────────────────────────────────────────

function StatusCards({ status, loading }: { status: UnifiedKnowledgeStatus | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-surface-100/80 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!status) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
      <Card padding="lg" className="bg-[#fefbfb] rounded-2xl shadow-sm">
        <h4 className="text-sm font-medium text-surface-600">ความรู้มาตรฐานจากแพลตฟอร์ม</h4>
        <p className="mt-2 text-lg font-semibold text-surface-800">
          {status.global.active ? "Active" : "—"}
        </p>
        <p className="mt-1 text-xs text-surface-500">Version {status.global.version}</p>
      </Card>
      <Card padding="lg" className="bg-[#fefbfb] rounded-2xl shadow-sm">
        <h4 className="text-sm font-medium text-surface-600">ข้อมูลของคลินิกคุณ</h4>
        <p className="mt-2 text-lg font-semibold text-surface-800">
          {status.clinic.active ? "Active" : "—"}
        </p>
        <p className="mt-1 text-xs text-surface-500">
          อัปเดตล่าสุด {formatDate(status.clinic.last_updated)}
        </p>
        <Badge variant={status.clinic.embedding_status === "ok" ? "default" : "warning"} className="mt-2">
          {status.clinic.embedding_status === "ok" ? "พร้อมใช้งาน" : "มีปัญหา"}
        </Badge>
        {status.clinic.last_embedding_at && (
          <p className="mt-1 text-xs text-surface-500">
            ฝังล่าสุด {formatDate(status.clinic.last_embedding_at)}
          </p>
        )}
      </Card>
      <Card padding="lg" className="bg-[#fefbfb] rounded-2xl shadow-sm">
        <h4 className="text-sm font-medium text-surface-600">โปรโมชันปัจจุบัน</h4>
        <p className="mt-2 text-lg font-semibold text-surface-800">
          {status.promotions.active_count} โปรโมชัน
        </p>
        {status.promotions.expiry_warnings > 0 && (
          <Badge variant="warning" className="mt-2">
            หมดอายุใน 7 วัน: {status.promotions.expiry_warnings}
          </Badge>
        )}
      </Card>
    </div>
  );
}

// ─── Services tab ─────────────────────────────────────────────────────────

function ServiceCard({
  service,
  global,
  platformManagedMode,
  onSave,
  onArchive,
}: {
  service: ClinicService;
  global: GlobalService | null;
  platformManagedMode?: boolean;
  onSave: (id: string, payload: { custom_title?: string; custom_highlight?: string; custom_price?: string; custom_description?: string; status?: "active" | "inactive" }) => void;
  onArchive?: (id: string) => void;
}) {
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [custom_title, setCustomTitle] = useState(service.custom_title);
  const [custom_highlight, setCustomHighlight] = useState(service.custom_highlight);
  const [custom_price, setCustomPrice] = useState(service.custom_price);
  const [custom_description, setCustomDescription] = useState(service.custom_description);
  const [status, setStatus] = useState<"active" | "inactive">(
    service.status === "embedding_failed" ? "active" : service.status
  );
  const [saving, setSaving] = useState(false);
  const titleReadOnly = platformManagedMode && !!global;
  const templateUpdateAvailable =
    !!global && service.template_version_at_embed != null && global.version > service.template_version_at_embed;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Parameters<typeof onSave>[1] = {
        custom_highlight,
        custom_price,
        custom_description,
        status,
      };
      if (!titleReadOnly) payload.custom_title = custom_title;
      await onSave(service.id, payload);
    } finally {
      setSaving(false);
    }
  };

  const displayName = custom_title?.trim() || global?.name || "บริการ";
  const isDirty =
    custom_title !== service.custom_title ||
    custom_highlight !== service.custom_highlight ||
    custom_price !== service.custom_price ||
    custom_description !== service.custom_description ||
    status !== service.status;

  return (
    <Card padding="lg" className="rounded-2xl shadow-sm">
      {titleReadOnly ? (
        <h3 className="text-lg font-semibold text-surface-800">{displayName}</h3>
      ) : (
        <input
          type="text"
          value={custom_title}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="w-full text-lg font-semibold text-surface-800 bg-transparent border-b border-transparent hover:border-surface-200 focus:border-primary-400 focus:outline-none rounded px-0"
          placeholder="ชื่อบริการ"
        />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {global && (
          <Badge variant="info">
            Template v{global.version}
            {service.template_version_at_embed != null && ` (ฝังเมื่อ v${service.template_version_at_embed})`}
          </Badge>
        )}
        {templateUpdateAvailable && (
          <Badge variant="warning">มีเทมเพลตเวอร์ชันใหม่</Badge>
        )}
        {service.status === "embedding_failed" && (
          <Badge variant="warning">อัปเดตข้อมูลไม่สำเร็จ — กดบันทึกเพื่อลองใหม่</Badge>
        )}
        {service.status === "active" && !templateUpdateAvailable && (
          <Badge variant="default">พร้อมใช้งาน</Badge>
        )}
      </div>
      {global?.standard_description && (
        <div className="mt-3 rounded-lg bg-surface-50 p-3 text-sm text-surface-600">
          {global.compliance_locked ? (
            <span className="text-surface-500">(ข้อความมาตรฐาน — ไม่สามารถแก้ไข)</span>
          ) : null}
          <p className="mt-1">{global.standard_description}</p>
        </div>
      )}
      <hr className="my-4 border-surface-200" />
      <div className="space-y-3">
        <label className="block text-sm font-medium text-surface-700">จุดเด่นของคลินิกคุณ</label>
        <Input
          value={custom_highlight}
          onChange={(e) => setCustomHighlight(e.target.value)}
          placeholder="จุดเด่นหรือข้อความโปรโมท"
          className="w-full"
        />
        <label className="block text-sm font-medium text-surface-700">ราคา</label>
        <Input
          value={custom_price}
          onChange={(e) => setCustomPrice(e.target.value)}
          placeholder="ช่วงราคา หรือราคาเริ่มต้น"
          className="w-full"
        />
        <label className="block text-sm font-medium text-surface-700">รายละเอียดเพิ่มเติม</label>
        <textarea
          value={custom_description}
          onChange={(e) => setCustomDescription(e.target.value)}
          placeholder="รายละเอียดเพิ่มเติม"
          className="w-full min-h-[80px] rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          rows={3}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={status === "active"}
            onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
            className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
          />
          เปิดใช้งาน
        </label>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!isDirty || saving}
          loading={saving}
        >
          บันทึก
        </Button>
        {onArchive && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setArchiveConfirm(true)}
            className="text-surface-600"
          >
            เก็บถาวร
          </Button>
        )}
      </div>
      {archiveConfirm && onArchive && (
        <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-3">
          <p className="text-sm text-surface-700">ต้องการเก็บบริการนี้เข้าถาวรหรือไม่? ข้อมูลจะไม่แสดงใน AI</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => { onArchive(service.id); setArchiveConfirm(false); }}>
              ยืนยัน
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setArchiveConfirm(false)}>ยกเลิก</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── FAQ tab ──────────────────────────────────────────────────────────────

function FaqItem({
  item,
  onSave,
  onDelete,
}: {
  item: ClinicFaq;
  onSave: (id: string, payload: { question?: string; answer?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const [saving, setSaving] = useState(false);
  const isDirty = question !== item.question || answer !== item.answer;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      await onSave(item.id, { question, answer });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-surface-800 hover:bg-surface-50"
      >
        <span className="line-clamp-1">{question || "(ไม่มีคำถาม)"}</span>
        <span className="flex shrink-0 items-center gap-1">
          {item.status === "embedding_failed" && (
            <Badge variant="warning" className="text-xs">มีปัญหา</Badge>
          )}
          <span className="text-surface-400">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-surface-100 px-4 py-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="คำถาม"
            className="mb-3 w-full"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="คำตอบ"
            className="mb-3 w-full min-h-[80px] rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
              loading={saving}
            >
              บันทึก
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (confirm("ต้องการเก็บคำถามนี้เข้าถาวรหรือไม่? ข้อมูลจะไม่แสดงใน AI")) onDelete(item.id);
              }}
            >
              เก็บถาวร
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function UnifiedKnowledgePage() {
  const [tab, setTab] = useState<"services" | "faq" | "promotions">("services");
  const [status, setStatus] = useState<UnifiedKnowledgeStatus | null>(null);
  const [globalServices, setGlobalServices] = useState<GlobalService[]>([]);
  const [clinicServices, setClinicServices] = useState<ClinicService[]>([]);
  const [faqItems, setFaqItems] = useState<ClinicFaq[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingFaq, setLoadingFaq] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addFaqOpen, setAddFaqOpen] = useState(false);
  const [processQueueLoading, setProcessQueueLoading] = useState(false);
  const [processQueueMessage, setProcessQueueMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/clinic/unified-knowledge/status", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(data);
      else setStatus(null);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await fetch("/api/clinic/unified-knowledge/services", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setClinicServices(data.items ?? []);
      else setClinicServices([]);
    } catch {
      setClinicServices([]);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  const fetchFaq = useCallback(async () => {
    setLoadingFaq(true);
    try {
      const res = await fetch("/api/clinic/unified-knowledge/faq", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFaqItems(data.items ?? []);
      else setFaqItems([]);
    } catch {
      setFaqItems([]);
    } finally {
      setLoadingFaq(false);
    }
  }, []);

  const fetchGlobal = useCallback(async () => {
    try {
      const res = await fetch("/api/clinic/unified-knowledge/global", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setGlobalServices(data.items ?? []);
    } catch {
      setGlobalServices([]);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  useEffect(() => {
    if (tab === "services") {
      fetchServices();
      fetchGlobal();
    }
  }, [tab, fetchServices, fetchGlobal]);
  useEffect(() => {
    if (tab === "faq") fetchFaq();
  }, [tab, fetchFaq]);

  const handleArchiveService = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/clinic/unified-knowledge/services/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          setToast("เก็บถาวรแล้ว");
          fetchServices();
          fetchStatus();
        } else {
          const data = await res.json().catch(() => ({}));
          setToast(data.error ?? "ไม่สำเร็จ");
        }
      } catch {
        setToast("เกิดข้อผิดพลาด");
      }
    },
    [fetchServices, fetchStatus]
  );

  const handleSaveService = useCallback(
    async (
      id: string,
      payload: {
        custom_title?: string;
        custom_highlight?: string;
        custom_price?: string;
        custom_description?: string;
        status?: "active" | "inactive";
      }
    ) => {
      const res = await fetch(`/api/clinic/unified-knowledge/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("บันทึกแล้ว ระบบกำลังอัปเดตข้อมูลให้ AI ในพื้นหลัง");
        fetchServices();
        fetchStatus();
      } else {
        setToast(data.error ?? "บันทึกไม่สำเร็จ");
      }
    },
    [fetchServices, fetchStatus]
  );

  const handleAddService = useCallback(
    async (global_service_id: string | null, custom_title: string) => {
      const res = await fetch("/api/clinic/unified-knowledge/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          global_service_id: global_service_id || undefined,
          custom_title: custom_title.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("เพิ่มบริการแล้ว ระบบกำลังอัปเดตข้อมูลให้ AI");
        setAddServiceOpen(false);
        fetchServices();
        fetchStatus();
      } else {
        setToast(data.error ?? "เพิ่มไม่สำเร็จ");
      }
    },
    [fetchServices, fetchStatus]
  );

  const handleSaveFaq = useCallback(
    async (id: string, payload: { question?: string; answer?: string }) => {
      const res = await fetch(`/api/clinic/unified-knowledge/faq/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("บันทึกแล้ว");
        fetchFaq();
        fetchStatus();
      } else {
        setToast(data.error ?? "บันทึกไม่สำเร็จ");
      }
    },
    [fetchFaq, fetchStatus]
  );

  const handleDeleteFaq = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/clinic/unified-knowledge/faq/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setToast("ลบแล้ว");
        fetchFaq();
        fetchStatus();
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error ?? "ลบไม่สำเร็จ");
      }
    },
    [fetchFaq, fetchStatus]
  );

  const handleAddFaq = useCallback(
    async (question: string, answer: string) => {
      const res = await fetch("/api/clinic/unified-knowledge/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("เพิ่มคำถามแล้ว");
        setAddFaqOpen(false);
        fetchFaq();
        fetchStatus();
      } else {
        setToast(data.error ?? "เพิ่มไม่สำเร็จ");
      }
    },
    [fetchFaq, fetchStatus]
  );

  const handleProcessQueue = useCallback(async () => {
    setProcessQueueLoading(true);
    setProcessQueueMessage(null);
    try {
      const res = await fetch("/api/clinic/knowledge/process-queue", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setProcessQueueMessage(
          data.message ?? `ประมวลผลแล้ว ${data.processed ?? 0} รายการ`
        );
        fetchStatus();
      } else {
        setProcessQueueMessage(data.error ?? "เรียกไม่สำเร็จ");
      }
    } catch {
      setProcessQueueMessage("เกิดข้อผิดพลาด");
    } finally {
      setProcessQueueLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-screen bg-[#fefbfb]">
      <PageHeader title={PAGE_TITLE} description={PAGE_SUBTITLE} />
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4">
        <section className="mb-8">
          {status?.ai_status != null && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-sm font-medium text-surface-700">สถานะ AI:</span>
              <Badge variant={status.ai_status === "issue" ? "warning" : "default"}>
                {status.ai_status === "ready" && "พร้อมใช้งาน"}
                {status.ai_status === "updating" && "กำลังอัปเดต"}
                {status.ai_status === "issue" && "มีปัญหา"}
              </Badge>
              {status.clinic.last_embedding_at && (
                <span className="text-xs text-surface-500">
                  ฝังล่าสุด {formatDate(status.clinic.last_embedding_at)}
                </span>
              )}
              {status.clinic.warning_count > 0 && (
                <Badge variant="warning">คำเตือน {status.clinic.warning_count}</Badge>
              )}
            </div>
          )}
          <StatusCards status={status} loading={loadingStatus} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleProcessQueue}
              disabled={processQueueLoading}
              loading={processQueueLoading}
            >
              อัปเดตข้อมูลให้ AI
            </Button>
            {processQueueMessage && (
              <span className="text-sm text-surface-600">{processQueueMessage}</span>
            )}
          </div>
          {status?.platform_managed_mode && (
            <div className="mt-4 rounded-xl border border-primary-200/80 bg-primary-50/60 px-4 py-2 text-sm text-primary-800">
              โหมดจัดการโดยแพลตฟอร์ม: คุณแก้ไขได้เฉพาะ จุดเด่น ราคา และรายละเอียดเพิ่มเติม เทมเพลตบริการมาจากแพลตฟอร์ม
            </div>
          )}
        </section>

        <nav className="mb-6 flex gap-1 border-b border-surface-200">
          {(["services", "faq", "promotions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "border border-b-0 border-surface-200 bg-white text-primary-600"
                  : "text-surface-600 hover:bg-surface-50 hover:text-surface-800"
              }`}
            >
              {t === "services" && "บริการ"}
              {t === "faq" && "คำถามที่พบบ่อย"}
              {t === "promotions" && "โปรโมชัน"}
            </button>
          ))}
        </nav>

        {tab === "services" && (
          <section>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" size="md" onClick={() => setAddServiceOpen(true)}>
                + เพิ่มบริการ
              </Button>
            </div>
            {loadingServices ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-2xl bg-surface-100 animate-pulse" />
                ))}
              </div>
            ) : clinicServices.length === 0 ? (
              <Card padding="lg" className="text-center py-12">
                <p className="text-surface-600">ยังไม่มีบริการ</p>
                <p className="mt-1 text-sm text-surface-500">
                  กด &quot;+ เพิ่มบริการ&quot; เพื่อเพิ่มบริการจากเทมเพลตหรือสร้างเอง
                </p>
                <Button
                  variant="primary"
                  size="md"
                  className="mt-4"
                  onClick={() => setAddServiceOpen(true)}
                >
                  + เพิ่มบริการ
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {clinicServices.map((svc) => {
                  const global = svc.global_service_id
                    ? globalServices.find((g) => g.id === svc.global_service_id) ?? null
                    : null;
                  return (
                    <ServiceCard
                      key={svc.id}
                      service={svc}
                      global={global}
                      platformManagedMode={status?.platform_managed_mode}
                      onSave={handleSaveService}
                      onArchive={handleArchiveService}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "faq" && (
          <section>
            <div className="mb-4 flex justify-end">
              <Button variant="primary" size="md" onClick={() => setAddFaqOpen(true)}>
                + เพิ่มคำถาม
              </Button>
            </div>
            {loadingFaq ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-surface-100 animate-pulse" />
                ))}
              </div>
            ) : faqItems.length === 0 ? (
              <Card padding="lg" className="text-center py-12">
                <p className="text-surface-600">ยังไม่มีคำถามที่พบบ่อย</p>
                <Button
                  variant="primary"
                  size="md"
                  className="mt-4"
                  onClick={() => setAddFaqOpen(true)}
                >
                  + เพิ่มคำถาม
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {faqItems.map((item) => (
                  <FaqItem
                    key={item.id}
                    item={item}
                    onSave={handleSaveFaq}
                    onDelete={handleDeleteFaq}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "promotions" && (
          <section>
            <Card padding="lg" className="rounded-2xl">
              <p className="text-surface-600">
                จัดการโปรโมชันและโปรโมชันที่กำลังหมดอายุได้ที่หน้ารายการโปรโมชัน
              </p>
              <Link href="/clinic/promotions">
                <Button variant="primary" size="md" className="mt-4">
                  ไปที่หน้ารายการโปรโมชัน
                </Button>
              </Link>
            </Card>
          </section>
        )}

        {addServiceOpen && (
          <AddServiceModal
            globalServices={globalServices}
            platformManagedMode={status?.platform_managed_mode}
            onAdd={handleAddService}
            onClose={() => setAddServiceOpen(false)}
          />
        )}
        {addFaqOpen && (
          <AddFaqModal
            onAdd={handleAddFaq}
            onClose={() => setAddFaqOpen(false)}
          />
        )}

        {toast && (
          <div
            role="alert"
            className="fixed bottom-4 right-4 z-50 rounded-xl bg-surface-800 px-4 py-2 text-sm text-white shadow-lg"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Service Modal ─────────────────────────────────────────────────────

function AddServiceModal({
  globalServices,
  platformManagedMode,
  onAdd,
  onClose,
}: {
  globalServices: GlobalService[];
  platformManagedMode?: boolean;
  onAdd: (global_service_id: string | null, custom_title: string) => void;
  onClose: () => void;
}) {
  const [selectedGlobalId, setSelectedGlobalId] = useState<string>(platformManagedMode && globalServices[0] ? globalServices[0].id : "");
  const [customTitle, setCustomTitle] = useState(platformManagedMode && globalServices[0] ? globalServices[0].name : "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = customTitle.trim() || (selectedGlobalId ? globalServices.find((g) => g.id === selectedGlobalId)?.name ?? "" : "");
    if (!title) return;
    if (platformManagedMode && !selectedGlobalId) return;
    setSubmitting(true);
    try {
      await onAdd(platformManagedMode ? selectedGlobalId : selectedGlobalId || null, title);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="add-service-title"
      >
        <h2 id="add-service-title" className="text-lg font-semibold text-surface-800">
          เพิ่มบริการ
        </h2>
        {platformManagedMode && (
          <p className="mt-1 text-xs text-surface-500">โหมดจัดการโดยแพลตฟอร์ม: ต้องเลือกเทมเพลตจากแพลตฟอร์ม</p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-surface-700">
            {platformManagedMode ? "เทมเพลต *" : "เทมเพลต (ถ้ามี)"}
          </label>
          <select
            value={selectedGlobalId}
            onChange={(e) => {
              setSelectedGlobalId(e.target.value);
              const g = globalServices.find((x) => x.id === e.target.value);
              if (g && !customTitle) setCustomTitle(g.name);
            }}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
            required={platformManagedMode}
          >
            {!platformManagedMode && <option value="">— ไม่ใช้เทมเพลต —</option>}
            {globalServices.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-surface-700">ชื่อบริการ *</label>
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="ชื่อบริการ"
            required
            className="w-full"
          />
          <div className="mt-4 flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} loading={submitting}>
              เพิ่ม
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Add FAQ Modal ─────────────────────────────────────────────────────────

function AddFaqModal({
  onAdd,
  onClose,
}: {
  onAdd: (question: string, answer: string) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(question, answer);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="add-faq-title"
      >
        <h2 id="add-faq-title" className="text-lg font-semibold text-surface-800">
          เพิ่มคำถามที่พบบ่อย
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-surface-700">คำถาม *</label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="คำถาม"
            required
            className="w-full"
          />
          <label className="block text-sm font-medium text-surface-700">คำตอบ</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="คำตอบ"
            className="w-full min-h-[80px] rounded-lg border border-surface-200 px-3 py-2 text-sm"
            rows={3}
          />
          <div className="mt-4 flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} loading={submitting}>
              เพิ่ม
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
