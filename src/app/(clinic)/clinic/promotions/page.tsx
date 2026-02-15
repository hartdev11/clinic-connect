"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";
import type { Promotion, PromotionStatus, PromotionTargetGroup } from "@/types/clinic";

const STATUS_OPTIONS: { value: PromotionStatus | "all"; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "กำลังใช้งาน" },
  { value: "scheduled", label: "กำหนดเวลา" },
  { value: "expired", label: "หมดอายุ" },
  { value: "archived", label: "เก็บถาวร" },
  { value: "draft", label: "แบบร่าง" },
];

const STATUS_DOT_COLOR: Record<string, string> = {
  active: "#059669",
  scheduled: "#2563EB",
  expired: "#94A3B8",
  archived: "#64748B",
  draft: "#94A3B8",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** Promotion Intelligence Overview — 4 soft metric cards, no shadow */
function PromotionOverview({ stats }: { stats: { active: number; expiringSoon: number; scheduled: number; expired: number } }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[
        { key: "active", label: "กำลังใช้งาน", value: stats.active },
        { key: "expiringSoon", label: "หมดอายุภายใน 3 วัน", value: stats.expiringSoon },
        { key: "scheduled", label: "กำหนดเวลา", value: stats.scheduled },
        { key: "expired", label: "หมดอายุ", value: stats.expired },
      ].map(({ key, label, value }) => (
        <div key={key} className="bg-[#FAFAFA] rounded-[12px] p-6 transition-transform duration-[90ms] ease-out hover:scale-[1.01]">
          <p className="text-[32px] font-semibold text-neutral-900 tabular-nums leading-[1.2] tracking-[-0.01em]">{value}</p>
          <p className="text-[13px] font-medium text-neutral-500 leading-[1.4] mt-2">{label}</p>
        </div>
      ))}
    </section>
  );
}

