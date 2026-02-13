"use client";

import { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
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

/** Enterprise: การ์ดรายการจองพร้อมปุ่มแก้ไข/ยกเลิก */
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
  return (
    <div className="p-3 rounded-xl border border-surface-200/80 hover:border-surface-300 group">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            {b.queueNumber != null && (
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700 font-bold text-sm shrink-0">
                {b.queueNumber}
              </span>
            )}
            <p className="font-medium text-surface-900">{b.customerName}</p>
          </div>
          <p className="text-sm text-surface-600">{b.service}</p>
          <p className="text-xs text-surface-500 mt-1 flex flex-wrap gap-2 items-center">
            {formatTime(b.scheduledAt)}
            {(b.channel || b.source) && (
              <Badge variant="default" className="text-[10px] px-1.5">
                {CHANNEL_LABEL[b.channel ?? ""] ?? SOURCE_LABEL[b.source ?? ""] ?? b.channel ?? b.source}
              </Badge>
            )}
            {typeof b.amount === "number" && b.amount > 0 && (
              <span>฿{b.amount.toLocaleString()}</span>
            )}
          </p>
          <Badge variant={statusColors[b.status] || "default"} className="mt-1 text-[10px]">
            {STATUS_LABEL[b.status] ?? b.status}
          </Badge>
        </div>
        {canModify && (
          <div className="flex gap-1 flex-shrink-0 flex-wrap">
            {canConfirm && (
              <Button size="sm" variant="primary" className="text-xs h-7" onClick={() => handleStatus("confirmed")} disabled={loading}>
                {b.status === "reschedule_pending_admin" ? "ยืนยันเลื่อน" : "ยืนยัน"}
              </Button>
            )}
            {canCallQueue && (
              <Button size="sm" variant="primary" className="text-xs h-7 bg-primary-600" onClick={() => handleStatus("in_progress")} disabled={loading}>
                เรียกคิว
              </Button>
            )}
            {canComplete && (
              <Button size="sm" variant="primary" className="text-xs h-7" onClick={() => handleStatus("completed")} disabled={loading}>
                เสร็จสิ้น
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={onEdit} disabled={loading}>
              แก้ไข
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 text-red-600" onClick={() => handleStatus("cancelled")} disabled={loading}>
              {b.status === "cancel_requested"
                ? "ยืนยันยกเลิก"
                : b.status === "confirmed"
                  ? "ยกเลิก"
                  : "ปฏิเสธ"}
            </Button>
          </div>
        )}
      </div>
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
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="min-w-0">
          <SectionHeader
          title="หน้างานวันนี้"
          description="คิวเรียงตามเวลา — เรียกคิวเมื่อลูกค้ามา แตะเสร็จสิ้นเมื่อให้บริการแล้ว"
          />
        </div>
        <a
          href={`/clinic/queue-display${queueBranch !== "all" ? `?branchId=${queueBranch}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 hover:underline shrink-0"
        >
          เปิดหน้าจอคิว →
        </a>
      </div>
      <Card padding="lg">
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-surface-600">วันที่</span>
            <input
              type="date"
              value={queueDate}
              onChange={(e) => setQueueDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-surface-200 text-sm"
            />
          </label>
          <select
            value={queueBranch}
            onChange={(e) => setQueueBranch(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-surface-200 text-sm"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={groupByDoctor}
              onChange={(e) => setGroupByDoctor(e.target.checked)}
            />
            <span>แยกตามแพทย์</span>
          </label>
        </div>

        {queueItems.length === 0 ? (
          <p className="text-sm text-surface-500 py-8 text-center">ไม่มีคิววันนี้</p>
        ) : groupByDoctor ? (
          <div className="space-y-4">
            {Array.from(byDoctor.entries()).map(([doctor, items]) => (
              <div key={doctor} className="border border-surface-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  className="w-full flex justify-between items-center px-4 py-3 bg-surface-50 hover:bg-surface-100 text-left"
                  onClick={() => setExpandedDoctor((x) => (x === doctor ? null : doctor))}
                >
                  <span className="font-semibold text-surface-800">{doctor}</span>
                  <span className="text-sm text-surface-500">{items.length} คิว</span>
                </button>
                {(expandedDoctor === null || expandedDoctor === doctor) && (
                  <div className="divide-y divide-surface-100">
                    {items.map((b) => (
                      <div key={b.id} className="px-4">
                        <BookingCard item={b} onEdit={() => onEdit(b)} onMutate={onMutate} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {queueItems.map((b) => (
              <BookingCard key={b.id} item={b} onEdit={() => onEdit(b)} onMutate={onMutate} />
            ))}
          </div>
        )}
      </Card>
    </section>
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

  if (isLoading) return <div className="py-4 text-center text-sm text-surface-500">กำลังโหลด...</div>;
  if (slots.length === 0)
    return (
      <div className="py-4 text-center text-sm text-surface-500">
        วันนี้งดให้บริการ{doctorName ? ` (${doctorName})` : ""}
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs text-surface-500">
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
              rounded-lg p-2 text-xs truncate
              ${s.status === "free" ? "bg-surface-50 text-surface-600 border border-surface-100" : ""}
              ${s.status === "busy" ? "bg-primary-100 text-primary-800 font-medium border border-primary-200/60" : ""}
              ${s.status === "completed" ? "bg-surface-100 text-surface-500 border border-surface-200 line-through" : ""}
              ${clickable ? "cursor-pointer hover:ring-2 hover:ring-primary-300" : ""}
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
      <span className="text-xs text-surface-500">หรือเลือกเวลาว่าง: </span>
      <div className="flex flex-wrap gap-1 mt-1">
        {slots.slice(0, 12).map((s) => (
          <button
            key={`${s.startISO}-${s.doctorId ?? ""}`}
            type="button"
            className="px-2 py-1 rounded text-xs bg-surface-100 hover:bg-primary-100 text-surface-700"
            onClick={() => onSelect(s.startISO, s.doctorId, s.doctorName)}
            title={s.doctorName ? `${s.start} - ${s.doctorName}` : s.start}
          >
            {s.start}
            {s.doctorName && <span className="text-[10px] text-surface-500 ml-0.5">({s.doctorName})</span>}
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
        <div key={d} className="text-center text-xs font-medium text-surface-500 py-1">
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
              ? "bg-surface-100 text-surface-600"
              : hasBoth
                ? "bg-primary-100 text-primary-800 border border-primary-200/60"
                : "bg-primary-100 text-primary-800 font-medium"
            : "hover:bg-surface-100";
        return (
          <button
            key={i}
            type="button"
            onClick={() => c.dateStr && onSelectDate(c.dateStr)}
            disabled={!c.dateStr}
            aria-label={c.dateStr ? (c.dateStr === todayStr ? `วันนี้ ${c.day}` : `วันที่ ${c.day}`) : undefined}
            className={`
              min-h-[44px] rounded-lg text-sm transition-colors
              ${c.isCurrentMonth ? "" : "text-surface-300"}
              ${cellStyle}
              ${selectedDate === c.dateStr ? "ring-2 ring-primary-500 bg-primary-50" : ""}
              ${c.dateStr === todayStr ? "ring-1 ring-primary-400/60 font-semibold" : ""}
            `}
          >
            {c.day}
            {c.count > 0 && (
              <span className="block text-[10px] font-normal mt-0.5">
                {hasCompletedOnly ? (
                  <span className="text-surface-500">✓ {stats.completed} เสร็จ</span>
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="การจอง"
        description="จัดการการจองคิว — ปฏิทิน เลือกวัน จองด้วยแอดมิน หรือ AI"
        aiAnalyze
      />

      {/* Enterprise: หน้างานวันนี้ — คิวเรียงตามเวลา */}
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

      {/* ปฏิทิน + รายการจอง */}
      <section>
        <SectionHeader
          title="ปฏิทิน"
          description="รวมทุกแพทย์ หรือเลือกดูตามแพทย์ — ว่าง/มีคิว/เสร็จแล้ว"
        />
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-surface-800">
                {MONTH_NAMES_TH[viewMonth - 1]} {viewYear + 543}
              </h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={prevMonth}>
                  ‹
                </Button>
                <Button variant="ghost" size="sm" onClick={nextMonth}>
                  ›
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30"
                title="เลือกรูปแบบปฏิทิน"
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
                className="px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30"
              >
                <option value="all">ทุกสาขา</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30"
                title="กรองตามช่องทาง"
              >
                <option value="all">ทุกช่องทาง</option>
                {BOOKING_CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
                ))}
              </select>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                + จองคิว
              </Button>
            </div>
            {calendarError && (
              <p className="text-sm text-red-600 py-2">โหลดปฏิทินไม่สำเร็จ: {calendarError.message}</p>
            )}
            {calendarLoading && !calendarData && (
              <div className="py-12 text-center text-surface-500 text-sm">กำลังโหลด...</div>
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
                <p className="mt-3 text-[11px] text-surface-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-primary-200 mr-1 align-middle" /> มีคิวรอ</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-surface-200 mr-1 align-middle" /> เสร็จแล้ว</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-200 mr-1 align-middle" /> ว่าง</span>
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
          </Card>

          <Card padding="lg">
            <CardHeader
              title={selectedDate ? `รายการจอง ${formatDate(selectedDate + "T12:00:00")}` : "รายการจอง"}
              subtitle={
                selectedDate
                  ? `${selectedDayItems.length} รายการ${doctorFilter !== "all" ? ` (${doctors.find((d) => (d.doctor_id || d.doctor_name || d.id) === doctorFilter)?.doctor_name || doctorFilter})` : ""}`
                  : `${doctorFilter !== "all" ? "กรองตามแพทย์ · " : ""}${allItems.length} รายการ${lastId ? " • มีเพิ่มเติม" : ""}`
              }
            />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(selectedDate ? selectedDayItems : items).length === 0 ? (
                <p className="text-sm text-surface-500 py-4">ยังไม่มีรายการจอง</p>
              ) : (
                (selectedDate ? selectedDayItems : items).map((b) => (
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
            {!selectedDate && lastId && (
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={loadMore}>
                โหลดเพิ่ม
              </Button>
            )}
          </Card>
        </div>
      </section>

      {/* รายงานการจอง — Enterprise: ตามช่องทาง LINE/Facebook/IG/TikTok ฯลฯ */}
      <section>
        <SectionHeader
          title="รายงานการจอง"
          description="สรุปตามช่องทาง (LINE, Facebook, IG, TikTok) หัตถการ จำนวนเงิน"
        />
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-surface-600">ช่วงวันที่</span>
            <input
              type="date"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
              className="px-2 py-1 rounded border border-surface-200 text-sm"
            />
            <span>-</span>
            <input
              type="date"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
              className="px-2 py-1 rounded border border-surface-200 text-sm"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
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
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card padding="lg">
            <CardHeader
              title="ตามช่องทาง"
              subtitle={`รวม ${reports.totalCount} รายการ • ฿${reports.totalAmount.toLocaleString()}`}
            />
            <div className="space-y-2">
              {reports.byChannel.map(([ch, v]) => (
                <div key={ch} className="flex justify-between text-sm">
                  <span>{CHANNEL_LABEL[ch] ?? SOURCE_LABEL[ch] ?? ch}</span>
                  <span>
                    {v.count} รายการ
                    {v.amount > 0 && ` • ฿${v.amount.toLocaleString()}`}
                  </span>
                </div>
              ))}
              {reports.byChannel.length === 0 && (
                <p className="text-sm text-surface-500 py-2">ไม่มีข้อมูลในช่วงนี้</p>
              )}
              <div className="pt-2 border-t border-surface-200 font-medium">
                <span>รวมทั้งหมด</span>
                <span>฿{reports.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </Card>
          <Card padding="lg">
            <CardHeader title="หัตถการยอดนิยม" subtitle="Top 10" />
            <div className="space-y-2">
              {reports.byProcedure.map(([proc, count]) => (
                <div key={proc} className="flex justify-between text-sm">
                  <span className="truncate">{proc}</span>
                  <span>{count} คน</span>
                </div>
              ))}
              {reports.byProcedure.length === 0 && (
                <p className="text-sm text-surface-500 py-2">ไม่มีข้อมูล</p>
              )}
            </div>
          </Card>
          <Card padding="lg">
            <CardHeader title="จำนวนจองต่อวัน" subtitle="ตามช่วงที่เลือก" />
            <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
              {reports.byDate.slice(-14).map(([date, count]) => (
                <div key={date} className="flex justify-between">
                  <span>{formatDate(date + "T12:00:00")}</span>
                  <span>{count} รายการ</span>
                </div>
              ))}
              {reports.byDate.length === 0 && (
                <p className="text-sm text-surface-500 py-2">ไม่มีข้อมูล</p>
              )}
            </div>
          </Card>
        </div>
      </section>

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
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-surface-200">
          <h2 id="edit-booking-title" className="text-lg font-semibold text-surface-900">แก้ไขการจอง</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">ชื่อลูกค้า *</label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อ-นามสกุล" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">เบอร์โทร</label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08xxxxxxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">บริการ *</label>
            {services.length > 0 ? (
              <select value={service} onChange={(e) => setService(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-200" required>
                <option value="">เลือกบริการ</option>
                {services.map((s) => (
                  <option key={s.id} value={s.service_name}>{s.service_name}</option>
                ))}
              </select>
            ) : (
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="ชื่อบริการ" required />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">หัตถการ/รายละเอียด</label>
            <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="เช่น Botox, ฟิลเลอร์" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">แพทย์ (ถ้ามี)</label>
            <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อแพทย์" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">จำนวนเงิน (บาท)</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">วันที่-เวลา *</label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">สถานะ</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-200">
              {(["pending", "pending_admin_confirm", "confirmed", "in_progress", "reschedule_pending_admin", "cancel_requested", "completed", "no-show", "cancelled"] as const).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">ช่องทางที่ลูกค้าจองเข้ามา</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)} className="w-full px-3 py-2 rounded-lg border border-surface-200">
              {BOOKING_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">หมายเหตุ</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={sending}>{sending ? "กำลังบันทึก..." : "บันทึก"}</Button>
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
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-surface-200">
          <h2 id="create-booking-title" className="text-lg font-semibold text-surface-900">จองคิวใหม่</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
              {slotAlternatives.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {slotAlternatives.map((a) => (
                    <button
                      key={a.startISO}
                      type="button"
                      className="px-2 py-1 rounded bg-white border border-red-200 text-red-800 text-xs hover:bg-red-50"
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
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">ชื่อลูกค้า *</label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">เบอร์โทร</label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="08xxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">บริการ *</label>
            {services.length > 0 ? (
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200"
                required
              >
                <option value="">เลือกบริการ</option>
                {services.map((s) => (
                  <option key={s.id} value={s.service_name}>{s.service_name}</option>
                ))}
              </select>
            ) : (
              <Input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="ชื่อบริการ"
                required
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">หัตถการ/รายละเอียด</label>
            <Input
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              placeholder="เช่น Botox, ฟิลเลอร์"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">แพทย์ (ถ้ามี)</label>
            <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อแพทย์" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">จำนวนเงิน (บาท)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">วันที่-เวลา *</label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
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
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">ช่องทางที่ลูกค้าจองเข้ามา</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as BookingChannel)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200"
            >
              {BOOKING_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">สาขา</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">หมายเหตุ</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="หมายเหตุ (ถ้ามี)"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? "กำลังบันทึก..." : "จองคิว"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-surface-500">กำลังโหลด...</div>}>
      <BookingPageContent />
    </Suspense>
  );
}
