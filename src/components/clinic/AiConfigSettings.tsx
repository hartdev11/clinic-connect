"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useClinicContext } from "@/contexts/ClinicContext";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { VOICE_DEFINITIONS } from "@/lib/ai/tenant-prompt-builder";
import type { VoiceId } from "@/types/ai-config";

const DEFAULT_GREETING = "สวัสดีค่ะ คุณ{name} 😊 มีอะไรให้ช่วยไหมคะ?";
const DEFAULT_FALLBACK = "ขออภัยค่ะ ตอนนี้ยังตอบไม่ได้ กรุณาติดต่อเจ้าหน้าที่ค่ะ";
const DEFAULT_HANDOFF = "กำลังส่งต่อให้เจ้าหน้าที่ช่วยคุณนะคะ รอสักครู่ค่ะ";

const DEFAULT_TEMPLATES = [
  "สวัสดีค่ะ คุณ{name} 😊 มีอะไรให้ช่วยไหมคะ?",
  "ขอบคุณที่ใช้บริการนะคะ หวังว่าจะพบกันใหม่เร็วๆ นี้ 💕",
  "มีโปรโมชั่นพิเศษสำหรับคุณค่ะ! [ใส่รายละเอียด]",
  "ขอเตือนนัดหมายพรุ่งนี้ค่ะ 📅 [ใส่วันเวลา]",
];

type ClinicStyle = "luxury" | "budget" | "friendly";
type MedicalPolicy = "strict" | "moderate" | "permissive";
type SalesStrategy = "consultative" | "direct" | "education_first";
type PromotionDisplay = "always" | "by_promotion_only" | "never";

const TONE_LABELS: Record<string, string> = {
  professional: "professional",
  elegant: "elegant",
  warm: "warm",
  fun: "fun",
  clean: "clean",
  honest: "honest",
};

const MEDICAL_POLICY_OPTIONS: { value: MedicalPolicy; label: string; desc: string }[] = [
  { value: "strict", label: "🔒 Conservative", desc: "AI จะไม่ตอบคำถามทางการแพทย์ → ส่งต่อหมอทันที" },
  { value: "moderate", label: "⚖️ Moderate (แนะนำ)", desc: "AI ตอบได้พร้อม disclaimer ว่าควรปรึกษาแพทย์" },
  { value: "permissive", label: "🔓 Permissive", desc: "AI ตอบได้แต่ไม่การันตีผล" },
];

const SALES_STRATEGY_OPTIONS: { value: SalesStrategy; label: string; desc: string }[] = [
  { value: "consultative", label: "🤝 Consultative", desc: "รับฟังก่อน ไม่กดดัน ให้ข้อมูลครบ → นำสู่การนัด" },
  { value: "direct", label: "⚡ Direct", desc: "ตอบตรง เน้น value สร้าง urgency เบาๆ" },
  { value: "education_first", label: "📚 Education First", desc: "ให้ความรู้วิชาการก่อน สร้างความน่าเชื่อถือ" },
];

const PROMOTION_DISPLAY_OPTIONS: { value: PromotionDisplay; label: string }[] = [
  { value: "always", label: "เสมอ" },
  { value: "by_promotion_only", label: "เฉพาะเมื่อมีโปร" },
  { value: "never", label: "ไม่แสดง" },
];

const CLINIC_STYLES: { value: ClinicStyle; label: string }[] = [
  { value: "friendly", label: "เป็นกันเอง (Friendly)" },
  { value: "luxury", label: "หรูหรา (Luxury)" },
  { value: "budget", label: "ราคาประหยัด (Budget)" },
];

const CUSTOMER_MSG = "สวัสดีค่ะ อยากสอบถามเรื่องโบท็อกซ์";