/** List row: thumbnail, name, AI-detected procedure chips, expiring soon, usage, status dot, actions */
function PromotionRow({
  item,
  branches,
  onEdit,
  onMutate,
}: {
  item: Promotion;
  branches: Array<{ id: string; name: string }>;
  onEdit: () => void;
  onMutate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const hasCover = item.media?.[0]?.type === "image";
  const coverUrl = hasCover ? `/api/clinic/promotions/${item.id}/cover` : null;
  const dotColor = STATUS_DOT_COLOR[item.status] ?? "#94A3B8";
  const branchNames = item.branchIds.map((id) => branches.find((b) => b.id === id)?.name ?? id).filter(Boolean);
  const procedures = item.extractedProcedures ?? [];
  const endAtMs = item.endAt ? new Date(item.endAt).getTime() : 0;
  const expiringSoon = endAtMs > 0 && endAtMs <= Date.now() + 3 * 86400000;

  const handleDelete = async () => {
    if (!confirm("ลบโปรโมชั่นนี้?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic/promotions?id=${item.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) onMutate();
      else throw new Error((await res.json()).error);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: "archived" }),
        credentials: "include",
      });
      if (res.ok) onMutate();
      else throw new Error((await res.json()).error);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex items-center gap-4 py-3 px-4 rounded-[10px] bg-white hover:bg-[#F2F2F7] transition-all duration-[90ms] ease-out hover:scale-[1.01] min-h-0 leading-[1.4]"
      style={{ transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}
    >
      <div className="shrink-0 w-16 h-16 rounded-[10px] bg-neutral-100 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[12px] text-neutral-400">ไม่มีรูป</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-neutral-800 text-[15px] truncate">{item.name}</p>
          {item.extractedPrice != null && (
            <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">฿{item.extractedPrice.toLocaleString()}</span>
          )}
          {expiringSoon && item.status === "active" && (
            <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">หมดอายุเร็วๆ นี้</span>
          )}
        </div>
        {procedures.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {procedures.slice(0, 4).map((proc, i) => (
              <span key={i} className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                {proc}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
          {branchNames.length ? <span className="text-[12px] text-neutral-500">{branchNames.join(", ")}</span> : null}
          <span className="text-[12px] text-neutral-500">หมดอายุ: {item.endAt ? formatDate(item.endAt) : "—"}</span>
          {(item.currentUsage != null || item.maxUsage != null) && (
            <span className="text-[12px] text-neutral-500 tabular-nums">
              ใช้แล้ว {item.currentUsage ?? 0}{item.maxUsage != null ? ` / ${item.maxUsage}` : ""}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[12px] text-neutral-600">
            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} aria-hidden />
            {item.status}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium bg-transparent text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100 disabled:opacity-50"
          onClick={onEdit}
          disabled={loading}
        >
          แก้ไข
        </button>
        {item.status !== "archived" && (
          <button
            type="button"
            className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium text-neutral-600 hover:bg-[#F2F2F7] transition-colors duration-100 disabled:opacity-50"
            onClick={handleArchive}
            disabled={loading}
          >
            เก็บถาวร
          </button>
        )}
        <button
          type="button"
          className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium text-red-600 hover:bg-red-50/50 transition-colors duration-100 disabled:opacity-50"
          onClick={handleDelete}
          disabled={loading}
        >
          ลบ
        </button>
      </div>
    </div>
  );
}

/** AI-first creation: upload image -> scan -> editable preview -> save (from-scan API) */
function CreateFromImageModal({
  branches,
  onClose,
  onSuccess,
}: {
  branches: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"upload" | "analyzing" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [tempUploadId, setTempUploadId] = useState<string | null>(null);
  const [tempExt, setTempExt] = useState<string>("jpg");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extractedProcedures, setExtractedProcedures] = useState<string[]>([]);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [extractedBenefits, setExtractedBenefits] = useState<string[]>([]);
  const [extractedPrice, setExtractedPrice] = useState<string>("");
  const [extractedDiscount, setExtractedDiscount] = useState<string>("");
  const [urgencyScore, setUrgencyScore] = useState<number | null>(null);
  const [imageSummary, setImageSummary] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);

  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [visibleToAI, setVisibleToAI] = useState(true);
  const [maxUsage, setMaxUsage] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleBranch = (id: string) => {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const addChip = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    const v = value.trim();
    if (v && !list.includes(v)) setList((prev) => [...prev, v]);
  };
  const removeChip = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setList((prev) => prev.filter((x) => x !== item));
  };

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep("analyzing");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/clinic/promotions/upload-temp", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed");
      setPreviewUrl(uploadData.url);
      setTempUploadId(uploadData.uploadId);
      setTempExt(uploadData.ext ?? "jpg");

      const scanRes = await fetch("/api/clinic/promotions/scan-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadData.url }),
        credentials: "include",
      });
      const scanData = await scanRes.json();
      if (!scanRes.ok) throw new Error(scanData.reason ?? scanData.error ?? "Could not analyze image");
      const ex = scanData.extracted ?? {};
      setExtractedProcedures(Array.isArray(ex.extractedProcedures) ? ex.extractedProcedures : []);
      setExtractedKeywords(Array.isArray(ex.extractedKeywords) ? ex.extractedKeywords : []);
      setExtractedBenefits(Array.isArray(ex.extractedBenefits) ? ex.extractedBenefits : []);
      setExtractedPrice(ex.extractedPrice != null ? String(ex.extractedPrice) : "");
      setExtractedDiscount(ex.extractedDiscount != null ? String(ex.extractedDiscount) : "");
      setUrgencyScore(typeof ex.urgencyScore === "number" ? ex.urgencyScore : null);
      setImageSummary(typeof ex.imageSummary === "string" ? ex.imageSummary : "");
      setName(prev => prev || (ex.imageSummary?.slice(0, 80) ?? ""));
      setDescription(prev => prev || (ex.imageSummary ?? ""));
      setAiSummary(scanData.aiSummary ?? "");
      setAiTags(Array.isArray(scanData.aiTags) ? scanData.aiTags : []);
      setImageDataUrl(typeof scanData.imageDataUrl === "string" ? scanData.imageDataUrl : null);
      setStep("preview");
    } catch (e) {
      setError((e as Error).message);
      setStep("upload");
    }
  }, [file]);

  const handleSave = async () => {
    if (!tempUploadId || !name.trim()) {
      setError("กรุณากรอกชื่อโปรโมชั่น");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/clinic/promotions/from-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempUploadId,
          ext: tempExt,
          name: name.trim(),
          description: description.trim() || undefined,
          startAt: startAt || undefined,
          endAt: endAt || undefined,
          branchIds,
          visibleToAI,
          maxUsage: maxUsage ? Number(maxUsage) : undefined,
          extractedProcedures: extractedProcedures.length ? extractedProcedures : undefined,
          extractedKeywords: extractedKeywords.length ? extractedKeywords : undefined,
          extractedBenefits: extractedBenefits.length ? extractedBenefits : undefined,
          extractedPrice: extractedPrice ? Number(extractedPrice) : undefined,
          extractedDiscount: extractedDiscount ? Number(extractedDiscount) : undefined,
          urgencyScore: urgencyScore ?? undefined,
          aiSummary: aiSummary || undefined,
          aiTags: aiTags.length ? aiTags : undefined,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      onSuccess();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="create-from-image-title">
      <div className="bg-white rounded-[16px] shadow-xl max-w-[640px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-neutral-100">
          <h2 id="create-from-image-title" className="text-[18px] font-semibold text-neutral-900">สร้างโปรโมชั่นจากรูป</h2>
          <p className="text-[13px] text-neutral-500 mt-1">อัปโหลดรูปโปรโมชั่น — AI จะวิเคราะห์และเติมข้อมูลให้</p>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[13px]" role="alert">{error}</div>
          )}

          {step === "upload" && (
            <>
              <div>
                <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">รูปโปรโมชั่น (จำเป็น)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="w-full text-[13px] file:mr-2 file:py-2 file:px-4 file:rounded-[10px] file:border-0 file:bg-neutral-100 file:text-neutral-800 file:font-medium"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFile(f ?? null);
                    setError(null);
                  }}
                />
                {file && <p className="text-[12px] text-neutral-500 mt-1">{file.name}</p>}
                {localPreviewUrl && (
                  <div className="mt-3 w-full rounded-[12px] overflow-hidden bg-neutral-100 flex justify-center">
                    <img src={localPreviewUrl} alt="" className="max-w-full max-h-[400px] w-auto h-auto object-contain" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-transparent text-neutral-800 hover:bg-[#F2F2F7]">ยกเลิก</button>
                <button type="button" onClick={handleUpload} disabled={!file} className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-black text-white hover:bg-neutral-800 disabled:opacity-50">อัปโหลดและวิเคราะห์</button>
              </div>
            </>
          )}

          {step === "analyzing" && (
            <div className="py-8 flex flex-col items-center justify-center gap-4">
              <span className="inline-block w-10 h-10 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" aria-hidden />
              <p className="text-[15px] font-medium text-neutral-700">AI is analyzing your promotion...</p>
              <p className="text-[13px] text-neutral-500">กำลังดึงข้อมูลจากรูป</p>
            </div>
          )}

          {step === "preview" && (
            <>
              {(imageDataUrl || previewUrl) && (
                <div className="w-full rounded-[12px] overflow-hidden bg-neutral-100 flex justify-center">
                  <img src={imageDataUrl ?? previewUrl ?? ""} alt="" className="max-w-full max-h-[400px] w-auto h-auto object-contain" />
                </div>
              )}
              <div className="p-4 rounded-[12px] bg-[#FAFAFA] border border-neutral-100">
                <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-3">AI Detected — แก้ไขได้</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-0.5">ชื่อ *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full min-h-[36px] px-3 py-1.5 rounded-[8px] border border-[#E5E7EB] text-[14px]" placeholder="ชื่อโปรโมชั่น" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-0.5">คำอธิบาย</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-1.5 rounded-[8px] border border-[#E5E7EB] text-[14px]" placeholder="คำอธิบาย" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">Procedures</label>
                    <div className="flex flex-wrap gap-1">
                      {extractedProcedures.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[12px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md">
                          {p} <button type="button" onClick={() => removeChip(extractedProcedures, setExtractedProcedures, p)} className="text-neutral-500 hover:text-neutral-700" aria-label="ลบ">×</button>
                        </span>
                      ))}
                      <input type="text" placeholder="เพิ่ม procedure" className="w-32 min-h-[28px] px-2 rounded-md border border-dashed border-neutral-300 text-[12px]" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChip(extractedProcedures, setExtractedProcedures, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">Price (฿)</label>
                      <input type="number" min={0} value={extractedPrice} onChange={(e) => setExtractedPrice(e.target.value)} className="w-28 min-h-[36px] px-2 py-1 rounded-[8px] border border-[#E5E7EB] text-[14px]" placeholder="—" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">Discount (%)</label>
                      <input type="number" min={0} max={100} value={extractedDiscount} onChange={(e) => setExtractedDiscount(e.target.value)} className="w-20 min-h-[36px] px-2 py-1 rounded-[8px] border border-[#E5E7EB] text-[14px]" placeholder="—" />
                    </div>
                  </div>
                  {extractedBenefits.length > 0 && (
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">Benefits</label>
                      <ul className="list-disc list-inside text-[13px] text-neutral-700 space-y-0.5">
                        {extractedBenefits.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {extractedKeywords.length > 0 && (
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">Keywords</label>
                      <div className="flex flex-wrap gap-1">
                        {extractedKeywords.slice(0, 8).map((k, i) => (
                          <span key={i} className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiSummary && (
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-0.5">AI Summary</label>
                      <p className="text-[13px] text-neutral-700 whitespace-pre-wrap">{aiSummary}</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">สาขา</label>
                <div className="flex flex-wrap gap-2">
                  {branches.map((b) => (
                    <label key={b.id} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} className="rounded border-[#E5E7EB]" />
                      <span className="text-[14px] text-neutral-800">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-neutral-500 mb-1">เริ่มต้น</label>
                  <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px]" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-neutral-500 mb-1">สิ้นสุด</label>
                  <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px]" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-neutral-500 mb-1">จำนวนครั้งที่ใช้ได้ (ไม่บังคับ)</label>
                <input type="number" min={0} value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} className="w-32 min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px]" placeholder="ไม่จำกัด" />
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={visibleToAI} onChange={(e) => setVisibleToAI(e.target.checked)} className="rounded border-[#E5E7EB]" />
                <span className="text-[14px] text-neutral-800">ให้ AI ค้นหาและแนะนำโปรนี้ในแชท</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-transparent text-neutral-800 hover:bg-[#F2F2F7]">ยกเลิก</button>
                <button type="button" onClick={handleSave} disabled={saving} className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-black text-white hover:bg-neutral-800 disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึกโปรโมชั่น"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Create/Edit form — minimal: Name, Description, Media, Dates, Usage limit (optional), Visible to AI. No manual agent/category. */
function PromotionForm({
  promotion,
  branches,
  onSuccess,
  onCancel,
}: {
  promotion: Promotion | null;
  branches: Array<{ id: string; name: string }>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!promotion;
  const [name, setName] = useState(promotion?.name ?? "");
  const [description, setDescription] = useState(promotion?.description ?? "");
  const [branchIds, setBranchIds] = useState<string[]>(promotion?.branchIds ?? []);
  const [status, setStatus] = useState<PromotionStatus>(promotion?.status ?? "draft");
  const [startAt, setStartAt] = useState(promotion?.startAt?.slice(0, 16) ?? "");
  const [endAt, setEndAt] = useState(promotion?.endAt?.slice(0, 16) ?? "");
  const [autoArchiveAt, setAutoArchiveAt] = useState(promotion?.autoArchiveAt?.slice(0, 16) ?? "");
  const [maxUsage, setMaxUsage] = useState(promotion?.maxUsage?.toString() ?? "");
  const [visibleToAI, setVisibleToAI] = useState(promotion?.visibleToAI ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastExtracted, setLastExtracted] = useState<{
    extractedProcedures?: string[];
    extractedPrice?: number;
    extractedBenefits?: string[];
    extractedKeywords?: string[];
  } | null>(null);

  const toggleBranch = (id: string) => {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อโปรโมชั่น");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && promotion) {
        const res = await fetch("/api/clinic/promotions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: promotion.id,
            name: name.trim(),
            description: description.trim() || undefined,
            targetGroup: "all",
            branchIds,
            status,
            startAt: startAt || undefined,
            endAt: endAt || undefined,
            autoArchiveAt: autoArchiveAt || undefined,
            maxUsage: maxUsage ? Number(maxUsage) : undefined,
            visibleToAI,
          }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      } else {
        const res = await fetch("/api/clinic/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            targetGroup: "all",
            branchIds,
            status,
            startAt: startAt || undefined,
            endAt: endAt || undefined,
            autoArchiveAt: autoArchiveAt || undefined,
            maxUsage: maxUsage ? Number(maxUsage) : undefined,
            visibleToAI,
          }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "สร้างไม่สำเร็จ");
      }
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = useCallback(
    async (promoId: string, file: File) => {
      setUploading(true);
      setAnalyzing(true);
      setLastExtracted(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/clinic/promotions/${promoId}/media`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
        if (data.extracted) {
          setLastExtracted({
            extractedProcedures: data.extracted.extractedProcedures,
            extractedPrice: data.extracted.extractedPrice,
            extractedBenefits: data.extracted.extractedBenefits,
            extractedKeywords: data.extracted.extractedKeywords,
          });
        }
        onSuccess();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
        setAnalyzing(false);
      }
    },
    [onSuccess]
  );

  return (
    <div className="bg-white rounded-[12px] border border-neutral-100 p-6 max-w-[720px]">
      <h2 className="text-[17px] font-medium text-neutral-800 leading-[1.4] mb-6">
        {isEdit ? "แก้ไขโปรโมชั่น" : "สร้างโปรโมชั่นใหม่"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[13px]" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">ชื่อโปรโมชั่น *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            placeholder="ชื่อโปรโมชั่น"
            required
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">คำอธิบาย</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full min-h-[80px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            placeholder="คำอธิบายโปรโมชั่น"
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">สาขา (เลือกได้หลายสาขา)</label>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <label key={b.id} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                  className="rounded border-[#E5E7EB]"
                />
                <span className="text-[14px] text-neutral-800">{b.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">เริ่มต้น</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">สิ้นสุด</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">เก็บถาวรอัตโนมัติ</label>
            <input
              type="datetime-local"
              value={autoArchiveAt}
              onChange={(e) => setAutoArchiveAt(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">จำนวนครั้งที่ใช้ได้ (ไม่บังคับ)</label>
          <input
            type="number"
            min={0}
            value={maxUsage}
            onChange={(e) => setMaxUsage(e.target.value)}
            className="w-full min-h-[40px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[14px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder="ไม่จำกัด"
          />
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={visibleToAI} onChange={(e) => setVisibleToAI(e.target.checked)} className="rounded border-[#E5E7EB]" />
          <span className="text-[14px] text-neutral-800">ให้ AI ค้นหาและแนะนำโปรนี้ให้ลูกค้าในแชท</span>
        </label>
        {isEdit && promotion && (
          <div>
            <label className="block text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5">สื่อ (รูป/วิดีโอ)</label>
            <div className="flex flex-wrap gap-2">
              {promotion.media.map((m, i) => (
                <div key={i} className="w-20 h-20 rounded-[10px] overflow-hidden bg-neutral-100">
                  {m.type === "video" ? (
                    <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img
                      src={i === 0 && m.type === "image" ? `/api/clinic/promotions/${promotion.id}/cover` : m.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[12px] text-neutral-500">อัปโหลดรูปหรือวิดีโอ — AI จะวิเคราะห์และดึงข้อมูลอัตโนมัติ</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                className="text-[13px] text-neutral-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-[10px] file:border-0 file:bg-neutral-100 file:text-neutral-800"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && promotion?.id) handleFileUpload(promotion.id, file);
                  e.target.value = "";
                }}
              />
            </label>
            {analyzing && (
              <p className="text-[13px] text-neutral-500 mt-2 flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-neutral-300 border-t-neutral-600 animate-spin" aria-hidden />
                AI is analyzing your promotion...
              </p>
            )}
            {lastExtracted && (lastExtracted.extractedProcedures?.length || lastExtracted.extractedPrice || lastExtracted.extractedBenefits?.length) && (
              <div className="mt-3 p-3 rounded-[10px] bg-[#FAFAFA] border border-neutral-100">
                <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide mb-2">AI detected</p>
                {lastExtracted.extractedProcedures?.length ? (
                  <p className="text-[13px] text-neutral-700">Procedure: {lastExtracted.extractedProcedures.join(", ")}</p>
                ) : null}
                {lastExtracted.extractedPrice != null ? (
                  <p className="text-[13px] text-neutral-700 mt-0.5">Price: ฿{lastExtracted.extractedPrice.toLocaleString()}</p>
                ) : null}
                {lastExtracted.extractedBenefits?.length ? (
                  <p className="text-[13px] text-neutral-600 mt-0.5">Benefits: {lastExtracted.extractedBenefits.slice(0, 3).join(", ")}</p>
                ) : null}
                {lastExtracted.extractedKeywords?.length ? (
                  <p className="text-[12px] text-neutral-500 mt-1">Keywords: {lastExtracted.extractedKeywords.slice(0, 5).join(", ")}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-transparent text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกโปรโมชั่น"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PromotionsPage() {
  const { branch_id } = useClinicContext();
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const [targetGroupFilter, setTargetGroupFilter] = useState<PromotionTargetGroup | "">("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [showCreateFromImage, setShowCreateFromImage] = useState(false);
  const [editingItem, setEditingItem] = useState<Promotion | null>(null);

  const statsUrl = `/api/clinic/promotions?stats=1${branch_id ? `&branchId=${encodeURIComponent(branch_id)}` : ""}`;
  const listParams = new URLSearchParams();
  if (statusFilter !== "all") listParams.set("status", statusFilter);
  if (targetGroupFilter) listParams.set("targetGroup", targetGroupFilter);
  if (branchFilter !== "all") listParams.set("branchId", branchFilter);
  else if (branch_id) listParams.set("branchId", branch_id);
  const listUrl = `/api/clinic/promotions?${listParams}`;

  const { data: stats, mutate: mutateStats } = useSWR<{ active: number; expiringSoon: number; scheduled: number; expired: number }>(
    statsUrl,
    apiFetcher,
    { revalidateOnFocus: false }
  );
  const { data: listData, mutate: mutateList } = useSWR<{ items: Promotion[] }>(listUrl, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const { data: branchesData } = useSWR<{ items: Array<{ id: string; name: string }> }>("/api/clinic/branches", apiFetcher);
  const branches = branchesData?.items ?? [];

  const items = listData?.items ?? [];
  const mutate = useCallback(() => {
    mutateStats();
    mutateList();
  }, [mutateStats, mutateList]);

  return (
    <div className="min-h-screen bg-white font-sans antialiased relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_-10%,rgba(0,0,0,0.025),transparent_60%)]" aria-hidden />
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-6">
        <PageHeader
          title="Promotions"
          description="สร้างโปรโมชั่น จัดการสื่อ และให้ AI ใช้ตอบลูกค้าอัตโนมัติ"
          aiAnalyze
        />

        <PromotionOverview stats={stats ?? { active: 0, expiringSoon: 0, scheduled: 0, expired: 0 }} />

        <section className="bg-[#FAFAFA] rounded-[12px] p-6 mb-8">
          <div className="bg-white rounded-[12px] p-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div>
                <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">โปรโมชั่นทั้งหมด</p>
                <h2 className="text-[17px] font-medium text-neutral-800 leading-[1.4] mt-0.5">รายการโปรโมชั่น</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFromImage(true)}
                  className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100"
                >
                  + Create Promotion from Image
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingItem(null); setShowForm(true); }}
                  className="min-h-[40px] px-4 rounded-[10px] text-[14px] font-medium bg-transparent text-neutral-800 border border-neutral-300 hover:bg-[#F2F2F7] transition-colors duration-100"
                >
                  Create manually
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PromotionStatus | "all")}
                className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                aria-label="สถานะ"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                aria-label="สาขา"
              >
                <option value="all">ทุกสาขา</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={targetGroupFilter}
                onChange={(e) => setTargetGroupFilter((e.target.value || "") as PromotionTargetGroup | "")}
                className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                aria-label="กลุ่มเป้าหมาย"
              >
                <option value="">ทุกกลุ่ม</option>
                <option value="new">ลูกค้าใหม่</option>
                <option value="existing">ลูกค้าปัจจุบัน</option>
                <option value="all">ทุกคน</option>
              </select>
            </div>
            {!listData && (
              <div className="space-y-3 py-8" aria-busy="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-[10px] bg-[#F5F5F7] animate-pulse" />
                ))}
              </div>
            )}
            {listData && items.length === 0 && (
              <p className="text-[14px] text-neutral-500 py-8 text-center">ยังไม่มีโปรโมชั่น</p>
            )}
            {listData && items.length > 0 && (
              <div className="space-y-3">
                {items.map((p) => (
                  <PromotionRow
                    key={p.id}
                    item={p}
                    branches={branches}
                    onEdit={() => { setEditingItem(p); setShowForm(true); }}
                    onMutate={mutate}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {showCreateFromImage && (
          <CreateFromImageModal
            branches={branches}
            onClose={() => setShowCreateFromImage(false)}
            onSuccess={() => { setShowCreateFromImage(false); mutate(); }}
          />
        )}

        {(showForm || editingItem) && (
          <section className="mb-8">
            <PromotionForm
              promotion={editingItem}
              branches={branches}
              onSuccess={() => { setShowForm(false); setEditingItem(null); mutate(); }}
              onCancel={() => { setShowForm(false); setEditingItem(null); }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
