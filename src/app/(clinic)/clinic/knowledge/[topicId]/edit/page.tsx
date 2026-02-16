"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { getMaxContentLength } from "@/lib/knowledge-validation";
import type { KnowledgeTopicCategory, KnowledgeVersionPayload } from "@/types/knowledge";

const CATEGORY_OPTIONS: { value: KnowledgeTopicCategory; label: string }[] = [
  { value: "service", label: "บริการ" },
  { value: "price", label: "ราคา" },
  { value: "faq", label: "คำถามที่พบบ่อย" },
];

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
  const maxLen = getMaxContentLength();

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
      if (data._warning) setError(data._warning);
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

  useEffect(() => {
    fetchTopic();
  }, [fetchTopic]);

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

  const handleSubmit = async (confirmFinancial = false) => {
    if (!form.topic?.trim() || !form.content?.trim()) {
      setError("กรุณากรอกหัวข้อและรายละเอียดทั้งหมด");
      return;
    }
    setError(null);
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
          confirmFinancial: confirmFinancial,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.needsConfirmation && data.message) {
        setFinancialConfirm(true);
        setLoading(false);
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

  if (fetching) {
    return (
      <div className="space-y-8">
        <PageHeader title="แก้ไขข้อมูล" description="กำลังโหลด..." />
        <div className="h-64 rounded-2xl bg-surface-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="แก้ไขข้อมูล"
        description="ข้อมูลนี้จะถูกใช้โดย AI เพื่อตอบคำถามลูกค้าใน LINE และช่องทางออนไลน์อื่น ๆ"
      />

      <Card padding="lg">
        <div className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              หัวข้อ <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.topic ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="เช่น โบท็อกซ์, ฟิลเลอร์, เลเซอร์กำจัดขน"
              className="w-full text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              ประเภท <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-surface-200 text-base focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-white"
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
            <span className="text-sm text-surface-500">กรอกหัวข้อและประเภทก่อน แล้วกดปุ่มนี้</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">สรุปสั้น ๆ</label>
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
              <ul className="mt-2 flex flex-wrap gap-2 list-disc list-inside text-surface-600 text-sm">
                {(form.summary ?? []).map((s, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {s}
                    <button
                      type="button"
                      className="text-surface-400 hover:text-red-600"
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
            <label className="block text-sm font-medium text-surface-700 mb-1">
              รายละเอียดทั้งหมด <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-surface-200 text-base focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 min-h-[200px] resize-y"
              value={form.content ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="กรอกรายละเอียดที่ AI จะใช้ตอบลูกค้า (สามารถใช้ bullet และย่อหน้าได้)"
              maxLength={maxLen + 100}
            />
            <p className="mt-1 text-sm text-surface-500">
              {form.content?.length ?? 0} / {maxLen.toLocaleString()} ตัวอักษร
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
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
              <ul className="mt-2 flex flex-wrap gap-2 list-disc list-inside text-surface-600 text-sm">
                {(form.exampleQuestions ?? []).map((q, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {q}
                    <button
                      type="button"
                      className="text-surface-400 hover:text-red-600"
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
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
              {error}
            </div>
          )}
          {assistWarning && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {assistWarning}
            </div>
          )}

          {financialConfirm && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
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
      </Card>
    </div>
  );
}
