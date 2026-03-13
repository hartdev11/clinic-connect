"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bars3Icon } from "@heroicons/react/24/outline";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  UnifiedKnowledgeStatus,
  GlobalService,
  ClinicService,
  ClinicFaq,
} from "@/types/unified-knowledge";

const PAGE_TITLE = "Knowledge Base";
const PAGE_SUBTITLE = "จัดการข้อมูลที่ AI ใช้ตอบคำถามลูกค้า";

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
          <div key={i} className="h-28 rounded-2xl bg-cream-200 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!status) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
      <div className="luxury-card p-6">
        <h4 className="font-body text-sm font-medium text-mauve-600">ความรู้มาตรฐานจากแพลตฟอร์ม</h4>
        <p className="mt-2 font-display text-lg font-semibold text-mauve-800">
          {status.global.active ? "Active" : "—"}
        </p>
        <p className="mt-1 font-body text-xs text-mauve-400">Version {status.global.version}</p>
      </div>
      <div className="luxury-card p-6">
        <h4 className="font-body text-sm font-medium text-mauve-600">ข้อมูลของคลินิกคุณ</h4>
        <p className="mt-2 font-display text-lg font-semibold text-mauve-800">
          {status.clinic.active ? "Active" : "—"}
        </p>
        <p className="mt-1 font-body text-xs text-mauve-400">
          อัปเดตล่าสุด {formatDate(status.clinic.last_updated)}
        </p>
        <Badge variant={status.clinic.embedding_status === "ok" ? "default" : "warning"} className="mt-2" size="sm">
          {status.clinic.embedding_status === "ok" ? "พร้อมใช้งาน" : "มีปัญหา"}
        </Badge>
        {status.clinic.last_embedding_at && (
          <p className="mt-1 font-body text-xs text-mauve-400">
            ฝังล่าสุด {formatDate(status.clinic.last_embedding_at)}
          </p>
        )}
      </div>
      <div className="luxury-card p-6">
        <h4 className="font-body text-sm font-medium text-mauve-600">โปรโมชันปัจจุบัน</h4>
        <p className="mt-2 font-display text-lg font-semibold text-mauve-800">
          {status.promotions.active_count} โปรโมชัน
        </p>
        {status.promotions.expiry_warnings > 0 && (
          <Badge variant="warning" className="mt-2" size="sm">
            หมดอายุใน 7 วัน: {status.promotions.expiry_warnings}
          </Badge>
        )}
      </div>
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
    <div className="luxury-card p-6">
      {titleReadOnly ? (
        <h3 className="font-display text-lg font-semibold text-mauve-800">{displayName}</h3>
      ) : (
        <Input
          value={custom_title}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="ชื่อบริการ"
          className="w-full font-display text-lg font-semibold text-mauve-800 border-0 border-b border-transparent hover:border-cream-300 focus:border-rg-400 rounded-none px-0"
        />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {global && (
          <Badge variant="info" size="sm">
            Template v{global.version}
            {service.template_version_at_embed != null && ` (ฝังเมื่อ v${service.template_version_at_embed})`}
          </Badge>
        )}
        {templateUpdateAvailable && (
          <Badge variant="warning" size="sm">มีเทมเพลตเวอร์ชันใหม่</Badge>
        )}
        {service.status === "embedding_failed" && (
          <Badge variant="warning" size="sm">อัปเดตข้อมูลไม่สำเร็จ — กดบันทึกเพื่อลองใหม่</Badge>
        )}
        {service.status === "active" && !templateUpdateAvailable && (
          <Badge variant="default" size="sm">พร้อมใช้งาน</Badge>
        )}
      </div>
      {global?.standard_description && (
        <div className="mt-3 rounded-2xl bg-cream-100 p-3 font-body text-sm text-mauve-600">
          {global.compliance_locked ? (
            <span className="text-mauve-400">(ข้อความมาตรฐาน — ไม่สามารถแก้ไข)</span>
          ) : null}
          <p className="mt-1">{global.standard_description}</p>
        </div>
      )}
      <hr className="my-4 border-cream-200" />
      <div className="space-y-3">
        <label className="block font-body text-sm font-medium text-mauve-700">จุดเด่นของคลินิกคุณ</label>
        <Input
          value={custom_highlight}
          onChange={(e) => setCustomHighlight(e.target.value)}
          placeholder="จุดเด่นหรือข้อความโปรโมท"
          className="w-full"
        />
        <label className="block font-body text-sm font-medium text-mauve-700">ราคา</label>
        <Input
          value={custom_price}
          onChange={(e) => setCustomPrice(e.target.value)}
          placeholder="ช่วงราคา หรือราคาเริ่มต้น"
          className="w-full"
        />
        <label className="block font-body text-sm font-medium text-mauve-700">รายละเอียดเพิ่มเติม</label>
        <Textarea
          value={custom_description}
          onChange={(e) => setCustomDescription(e.target.value)}
          placeholder="รายละเอียดเพิ่มเติม"
          className="w-full min-h-[80px] rounded-2xl border-cream-200"
          rows={3}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-body text-sm text-mauve-700">
          <input
            type="checkbox"
            checked={status === "active"}
            onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
            className="rounded border-cream-300 text-rg-500 focus:ring-rg-400"
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
          >
            เก็บถาวร
          </Button>
        )}
      </div>
      {archiveConfirm && onArchive && (
        <div className="mt-4 rounded-2xl border border-cream-200 bg-cream-50 p-4">
          <p className="font-body text-sm text-mauve-700">ต้องการเก็บบริการนี้เข้าถาวรหรือไม่? ข้อมูลจะไม่แสดงใน AI</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => { onArchive(service.id); setArchiveConfirm(false); }}>
              ยืนยัน
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setArchiveConfirm(false)}>ยกเลิก</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FAQ tab ──────────────────────────────────────────────────────────────

