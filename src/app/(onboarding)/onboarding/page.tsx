"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import useSWR from "swr";
import type { DayOfWeek } from "@/types/clinic";
import type { OnboardingServicePreset } from "@/lib/onboarding-presets";
import { CATEGORY_LABELS } from "@/lib/onboarding-presets";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

const DAY_KEYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "จ",
  tuesday: "อ",
  wednesday: "พ",
  thursday: "พฤ",
  friday: "ศ",
  saturday: "ส",
  sunday: "อา",
};

const fadeSlideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

function saveStep1(data: Record<string, unknown>) {
  return fetch("/api/onboarding/step1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: presetsData } = useSWR<{ items: OnboardingServicePreset[] }>(
    step === 2 ? "/api/onboarding/step2" : null,
    fetcher
  );

  const { data: clinicServices } = useSWR<{ items: Array<{ id: string; custom_title: string; custom_price: string }> }>(
    step >= 3 ? "/api/clinic/unified-knowledge/services" : null,
    fetcher
  );

  const presets = presetsData?.items ?? [];
  const services = clinicServices?.items ?? [];

  const { data: step1Data } = useSWR<{
    clinicName: string;
    address: string;
    phone: string;
    lineOA: string;
    businessHours?: Record<string, { open: string; close: string } | null>;
  }>(step === 1 ? "/api/onboarding/step1" : null, fetcher);

  const [form1, setForm1] = useState({
    clinicName: "",
    address: "",
    phone: "",
    lineOA: "",
    businessHours: {} as Record<string, { open: string; close: string } | null>,
  });

  const [form2Selected, setForm2Selected] = useState<Set<string>>(new Set());
  const [form2Search, setForm2Search] = useState("");
  const [form2Category, setForm2Category] = useState<string>("");

  const [form3Prices, setForm3Prices] = useState<Record<string, string>>({});

  const [form4Promos, setForm4Promos] = useState<
    Array<{ name: string; discountType: "percent" | "fixed"; value: number; startAt: string; endAt: string }>
  >([{ name: "", discountType: "percent", value: 0, startAt: "", endAt: "" }]);

  const [form5, setForm5] = useState({
    clinic_style: "friendly" as "luxury" | "budget" | "friendly",
    ai_tone: "casual" as "formal" | "casual" | "fun",
    usp: "",
    competitors: [] as string[],
    greeting_message: "",
  });

  useEffect(() => {
    if (step1Data) {
      setForm1((f) => ({
        ...f,
        clinicName: step1Data.clinicName ?? f.clinicName,
        address: step1Data.address ?? f.address,
        phone: step1Data.phone ?? f.phone,
        lineOA: step1Data.lineOA ?? f.lineOA,
        businessHours: step1Data.businessHours
          ? { ...f.businessHours, ...step1Data.businessHours }
          : f.businessHours,
      }));
    }
  }, [step1Data]);

  useEffect(() => {
    if (services.length > 0) {
      const prices: Record<string, string> = {};
      for (const s of services) {
        prices[s.id] = s.custom_price || "";
      }
      setForm3Prices((p) => ({ ...p, ...prices }));
    }
  }, [services]);

  const saveStep1Blur = useCallback(
    (field: string, value: string | Record<string, unknown>) => {
      setSaving(true);
      const payload: Record<string, unknown> = {};
      if (field === "clinicName") payload.clinicName = value;
      if (field === "address") payload.address = value;
      if (field === "phone") payload.phone = value;
      if (field === "lineOA") payload.lineOA = value;
      if (field === "businessHours") payload.businessHours = value;
      saveStep1(payload)
        .then(() => {})
        .finally(() => setSaving(false));
    },
    []
  );

  const progress = (step / 5) * 100;
  const categories = [...new Set(presets.map((p) => p.category))];
  const filteredPresets = presets.filter((p) => {
    const matchSearch =
      !form2Search.trim() ||
      p.name.toLowerCase().includes(form2Search.toLowerCase()) ||
      (CATEGORY_LABELS[p.category] ?? p.category).toLowerCase().includes(form2Search.toLowerCase());
    const matchCat = !form2Category || p.category === form2Category;
    return matchSearch && matchCat;
  });

  const handleNext = async () => {
    if (step === 1) {
      setSaving(true);
      await saveStep1({
        clinicName: form1.clinicName,
        address: form1.address,
        phone: form1.phone,
        lineOA: form1.lineOA,
        businessHours: form1.businessHours,
      });
      setSaving(false);
      setStep(2);
    } else if (step === 2) {
      setSaving(true);
      const selected = Array.from(form2Selected).map((id) => {
        const p = presets.find((x) => x.id === id) ?? {
          id,
          name: id,
          category: "other",
          defaultPrice: 0,
          duration: 60,
          description: "",
        };
        return p;
      });
      const res = await fetch("/api/onboarding/step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ selected }),
      });
      setSaving(false);
      if (!res.ok) {
        const j = await res.json();
        alert(j.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setStep(3);
      router.refresh();
    } else if (step === 3) {
      setSaving(true);
      const updates = Object.entries(form3Prices).map(([id, custom_price]) => ({ id, custom_price }));
      await fetch("/api/onboarding/step3", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ updates }),
      });
      setSaving(false);
      setStep(4);
    } else if (step === 4) {
      const valid = form4Promos.filter((p) => p.name.trim());
      if (valid.length > 0) {
        setSaving(true);
        await fetch("/api/onboarding/step4", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            promotions: valid.map((p) => ({
              ...p,
              startAt: p.startAt || new Date().toISOString(),
              endAt: p.endAt || new Date().toISOString(),
            })),
          }),
        });
        setSaving(false);
      }
      setStep(5);
    } else if (step === 5) {
      setSaving(true);
      await fetch("/api/onboarding/step5", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form5),
      });
      setSaving(false);
      setCompleteLoading(true);
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
      });
      setCompleteLoading(false);
      if (res.ok) {
        setSuccess(true);
      } else {
        const j = await res.json();
        alert(j.error ?? "เกิดข้อผิดพลาด");
      }
    }
  };

  const handleCompleteRedirect = () => {
    router.replace("/clinic");
    router.refresh();
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <motion.div
          {...fadeSlideUp}
          className="luxury-card p-10 max-w-lg w-full text-center"
        >
          <div className="text-5xl mb-6">🎉</div>
          <h1
            className="font-display text-3xl font-semibold text-mauve-800 mb-4"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            AI พร้อมใช้แล้ว!
          </h1>
          <p className="font-body text-mauve-600 mb-8">
            บริการที่เลือก {services.length} รายการ โปรโมชัน {form4Promos.filter((p) => p.name.trim()).length} รายการ
          </p>
          <Button onClick={handleCompleteRedirect} className="rg-gradient text-white border-0">
            ไปที่ Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto w-full">
        {/* Step indicator */}
        <div className="mb-10">
          <div className="flex justify-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full transition-all ${
                  s <= step ? "rg-gradient" : "bg-cream-300"
                }`}
              />
            ))}
          </div>
          <div className="h-1.5 bg-cream-300 rounded-full overflow-hidden">
            <motion.div
              className="h-full rg-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              {...fadeSlideUp}
              className="luxury-card p-8"
            >
              <h2
                className="font-display text-2xl font-semibold text-mauve-800 mb-6"
                style={{ fontFamily: "Cormorant Garamond, serif" }}
              >
                ข้อมูลพื้นฐาน
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    ชื่อคลินิก
                  </label>
                  <Input
                    value={form1.clinicName}
                    onChange={(e) => setForm1((f) => ({ ...f, clinicName: e.target.value }))}
                    onBlur={() => saveStep1Blur("clinicName", form1.clinicName)}
                    placeholder="ชื่อคลินิกของคุณ"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    ที่อยู่
                  </label>
                  <Input
                    value={form1.address}
                    onChange={(e) => setForm1((f) => ({ ...f, address: e.target.value }))}
                    onBlur={() => saveStep1Blur("address", form1.address)}
                    placeholder="ที่อยู่คลินิก"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    เบอร์โทร
                  </label>
                  <Input
                    value={form1.phone}
                    onChange={(e) => setForm1((f) => ({ ...f, phone: e.target.value }))}
                    onBlur={() => saveStep1Blur("phone", form1.phone)}
                    placeholder="02-xxx-xxxx"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    LINE Official Account (ถ้ามี)
                  </label>
                  <Input
                    value={form1.lineOA}
                    onChange={(e) => setForm1((f) => ({ ...f, lineOA: e.target.value }))}
                    onBlur={() => saveStep1Blur("lineOA", form1.lineOA)}
                    placeholder="@clinic_name"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-3">
                    เวลาทำการ
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_KEYS.map((d) => (
                      <div key={d} className="flex items-center gap-1">
                        <span className="font-body text-sm text-mauve-600 w-6">{DAY_LABELS[d]}</span>
                        <input
                          type="checkbox"
                          checked={!!form1.businessHours[d]}
                          onChange={(e) => {
                            const h = form1.businessHours[d];
                            setForm1((f) => ({
                              ...f,
                              businessHours: {
                                ...f.businessHours,
                                [d]: e.target.checked
                                  ? h ?? { open: "09:00", close: d === "saturday" ? "14:00" : "18:00" }
                                  : null,
                              },
                            }));
                          }}
                          className="rounded"
                        />
                        {form1.businessHours[d] && (
                          <>
                            <input
                              type="time"
                              value={form1.businessHours[d]?.open ?? "09:00"}
                              onChange={(e) =>
                                setForm1((f) => ({
                                  ...f,
                                  businessHours: {
                                    ...f.businessHours,
                                    [d]: { ...(f.businessHours[d] ?? { open: "09:00", close: "18:00" }), open: e.target.value },
                                  },
                                }))
                              }
                              className="text-sm border rounded px-1 py-0.5 w-20"
                            />
                            <span className="text-mauve-400">-</span>
                            <input
                              type="time"
                              value={form1.businessHours[d]?.close ?? "18:00"}
                              onChange={(e) =>
                                setForm1((f) => ({
                                  ...f,
                                  businessHours: {
                                    ...f.businessHours,
                                    [d]: { ...(f.businessHours[d] ?? { open: "09:00", close: "18:00" }), close: e.target.value },
                                  },
                                }))
                              }
                              className="text-sm border rounded px-1 py-0.5 w-20"
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              {...fadeSlideUp}
              className="luxury-card p-8"
            >
              <h2
                className="font-display text-2xl font-semibold text-mauve-800 mb-4"
                style={{ fontFamily: "Cormorant Garamond, serif" }}
              >
                เลือกบริการ
              </h2>
              <Input
                placeholder="ค้นหาบริการหรือหมวดหมู่"
                value={form2Search}
                onChange={(e) => setForm2Search(e.target.value)}
                className="mb-4"
              />
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setForm2Category("")}
                  className={`px-3 py-1 rounded-full text-sm font-body ${
                    !form2Category ? "rg-gradient text-white" : "bg-cream-200 text-mauve-600"
                  }`}
                >
                  ทั้งหมด
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm2Category((x) => (x === c ? "" : c))}
                    className={`px-3 py-1 rounded-full text-sm font-body ${
                      form2Category === c ? "rg-gradient text-white" : "bg-cream-200 text-mauve-600"
                    }`}
                  >
                    {CATEGORY_LABELS[c] ?? c}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex justify-between items-center">
                <span className="font-body text-sm text-mauve-600">
                  เลือกแล้ว {form2Selected.size} รายการ
                </span>
                {form2Selected.size > 0 && (
                  <span className="px-2 py-0.5 rounded-lg rg-gradient text-white text-xs">
                    {form2Selected.size}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {filteredPresets.length === 0 ? (
                  <p className="font-body text-mauve-500 py-8 text-center">ไม่พบบริการ</p>
                ) : (
                  filteredPresets.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-cream-200 hover:bg-cream-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form2Selected.has(p.id)}
                        onChange={(e) => {
                          setForm2Selected((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          });
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-body font-medium text-mauve-800">{p.name}</span>
                        <span className="font-body text-sm text-mauve-500 ml-2">
                          {p.defaultPrice > 0 ? `${p.defaultPrice} บาท` : ""}
                        </span>
                      </div>
                      <span className="text-xs text-mauve-400">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                    </label>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              {...fadeSlideUp}
              className="luxury-card p-8"
            >
              <h2
                className="font-display text-2xl font-semibold text-mauve-800 mb-4"
                style={{ fontFamily: "Cormorant Garamond, serif" }}
              >
                กำหนดราคา
              </h2>
              <p className="font-body text-sm text-mauve-600 mb-6">
                กรอกราคาสำหรับแต่ละบริการ (บาท) หรือใช้รูปแบบ 500-2000 สำหรับช่วงราคา
              </p>
              <div className="space-y-4">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center gap-4">
                    <span className="font-body font-medium text-mauve-800 flex-1 truncate">
                      {s.custom_title}
                    </span>
                    <Input
                      value={form3Prices[s.id] ?? ""}
                      onChange={(e) =>
                        setForm3Prices((p) => ({ ...p, [s.id]: e.target.value }))
                      }
                      placeholder="ราคา หรือ min-max"
                      className="w-32"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              {...fadeSlideUp}
              className="luxury-card p-8"
            >
              <h2
                className="font-display text-2xl font-semibold text-mauve-800 mb-4"
                style={{ fontFamily: "Cormorant Garamond, serif" }}
              >
                โปรโมชัน (ไม่บังคับ)
              </h2>
              <p className="font-body text-sm text-mauve-600 mb-6">
                สร้างได้สูงสุด 3 โปรโมชัน หรือข้ามขั้นตอนนี้
              </p>
              <div className="space-y-6">
                {form4Promos.map((pr, i) => (
                  <div key={i} className="p-4 rounded-xl border border-cream-200 space-y-3">
                    <Input
                      placeholder="ชื่อโปรโมชัน"
                      value={pr.name}
                      onChange={(e) =>
                        setForm4Promos((arr) => {
                          const n = [...arr];
                          n[i] = { ...n[i], name: e.target.value };
                          return n;
                        })
                      }
                    />
                    <div className="flex gap-4 flex-wrap">
                      <select
                        value={pr.discountType}
                        onChange={(e) =>
                          setForm4Promos((arr) => {
                            const n = [...arr];
                            n[i] = { ...n[i], discountType: e.target.value as "percent" | "fixed" };
                            return n;
                          })
                        }
                        className="border rounded px-3 py-2 font-body text-sm"
                      >
                        <option value="percent">%</option>
                        <option value="fixed">฿</option>
                      </select>
                      <Input
                        type="number"
                        placeholder="ค่า"
                        value={pr.value || ""}
                        onChange={(e) =>
                          setForm4Promos((arr) => {
                            const n = [...arr];
                            n[i] = { ...n[i], value: Number(e.target.value) || 0 };
                            return n;
                          })
                        }
                        className="w-24"
                      />
                      <Input
                        type="date"
                        placeholder="เริ่ม"
                        value={pr.startAt?.slice(0, 10) ?? ""}
                        onChange={(e) =>
                          setForm4Promos((arr) => {
                            const n = [...arr];
                            n[i] = { ...n[i], startAt: e.target.value || "" };
                            return n;
                          })
                        }
                        className="w-36"
                      />
                      <Input
                        type="date"
                        placeholder="สิ้นสุด"
                        value={pr.endAt?.slice(0, 10) ?? ""}
                        onChange={(e) =>
                          setForm4Promos((arr) => {
                            const n = [...arr];
                            n[i] = { ...n[i], endAt: e.target.value || "" };
                            return n;
                          })
                        }
                        className="w-36"
                      />
                    </div>
                  </div>
                ))}
                {form4Promos.length < 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm4Promos((arr) => [
                        ...arr,
                        { name: "", discountType: "percent", value: 0, startAt: "", endAt: "" },
                      ])
                    }
                    className="font-body text-sm text-rg-600 hover:underline"
                  >
                    + เพิ่มโปรโมชัน
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              {...fadeSlideUp}
              className="luxury-card p-8"
            >
              <h2
                className="font-display text-2xl font-semibold text-mauve-800 mb-6"
                style={{ fontFamily: "Cormorant Garamond, serif" }}
              >
                บุคลิก AI และสไตล์
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-2">
                    สไตล์คลินิก
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {(["luxury", "budget", "friendly"] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setForm5((f) => ({ ...f, clinic_style: style }))}
                        className={`luxury-card px-6 py-4 rounded-xl ${
                          form5.clinic_style === style ? "ring-2 ring-rg-400" : ""
                        }`}
                      >
                        {style === "luxury" ? "หรูหรา" : style === "budget" ? "ประหยัด" : "เป็นกันเอง"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-2">
                    น้ำเสียง AI
                  </label>
                  <div className="flex gap-4">
                    {(["formal", "casual", "fun"] as const).map((tone) => (
                      <label key={tone} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ai_tone"
                          checked={form5.ai_tone === tone}
                          onChange={() => setForm5((f) => ({ ...f, ai_tone: tone }))}
                        />
                        <span>{tone === "formal" ? "ทางการ" : tone === "casual" ? "สบายๆ" : "สนุก"}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    จุดเด่นของคลินิก (USP)
                  </label>
                  <textarea
                    value={form5.usp}
                    onChange={(e) => setForm5((f) => ({ ...f, usp: e.target.value }))}
                    placeholder="เช่น ใช้เทคโนโลยีล้ำสมัย ทีมแพทย์เฉพาะทาง"
                    className="w-full border rounded-xl p-3 font-body text-sm min-h-[80px]"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    คู่แข่ง (แท็ก)
                  </label>
                  <Input
                    placeholder="เพิ่มแท็ก เช่น คลินิก A, คลินิก B"
                    value={form5.competitors.join(", ")}
                    onChange={(e) =>
                      setForm5((f) => ({
                        ...f,
                        competitors: e.target.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-mauve-700 mb-1">
                    ข้อความต้อนรับ
                  </label>
                  <textarea
                    value={form5.greeting_message}
                    onChange={(e) => setForm5((f) => ({ ...f, greeting_message: e.target.value }))}
                    placeholder="สวัสดีครับ ยินดีต้อนรับสู่..."
                    className="w-full border rounded-xl p-3 font-body text-sm min-h-[100px]"
                    rows={4}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || saving}
          >
            ย้อนกลับ
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              saving ||
              completeLoading ||
              (step === 1 && !form1.clinicName.trim()) ||
              (step === 2 && form2Selected.size === 0)
            }
          >
            {completeLoading
              ? "กำลังเตรียม AI..."
              : saving
                ? "กำลังบันทึก..."
                : step === 5
                  ? "เสร็จสิ้น"
                  : "ถัดไป"}
          </Button>
        </div>
      </div>
    </div>
  );
}
