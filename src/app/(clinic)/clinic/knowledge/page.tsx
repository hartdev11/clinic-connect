"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { DuplicateWarningModal } from "@/components/clinic/DuplicateWarningModal";
import { useClinicContext } from "@/contexts/ClinicContext";
import { isKnowledgeWashingMachineEnabled } from "@/lib/feature-flags";
import type { KnowledgeDocumentCreate, DuplicateResult, ConflictResolution } from "@/types/knowledge";

export default function KnowledgeInputPage() {
  const { currentOrg } = useClinicContext();
  const [form, setForm] = useState<Partial<KnowledgeDocumentCreate>>({
    level: "org",
    topic: "",
    category: "service",
    key_points: [],
    text: "",
    is_active: true,
    source: "manual",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status?: string;
    message?: string;
    duplicate?: DuplicateResult;
    id?: string;
  } | null>(null);
  const [keyPointInput, setKeyPointInput] = useState("");
  const [showWashingMachine, setShowWashingMachine] = useState(false);
  const [exactDuplicate, setExactDuplicate] = useState<DuplicateResult | null>(null);

  const isEnterprise = currentOrg?.plan === "enterprise";
  const washingMachineEnabled = isEnterprise && isKnowledgeWashingMachineEnabled(currentOrg?.plan);

  const handleSubmit = async (resolution?: ConflictResolution) => {
    if (!form.topic?.trim() || !form.category?.trim() || !form.text?.trim()) {
      setResult({ status: "error", message: "กรอก topic, category, text ให้ครบ" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/clinic/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          doc: {
            ...form,
            key_points: form.key_points ?? [],
          },
          conflictResolution: resolution,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error");
      }
      
      // FE-4: Exact match → block; Semantic > 0.85 → modal
      if (data.status === "needs_resolution" && data.duplicate) {
        if (data.duplicate.type === "exact") {
          setExactDuplicate(data.duplicate);
          setResult({ status: "error", message: "พบข้อความซ้ำ exactly — ไม่สามารถบันทึกได้" });
          return;
        }
        // Semantic similarity → show modal
        setResult(data);
        return;
      }
      
      setResult(data);
      setExactDuplicate(null);
      if (data.status === "saved" || data.status === "replaced" || data.status === "kept" || data.status === "cancelled") {
        setForm({ ...form, topic: "", text: "", key_points: [] });
      }
    } catch (err) {
      setResult({ status: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const addKeyPoint = () => {
    const v = keyPointInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, key_points: [...(f.key_points ?? []), v] }));
    setKeyPointInput("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Knowledge Input"
        description="E5.7–E5.9 — เพิ่มความรู้เข้าระบบ Structured Input → Duplicate Detection → Save → Embed → Vector DB"
      />

      <section>
        <SectionHeader
          title="Structured Input"
          description="กรอกข้อมูล knowledge — ถ้าพบซ้ำจะแจ้ง Replace / Keep / Cancel"
        />
        <Card padding="lg">
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Topic</label>
              <Input
                value={form.topic ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="filler"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Category</label>
              <select
                className="w-full px-4 py-2 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                value={form.category ?? "service"}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="service">service</option>
                <option value="price">price</option>
                <option value="faq">faq</option>
                <option value="promotion">promotion</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Key points</label>
              <div className="flex gap-2">
                <Input
                  value={keyPointInput}
                  onChange={(e) => setKeyPointInput(e.target.value)}
                  placeholder="ราคา 8,000–20,000"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyPoint())}
                />
                <Button variant="secondary" size="md" onClick={addKeyPoint}>
                  เพิ่ม
                </Button>
              </div>
              {(form.key_points ?? []).length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {(form.key_points ?? []).map((kp, i) => (
                    <li key={i}>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-100 text-sm">
                        {kp}
                        <button
                          type="button"
                          className="text-surface-400 hover:text-red-600"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              key_points: (f.key_points ?? []).filter((_, j) => j !== i),
                            }))
                          }
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Content (ข้อความที่ embed)</label>
              <textarea
                className="w-full px-4 py-2 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 min-h-[120px]"
                value={form.text ?? ""}
                onChange={(e) => {
                  setForm((f) => ({ ...f, text: e.target.value }));
                  setExactDuplicate(null);
                  setResult(null);
                }}
                placeholder="ฟิลเลอร์ช่วยปรับรูปหน้า เติมเต็มร่องลึก ราคาเริ่มต้นประมาณ 8,000–20,000 บาท..."
              />
            </div>
            {washingMachineEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="washing-machine"
                  checked={showWashingMachine}
                  onChange={(e) => setShowWashingMachine(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="washing-machine" className="text-sm text-surface-700">
                  ใช้ Knowledge Washing Machine (Enterprise)
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => handleSubmit()}
                disabled={loading || !!exactDuplicate}
              >
                {loading ? "กำลังตรวจสอบ..." : "บันทึก"}
              </Button>
            </div>
          </div>
        </Card>

        {exactDuplicate && (
          <Card padding="lg" className="mt-4 border-red-200 bg-red-50">
            <p className="font-medium text-red-800 mb-2">❌ พบข้อความซ้ำ exactly</p>
            <p className="text-sm text-red-700 mb-2">
              เอกสารเดิม: {exactDuplicate.existing.topic} / {exactDuplicate.existing.category}
            </p>
            <p className="text-sm text-red-600">ไม่สามารถบันทึกได้ — กรุณาแก้ไขข้อความหรือใช้เอกสารเดิม</p>
          </Card>
        )}

        {result?.status === "needs_resolution" && result.duplicate && result.duplicate.type === "semantic" && (
          <DuplicateWarningModal
            duplicate={result.duplicate}
            onResolve={(action) => handleSubmit(action)}
            loading={loading}
          />
        )}

        {result?.status && result.status !== "needs_resolution" && (
          <Card padding="lg" className="mt-4 border-green-200 bg-green-50">
            <p className="font-medium text-green-800">{result.message}</p>
            {result.id && <p className="text-sm text-green-700 mt-1">ID: {result.id}</p>}
          </Card>
        )}

        {result?.status === "error" && (
          <Card padding="lg" className="mt-4 border-red-200 bg-red-50">
            <p className="font-medium text-red-800">{result.message}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