function FaqItem({
  item,
  onSave,
  onDelete,
  dragHandle,
}: {
  item: ClinicFaq;
  onSave: (id: string, payload: { question?: string; answer?: string }) => void;
  onDelete: (id: string) => void;
  dragHandle?: React.ReactNode;
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
    <div className="rounded-2xl border border-cream-200 bg-white luxury-card overflow-hidden">
      <div className="flex items-stretch">
        {dragHandle}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 min-w-0 items-center justify-between gap-2 px-4 py-3 text-left font-body text-sm font-medium text-mauve-800 hover:bg-cream-50 transition-colors"
        >
          <span className="line-clamp-1">{question || "(ไม่มีคำถาม)"}</span>
          <span className="flex shrink-0 items-center gap-1">
            {item.status === "embedding_failed" && (
              <Badge variant="warning" size="sm">มีปัญหา</Badge>
            )}
            <span className="text-mauve-400">{open ? "▲" : "▼"}</span>
          </span>
        </button>
      </div>
      {open && (
        <div className="border-t border-cream-200 px-4 py-3 bg-cream-50/50">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="คำถาม"
            className="mb-3 w-full"
          />
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="คำตอบ"
            className="mb-3 w-full min-h-[80px] rounded-2xl border-cream-200"
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

function SortableFaqItem({
  item,
  onSave,
  onDelete,
}: {
  item: ClinicFaq;
  onSave: (id: string, payload: { question?: string; answer?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="flex shrink-0 items-center justify-center w-10 cursor-grab active:cursor-grabbing text-cream-400 hover:text-cream-600 transition-colors"
      aria-label="ลากเพื่อจัดเรียง"
    >
      <Bars3Icon className="h-5 w-5" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-all duration-200 ease-out",
        isDragging && "opacity-90 shadow-luxury-lg z-10"
      )}
    >
      <FaqItem item={item} onSave={onSave} onDelete={onDelete} dragHandle={handle} />
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

  const handleReorderFaq = useCallback(
    async (newOrder: string[]) => {
      const res = await fetch("/api/clinic/unified-knowledge/faq/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: newOrder }),
      });
      if (res.ok) {
        setToast("จัดเรียงแล้ว");
      } else {
        const data = await res.json().catch(() => ({}));
        setToast(data.error ?? "จัดเรียงไม่สำเร็จ");
      }
    },
    []
  );

  const faqSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFaqDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = faqItems.findIndex((f) => f.id === active.id);
      const newIndex = faqItems.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(faqItems, oldIndex, newIndex);
      setFaqItems(reordered);
      handleReorderFaq(reordered.map((f) => f.id));
    },
    [faqItems, handleReorderFaq]
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

  const handleAddTopic = () => {
    if (tab === "services") setAddServiceOpen(true);
    else if (tab === "faq") setAddFaqOpen(true);
  };

  const knowledgeTabs = [
    { value: "services" as const, label: "บริการ" },
    { value: "faq" as const, label: "คำถามที่พบบ่อย" },
    { value: "promotions" as const, label: "โปรโมชัน" },
  ];

  return (
    <div className="min-h-screen bg-cream-50/30">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4">
        <PageHeader
          title={PAGE_TITLE}
          subtitle={PAGE_SUBTITLE}
          actions={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleProcessQueue}
                disabled={processQueueLoading}
                loading={processQueueLoading}
              >
                ⬢ Sync ทั้งหมด
              </Button>
              <Button
                variant="primary"
                size="sm"
                shimmer
                onClick={handleAddTopic}
                disabled={tab === "promotions"}
              >
                + เพิ่มหัวข้อ
              </Button>
            </div>
          }
        />
        <section className="mb-8">
          {status?.ai_status != null && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-luxury">
              <span className="font-body text-sm font-medium text-mauve-700">สถานะ AI:</span>
              <Badge variant={status.ai_status === "issue" ? "warning" : "default"} size="sm">
                {status.ai_status === "ready" && "พร้อมใช้งาน"}
                {status.ai_status === "updating" && "กำลังอัปเดต"}
                {status.ai_status === "issue" && "มีปัญหา"}
              </Badge>
              {status.clinic.last_embedding_at && (
                <span className="font-body text-xs text-mauve-400">
                  ฝังล่าสุด {formatDate(status.clinic.last_embedding_at)}
                </span>
              )}
              {status.clinic.warning_count > 0 && (
                <Badge variant="warning" size="sm">คำเตือน {status.clinic.warning_count}</Badge>
              )}
            </div>
          )}
          <StatusCards status={status} loading={loadingStatus} />
          {processQueueMessage && (
            <p className="mt-3 font-body text-sm text-mauve-600">{processQueueMessage}</p>
          )}
          {status?.platform_managed_mode && (
            <div className="mt-4 rounded-2xl border border-rg-200/80 bg-rg-50/60 px-4 py-2 font-body text-sm text-mauve-800">
              โหมดจัดการโดยแพลตฟอร์ม: คุณแก้ไขได้เฉพาะ จุดเด่น ราคา และรายละเอียดเพิ่มเติม เทมเพลตบริการมาจากแพลตฟอร์ม
            </div>
          )}
        </section>

        <div className="flex gap-1 p-1 bg-cream-200 rounded-2xl mb-6 w-fit">
          {knowledgeTabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-body font-medium transition-all duration-200",
                tab === t.value
                  ? "bg-white text-mauve-700 shadow-luxury"
                  : "text-mauve-400 hover:text-mauve-600"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "services" && (
          <section>
            {loadingServices ? (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-2xl bg-cream-200 animate-pulse" />
                ))}
              </div>
            ) : clinicServices.length === 0 ? (
              <div className="luxury-card p-6">
                <EmptyState
                  icon={<span className="text-2xl">◇</span>}
                  title="ยังไม่มีบริการ"
                  description="กด &quot;+ เพิ่มหัวข้อ&quot; เพื่อเพิ่มบริการจากเทมเพลตหรือสร้างเอง"
                  action={
                    <Button variant="primary" size="md" onClick={() => setAddServiceOpen(true)}>
                      + เพิ่มบริการ
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {clinicServices.map((svc, i) => {
                  const global = svc.global_service_id
                    ? globalServices.find((g) => g.id === svc.global_service_id) ?? null
                    : null;
                  return (
                    <motion.div
                      key={svc.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <ServiceCard
                        service={svc}
                        global={global}
                        platformManagedMode={status?.platform_managed_mode}
                        onSave={handleSaveService}
                        onArchive={handleArchiveService}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "faq" && (
          <section>
            {loadingFaq ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-2xl bg-cream-200 animate-pulse" />
                ))}
              </div>
            ) : faqItems.length === 0 ? (
              <div className="luxury-card p-6">
                <EmptyState
                  icon={<span className="text-2xl">◎</span>}
                  title="ยังไม่มีคำถามที่พบบ่อย"
                  action={
                    <Button variant="primary" size="md" onClick={() => setAddFaqOpen(true)}>
                      + เพิ่มคำถาม
                    </Button>
                  }
                />
              </div>
            ) : (
              <DndContext
                sensors={faqSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleFaqDragEnd}
              >
                <SortableContext
                  items={faqItems.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {faqItems.map((item) => (
                      <SortableFaqItem
                        key={item.id}
                        item={item}
                        onSave={handleSaveFaq}
                        onDelete={handleDeleteFaq}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
        )}

        {tab === "promotions" && (
          <section>
            <div className="luxury-card p-6">
              <p className="font-body text-mauve-600">
                จัดการโปรโมชันและโปรโมชันที่กำลังหมดอายุได้ที่หน้ารายการโปรโมชัน
              </p>
              <Link href="/clinic/promotions">
                <Button variant="primary" size="md" className="mt-4">
                  ไปที่หน้ารายการโปรโมชัน
                </Button>
              </Link>
            </div>
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
            className="fixed bottom-4 right-4 z-50 rounded-2xl bg-mauve-800 px-4 py-2 font-body text-sm text-white shadow-luxury"
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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 luxury-card p-6 shadow-luxury"
        role="dialog"
        aria-labelledby="add-service-title"
      >
        <h2 id="add-service-title" className="font-display text-lg font-semibold text-mauve-800">
          เพิ่มบริการ
        </h2>
        {platformManagedMode && (
          <p className="mt-1 font-body text-xs text-mauve-400">โหมดจัดการโดยแพลตฟอร์ม: ต้องเลือกเทมเพลตจากแพลตฟอร์ม</p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block font-body text-sm font-medium text-mauve-700">
            {platformManagedMode ? "เทมเพลต *" : "เทมเพลต (ถ้ามี)"}
          </label>
          <select
            value={selectedGlobalId}
            onChange={(e) => {
              setSelectedGlobalId(e.target.value);
              const g = globalServices.find((x) => x.id === e.target.value);
              if (g && !customTitle) setCustomTitle(g.name);
            }}
            className="w-full rounded-2xl border border-cream-200 px-3 py-2 font-body text-sm text-mauve-800 bg-white focus:border-rg-400 focus:outline-none focus:ring-1 focus:ring-rg-400"
            required={platformManagedMode}
          >
            {!platformManagedMode && <option value="">— ไม่ใช้เทมเพลต —</option>}
            {globalServices.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <label className="block font-body text-sm font-medium text-mauve-700">ชื่อบริการ *</label>
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="ชื่อบริการ"
            required
            className="w-full"
          />
          <div className="mt-4 flex gap-2 justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting} loading={submitting}>
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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 luxury-card p-6 shadow-luxury"
        role="dialog"
        aria-labelledby="add-faq-title"
      >
        <h2 id="add-faq-title" className="font-display text-lg font-semibold text-mauve-800">
          เพิ่มคำถามที่พบบ่อย
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block font-body text-sm font-medium text-mauve-700">คำถาม *</label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="คำถาม"
            required
            className="w-full"
          />
          <label className="block font-body text-sm font-medium text-mauve-700">คำตอบ</label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="คำตอบ"
            className="w-full min-h-[80px] rounded-2xl border-cream-200"
            rows={3}
          />
          <div className="mt-4 flex gap-2 justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting} loading={submitting}>
              เพิ่ม
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