export function AiConfigSettings() {
  const { currentOrg } = useClinicContext();
  const [templates, setTemplates] = useState<string[]>([]);
  const [clinicStyle, setClinicStyle] = useState<ClinicStyle>("friendly");
  const [greetingMessage, setGreetingMessage] = useState(DEFAULT_GREETING);
  const [fallbackMessage, setFallbackMessage] = useState(DEFAULT_FALLBACK);
  const [handoffMessage, setHandoffMessage] = useState(DEFAULT_HANDOFF);
  const [medicalPolicy, setMedicalPolicy] = useState<MedicalPolicy>("moderate");
  const [voiceId, setVoiceId] = useState<VoiceId>("V03");
  const [salesStrategy, setSalesStrategy] = useState<SalesStrategy>("consultative");
  const [showPriceRange, setShowPriceRange] = useState(true);
  const [showExactPrice, setShowExactPrice] = useState(false);
  const [negotiationAllowed, setNegotiationAllowed] = useState(false);
  const [promotionDisplay, setPromotionDisplay] = useState<PromotionDisplay>("by_promotion_only");
  const [hoverVoice, setHoverVoice] = useState<VoiceId | null>(null);
  const [previewPreviews, setPreviewPreviews] = useState<{ label: string; customerMessage: string; aiResponse: string }[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<{ id?: string; summary: string; timeAgo: string; changedBy: string }[]>([]);
  const [savingVoice, setSavingVoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);
  const [savingMessages, setSavingMessages] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const [tplRes, settingsRes, historyRes] = await Promise.all([
        fetch("/api/clinic/ai-config/message-templates", { credentials: "include" }),
        fetch("/api/clinic/ai-config/settings", { credentials: "include" }),
        fetch("/api/clinic/ai-config/history", { credentials: "include" }),
      ]);
      const tplData = await tplRes.json();
      const settingsData = await settingsRes.json();
      const historyData = await historyRes.json();
      const arr = Array.isArray(tplData?.templates) && tplData.templates.length > 0 ? tplData.templates : [...DEFAULT_TEMPLATES];
      setTemplates(arr);
      if (settingsData?.clinic_style) setClinicStyle(settingsData.clinic_style);
      if (settingsData?.greeting_message) setGreetingMessage(settingsData.greeting_message);
      if (settingsData?.fallback_message) setFallbackMessage(settingsData.fallback_message);
      if (settingsData?.handoff_message) setHandoffMessage(settingsData.handoff_message);
      if (settingsData?.medicalPolicy) setMedicalPolicy(settingsData.medicalPolicy);
      if (settingsData?.voice_id) setVoiceId(settingsData.voice_id);
      if (settingsData?.sales_strategy) setSalesStrategy(settingsData.sales_strategy);
      if (typeof settingsData?.show_price_range === "boolean") setShowPriceRange(settingsData.show_price_range);
      if (typeof settingsData?.show_exact_price === "boolean") setShowExactPrice(settingsData.show_exact_price);
      if (typeof settingsData?.negotiation_allowed === "boolean") setNegotiationAllowed(settingsData.negotiation_allowed);
      if (settingsData?.promotion_display) setPromotionDisplay(settingsData.promotion_display);
      if (Array.isArray(historyData?.history)) setHistory(historyData.history);
    } catch {
      setTemplates([...DEFAULT_TEMPLATES]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/clinic/ai-config/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          voice_id: voiceId,
          medicalPolicy,
          sales_strategy: salesStrategy,
          show_price_range: showPriceRange,
          show_exact_price: showExactPrice,
        }),
      });
      const data = await res.json();
      if (data?.previews) setPreviewPreviews(data.previews);
    } catch {
      setPreviewPreviews(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [voiceId, medicalPolicy, salesStrategy, showPriceRange, showExactPrice]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/clinic/ai-config/message-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ templates }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setMessage({ type: "success", text: "บันทึกข้อความเทมเพลตสำเร็จ" });
      else setMessage({ type: "error", text: json.error ?? "บันทึกไม่สำเร็จ" });
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => setTemplates((prev) => [...prev, ""]);
  const handleChange = (index: number, value: string) => {
    setTemplates((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setMessage(null);
  };
  const handleRemove = (index: number) => setTemplates((prev) => prev.filter((_, i) => i !== index));
  const handleReset = () => setTemplates([...DEFAULT_TEMPLATES]);

  const orgId = currentOrg?.id;
  const canEdit = !!orgId;

  const saveVoiceMedicalStrategy = async () => {
    setMessage(null);
    setSavingVoice(true);
    try {
      const res = await fetch("/api/clinic/ai-config/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ voice_id: voiceId, sales_strategy: salesStrategy, medicalPolicy }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "บันทึก Voice, Medical Policy & Sales Strategy สำเร็จ" });
        loadSettings();
      } else setMessage({ type: "error", text: json.error ?? "บันทึกไม่สำเร็จ" });
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSavingVoice(false);
    }
  };

  const savePricing = async () => {
    setMessage(null);
    setSavingPricing(true);
    try {
      const res = await fetch("/api/clinic/ai-config/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          show_price_range: showPriceRange,
          show_exact_price: showExactPrice,
          negotiation_allowed: negotiationAllowed,
          promotion_display: promotionDisplay,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "บันทึกการแสดงราคาสำเร็จ" });
        loadSettings();
      } else {
        const json = await res.json();
        setMessage({ type: "error", text: json.error ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSavingPricing(false);
    }
  };

  const saveClinicStyle = async () => {
    setMessage(null);
    setSavingStyle(true);
    try {
      const res = await fetch("/api/clinic/ai-config/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clinic_style: clinicStyle }),
      });
      if (res.ok) setMessage({ type: "success", text: "บันทึกสไตล์คลินิกสำเร็จ" });
      else {
        const json = await res.json();
        setMessage({ type: "error", text: json.error ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSavingStyle(false);
    }
  };

  const saveMessages = async () => {
    setMessage(null);
    setSavingMessages(true);
    try {
      const res = await fetch("/api/clinic/ai-config/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          greeting_message: greetingMessage,
          fallback_message: fallbackMessage,
          handoff_message: handoffMessage,
        }),
      });
      if (res.ok) setMessage({ type: "success", text: "บันทึกข้อความสำเร็จ" });
      else {
        const json = await res.json();
        setMessage({ type: "error", text: json.error ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSavingMessages(false);
    }
  };

  const displayVoice = hoverVoice ?? voiceId;
  const displayVoiceDef = VOICE_DEFINITIONS[displayVoice] ?? VOICE_DEFINITIONS.V03;

  if (loading) {
    return (
      <div className="luxury-card p-6 space-y-6">
        <div className="h-8 w-48 bg-cream-200 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-cream-200 rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-8">
        {/* Message */}
        {message && (
          <div
            role="alert"
            className={cn(
              "rounded-xl px-4 py-3 text-sm font-body",
              message.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"
            )}
          >
            {message.text}
          </div>
        )}

        {/* Voice + Medical Policy side by side */}
        <section className="luxury-card p-6 space-y-6">
          <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
            Voice Personality & Medical Policy
          </h3>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Voice cards */}
            <div>
              <p className="text-sm font-body text-mauve-600 mb-3">บุคลิก AI — เลือกโทนการตอบ</p>
              <select
                value={voiceId}
                onChange={(e) => canEdit && setVoiceId(e.target.value as VoiceId)}
                onFocus={() => setHoverVoice(null)}
                disabled={!canEdit}
                className="mb-3 w-full rounded-xl border border-cream-300 px-3 py-2 text-sm font-body text-mauve-700 bg-white focus:ring-2 focus:ring-rg-300 focus:border-rg-400"
                aria-label="เลือกบุคลิก Voice"
              >
                {(Object.keys(VOICE_DEFINITIONS) as VoiceId[]).map((vid) => {
                  const def = VOICE_DEFINITIONS[vid];
                  return (
                    <option key={vid} value={vid}>
                      {vid} — {def.name}
                    </option>
                  );
                })}
              </select>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(VOICE_DEFINITIONS) as VoiceId[]).map((vid) => {
                  const def = VOICE_DEFINITIONS[vid];
                  const selected = voiceId === vid;
                  return (
                    <button
                      key={vid}
                      type="button"
                      onClick={() => canEdit && setVoiceId(vid)}
                      onMouseEnter={() => setHoverVoice(vid)}
                      onMouseLeave={() => setHoverVoice(null)}
                      disabled={!canEdit}
                      className={cn(
                        "luxury-card p-3 text-left transition-all duration-200 hover:shadow-luxury",
                        selected ? "border-2 border-rg-400 bg-rg-50" : "border border-cream-300 hover:border-rg-200"
                      )}
                    >
                      <p className="font-display font-semibold text-sm text-mauve-800">{vid} — {def.name}</p>
                      <p className="text-xs text-mauve-500 mt-0.5">{def.personalityDesc}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-cream-200 text-mauve-600">{TONE_LABELS[def.tone] ?? def.tone}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-cream-200 text-mauve-600">{def.formalityLabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Medical Policy */}
            <div>
              <p className="text-sm font-body text-mauve-600 mb-3">Medical Policy (อย. Compliance)</p>
              <div className="space-y-2">
                {MEDICAL_POLICY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => canEdit && setMedicalPolicy(opt.value)}
                    disabled={!canEdit}
                    className={cn(
                      "w-full p-3 rounded-xl text-left text-sm font-body transition-all",
                      medicalPolicy === opt.value ? "bg-rg-50 border-2 border-rg-400 text-rg-800" : "bg-cream-100 border border-cream-200 text-mauve-600 hover:bg-cream-200"
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <p className="text-xs text-mauve-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={savingVoice} disabled={!canEdit} onClick={saveVoiceMedicalStrategy}>
              บันทึก Voice & Medical Policy
            </Button>
          </div>
        </section>

        {/* Voice preview bubble */}
        <section className="luxury-card p-4 bg-cream-50 border border-cream-200">
          <p className="text-xs font-body text-mauve-500 mb-2">ตัวอย่างการตอบ — &quot;{CUSTOMER_MSG}&quot;</p>
          <div className="flex gap-2">
            <div className="rounded-2xl rounded-tr-md bg-white border border-cream-200 px-3 py-2 shadow-soft max-w-[85%]">
              <p className="font-body text-xs text-mauve-500">{CUSTOMER_MSG}</p>
            </div>
            <div className="rounded-2xl rounded-tl-md bg-rg-100/80 border border-rg-200 px-3 py-2 max-w-[85%]">
              <p className="font-body text-sm text-mauve-800 whitespace-pre-wrap">{displayVoiceDef.opening_example}</p>
            </div>
          </div>
        </section>

        {/* Pricing Display Config */}
        <section className="luxury-card p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
            การแสดงราคา
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showPriceRange}
                onChange={(e) => canEdit && setShowPriceRange(e.target.checked)}
                disabled={!canEdit}
                className="rounded border-cream-300 text-rg-500"
              />
              <span className="text-sm font-body text-mauve-700">แสดงช่วงราคา (show_price_range)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showExactPrice}
                onChange={(e) => canEdit && setShowExactPrice(e.target.checked)}
                disabled={!canEdit}
                className="rounded border-cream-300 text-rg-500"
              />
              <span className="text-sm font-body text-mauve-700">แสดงราคาที่แน่นอน (show_exact_price)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={negotiationAllowed}
                onChange={(e) => canEdit && setNegotiationAllowed(e.target.checked)}
                disabled={!canEdit}
                className="rounded border-cream-300 text-rg-500"
              />
              <span className="text-sm font-body text-mauve-700">อนุญาตให้ต่อรองราคา (negotiation_allowed)</span>
            </label>
          </div>
          <div>
            <p className="text-xs font-body text-mauve-600 mb-1">การแสดงโปรโมชั่น</p>
            <select
              value={promotionDisplay}
              onChange={(e) => canEdit && setPromotionDisplay(e.target.value as PromotionDisplay)}
              disabled={!canEdit}
              className="rounded-xl border border-cream-300 px-3 py-2 text-sm font-body text-mauve-700 bg-white"
            >
              {PROMOTION_DISPLAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" loading={savingPricing} onClick={savePricing}>
              บันทึกการแสดงราคา
            </Button>
          )}
        </section>

        {/* Sales Strategy */}
        <section className="luxury-card p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
            กลยุทธ์การขาย
          </h3>
          <div className="space-y-2">
            {SALES_STRATEGY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => canEdit && setSalesStrategy(opt.value)}
                disabled={!canEdit}
                className={cn(
                  "w-full p-3 rounded-xl text-left text-sm font-body transition-all",
                  salesStrategy === opt.value ? "bg-rg-50 border-2 border-rg-400 text-rg-800" : "bg-cream-100 border border-cream-200 text-mauve-600 hover:bg-cream-200"
                )}
              >
                <span className="font-medium">{opt.label}</span>
                <p className="text-xs text-mauve-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" loading={savingVoice} disabled={!canEdit} onClick={saveVoiceMedicalStrategy}>
              บันทึก Sales Strategy
            </Button>
          )}
        </section>

        {/* Clinic Style */}
        <section className="luxury-card p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
            สไตล์คลินิก (Customer Persona)
          </h3>
          <div className="flex flex-wrap gap-2">
            {CLINIC_STYLES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => canEdit && setClinicStyle(opt.value)}
                disabled={!canEdit}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-body transition-all",
                  clinicStyle === opt.value ? "bg-rg-100 text-rg-700 ring-2 ring-rg-400" : "bg-cream-100 text-mauve-600 hover:bg-cream-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" loading={savingStyle} disabled={!canEdit} onClick={saveClinicStyle}>
              บันทึกสไตล์
            </Button>
          )}
        </section>

        {/* Greeting, Fallback, Handoff */}
        <section className="luxury-card p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
            ข้อความ AI — Greeting / Fallback / Handoff
          </h3>
          <p className="text-sm font-body text-mauve-500">
            ใช้ <code className="px-1 py-0.5 rounded bg-cream-200 text-mauve-600">{`{name}`}</code> แทนชื่อลูกค้า
          </p>
          <Textarea label="Greeting" value={greetingMessage} onChange={(e) => setGreetingMessage(e.target.value)} placeholder={DEFAULT_GREETING} rows={2} disabled={!canEdit} />
          <Textarea label="Fallback" value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} placeholder={DEFAULT_FALLBACK} rows={2} disabled={!canEdit} />
          <Textarea label="Handoff" value={handoffMessage} onChange={(e) => setHandoffMessage(e.target.value)} placeholder={DEFAULT_HANDOFF} rows={2} disabled={!canEdit} />
          {canEdit && (
            <Button variant="primary" size="sm" loading={savingMessages} onClick={saveMessages}>
              บันทึกข้อความ
            </Button>
          )}
        </section>

        {/* Message Templates */}
        <section className="luxury-card p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
            AI Config — ข้อความเทมเพลต
          </h3>
          <div className="space-y-3">
            {templates.map((tpl, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={tpl} onChange={(e) => handleChange(i, e.target.value)} placeholder={`เทมเพลต ${i + 1}`} className="flex-1" disabled={!canEdit} aria-label={`เทมเพลต ${i + 1}`} />
                <Button variant="ghost" size="sm" onClick={() => handleRemove(i)} disabled={!canEdit || templates.length <= 1} aria-label="ลบเทมเพลต">
                  <TrashIcon className="w-4 h-4 text-mauve-400 hover:text-red-600" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleAdd} disabled={!canEdit} aria-label="เพิ่มเทมเพลต">
              <PlusIcon className="w-4 h-4 mr-1" /> เพิ่มเทมเพลต
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!canEdit} aria-label="รีเซ็ต">รีเซ็ต</Button>
            <Button variant="primary" size="sm" loading={saving} disabled={!canEdit} onClick={handleSave} aria-label="บันทึก">บันทึก</Button>
          </div>
        </section>

        {/* Config History */}
        {history.length > 0 && (
          <section className="luxury-card p-6 space-y-3">
            <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
              ประวัติการเปลี่ยน
            </h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((item, i) => (
                <div key={item.id ?? i} className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-rg-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-body text-mauve-700">{item.summary}</p>
                    <p className="text-xs text-mauve-500">โดย {item.changedBy} — {item.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Live Preview Panel */}
      <div className="lg:w-80 flex-shrink-0">
        <div className="luxury-card p-4 sticky top-4">
          <h3 className="font-display text-sm font-semibold text-mauve-800 mb-3">ตัวอย่างการสนทนา</h3>
          {previewLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-cream-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : previewPreviews && previewPreviews.length > 0 ? (
            <div className="rounded-2xl overflow-hidden border border-cream-300 bg-white shadow-soft">
              <div className="h-8 flex items-center px-3 bg-line-500" />
              <div className="p-3 space-y-3 min-h-[200px]">
                {previewPreviews.map((p, i) => (
                  <div key={i}>
                    <div className="flex justify-end mb-1">
                      <div className="max-w-[90%] rounded-2xl rounded-tr-md bg-white border border-cream-200 px-2 py-1.5 shadow-soft">
                        <p className="font-body text-[11px] text-mauve-600">{p.customerMessage}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-rg-100/80 border border-rg-200 px-2 py-1.5">
                        <p className="text-[10px] text-mauve-500">{p.label}</p>
                        <p className="font-body text-xs text-mauve-800 whitespace-pre-wrap">{p.aiResponse}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-mauve-500">ยังไม่มีตัวอย่าง — เลือก config แล้วจะแสดง</p>
          )}
          <Button variant="ghost" size="xs" className="mt-2" onClick={fetchPreview} disabled={previewLoading}>
            รีเฟรชตัวอย่าง
          </Button>
        </div>
      </div>
    </div>
  );
}
