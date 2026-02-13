"use client";

/**
 * Enterprise: การตั้งค่าคิวและสล็อต
 * - เวลาเปิด–ปิดสาขา (branch_hours)
 * - ตารางแพทย์ (doctor_schedules) + บริการที่ทำได้ (procedures)
 * - วันปิด (blackout_dates)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";
import useSWR from "swr";
import type { DayOfWeek } from "@/types/clinic";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "จันทร์",
  tuesday: "อังคาร",
  wednesday: "พุธ",
  thursday: "พฤหัส",
  friday: "ศุกร์",
  saturday: "เสาร์",
  sunday: "อาทิตย์",
};

const DAY_KEYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function SlotSettings() {
  return (
    <RequireRole allowed={["owner", "manager"]}>
      <section>
        <SectionHeader
          title="การตั้งค่าคิวและสล็อต"
          description="เวลาทำการสาขา ตารางแพทย์ วันปิด — ใช้ควบคุม slot ว่างสำหรับการจอง"
        />
        <EnsureBranchHours />
        <BranchHoursSettings />
        <DoctorSchedulesSettings />
        <BlackoutDatesSettings />
      </section>
    </RequireRole>
  );
}

function EnsureBranchHours() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    fetch("/api/clinic/slot-settings", { method: "POST", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.created) setMessage(`สร้างเวลาทำการให้ ${d.created} สาขาแล้ว`);
      })
      .catch(() => {});
  }, [initialized]);

  const handleEnsure = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/clinic/slot-settings", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.created ? `สร้างเวลาทำการให้ ${data.created} สาขาแล้ว` : "ทุกสาขามีเวลาทำการแล้ว");
      } else {
        setMessage(data.error ?? "เกิดข้อผิดพลาด");
      }
    } catch {
      setMessage("การเชื่อมต่อล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="lg" className="mb-6">
      <CardHeader
        title="เตรียมระบบ"
        subtitle="สร้างเวลาทำการเริ่มต้น (จ–ศ 09:00–18:00, ส 09:00–14:00, อา ปิด) ให้ทุกสาขา"
      />
      <div className="flex items-center gap-4">
        <Button onClick={handleEnsure} disabled={loading}>
          {loading ? "กำลังดำเนินการ..." : "สร้างเวลาทำการให้ทุกสาขา"}
        </Button>
        {message && <span className="text-sm text-surface-600">{message}</span>}
      </div>
    </Card>
  );
}

function BranchHoursSettings() {
  const { data: branchesData } = useSWR<{ items: Array<{ id: string; name: string }> }>(
    "/api/clinic/branches",
    fetcher
  );
  const branches = branchesData?.items ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card padding="lg" className="mb-6">
      <CardHeader
        title="เวลาเปิด–ปิดสาขา"
        subtitle="กำหนดช่วงเวลาทำการและความยาวคิว (นาที) ของแต่ละสาขา"
      />
      {branches.length === 0 ? (
        <p className="text-sm text-surface-500 py-4">ยังไม่มีสาขา</p>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <BranchHoursForm
              key={b.id}
              branchId={b.id}
              branchName={b.name}
              expanded={expandedId === b.id}
              onToggle={() => setExpandedId((x) => (x === b.id ? null : b.id))}
              onSave={() => setExpandedId(null)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function BranchHoursForm({
  branchId,
  branchName,
  expanded,
  onToggle,
  onSave,
}: {
  branchId: string;
  branchName: string;
  expanded: boolean;
  onToggle: () => void;
  onSave: () => void;
}) {
  const { data, mutate } = useSWR<Record<string, unknown>>(
    expanded ? `/api/clinic/branches/${branchId}/hours` : null,
    fetcher
  );
  const [form, setForm] = useState<Record<string, { open: string; close: string } | null>>({});
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const days: Record<string, { open: string; close: string } | null> = {};
      for (const k of DAY_KEYS) {
        const v = data[k];
        if (v && typeof v === "object" && "open" in v && "close" in v) {
          days[k] = { open: String(v.open), close: String(v.close) };
        } else if (v === null) {
          days[k] = null;
        } else {
          days[k] = k === "sunday" ? null : { open: "09:00", close: k === "saturday" ? "14:00" : "18:00" };
        }
      }
      setForm(days);
      setSlotDuration(typeof data.slot_duration_minutes === "number" ? data.slot_duration_minutes : 30);
    }
  }, [data]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/branches/${branchId}/hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slot_duration_minutes: slotDuration }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      mutate();
      onSave();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 overflow-hidden">
      <button
        type="button"
        className="w-full flex justify-between items-center p-4 text-left hover:bg-surface-50"
        onClick={onToggle}
      >
        <span className="font-medium text-surface-900">{branchName}</span>
        <span className="text-surface-500">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="p-4 border-t border-surface-200 space-y-4 bg-surface-50/50">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2 font-medium">ความยาวคิว (นาที)</div>
            <div>
              <Input
                type="number"
                min={15}
                max={120}
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value) || 30)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DAY_KEYS.map((day) => (
              <div key={day} className="space-y-1">
                <label className="text-xs font-medium text-surface-600">{DAY_LABELS[day]}</label>
                {form[day] ? (
                  <div className="flex gap-1">
                    <Input
                      type="time"
                      value={form[day]!.open}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [day]: { ...f[day]!, open: e.target.value },
                        }))
                      }
                      className="text-sm"
                    />
                    <Input
                      type="time"
                      value={form[day]!.close}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [day]: { ...f[day]!, close: e.target.value },
                        }))
                      }
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-surface-500 text-sm">ปิด</span>
                    <button
                      type="button"
                      className="text-xs text-primary-600"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          [day]: { open: "09:00", close: "18:00" },
                        }))
                      }
                    >
                      เปิด
                    </button>
                  </div>
                )}
                {form[day] && (
                  <button
                    type="button"
                    className="text-xs text-surface-500 hover:text-red-600"
                    onClick={() => setForm((f) => ({ ...f, [day]: null }))}
                  >
                    ปิดวันนี้
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type DoctorScheduleItem = {
  id: string;
  doctor_id: string;
  doctor_name?: string;
  work_days: string[];
  work_start: string;
  work_end: string;
  procedures?: string[];
};

function DoctorSchedulesSettings() {
  const { data, mutate } = useSWR<{ items: DoctorScheduleItem[] }>(
    "/api/clinic/doctor-schedules",
    fetcher
  );
  const items = data?.items ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card padding="lg" className="mb-6">
      <CardHeader
        title="ตารางแพทย์"
        subtitle="วันเข้า ช่วงเวลา บริการที่ทำได้ — ใช้กรอง slot ตามแพทย์และหัตถการ"
        action={
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            + เพิ่มแพทย์
          </Button>
        }
      />
      {showAdd && (
        <AddDoctorScheduleForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            mutate();
          }}
        />
      )}
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-surface-500 py-4">ยังไม่มีตารางแพทย์ — ระบบจะใช้เวลาสาขา</p>
        ) : (
          items.map((s) => (
            <div key={s.id} className="rounded-lg border border-surface-200 overflow-hidden">
              <div className="flex justify-between items-center p-3 bg-surface-50">
                <div>
                  <span className="font-medium">{s.doctor_name || s.doctor_id}</span>
                  <span className="text-sm text-surface-500 ml-2">
                    {s.work_start}–{s.work_end} ({s.work_days?.length ?? 5} วัน)
                  </span>
                  {(s.procedures?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.procedures!.map((p) => (
                        <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(editingId === s.id ? null : s.id)}>
                    แก้ไข
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={async () => {
                      if (!confirm("ลบตารางแพทย์?")) return;
                      const res = await fetch(`/api/clinic/doctor-schedules/${s.id}`, {
                        method: "DELETE",
                        credentials: "include",
                      });
                      if (res.ok) mutate();
                    }}
                  >
                    ลบ
                  </Button>
                </div>
              </div>
              {editingId === s.id && (
                <EditDoctorScheduleForm
                  docId={s.id}
                  initial={s}
                  onClose={() => setEditingId(null)}
                  onSuccess={() => {
                    setEditingId(null);
                    mutate();
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

const DEFAULT_PROCEDURES = ["โบท็อกซ์", "ฟิลเลอร์", "เลเซอร์", "รีจูรัน", "สักคิ้ว", "ยกกระชับ", "consult"];

function AddDoctorScheduleForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [doctorId, setDoctorId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [workDays, setWorkDays] = useState<DayOfWeek[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const [customProcedure, setCustomProcedure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: knowledgeData } = useSWR<{ items: Array<{ service_name: string }> }>(
    "/api/clinic/knowledge-brain/global",
    fetcher
  );
  const serviceOptions = useMemo(() => {
    const fromKnowledge = (knowledgeData?.items ?? []).map((x) => x.service_name);
    const combined = [...new Set([...DEFAULT_PROCEDURES, ...fromKnowledge])].filter(Boolean).sort();
    return combined;
  }, [knowledgeData]);

  const toggleDay = (d: DayOfWeek) => {
    setWorkDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b))
    );
  };

  const toggleProcedure = (p: string) => {
    setProcedures((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort()
    );
  };

  const addCustomProcedure = () => {
    const v = customProcedure.trim();
    if (v && !procedures.includes(v)) {
      setProcedures((prev) => [...prev, v].sort());
      setCustomProcedure("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!doctorId.trim()) {
      setError("กรุณากรอกรหัส/ชื่อแพทย์");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/doctor-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: doctorId.trim(),
          doctor_name: doctorName.trim() || undefined,
          work_days: workDays,
          work_start: workStart,
          work_end: workEnd,
          procedures: procedures.length > 0 ? procedures : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เพิ่มไม่สำเร็จ");
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-surface-200 bg-surface-50/50 space-y-4">
      <h4 className="font-semibold">เพิ่มตารางแพทย์</h4>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="รหัส/ชื่อแพทย์"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            placeholder="พญ.สมหญิง หรือ doc001"
            required
          />
          <Input
            label="ชื่อแสดง (ถ้ามี)"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="พญ.สมหญิง ใจดี"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="เวลาเข้า" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
          <Input label="เวลาออก" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">วันทำงาน</label>
          <div className="flex flex-wrap gap-2">
            {DAY_KEYS.map((d) => (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={workDays.includes(d)}
                  onChange={() => toggleDay(d)}
                />
                <span className="text-sm">{DAY_LABELS[d]}</span>
              </label>
            ))}
          </div>
        </div>
        <ProcedureSelector
          procedures={procedures}
          serviceOptions={serviceOptions}
          customProcedure={customProcedure}
          setCustomProcedure={setCustomProcedure}
          onToggle={toggleProcedure}
          onAddCustom={addCustomProcedure}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "กำลังเพิ่ม..." : "เพิ่มแพทย์"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProcedureSelector({
  procedures,
  serviceOptions,
  customProcedure,
  setCustomProcedure,
  onToggle,
  onAddCustom,
}: {
  procedures: string[];
  serviceOptions: string[];
  customProcedure: string;
  setCustomProcedure: (v: string) => void;
  onToggle: (p: string) => void;
  onAddCustom: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 mb-2">บริการที่ทำได้</label>
      <p className="text-xs text-surface-500 mb-2">เลือกบริการ/หัตถการที่แพทย์คนนี้รับทำ — ใช้กรอง slot เวลาจอง</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {serviceOptions.map((p) => (
          <label key={p} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={procedures.includes(p)}
              onChange={() => onToggle(p)}
            />
            <span className="text-sm">{p}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customProcedure}
          onChange={(e) => setCustomProcedure(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddCustom())}
          placeholder="พิมพ์เพิ่ม (เช่น โบท็อกซ์คาง)"
          className="flex-1 px-3 py-2 rounded-lg border border-surface-200 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={onAddCustom}>
          เพิ่ม
        </Button>
      </div>
      {procedures.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {procedures.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-sm"
            >
              {p}
              <button type="button" onClick={() => onToggle(p)} className="text-primary-600 hover:text-red-600">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EditDoctorScheduleForm({
  docId,
  initial,
  onClose,
  onSuccess,
}: {
  docId: string;
  initial: DoctorScheduleItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [workStart, setWorkStart] = useState(initial.work_start);
  const [workEnd, setWorkEnd] = useState(initial.work_end);
  const [workDays, setWorkDays] = useState<DayOfWeek[]>(initial.work_days as DayOfWeek[]);
  const [procedures, setProcedures] = useState<string[]>(initial.procedures ?? []);
  const [customProcedure, setCustomProcedure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: knowledgeData } = useSWR<{ items: Array<{ service_name: string }> }>(
    "/api/clinic/knowledge-brain/global",
    fetcher
  );
  const serviceOptions = useMemo(() => {
    const fromKnowledge = (knowledgeData?.items ?? []).map((x) => x.service_name);
    return [...new Set([...DEFAULT_PROCEDURES, ...fromKnowledge, ...procedures])].filter(Boolean).sort();
  }, [knowledgeData, procedures]);

  const toggleDay = (d: DayOfWeek) => {
    setWorkDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b))
    );
  };

  const toggleProcedure = (p: string) => {
    setProcedures((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort()
    );
  };

  const addCustomProcedure = () => {
    const v = customProcedure.trim();
    if (v && !procedures.includes(v)) {
      setProcedures((prev) => [...prev, v].sort());
      setCustomProcedure("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic/doctor-schedules/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_days: workDays,
          work_start: workStart,
          work_end: workEnd,
          procedures,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white border-t border-surface-200 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <Input label="เวลาเข้า" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
          <Input label="เวลาออก" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">วันทำงาน</label>
          <div className="flex flex-wrap gap-2">
            {DAY_KEYS.map((d) => (
              <label key={d} className="flex items-center gap-1">
                <input type="checkbox" checked={workDays.includes(d)} onChange={() => toggleDay(d)} />
                <span className="text-sm">{DAY_LABELS[d]}</span>
              </label>
            ))}
          </div>
        </div>
        <ProcedureSelector
          procedures={procedures}
          serviceOptions={serviceOptions}
          customProcedure={customProcedure}
          setCustomProcedure={setCustomProcedure}
          onToggle={toggleProcedure}
          onAddCustom={addCustomProcedure}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
        </div>
      </form>
    </div>
  );
}

function BlackoutDatesSettings() {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const { data, mutate } = useSWR<{ items: Array<{ id: string; date: string; reason?: string; branch_id?: string | null }> }>(
    `/api/clinic/blackout-dates?from=${from}&to=${to}`,
    fetcher
  );
  const items = data?.items ?? [];
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Card padding="lg">
      <CardHeader
        title="วันปิด"
        subtitle="วันหยุด ซ่อมบำรุง — วันเหล่านี้จะไม่มี slot ว่าง"
        action={
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            + เพิ่มวันปิด
          </Button>
        }
      />
      {showAdd && (
        <AddBlackoutForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            mutate();
          }}
        />
      )}
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-surface-500 py-4">ยังไม่มีวันปิด</p>
        ) : (
          items.map((b) => (
            <BlackoutItem key={b.id} item={b} onDelete={mutate} />
          ))
        )}
      </div>
    </Card>
  );
}

function BlackoutItem({
  item,
  onDelete,
}: {
  item: { id: string; date: string; reason?: string };
  onDelete: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("ลบวันปิด?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic/blackout-dates/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onDelete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-between items-center p-3 rounded-lg bg-surface-50 border border-surface-100">
      <div>
        <span className="font-medium">{item.date}</span>
        {item.reason && <span className="text-sm text-surface-500 ml-2">({item.reason})</span>}
      </div>
      <Button variant="ghost" size="sm" className="text-red-600" onClick={handleDelete} disabled={loading}>
        ลบ
      </Button>
    </div>
  );
}

function AddBlackoutForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!date) {
      setError("กรุณาเลือกวันที่");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/blackout-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เพิ่มไม่สำเร็จ");
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-surface-200 bg-surface-50/50 space-y-4">
      <h4 className="font-semibold">เพิ่มวันปิด</h4>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-4 items-end">
        <Input
          label="วันที่"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="เหตุผล (ไม่บังคับ)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="วันหยุด, เครื่องซ่อม"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "กำลังเพิ่ม..." : "เพิ่ม"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          ยกเลิก
        </Button>
      </form>
    </div>
  );
}
