"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { KnowledgeErrorState } from "@/components/clinic/KnowledgeErrorState";
import { KnowledgeDuplicateModal } from "@/components/clinic/KnowledgeDuplicateModal";
import { getMaxContentLength, validateKnowledgeContent } from "@/lib/knowledge-validation";
import type { KnowledgeTopicCategory, KnowledgeVersionPayload, KnowledgeChangeLogEntry } from "@/types/knowledge";

const CATEGORY_OPTIONS: { value: KnowledgeTopicCategory; label: string }[] = [
  { value: "service", label: "บริการ" },
  { value: "price", label: "ราคา" },
  { value: "faq", label: "คำถามที่พบบ่อย" },
];

function categoryLabel(cat: KnowledgeTopicCategory | undefined): string {
  return CATEGORY_OPTIONS.find((o) => o.value === (cat ?? "service"))?.label ?? cat ?? "";
}

export default function KnowledgeEditPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = typeof params.topicId === "string" ? params.topicId : "";

  const [form, setForm] = useState<Partial<KnowledgeVersionPayload>>({
    topic: "",
    category: "service",
    summary: [],
    content: "",
    exampleQuestions: [],
  });
  const [summaryInput, setSummaryInput] = useState("");
  const [exampleInput, setExampleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistLoading, setAssistLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assistWarning, setAssistWarning] = useState<string | null>(null);
  const [financialConfirm, setFinancialConfirm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicatePeerId, setDuplicatePeerId] = useState<string | null>(null);
  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupActionLoading, setDupActionLoading] = useState(false);
  const [topicUpdatedAt, setTopicUpdatedAt] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ latestUpdatedAt?: string; message?: string } | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [history, setHistory] = useState<KnowledgeChangeLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const maxLen = getMaxContentLength();
  const contentLength = form.content?.length ?? 0;

  const validationMessages = useMemo(() => {
    const messages: Array<{ level: "error" | "warning"; text: string }> = [];
    const content = form.content?.trim() ?? "";
    if (content && content.length < 50) {
      messages.push({ level: "error", text: "รายละเอียดต้องยาวอย่างน้อย 50 ตัวอักษร เพื่อคุณภาพคำตอบของ AI" });
    }
    const hasDigits = /\d/.test(content);
    const hasCurrency = /(บาท|฿|thb|baht)/i.test(content);
    if (hasDigits && !hasCurrency) {
      messages.push({ level: "warning", text: "พบตัวเลขราคา แต่ไม่พบสกุลเงิน (เช่น บาท / ฿) กรุณาระบุให้ชัดเจน" });
    }
    if (content.length > 5000) {
      messages.push({ level: "warning", text: "เนื้อหาเกิน 5,000 ตัวอักษร ระบบจะตัดแบ่งข้อความอัตโนมัติ" });
    }
    if (duplicateWarning) {
      messages.push({ level: "warning", text: duplicateWarning });
    }
    return messages;
  }, [form.content, duplicateWarning]);

  const handleAssist = async () => {
    if (!form.topic?.trim()) {
      setError("กรุณากรอกหัวข้อก่อน แล้วกดให้ AI ช่วยเขียน");
      return;
    }
    setError(null);
    setAssistLoading(true);
    try {
      const res = await fetch("/api/clinic/knowledge/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: form.topic.trim(),
          category: form.category ?? "service",
          optionalHint: form.content?.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error(data.error ?? "วันนี้ใช้ครบ 20 ครั้งแล้ว");
      if (!res.ok) throw new Error(data.error ?? "ขอคำแนะนำไม่สำเร็จ");
      if (data._warning) setAssistWarning(data._warning as string);
      const summary = Array.isArray(data.keyPoints) ? data.keyPoints : [];
      const sampleQuestions = Array.isArray(data.sampleQuestions) ? data.sampleQuestions : [];
      const contentLine = typeof data.summary === "string" ? data.summary : "";
      const contentBullets = summary.map((s: string) => `• ${s}`).join("\n");
      setForm((f) => ({
        ...f,
        summary,
        exampleQuestions: sampleQuestions,
        content: [contentLine, contentBullets].filter(Boolean).join("\n\n"),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssistLoading(false);
    }
  };

  const fetchTopic = useCallback(async () => {
    if (!topicId) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/clinic/knowledge/topics/${topicId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "โหลดไม่สำเร็จ");
      setTopicUpdatedAt(typeof data?.topic?.updatedAt === "string" ? data.topic.updatedAt : null);
      const active = data.activeVersion ?? data.versions?.[0];
      if (active) {
        setForm({
          topic: active.topic ?? data.topic?.topic ?? "",
          category: active.category ?? data.topic?.category ?? "service",
          summary: active.summary ?? [],
          content: active.content ?? "",
          exampleQuestions: active.exampleQuestions ?? [],
        });
      } else {
        setForm({
          topic: data.topic?.topic ?? "",
          category: data.topic?.category ?? "service",
          summary: [],
          content: "",
          exampleQuestions: [],
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }, [topicId]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/clinic/knowledge/change-log?limit=100", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      setHistory(entries.filter((entry: { topicId?: string }) => entry.topicId === topicId));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchTopic();
  }, [fetchTopic]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const topic = form.topic?.trim();
    if (!topic || topic.length < 2) {
      setDuplicateWarning(null);
      setDuplicatePeerId(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clinic/knowledge/topics?search=${encodeURIComponent(topic)}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        const topics = Array.isArray(data?.topics) ? data.topics : [];
        const match = topics.find(
          (item: { topic?: string; id?: string }) =>
            (item.topic ?? "").trim().toLowerCase() === topic.toLowerCase() && item.id !== topicId
        ) as { id?: string } | undefined;
        setDuplicatePeerId(match?.id ?? null);
        setDuplicateWarning(match ? "พบหัวข้อใกล้เคียง/ซ้ำในระบบแล้ว ควรตรวจสอบก่อนบันทึก" : null);
      } catch {
        setDuplicateWarning(null);
        setDuplicatePeerId(null);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [form.topic, topicId]);

  const addSummary = () => {
    const v = summaryInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, summary: [...(f.summary ?? []), v] }));
    setSummaryInput("");
  };

  const addExample = () => {
    const v = exampleInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, exampleQuestions: [...(f.exampleQuestions ?? []), v] }));
    setExampleInput("");
  };

  const runCreateFromEdit = async ({
    overwriteTopicId,
    forceCreateNew,
  }: {
    overwriteTopicId?: string;
    forceCreateNew?: boolean;
  }) => {
    setDupActionLoading(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/knowledge/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: form.topic?.trim(),
          category: form.category ?? "service",
          summary: form.summary ?? [],
          content: form.content?.trim(),
          exampleQuestions: form.exampleQuestions ?? [],
          confirmFinancial: true,
          overwriteTopicId,
          forceCreateNew,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setDupModalOpen(false);
      router.push("/clinic/knowledge");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setDupActionLoading(false);
    }
  };

  const handleSubmit = async (confirmFinancial = false) => {
    if (!form.topic?.trim() || !form.content?.trim()) {
      setError("กรุณากรอกหัวข้อและรายละเอียดทั้งหมด");
      return;
    }
    if ((form.content?.trim().length ?? 0) < 50) {
      setError("รายละเอียดต้องยาวอย่างน้อย 50 ตัวอักษร");
      return;
    }
    const contentValidation = validateKnowledgeContent(form.content.trim());
    if (!contentValidation.valid) {
      setError(contentValidation.message ?? "เนื้อหาไม่ถูกต้อง");
      return;
    }
    if (contentValidation.financialWarning && !confirmFinancial) {
      setFinancialConfirm(true);
      return;
    }
    setError(null);

    if (duplicatePeerId) {
      setDupModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/clinic/knowledge/topics/${topicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: form.topic.trim(),
          category: form.category ?? "service",
          summary: form.summary ?? [],
          content: form.content.trim(),
          exampleQuestions: form.exampleQuestions ?? [],
          confirmFinancial: confirmFinancial || contentValidation.financialWarning === true,
          expectedUpdatedAt: topicUpdatedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        if (data?.code === "DUPLICATE_TOPIC") {
          setDuplicatePeerId(typeof data?.existingTopicId === "string" ? data.existingTopicId : null);
          setDupModalOpen(true);
          return;
        }
        setConflictInfo({
          latestUpdatedAt: typeof data?.latestUpdatedAt === "string" ? data.latestUpdatedAt : undefined,
          message: typeof data?.error === "string" ? data.error : "Someone updated this topic. View latest version or overwrite?",
        });
        setShowConflictModal(true);
        return;
      }
      if (data.needsConfirmation && data.message) {
        setFinancialConfirm(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      }
      router.push("/clinic/knowledge");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleOverwriteAfterConflict = async () => {
    if (!conflictInfo) return;
    setShowConflictModal(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic/knowledge/topics/${topicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: form.topic?.trim(),
          category: form.category ?? "service",
          summary: form.summary ?? [],
          content: form.content?.trim(),
          exampleQuestions: form.exampleQuestions ?? [],
          confirmFinancial: false,
          forceOverwrite: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      router.push("/clinic/knowledge");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="space-y-8">
        <PageHeader title="แก้ไขข้อมูล" subtitle="กำลังโหลด..." />
        <div className="h-64 rounded-2xl bg-cream-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="แก้ไขข้อมูล"
        subtitle="ข้อมูลนี้จะถูกใช้โดย AI เพื่อตอบคำถามลูกค้าใน LINE และช่องทางออนไลน์อื่น ๆ"
      />

      <div className="luxury-card p-6">
        <div className="space-y-6 max-w-2xl">
          <div>
            <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
              หัวข้อ <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.topic ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="เช่น โบท็อกซ์, ฟิลเลอร์, เลเซอร์กำจัดขน"
              className="w-full"
            />
          </div>

          <div>
            <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
              ประเภท <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-2xl border border-cream-200 font-body text-base text-mauve-800 bg-white focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 focus:outline-none"
              value={form.category ?? "service"}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as KnowledgeTopicCategory }))}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleAssist}
              disabled={assistLoading || !form.topic?.trim()}
              loading={assistLoading}
            >
              ✨ ให้ AI ช่วยเขียน
            </Button>
            <span className="font-body text-sm text-mauve-400">กรอกหัวข้อและประเภทก่อน แล้วกดปุ่มนี้</span>
          </div>

          <div>
            <label className="block font-body text-sm font-medium text-mauve-700 mb-1">สรุปสั้น ๆ</label>
            <div className="flex gap-2">
              <Input
                value={summaryInput}
                onChange={(e) => setSummaryInput(e.target.value)}
                placeholder="เช่น ใช้เวลา 30 นาที"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSummary())}
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="md" onClick={addSummary}>
                เพิ่ม
              </Button>
            </div>
            {(form.summary ?? []).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 list-disc list-inside font-body text-mauve-600 text-sm">
                {(form.summary ?? []).map((s, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {s}
                    <button
                      type="button"
                      className="text-mauve-400 hover:text-red-600"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          summary: (f.summary ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
              รายละเอียดทั้งหมด <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="w-full min-h-[200px] resize-y"
              value={form.content ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="กรอกรายละเอียดที่ AI จะใช้ตอบลูกค้า (สามารถใช้ bullet และย่อหน้าได้)"
              maxLength={maxLen + 100}
            />
            <p className="mt-1 font-body text-sm text-mauve-400">
              {contentLength} / {maxLen.toLocaleString()} ตัวอักษร
            </p>
          </div>

          <div>
            <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
              ตัวอย่างคำถามที่ลูกค้าอาจถาม (ไม่บังคับ)
            </label>
            <div className="flex gap-2">
              <Input
                value={exampleInput}
                onChange={(e) => setExampleInput(e.target.value)}
                placeholder="เช่น โบท็อกซ์กี่บาท"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExample())}
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="md" onClick={addExample}>
                เพิ่ม
              </Button>
            </div>
            {(form.exampleQuestions ?? []).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 list-disc list-inside font-body text-mauve-600 text-sm">
                {(form.exampleQuestions ?? []).map((q, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {q}
                    <button
                      type="button"
                      className="text-mauve-400 hover:text-red-600"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          exampleQuestions: (f.exampleQuestions ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <KnowledgeErrorState message={error} onRetry={fetchTopic} />
          )}
          {validationMessages.length > 0 && (
            <div className="rounded-2xl border border-cream-200 bg-white p-4">
              <p className="font-body text-sm font-semibold text-mauve-700">Validation checks</p>
              <ul className="mt-2 space-y-1 font-body text-sm">
                {validationMessages.map((msg, idx) => (
                  <li key={idx} className={msg.level === "error" ? "text-red-700" : "text-amber-700"}>
                    {msg.level === "error" ? "• [Error] " : "• [Warning] "}
                    {msg.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assistWarning && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 font-body text-amber-800 text-sm">
              {assistWarning}
            </div>
          )}

          {financialConfirm && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 font-body text-amber-800 text-sm">
              <p className="font-medium">ข้อมูลด้านการเงินไม่ควรใส่ในส่วนนี้</p>
              <p className="mt-1">หากยืนยันว่าต้องการบันทึก กรุณากด &quot;บันทึกหลังยืนยัน&quot;</p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setFinancialConfirm(false)}>
                  แก้ไขเนื้อหา
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleSubmit(true)} loading={loading}>
                  บันทึกหลังยืนยัน
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSubmit(false)}
              disabled={loading || !!financialConfirm}
              loading={loading}
            >
              บันทึก
            </Button>
            <Link href="/clinic/knowledge">
              <Button variant="ghost" size="md">ยกเลิก</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="luxury-card p-6">
        <h3 className="font-display text-lg font-semibold text-mauve-800">History</h3>
        {historyLoading ? (
          <div className="mt-3 h-20 rounded-xl bg-cream-100 animate-pulse" />
        ) : history.length === 0 ? (
          <p className="mt-3 font-body text-sm text-mauve-500">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
        ) : (
          <ul className="mt-3 divide-y divide-cream-200">
            {history.map((entry) => (
              <li key={entry.id} className="py-2">
                <p className="font-body text-sm text-mauve-700">
                  {entry.action} by {entry.userId || "unknown"} • {new Date(entry.createdAt).toLocaleString("th-TH")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <KnowledgeDuplicateModal
        open={dupModalOpen}
        onClose={() => setDupModalOpen(false)}
        existingTopicId={duplicatePeerId ?? ""}
        newTopicTitle={form.topic?.trim() ?? ""}
        newCategoryLabel={categoryLabel(form.category)}
        newContent={form.content?.trim() ?? ""}
        loadingAction={dupActionLoading}
        onUseExisting={() => {
          if (duplicatePeerId) router.push(`/clinic/knowledge/${duplicatePeerId}/edit`);
        }}
        onOverwriteExisting={() => {
          if (!duplicatePeerId) return;
          void runCreateFromEdit({ overwriteTopicId: duplicatePeerId });
        }}
        onCreateAsNew={() => void runCreateFromEdit({ forceCreateNew: true })}
      />

      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-luxury-xl">
            <h3 className="font-display text-lg font-semibold text-mauve-800">Version conflict detected</h3>
            <p className="mt-2 font-body text-sm text-mauve-600">
              {conflictInfo?.message ?? "Someone updated this topic. View latest version or overwrite?"}
            </p>
            {conflictInfo?.latestUpdatedAt ? (
              <p className="mt-1 font-body text-xs text-mauve-500">
                Latest update: {new Date(conflictInfo.latestUpdatedAt).toLocaleString("th-TH")}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={fetchTopic}>View latest version</Button>
              <Button variant="primary" size="sm" onClick={handleOverwriteAfterConflict}>Overwrite</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
