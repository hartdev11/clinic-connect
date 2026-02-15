"use client";

import { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";
import { BOOKING_CHANNELS } from "@/types/clinic";
import type { BookingChannel } from "@/types/clinic";

const DAY_NAMES_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_NAMES_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** Enterprise: ช่องทางที่ลูกค้าจองเข้ามา */
const CHANNEL_LABEL: Record<string, string> = {
  line: "LINE",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  web: "เว็บไซต์",
  walk_in: "Walk-in",
  phone: "โทรศัพท์",
  referral: "แนะนำ",
  other: "อื่นๆ",
};

const SOURCE_LABEL: Record<string, string> = {
  line: "LINE",
  web: "Web",
  admin: "แอดมิน",
  ai: "AI",
};

/** Workspace tabs — state-based rendering only */
type WorkspaceTab = "today" | "calendar" | "all" | "reports";

/** Visual tokens: Background #FFFFFF, Surface #F7F8FA, Border #E5E7EB, Primary text #111827, Secondary #6B7280. Spacing 4/8/12/16/24/32. Radius 8–12px. */
const statusColors: Record<string, "default" | "success" | "warning" | "info" | "error"> = {
  pending: "warning",
  confirmed: "success",
  in_progress: "info",
  completed: "info",
  "no-show": "error",
  cancelled: "default",
  pending_admin_confirm: "warning",
  reschedule_pending_admin: "warning",
  cancel_requested: "default",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  in_progress: "กำลังรับบริการ",
  completed: "เสร็จสิ้น",
  "no-show": "ไม่มาตามนัด",
  cancelled: "ยกเลิก",
  pending_admin_confirm: "รอแอดมินยืนยัน",
  reschedule_pending_admin: "รอแอดมินยืนยันเลื่อน",
  cancel_requested: "รอยกเลิก",
};

type BookingItem = {
  id: string;
  customerName: string;
  phoneNumber?: string | null;
  service: string;
  procedure?: string | null;
  amount?: number | null;
  source?: string | null;
  channel?: string | null;
  doctor?: string | null;
  branchId?: string;
  branchName?: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  queueNumber?: number;
  doctorGroup?: string;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** Status accent for left border — muted, no bright fill */
const statusAccentColor: Record<string, string> = {
  pending: "#D97706",
  confirmed: "#059669",
  in_progress: "#2563EB",
  completed: "#64748B",
  "no-show": "#DC2626",
  cancelled: "#94A3B8",
  pending_admin_confirm: "#D97706",
  reschedule_pending_admin: "#D97706",
  cancel_requested: "#94A3B8",
};

/** iOS minimal: list-style card — no borders, dot+text status, system buttons, 100ms */
function BookingCard({
  item: b,
  onEdit,
  onMutate,
}: {
  item: BookingItem;
  onEdit: () => void;
  onMutate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canModify =
    b.status === "pending" ||
    b.status === "confirmed" ||
    b.status === "in_progress" ||
    b.status === "pending_admin_confirm" ||
    b.status === "reschedule_pending_admin" ||
    b.status === "cancel_requested";
  const canCallQueue = b.status === "confirmed";
  const canComplete = b.status === "in_progress";
  const canConfirm =
    b.status === "pending" ||
    b.status === "pending_admin_confirm" ||
    b.status === "reschedule_pending_admin";
  const handleStatus = async (status: string) => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/clinic/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) onMutate();
      else setError(typeof data?.error === "string" ? data.error : "เกิดข้อผิดพลาด");
    } catch {
      setError("การเชื่อมต่อล้มเหลว");
    } finally {
      setLoading(false);
    }
  };
  const dotColor = statusAccentColor[b.status] ?? "#94A3B8";
  return (
    <div
      className="relative flex items-stretch gap-4 py-3 px-4 rounded-[10px] bg-white hover:bg-[#F2F2F7] transition-all duration-[90ms] min-h-0 leading-[1.4] hover:scale-[1.01]"
      style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
    >
      {error && (
        <p className="absolute top-0 left-0 right-0 text-xs text-red-600 bg-red-50/95 px-2 py-1 rounded-t-[10px] leading-tight" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col items-center justify-center shrink-0 w-11">
        <span className="text-[13px] font-medium text-neutral-500 tabular-nums leading-[1.4]" aria-label={`เวลา ${formatTime(b.scheduledAt)}`}>
          {formatTime(b.scheduledAt)}
        </span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-neutral-800 text-[15px] truncate leading-[1.4] align-middle">
            {b.queueNumber != null && (
              <span className="text-neutral-500 font-medium mr-1.5">{b.queueNumber}</span>
            )}
            {b.customerName}
          </span>
          {typeof b.amount === "number" && b.amount > 0 && (
            <span className="text-[13px] text-neutral-500 shrink-0 tabular-nums text-right">฿{b.amount.toLocaleString()}</span>
          )}
        </div>
        <p className="text-[13px] text-neutral-500 truncate leading-[1.4] mt-0.5">{b.service}{b.procedure ? ` · ${b.procedure}` : ""}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
          {b.doctor && <span className="text-[12px] text-neutral-500">{b.doctor}</span>}
          {(b.channel || b.source) && (
            <span className="text-[12px] text-neutral-500">
              {CHANNEL_LABEL[b.channel ?? ""] ?? SOURCE_LABEL[b.source ?? ""] ?? b.channel ?? b.source}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[12px] text-neutral-600 align-baseline" title={STATUS_LABEL[b.status] ?? b.status}>
            <span className="w-[6px] h-[6px] rounded-full shrink-0 self-center" style={{ backgroundColor: dotColor }} aria-hidden />
            {STATUS_LABEL[b.status] ?? b.status}
          </span>
        </div>
      </div>
      {canModify && (
        <div className="flex items-center gap-1.5 shrink-0">
          {canConfirm && (
            <button type="button" className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100 disabled:opacity-50" onClick={() => handleStatus("confirmed")} disabled={loading} title={b.status === "reschedule_pending_admin" ? "ยืนยันเลื่อน" : "ยืนยัน"}>
              {b.status === "reschedule_pending_admin" ? "ยืนยันเลื่อน" : "ยืนยัน"}
            </button>
          )}
          {canCallQueue && (
            <button type="button" className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100 disabled:opacity-50" onClick={() => handleStatus("in_progress")} disabled={loading} title="เรียกคิว">
              เรียกคิว
            </button>
          )}
          {canComplete && (
            <button type="button" className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100 disabled:opacity-50" onClick={() => handleStatus("completed")} disabled={loading} title="เสร็จสิ้น">
              เสร็จสิ้น
            </button>
          )}
          <button type="button" className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium bg-transparent text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100 disabled:opacity-50" onClick={onEdit} disabled={loading} title="แก้ไข">
            แก้ไข
          </button>
          <button type="button" className="h-[34px] px-3 rounded-[10px] text-[13px] font-medium text-red-600 hover:bg-red-50/50 transition-colors duration-100 disabled:opacity-50" onClick={() => handleStatus("cancelled")} disabled={loading} title={b.status === "cancel_requested" ? "ยืนยันยกเลิก" : "ยกเลิก"}>
            {b.status === "cancel_requested" ? "ยืนยันยกเลิก" : b.status === "confirmed" ? "ยกเลิก" : "ปฏิเสธ"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatDateForInput(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

/** Enterprise: หน้างานวันนี้ — แสดงคิวเรียงตามเวลา พร้อมปุ่มเรียกคิว/เสร็จสิ้น */
function QueueWorkbench({
  dateStr,
  branchFilter,
  branches,
  onMutate,
  onEdit,
}: {
  dateStr: string;
  branchFilter: string;
  branches: Array<{ id: string; name: string }>;
  onMutate: () => void;
  onEdit: (item: BookingItem) => void;
}) {
  const [queueDate, setQueueDate] = useState(dateStr);
  const [queueBranch, setQueueBranch] = useState(branchFilter);
  const [groupByDoctor, setGroupByDoctor] = useState(true);

  const queueParams = new URLSearchParams({
    date: queueDate,
    groupByDoctor: String(groupByDoctor),
  });
  if (queueBranch !== "all") queueParams.set("branchId", queueBranch);

  const { data: queueData } = useSWR<{
    items: BookingItem[];
    total: number;
  }>(`/api/clinic/bookings/queue?${queueParams}`, apiFetcher, { refreshInterval: 10000 });

  const queueItems = queueData?.items ?? [];
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);

  const byDoctor = useMemo(() => {
    const m = new Map<string, BookingItem[]>();
    for (const b of queueItems) {
      const key = b.doctorGroup ?? "(รวม)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(b);
    }
    return m;
  }, [queueItems]);

  return (
    <section>
      <div className="flex justify-between items-start gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-neutral-900 leading-[1.4]">หน้างานวันนี้</h2>
          <p className="text-[13px] text-neutral-500 mt-1 leading-[1.4]">คิวเรียงตามเวลา — เรียกคิวเมื่อลูกค้ามา แตะเสร็จสิ้นเมื่อให้บริการแล้ว</p>
        </div>
        <a
          href={`/clinic/queue-display${queueBranch !== "all" ? `?branchId=${queueBranch}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-neutral-800 hover:opacity-80 transition-opacity duration-100 shrink-0"
        >
          เปิดหน้าจอคิว →
        </a>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-[13px] font-medium text-neutral-500 leading-[1.4]">
            <span>วันที่</span>
            <input
              type="date"
              value={queueDate}
              onChange={(e) => setQueueDate(e.target.value)}
              className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            />
          </label>
          <select
            value={queueBranch}
            onChange={(e) => setQueueBranch(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[13px] font-medium text-neutral-800 cursor-pointer leading-[1.4]">
            <input
              type="checkbox"
              checked={groupByDoctor}
              onChange={(e) => setGroupByDoctor(e.target.checked)}
              className="rounded border-[#E5E7EB]"
            />
            <span>แยกตามแพทย์</span>
          </label>
        </div>

        {queueItems.length === 0 ? (
          <p className="text-[13px] text-neutral-500 py-8 text-center leading-[1.4]">ไม่มีคิววันนี้</p>
        ) : groupByDoctor ? (
          <div className="space-y-4">
            {Array.from(byDoctor.entries()).map(([doctor, items]) => (
              <div key={doctor} className="space-y-0">
                <button
                  type="button"
                  className="w-full flex justify-between items-center px-0 py-2 text-left text-[13px] font-medium text-neutral-800 leading-[1.4] hover:opacity-80 transition-opacity duration-100"
                  onClick={() => setExpandedDoctor((x) => (x === doctor ? null : doctor))}
                >
                  <span className="font-medium text-neutral-800">{doctor}</span>
                  <span className="text-[13px] text-neutral-500">{items.length} คิว</span>
                </button>
                {(expandedDoctor === null || expandedDoctor === doctor) && (
                  <div className="space-y-3 pt-1">
                    {items.map((b) => (
                      <BookingCard key={b.id} item={b} onEdit={() => onEdit(b)} onMutate={onMutate} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {queueItems.map((b) => (
              <BookingCard key={b.id} item={b} onEdit={() => onEdit(b)} onMutate={onMutate} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Insight block — signature metric 30–32px, 8px/16px spacing, contextual hint from existing data */
function TodaySummaryPanel({
  todayStr,
  todayCount,
  branchLabel,
  waitingCount = 0,
}: {
  todayStr: string;
  todayCount: number;
  branchLabel: string;
  waitingCount?: number;
}) {
  return (
    <div className="bg-[#FAFAFA] rounded-[12px] p-6">
      <p className="text-[32px] font-semibold text-neutral-900 tabular-nums leading-[1.2] tracking-[-0.01em]">{todayCount}</p>
      <p className="text-[13px] font-medium text-neutral-500 leading-[1.4] mt-2">การจองวันนี้</p>
      <div className="mt-4 space-y-3">
        {waitingCount > 0 && (
          <p className="text-[13px] text-neutral-500 leading-[1.4]">{waitingCount} รอรับบริการ</p>
        )}
        <p className="text-[13px] leading-[1.4] text-neutral-500"><span className="font-medium text-neutral-800">สาขา</span> {branchLabel}</p>
        <p className="text-[13px] leading-[1.4] text-neutral-500"><span className="font-medium text-neutral-800">วันที่</span> {formatDate(todayStr + "T12:00:00")}</p>
      </div>
    </div>
  );
}

/** Enterprise: แสดง timeline แบบ time-slot — ว่าง/มีคิว/เสร็จแล้ว ต่อช่วงเวลา */
function DayTimelineView({
  dateStr,
  branchId,
  doctorId,
  doctorName,
  onSelectBooking,
}: {
  dateStr: string;
  branchId: string;
  doctorId?: string;
  doctorName?: string;
  onSelectBooking?: (bookingId: string) => void;
}) {
  const params = new URLSearchParams({ date: dateStr, branchId });
  if (doctorId) params.set("doctorId", doctorId);
  const { data, isLoading } = useSWR<{
    date: string;
    branchId: string;
    slots: Array<{
      start: string;
      end: string;
      status: "free" | "busy" | "completed";
      customerName?: string;
      service?: string;
      bookingId?: string;
    }>;
    doctorName?: string;
  }>(`/api/clinic/bookings/timeline?${params}`, apiFetcher, { revalidateOnFocus: false });

  const slots = data?.slots ?? [];
  const freeCount = slots.filter((s) => s.status === "free").length;
  const busyCount = slots.filter((s) => s.status === "busy").length;
  const doneCount = slots.filter((s) => s.status === "completed").length;

  if (isLoading) return (
    <div className="py-4 space-y-2" aria-busy="true" aria-live="polite">
      <div className="h-4 w-3/4 rounded bg-[#E5E7EB] animate-pulse" />
      <div className="h-16 grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-8 rounded bg-[#E5E7EB] animate-pulse" />
        ))}
      </div>
    </div>
  );
  if (slots.length === 0)
    return (
      <div className="py-4 text-center text-sm text-[#6B7280]">
        วันนี้งดให้บริการ{doctorName ? ` (${doctorName})` : ""}
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-[#6B7280] leading-[1.4]">
        ว่าง {freeCount} · มีคิว {busyCount} · เสร็จ {doneCount}
        {doctorName && ` · ${doctorName}`}
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
        {slots.map((s, i) => {
          const clickable = (s.status === "busy" || s.status === "completed") && s.bookingId && onSelectBooking;
          return (
          <div
            key={i}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onSelectBooking?.(s.bookingId!) : undefined}
            onKeyDown={clickable ? (e) => e.key === "Enter" && onSelectBooking?.(s.bookingId!) : undefined}
            className={`
              rounded-[10px] p-2 text-[12px] truncate leading-[1.4] transition-colors duration-100
              ${s.status === "free" ? "bg-[#FAFAFA] text-[#6B7280]" : ""}
              ${s.status === "busy" ? "bg-[#EFF6FF] text-[#1E40AF] font-medium" : ""}
              ${s.status === "completed" ? "bg-[#FAFAFA] text-[#6B7280] line-through" : ""}
              ${clickable ? "cursor-pointer hover:opacity-90" : ""}
            `}
            title={
              s.status === "free"
                ? `${s.start}–${s.end} ว่าง`
                : s.status === "busy"
                  ? `${s.start} ${s.customerName ?? ""} · ${s.service ?? ""}`
                  : `${s.start} เสร็จแล้ว`
            }
          >
            {s.start}
            {s.status === "busy" && s.customerName && (
              <span className="block truncate mt-0.5 text-[10px]">{s.customerName}</span>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

/** Enterprise: เลือกเวลาจาก slot ที่ว่าง (กรองตามบริการ ถ้ามี) */
function SlotSelector({
  branchId,
  dateStr,
  procedure,
  onSelect,
}: {
  branchId: string;
  dateStr: string;
  procedure?: string;
  onSelect: (startISO: string, doctorId?: string, doctorName?: string) => void;
}) {
  const params = new URLSearchParams({ branchId, date: dateStr });
  if (procedure) params.set("procedure", procedure);
  const { data, isLoading } = useSWR<{ slots: Array<{ start: string; startISO: string; doctorId?: string; doctorName?: string }> }>(
    `/api/clinic/bookings/slots?${params}`,
    apiFetcher
  );
  const slots = data?.slots ?? [];
  if (isLoading || slots.length === 0) return null;
  return (
    <div className="mt-2">
      <span className="text-[12px] font-medium text-[#6B7280]">หรือเลือกเวลาว่าง: </span>
      <div className="flex flex-wrap gap-1 mt-1">
        {slots.slice(0, 12).map((s) => (
          <button
            key={`${s.startISO}-${s.doctorId ?? ""}`}
            type="button"
            className="min-h-[34px] px-3 py-2 rounded-[10px] text-[13px] font-medium bg-white text-[#111827] hover:bg-[#F5F5F7] transition-colors duration-100"
            onClick={() => onSelect(s.startISO, s.doctorId, s.doctorName)}
            title={s.doctorName ? `${s.start} - ${s.doctorName}` : s.start}
          >
            {s.start}
            {s.doctorName && <span className="text-[11px] text-[#6B7280] ml-0.5">({s.doctorName})</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

type DateStats = { active: number; completed: number };

/** Enterprise: ปฏิทิน — ว่าง / มีคิวรอ (active) / เสร็จแล้ว (completed) */
function CalendarGrid({
  year,
  month,
  datesWithCount,
  datesWithStatus,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  datesWithCount: Record<string, number>;
  datesWithStatus?: Record<string, DateStats>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const today = new Date();
  const todayStr =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? `${year}-${String(month).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      : null;
  const cells: Array<{ day: number; dateStr: string; isCurrentMonth: boolean; count: number; stats?: DateStats }> = [];

  for (let i = 0; i < startPad; i++) {
    const d = prevMonthDays - startPad + i + 1;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({
      day: d,
      dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      isCurrentMonth: false,
      count: 0,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d,
      dateStr,
      isCurrentMonth: true,
      count: datesWithCount[dateStr] ?? 0,
      stats: datesWithStatus?.[dateStr],
    });
  }
  const remainder = cells.length % 7;
  const extra = remainder ? 7 - remainder : 0;
  for (let i = 0; i < extra; i++) {
    cells.push({
      day: i + 1,
      dateStr: "",
      isCurrentMonth: false,
      count: 0,
    });
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {DAY_NAMES_TH.map((d) => (
        <div key={d} className="text-center text-[12px] font-medium text-[#6B7280] py-1 leading-[1.35]">
          {d}
        </div>
      ))}
      {cells.map((c, i) => {
        const stats = c.stats ?? { active: 0, completed: 0 };
        const hasActive = stats.active > 0;
        const hasCompletedOnly = stats.completed > 0 && !hasActive;
        const hasBoth = hasActive && stats.completed > 0;
        const cellStyle =
          hasActive || hasCompletedOnly
            ? hasCompletedOnly
              ? "bg-[#FAFAFA] text-[#6B7280]"
              : hasBoth
                ? "bg-[#EFF6FF] text-[#1E40AF] font-medium"
                : "bg-[#EFF6FF] text-[#1E40AF] font-medium"
            : "hover:bg-[#F5F5F7]";
        return (
          <button
            key={i}
            type="button"
            onClick={() => c.dateStr && onSelectDate(c.dateStr)}
            disabled={!c.dateStr}
            aria-label={c.dateStr ? (c.dateStr === todayStr ? `วันนี้ ${c.day}` : `วันที่ ${c.day}`) : undefined}
            className={`
              min-h-[40px] rounded-[10px] text-[13px] leading-[1.4] transition-colors duration-[120ms] ease-out
              hover:ring-2 hover:ring-inset hover:ring-neutral-200/80
              ${c.isCurrentMonth ? "" : "text-[#9CA3AF]"}
              ${cellStyle}
              ${selectedDate === c.dateStr ? "ring-2 ring-black/20 bg-[#F5F5F7]" : ""}
              ${c.dateStr === todayStr ? "font-semibold text-[#111827]" : ""}
            `}
          >
            {c.day}
            {c.count > 0 && (
              <span className="block text-[10px] font-normal mt-0.5">
                {hasCompletedOnly ? (
                  <span className="text-[#6B7280]">✓ {stats.completed} เสร็จ</span>
                ) : hasBoth ? (
                  <span>{stats.active} คิว · ✓ {stats.completed}</span>
                ) : (
                  <span>{stats.active} จอง</span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BookingPageContent() {
  const { branch_id } = useClinicContext();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reportTo, setReportTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [editingItem, setEditingItem] = useState<BookingItem | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("today");

  const calendarParams = new URLSearchParams({
    year: String(viewYear),
    month: String(viewMonth),
  });
  if (branchFilter !== "all") calendarParams.set("branchId", branchFilter);
  if (channelFilter !== "all") calendarParams.set("channel", channelFilter);
  if (doctorFilter !== "all") calendarParams.set("doctorId", doctorFilter);

  const { data: calendarData, error: calendarError, isLoading: calendarLoading, mutate: mutateCalendar } = useSWR<{
    datesWithCount: Record<string, number>;
    datesWithStatus?: Record<string, { active: number; completed: number }>;
    items: BookingItem[];
  }>(
    `/api/clinic/bookings/calendar?${calendarParams}`,
    apiFetcher
  );
  const { data: branchesData } = useSWR<{ items: Array<{ id: string; name: string }> }>(
    "/api/clinic/branches",
    apiFetcher
  );
  const { data: doctorsData } = useSWR<{
    items: Array<{ id: string; doctor_id: string; doctor_name?: string }>;
  }>("/api/clinic/doctor-schedules", apiFetcher);
  const { data: servicesData } = useSWR<{ items: Array<{ id: string; service_name: string }> }>(
    "/api/clinic/knowledge-brain/global",
    apiFetcher
  );

  const [lastId, setLastId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<BookingItem[]>([]);
  const listParams = new URLSearchParams({ limit: "100" });
  if (branch_id) listParams.set("branchId", branch_id);
  if (branchFilter !== "all") listParams.set("branchId", branchFilter);
  if (channelFilter !== "all") listParams.set("channel", channelFilter);
  if (statusFilter) listParams.set("status", statusFilter);

  const reportParams = new URLSearchParams({ from: reportFrom, to: reportTo });
  if (branchFilter !== "all") reportParams.set("branchId", branchFilter);
  if (channelFilter !== "all") reportParams.set("channel", channelFilter);

  const listCacheKey = `/api/clinic/bookings?${listParams}`;
  const { data: listData, mutate: mutateList } = useSWR<{ items: BookingItem[]; lastId?: string | null; hasMore?: boolean }>(
    listCacheKey,
    apiFetcher
  );

  useEffect(() => {
    setAllItems([]);
    setLastId(null);
  }, [listCacheKey]);

  useEffect(() => {
    if (listData?.items) {
      setAllItems(listData.items);
      setLastId(listData.lastId ?? null);
    }
  }, [listData?.items, listData?.lastId]);

  const loadMore = useCallback(async () => {
    if (!lastId) return;
    const params = new URLSearchParams({ limit: "100" });
    if (branch_id) params.set("branchId", branch_id);
    if (branchFilter !== "all") params.set("branchId", branchFilter);
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("startAfter", lastId);
    const res = await fetch(`/api/clinic/bookings?${params}`, { credentials: "include" });
    const data = await res.json();
    if (data?.items?.length) {
      setAllItems((prev) => [...prev, ...data.items]);
      setLastId(data.lastId ?? null);
    } else {
      setLastId(null);
    }
  }, [lastId, branchFilter, channelFilter, statusFilter, branch_id]);
  const { data: reportData } = useSWR<{
    totalCount: number;
    totalAmount: number;
    byChannel: Array<{ channel: string; count: number; amount: number }>;
    byProcedure: Array<{ name: string; count: number }>;
    byDate: Array<{ date: string; count: number }>;
    items: Array<{
      id: string;
      customerName: string;
      service: string;
      procedure?: string | null;
      channel?: string | null;
      amount?: number | null;
      scheduledAt: string;
      status: string;
      branchName?: string;
    }>;
  }>(`/api/clinic/bookings/reports?${reportParams}`, apiFetcher);

  const items = selectedDate ? [] : allItems;
  const calendarItems = calendarData?.items ?? [];
  const selectedDayItems = selectedDate
    ? calendarItems.filter((b) => b.scheduledAt.startsWith(selectedDate))
    : [];

  const branches = branchesData?.items ?? [];
  const services = servicesData?.items ?? [];

  const doctors = doctorsData?.items ?? [];
  const reports = useMemo(() => {
    const data = reportData;
    if (!data)
      return {
        totalCount: 0,
        totalAmount: 0,
        byChannel: [] as Array<[string, { count: number; amount: number }]>,
        byProcedure: [] as Array<[string, number]>,
        byDate: [] as Array<[string, number]>,
      };
    return {
      totalCount: data.totalCount,
      totalAmount: data.totalAmount,
      byChannel: data.byChannel.map((x) => [x.channel, { count: x.count, amount: x.amount }] as const),
      byProcedure: data.byProcedure.slice(0, 10).map((x) => [x.name, x.count] as const),
      byDate: data.byDate.map((x) => [x.date, x.count] as const),
    };
  }, [reportData]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }, [viewMonth]);
  const nextMonth = useCallback(() => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const todayWaitingCount = useMemo(() => {
    if (activeTab !== "today") return 0;
    return calendarItems.filter((b) => b.scheduledAt.startsWith(todayStr) && (b.status === "pending" || b.status === "confirmed")).length;
  }, [activeTab, todayStr, calendarItems]);

  const [tabUnderlineExpanded, setTabUnderlineExpanded] = useState(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setTabUnderlineExpanded(true));
    });
    return () => cancelAnimationFrame(id);
  }, [activeTab]);
  const setActiveTabWithUnderline = useCallback((tab: WorkspaceTab) => {
    setActiveTab(tab);
    setTabUnderlineExpanded(false);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans antialiased relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_-10%,rgba(0,0,0,0.025),transparent_60%)]" aria-hidden />
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-6">
        <PageHeader
          title="การจอง"
          description="จัดการการจองคิว — ปฏิทิน เลือกวัน จองด้วยแอดมิน หรือ AI"
          aiAnalyze
        />

      {activeTab === "today" && (
        <div className="pt-8 pb-2">
          <h2 className="text-[21px] font-medium text-neutral-800 leading-[1.3]">หน้างานวันนี้</h2>
          <p className="text-[13px] text-neutral-500 mt-1 leading-[1.4]">คิวเรียงตามเวลา — เรียกคิวเมื่อลูกค้ามา แตะเสร็จสิ้นเมื่อให้บริการแล้ว</p>
        </div>
      )}

      {/* Sticky Workspace Tabs — underline active, 2px, ease-out */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 md:-mx-6 md:px-6 pt-2 pb-4 flex gap-6 border-b border-neutral-100" role="tablist" aria-label="Workspace tabs">
        {(
          [
            ["today", "วันนี้"],
            ["calendar", "ปฏิทิน"],
            ["all", "รายการจองทั้งหมด"],
            ["reports", "รายงาน"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTabWithUnderline(tab)}
            className={`relative min-h-[40px] px-1 pb-2 text-[14px] font-medium leading-[1.4] transition-colors duration-[120ms] ease-out focus:outline-none focus:ring-2 focus:ring-black/20 focus:ring-offset-2 ${
              activeTab === tab ? "text-neutral-800" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {label}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-0 h-[2px] bg-neutral-800 rounded-full transition-[width] duration-[120ms] ease-out"
                style={{ width: tabUnderlineExpanded ? "100%" : "40%" }}
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>

      {/* TODAY: 48px below header→grid, 32px Queue→Timeline, 16px inside sections */}
      {activeTab === "today" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)] gap-6 md:gap-8 lg:gap-10 pt-12 pb-10">
          <div className="min-w-0 space-y-8">
            <div className="bg-[#FAFAFA] rounded-[12px] p-6">
              <div className="bg-white rounded-[12px] p-6">
              <QueueWorkbench
        dateStr={todayStr}
        branchFilter={branchFilter}
        branches={branches}
        onMutate={() => {
          void mutateList();
          void mutateCalendar();
        }}
        onEdit={(item) => setEditingItem(item)}
      />
              </div>
            </div>
            <section className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-4">
              <h2 className="text-[17px] font-medium text-neutral-800 leading-[1.4]">Timeline วันนี้</h2>
              <DayTimelineView
                dateStr={todayStr}
                branchId={branchFilter !== "all" ? branchFilter : branches[0]?.id ?? ""}
                doctorId={doctorFilter !== "all" ? doctorFilter : undefined}
                doctorName={doctorFilter !== "all" ? doctors.find((d) => (d.doctor_id || d.doctor_name || d.id) === doctorFilter)?.doctor_name : undefined}
                onSelectBooking={(id) => {
                  const item = calendarItems.find((b) => b.id === id);
                  if (item) setEditingItem(item);
                }}
              />
            </section>
          </div>
          <div className="min-w-0 lg:max-w-[300px]">
            <TodaySummaryPanel
              todayStr={todayStr}
              todayCount={calendarData?.datesWithCount?.[todayStr] ?? 0}
              branchLabel={branchFilter === "all" ? "ทุกสาขา" : branches.find((b) => b.id === branchFilter)?.name ?? branchFilter}
              waitingCount={todayWaitingCount}
            />
          </div>
        </div>
      )}

      {/* CALENDAR: soft container, micro legend, grid-aligned */}
      {activeTab === "calendar" && (
      <section className="py-8">
        <div className="sticky top-[52px] z-[9] bg-white -mx-4 px-4 md:-mx-6 md:px-6 py-3 mb-8 flex flex-wrap gap-3 items-center">
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            title="เลือกรูปแบบปฏิทิน"
            aria-label="เลือกแพทย์"
          >
            <option value="all">รวมทุกแพทย์</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.doctor_id || d.doctor_name || d.id}>
                {d.doctor_name || d.doctor_id || `แพทย์ ${d.id.slice(0, 6)}`}
              </option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            aria-label="เลือกสาขา"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            title="กรองตามช่องทาง"
            aria-label="เลือกช่องทาง"
          >
            <option value="all">ทุกช่องทาง</option>
            {BOOKING_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowCreateModal(true)} className="min-h-[36px] px-4 py-2 rounded-[10px] text-[13px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100">
            + จองคิว
          </button>
        </div>
        <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-5">
            <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">ปฏิทิน</p>
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-medium text-neutral-800 leading-[1.4]">
                {MONTH_NAMES_TH[viewMonth - 1]} {viewYear + 543}
              </h3>
              <div className="flex gap-1">
                <button type="button" onClick={prevMonth} className="min-h-[36px] min-w-[36px] px-2 rounded-[10px] text-[13px] font-medium text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100" aria-label="เดือนก่อน">
                  ‹
                </button>
                <button type="button" onClick={nextMonth} className="min-h-[36px] min-w-[36px] px-2 rounded-[10px] text-[13px] font-medium text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100" aria-label="เดือนถัดไป">
                  ›
                </button>
              </div>
            </div>
            {calendarError && (
              <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-[10px] bg-red-50 text-[13px] text-red-700 leading-[1.4]" role="alert">
                <span>โหลดปฏิทินไม่สำเร็จ: {calendarError.message}</span>
                <button type="button" className="shrink-0 text-[13px] font-medium text-red-700 hover:opacity-80" onClick={() => void mutateCalendar()}>
                  ลองใหม่
                </button>
              </div>
            )}
            {calendarLoading && !calendarData && (
              <div className="py-8 space-y-3" aria-busy="true">
                <div className="h-4 w-24 rounded-[10px] bg-[#F5F5F7] animate-pulse mx-auto" />
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-[10px] bg-[#F5F5F7] animate-pulse" />
                  ))}
                </div>
              </div>
            )}
            {!calendarLoading && (
              <>
                <CalendarGrid
                  year={viewYear}
                  month={viewMonth}
                  datesWithCount={calendarData?.datesWithCount ?? {}}
                  datesWithStatus={calendarData?.datesWithStatus}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
                <p className="mt-5 text-[12px] text-neutral-500 flex flex-wrap gap-x-4 gap-y-1 leading-[1.4]">
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-300 mr-1.5 align-middle" /> มีคิวรอ</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E5E7EB] mr-1.5 align-middle" /> เสร็จแล้ว</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9CA3AF] mr-1.5 align-middle" /> ว่าง</span>
                </p>
                {selectedDate && (branchFilter !== "all" || branches[0]?.id) && (
                  <DayTimelineView
                    dateStr={selectedDate}
                    branchId={branchFilter !== "all" ? branchFilter : branches[0]!.id}
                    doctorId={doctorFilter !== "all" ? doctorFilter : undefined}
                    doctorName={
                      doctorFilter !== "all"
                        ? doctors.find((d) => (d.doctor_id || d.doctor_name || d.id) === doctorFilter)?.doctor_name
                        : undefined
                    }
                    onSelectBooking={(id) => {
                      const item = calendarItems.find((b) => b.id === id);
                      if (item) setEditingItem(item);
                    }}
                  />
                )}
              </>
            )}
          </div>
      </section>
      )}

      {/* ALL BOOKINGS: soft container, summary, grid-aligned */}
      {activeTab === "all" && (
      <section className="py-8">
        <div className="sticky top-[52px] z-[9] bg-white -mx-4 px-4 md:-mx-6 md:px-6 py-3 mb-8 flex flex-wrap gap-3 items-center">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            aria-label="สาขา"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            aria-label="ช่องทาง"
          >
            <option value="all">ทุกช่องทาง</option>
            {BOOKING_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
            ))}
          </select>
          <button type="button" onClick={() => setShowCreateModal(true)} className="min-h-[36px] px-4 py-2 rounded-[10px] text-[13px] font-medium bg-black text-white hover:bg-neutral-800 transition-colors duration-100">
            + จองคิว
          </button>
        </div>
        <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-4">
          <div>
            <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">รายการทั้งหมด</p>
            <p className="text-[14px] font-medium text-neutral-800 leading-[1.4] mt-0.5">
              {allItems.length} รายการ{lastId ? " · โหลดเพิ่มได้" : ""}
            </p>
          </div>
          <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-[13px] text-neutral-500 py-8 text-center leading-[1.4]">ยังไม่มีรายการจอง</p>
          ) : (
            items.map((b) => (
              <BookingCard
                key={b.id}
                item={b}
                onEdit={() => setEditingItem(b)}
                onMutate={() => {
                  void mutateList();
                  void mutateCalendar();
                }}
              />
            ))
          )}
          </div>
          {lastId && (
            <div className="pt-2">
              <button type="button" className="w-full min-h-[36px] rounded-[10px] text-[13px] font-medium text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100" onClick={loadMore}>
                โหลดเพิ่ม
              </button>
            </div>
          )}
        </div>
      </section>
      )}

      {/* REPORTS: type scale, micro-labels, soft containers */}
      {activeTab === "reports" && (
      <section className="py-8">
        <div className="mb-8">
          <h2 className="text-[17px] font-medium text-neutral-800 leading-[1.4]">รายงานการจอง</h2>
          <p className="text-[13px] text-neutral-500 mt-1 leading-[1.4]">สรุปตามช่องทาง หัตถการ จำนวนเงิน</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-2">
            <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">ช่วงที่เลือก</p>
            <p className="text-[30px] font-semibold text-neutral-800 tabular-nums leading-[1.2]">{reports.totalCount}</p>
            <p className="text-[13px] font-medium text-neutral-500 leading-[1.4]">จำนวนจองทั้งหมด</p>
          </div>
          <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-2">
            <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wide">ช่วงที่เลือก</p>
            <p className="text-[30px] font-semibold text-neutral-800 tabular-nums leading-[1.2]">฿{reports.totalAmount.toLocaleString()}</p>
            <p className="text-[13px] font-medium text-neutral-500 leading-[1.4]">ยอดรวม (บาท)</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center mb-8">
          <label className="flex items-center gap-2 text-[13px] font-medium text-neutral-500 leading-[1.4]">
            <span>ช่วงวันที่</span>
            <input
              type="date"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
              className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            />
            <span>-</span>
            <input
              type="date"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
              className="min-h-[36px] px-3 py-2 rounded-[10px] border border-[#E5E7EB] text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow duration-100"
            />
          </label>
          <button
            type="button"
            className="min-h-[36px] px-4 py-2 rounded-[10px] text-[13px] font-medium bg-transparent text-neutral-800 hover:bg-[#F2F2F7] transition-colors duration-100"
            onClick={() => {
              const items = reportData?.items ?? [];
              const headers = ["วันที่", "ชื่อลูกค้า", "บริการ", "หัตถการ", "ช่องทาง", "จำนวนเงิน", "สถานะ", "สาขา"];
              const rows = items.map((b) => [
                new Date(b.scheduledAt).toLocaleString("th-TH"),
                b.customerName,
                b.service,
                b.procedure ?? "",
                CHANNEL_LABEL[b.channel ?? ""] ?? b.channel ?? "",
                (b.amount ?? 0).toString(),
                STATUS_LABEL[b.status] ?? b.status,
                b.branchName ?? "",
              ]);
              const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `booking-report-${reportFrom}-${reportTo}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export CSV
          </button>
        </div>
          <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-4">
            <div>
              <h3 className="text-[17px] font-medium text-neutral-800 leading-[1.4]">ตามช่องทาง</h3>
              <p className="text-[13px] text-neutral-500 mt-0.5 leading-[1.4]">รวม {reports.totalCount} รายการ · ฿{reports.totalAmount.toLocaleString()}</p>
            </div>
            <div className="space-y-3 text-[14px] text-neutral-800 leading-[1.4]">
              {reports.byChannel.map(([ch, v]) => (
                <div key={ch} className="flex justify-between">
                  <span className="text-neutral-800">{CHANNEL_LABEL[ch] ?? SOURCE_LABEL[ch] ?? ch}</span>
                  <span className="text-neutral-500 tabular-nums">
                    {v.count} รายการ
                    {v.amount > 0 && ` · ฿${v.amount.toLocaleString()}`}
                  </span>
                </div>
              ))}
              {reports.byChannel.length === 0 && (
                <p className="text-[13px] font-medium text-neutral-500 py-2 leading-[1.4]">ไม่มีข้อมูลในช่วงนี้</p>
              )}
              <div className="pt-4 mt-2 text-[13px] font-medium text-neutral-800 flex justify-between">
                <span>รวมทั้งหมด</span>
                <span className="tabular-nums">฿{reports.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-4">
            <div>
              <h3 className="text-[17px] font-medium text-neutral-800 leading-[1.4]">หัตถการยอดนิยม</h3>
              <p className="text-[13px] text-neutral-500 mt-0.5 leading-[1.4]">Top 10</p>
            </div>
            <div className="space-y-3">
              {reports.byProcedure.map(([proc, count]) => (
                <div key={proc} className="flex justify-between text-[13px] leading-[1.4]">
                  <span className="truncate text-neutral-800">{proc}</span>
                  <span className="tabular-nums text-neutral-500">{count} คน</span>
                </div>
              ))}
              {reports.byProcedure.length === 0 && (
                <p className="text-[13px] font-medium text-neutral-500 py-2 leading-[1.4]">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
          <div className="bg-[#FAFAFA] rounded-[12px] p-6 space-y-4">
            <div>
              <h3 className="text-[17px] font-medium text-neutral-800 leading-[1.4]">จำนวนจองต่อวัน</h3>
              <p className="text-[13px] text-neutral-500 mt-0.5 leading-[1.4]">ตามช่วงที่เลือก</p>
            </div>
            <div className="space-y-3 max-h-56 overflow-y-auto text-[13px] leading-[1.4]">
              {reports.byDate.slice(-14).map(([date, count]) => (
                <div key={date} className="flex justify-between">
                  <span className="text-neutral-800">{formatDate(date + "T12:00:00")}</span>
                  <span className="tabular-nums text-neutral-500">{count} รายการ</span>
                </div>
              ))}
              {reports.byDate.length === 0 && (
                <p className="text-[13px] text-neutral-500 py-2">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Modal แก้ไขการจอง */}
      {editingItem && (
        <EditBookingModal
          item={editingItem}
          branches={branches}
          services={services}
          doctors={doctors}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            void mutateList();
            void mutateCalendar();
          }}
        />
      )}

      {/* Modal จองคิว */}
      {showCreateModal && (
        <CreateBookingModal
          branches={branches}
          services={services}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            void mutateList();
            void mutateCalendar();
          }}
        />
      )}
      </div>
    </div>
  );
}

function EditBookingModal({
  item,
  branches,
  services,
  doctors,
  onClose,
  onSuccess,
}: {
  item: BookingItem;
  branches: Array<{ id: string; name: string }>;
  services: Array<{ id: string; service_name: string }>;
  doctors: Array<{ id: string; doctor_id: string; doctor_name?: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customerName, setCustomerName] = useState(item.customerName);
  const [phoneNumber, setPhoneNumber] = useState(item.phoneNumber ?? "");
  const [service, setService] = useState(item.service);
  const [procedure, setProcedure] = useState(item.procedure ?? "");
  const [amount, setAmount] = useState(item.amount?.toString() ?? "");
  const [doctor, setDoctor] = useState(item.doctor ?? "");
  const [channel, setChannel] = useState<BookingChannel>((item.channel as BookingChannel) ?? "line");
  const [scheduledAt, setScheduledAt] = useState(formatDateForInput(item.scheduledAt));
  const [status, setStatus] = useState(item.status);
  const [branchId, setBranchId] = useState(item.branchId ?? branches[0]?.id ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branches.length && (!branchId || !branches.some((b) => b.id === branchId))) {
      setBranchId(item.branchId ?? branches[0].id);
    }
  }, [branches, branchId, item.branchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !service.trim()) {
      setError("กรุณากรอกชื่อลูกค้าและบริการ");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/clinic/bookings/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
          service: service.trim(),
          procedure: procedure.trim() || null,
          amount: amount ? Number(amount) : undefined,
          doctor: doctor.trim() || undefined,
          channel,
          scheduledAt: new Date(scheduledAt).toISOString(),
          status,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-booking-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#FFFFFF] rounded-[8px] border border-[#E5E7EB] max-w-md w-full mx-4 max-h-[90vh] flex flex-col shadow-none" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#E5E7EB] shrink-0">
          <h2 id="edit-booking-title" className="text-[16px] font-semibold text-[#111827] leading-[1.35]">แก้ไขการจอง</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded-[8px] bg-red-50 border border-red-100 text-red-700 text-[13px] leading-[1.4]" role="alert">{error}</div>
            )}
            <section className="space-y-3" aria-labelledby="edit-customer-heading">
              <h3 id="edit-customer-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">ข้อมูลลูกค้า</h3>
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1 leading-[1.4]">ชื่อลูกค้า *</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อ-นามสกุล" required className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">เบอร์โทร</label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08xxxxxxxx" className="min-h-[36px]" />
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="edit-service-heading">
              <h3 id="edit-service-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">บริการ และเวลา</h3>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">บริการ *</label>
            {services.length > 0 ? (
              <select value={service} onChange={(e) => setService(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-[#E5E7EB] min-h-[36px] text-[#111827]" required>
                <option value="">เลือกบริการ</option>
                {services.map((s) => (
                  <option key={s.id} value={s.service_name}>{s.service_name}</option>
                ))}
              </select>
            ) : (
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="ชื่อบริการ" required className="min-h-[36px]" />
            )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">หัตถการ/รายละเอียด</label>
                <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="เช่น Botox, ฟิลเลอร์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">แพทย์ (ถ้ามี)</label>
                <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อแพทย์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">จำนวนเงิน (บาท)</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">วันที่-เวลา *</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="min-h-[36px]" />
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="edit-status-heading">
              <h3 id="edit-status-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">สถานะ และช่องทาง</h3>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">สถานะ</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-[#E5E7EB] min-h-[36px] text-[#111827]">
                  {(["pending", "pending_admin_confirm", "confirmed", "in_progress", "reschedule_pending_admin", "cancel_requested", "completed", "no-show", "cancelled"] as const).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">ช่องทางที่ลูกค้าจองเข้ามา</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)} className="w-full px-3 py-2 rounded-[8px] border border-[#E5E7EB] min-h-[36px] text-[#111827]">
                  {BOOKING_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
                  ))}
                </select>
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="edit-notes-heading">
              <h3 id="edit-notes-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">หมายเหตุ</h3>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" className="min-h-[36px]" />
            </section>
          </div>
          <div className="sticky bottom-0 p-4 border-t border-[#E5E7EB] bg-[#FFFFFF] flex gap-2 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-[36px]">ยกเลิก</Button>
            <Button type="submit" disabled={sending} className="min-h-[36px]">{sending ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateBookingModal({
  branches,
  services,
  onClose,
  onSuccess,
}: {
  branches: Array<{ id: string; name: string }>;
  services: Array<{ id: string; service_name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [service, setService] = useState("");
  const [procedure, setProcedure] = useState("");
  const [amount, setAmount] = useState("");
  const [doctor, setDoctor] = useState("");
  const [channel, setChannel] = useState<BookingChannel>("line");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (branches.length && (!branchId || !branches.some((b) => b.id === branchId))) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotAlternatives, setSlotAlternatives] = useState<Array<{ start: string; startISO: string }>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSlotAlternatives([]);
    if (!customerName.trim() || !service.trim()) {
      setError("กรุณากรอกชื่อลูกค้าและบริการ");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/clinic/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
          service: service.trim(),
          procedure: procedure.trim() || undefined,
          amount: amount ? Number(amount) : undefined,
          doctor: doctor.trim() || undefined,
          source: "admin",
          channel,
          branchId: branchId || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          status: "pending",
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.alternatives?.length) {
          setError(`ช่วงเวลานี้ไม่ว่าง แนะนำ: ${data.alternatives.map((a: { start: string }) => a.start).join(", ")} — คลิกเลือกเวลาที่แนะนำได้`);
          setSlotAlternatives(data.alternatives as Array<{ start: string; startISO: string }>);
          return;
        }
        throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      }
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-booking-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#FFFFFF] rounded-[8px] border border-[#E5E7EB] max-w-md w-full mx-4 max-h-[90vh] flex flex-col shadow-none" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#E5E7EB] shrink-0">
          <h2 id="create-booking-title" className="text-[16px] font-semibold text-[#111827] leading-[1.35]">จองคิวใหม่</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded-[8px] bg-red-50 border border-red-100 text-red-700 text-[13px] leading-[1.4]" role="alert">
                {error}
                {slotAlternatives.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {slotAlternatives.map((a) => (
                      <button
                        key={a.startISO}
                        type="button"
                        className="min-h-[36px] px-2 py-1 rounded-[8px] bg-white border border-red-200 text-red-800 text-[12px] font-medium hover:bg-red-50 focus:ring-2 focus:ring-red-300"
                        onClick={() => {
                          const d = new Date(a.startISO);
                          setScheduledAt(d.toISOString().slice(0, 16));
                          setSlotAlternatives([]);
                          setError(null);
                        }}
                      >
                        {a.start}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <section className="space-y-3" aria-labelledby="create-customer-heading">
              <h3 id="create-customer-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">ข้อมูลลูกค้า</h3>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">ชื่อลูกค้า *</label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                  required
                  className="min-h-[36px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">เบอร์โทร</label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="08xxxxxxxx"
                  className="min-h-[36px]"
                />
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="create-service-heading">
              <h3 id="create-service-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">บริการ และเวลา</h3>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">บริการ *</label>
                {services.length > 0 ? (
                  <select value={service} onChange={(e) => setService(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-[#E5E7EB] min-h-[36px] text-[#111827]" required>
                    <option value="">เลือกบริการ</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.service_name}>{s.service_name}</option>
                    ))}
                  </select>
                ) : (
                  <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="ชื่อบริการ" required className="min-h-[36px]" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">หัตถการ/รายละเอียด</label>
                <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="เช่น Botox, ฟิลเลอร์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">แพทย์ (ถ้ามี)</label>
                <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อแพทย์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">จำนวนเงิน (บาท)</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">วันที่-เวลา *</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="min-h-[36px]" />
                {branchId && scheduledAt && (
                  <SlotSelector
                    branchId={branchId}
                    dateStr={scheduledAt.slice(0, 10)}
                    procedure={service || undefined}
                    onSelect={(iso, doctorId, doctorName) => {
                      setScheduledAt(new Date(iso).toISOString().slice(0, 16));
                      if (doctorName) setDoctor(doctorName);
                    }}
                  />
                )}
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="create-channel-heading">
              <h3 id="create-channel-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">ช่องทาง และสาขา</h3>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">ช่องทางที่ลูกค้าจองเข้ามา</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)} className="w-full px-3 py-2 rounded-[8px] border border-[#E5E7EB] min-h-[36px] text-[#111827]">
                  {BOOKING_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-1">สาขา</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-[#E5E7EB] min-h-[36px] text-[#111827]">
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="create-notes-heading">
              <h3 id="create-notes-heading" className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide leading-[1.35]">หมายเหตุ</h3>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" className="min-h-[36px]" />
            </section>
          </div>
          <div className="sticky bottom-0 p-4 border-t border-[#E5E7EB] bg-[#FFFFFF] flex gap-2 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-[36px]">ยกเลิก</Button>
            <Button type="submit" disabled={sending} className="min-h-[36px]">{sending ? "กำลังบันทึก..." : "จองคิว"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFFFF] p-6" aria-busy="true">
          <div className="h-8 w-48 rounded bg-[#E5E7EB] animate-pulse mb-4" />
          <div className="h-10 w-full max-w-md rounded bg-[#E5E7EB] animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-[8px] bg-[#E5E7EB] animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
