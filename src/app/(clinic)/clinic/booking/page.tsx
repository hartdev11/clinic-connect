"use client";

import { Suspense, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";
import { cn } from "@/lib/utils";
import { BOOKING_CHANNELS } from "@/types/clinic";
import type { BookingChannel } from "@/types/clinic";
import { TableCellsIcon, XMarkIcon } from "@heroicons/react/24/outline";

const CHART_COLORS = { primary: "var(--rg-500)", secondary: "var(--mauve-500)", grid: "var(--cream-300)", purple: "var(--mauve-500)" };
const PIE_COLORS = ["var(--rg-500)", "var(--mauve-500)", "var(--rg-300)", "var(--mauve-300)", "var(--rg-400)"];

const DAY_NAMES_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_NAMES_TH_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

/** Get Monday of week containing dateStr (YYYY-MM-DD) */
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get status color for booking block */
function getBookingBlockColor(status: string): string {
  if (["confirmed", "in_progress"].includes(status)) return "bg-[color:var(--ent-success)]/20 text-[var(--ent-success)] border-[var(--ent-success)]/30";
  if (["pending", "pending_admin_confirm", "reschedule_pending_admin"].includes(status)) return "bg-[color:var(--ent-warning)]/20 text-[var(--ent-warning)] border-[var(--ent-warning)]/30";
  if (["completed"].includes(status)) return "bg-cream-200 text-cream-600 border-cream-300";
  if (["cancelled", "no-show"].includes(status)) return "bg-cream-100 text-mauve-400 border-cream-200 line-through";
  return "bg-cream-200 text-mauve-600 border-cream-300";
}
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
  doctor_id?: string | null;
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

/** Status accent — semantic tokens only */
const statusAccentColor: Record<string, string> = {
  pending: "var(--ent-warning)",
  confirmed: "var(--ent-success)",
  in_progress: "var(--ent-info)",
  completed: "var(--cream-400)",
  "no-show": "var(--ent-danger)",
  cancelled: "var(--cream-400)",
  pending_admin_confirm: "var(--ent-warning)",
  reschedule_pending_admin: "var(--ent-warning)",
  cancel_requested: "var(--cream-400)",
};

/** Reject dialog — กรอกเหตุผล แล้ว AI ส่งข้อความแจ้งลูกค้าอัตโนมัติ */
function RejectDialog({
  open,
  onClose,
  booking,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  booking: BookingItem | null;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSending(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="ปฏิเสธการจอง" id="reject-dialog">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="p-5 space-y-4">
          {booking && (
            <p className="font-body text-sm text-mauve-600">
              ลูกค้า: {booking.customerName} · บริการ: {booking.service} · {formatTime(booking.scheduledAt)}
            </p>
          )}
          <div>
            <label className="block font-body text-sm font-medium text-mauve-700 mb-1">เหตุผล (จะส่งแจ้งลูกค้าอัตโนมัติ) *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ไม่มีแพทย์ว่างช่วงเวลานี้ กรุณาจองเวลาอื่น"
              rows={3}
              className="w-full px-3 py-2 rounded-2xl border border-cream-300 text-sm text-mauve-800 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 resize-none"
              required
            />
          </div>
        </div>
        <div className="p-5 border-t border-cream-200 flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={sending || !reason.trim()}>
            {sending ? "กำลังส่ง..." : "ยืนยันปฏิเสธ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Enterprise: Card แสดงรายการจอง — AI badge, ช่องทาง, ยืนยัน/ปฏิเสธ */
function BookingCard({
  item: b,
  onEdit,
  onMutate,
  onReject,
}: {
  item: BookingItem;
  onEdit: () => void;
  onMutate: () => void;
  onReject: (item: BookingItem) => void;
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
  const isFromAI = b.source === "ai";
  const channelLabel = CHANNEL_LABEL[b.channel ?? ""] ?? SOURCE_LABEL[b.source ?? ""] ?? b.channel ?? b.source ?? "—";

  const handleStatus = async (status: string, rejectReason?: string) => {
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { status };
      if (rejectReason) body.rejectReason = rejectReason;
      const r = await fetch(`/api/clinic/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const statusVariant =
    b.status === "confirmed" ? "success" :
    b.status === "pending" || b.status === "pending_admin_confirm" || b.status === "reschedule_pending_admin" ? "warning" :
    b.status === "cancelled" || b.status === "no-show" ? "danger" : "default";

  return (
    <div className="relative luxury-card p-5 flex items-center gap-4 group cursor-pointer hover:shadow-luxury-lg transition-all duration-200">
      {error && (
        <p className="absolute top-0 left-0 right-0 text-xs text-red-600 bg-red-50/95 px-2 py-1 rounded-t-2xl leading-tight font-body" role="alert">
          {error}
        </p>
      )}
      <div className="flex-shrink-0 text-center w-16">
        <p className="font-display text-lg font-semibold text-mauve-800 leading-none" aria-label={`เวลา ${formatTime(b.scheduledAt)}`}>
          {formatTime(b.scheduledAt)}
        </p>
      </div>
      <div className="flex flex-col items-center self-stretch flex-shrink-0">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full flex-shrink-0",
          b.status === "confirmed" ? "bg-emerald-400" :
          b.status === "pending" || b.status === "pending_admin_confirm" || b.status === "reschedule_pending_admin" ? "bg-amber-400" :
          b.status === "cancelled" || b.status === "no-show" ? "bg-red-400" : "bg-rg-400"
        )} />
        <div className="w-px flex-1 bg-cream-300 my-1 min-h-[8px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="font-body font-medium text-mauve-800 text-sm truncate">
            {b.queueNumber != null && <span className="text-mauve-500 font-medium mr-1.5">{b.queueNumber}</span>}
            {b.customerName}
          </p>
          {isFromAI && (
            <Badge variant="ai" size="sm" className="bg-purple-100 text-purple-700 border-purple-300">
              🤖 AI จอง
            </Badge>
          )}
          <Badge variant={statusVariant} size="sm" dot>
            {STATUS_LABEL[b.status] ?? b.status}
          </Badge>
          <span className="font-body text-xs text-mauve-400">{channelLabel}</span>
        </div>
        <p className="font-body text-xs text-mauve-400 truncate">{b.service}{b.procedure ? ` · ${b.procedure}` : ""}</p>
      </div>
      <div className="flex-shrink-0 hidden sm:flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-mauve-100 flex items-center justify-center text-mauve-600 text-xs font-body">
          {(b.doctor || "—").charAt(0)}
        </div>
        <p className="font-body text-xs text-mauve-500 max-w-[80px] truncate">{b.doctor || "—"}</p>
      </div>
      <span className="text-mauve-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">→</span>
      {canModify && (
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {canConfirm && (
            <Button type="button" size="sm" variant="primary" onClick={() => handleStatus("confirmed")} disabled={loading} title="ยืนยัน">
              ยืนยัน
            </Button>
          )}
          {canCallQueue && (
            <Button type="button" size="sm" variant="primary" onClick={() => handleStatus("in_progress")} disabled={loading} title="เรียกคิว">
              เรียกคิว
            </Button>
          )}
          {canComplete && (
            <Button type="button" size="sm" variant="primary" onClick={() => handleStatus("completed")} disabled={loading} title="เสร็จสิ้น">
              เสร็จสิ้น
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onEdit} disabled={loading} title="แก้ไข">
            แก้ไข
          </Button>
          {(canConfirm || b.status === "confirmed") && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              disabled={loading}
              title={b.status === "cancel_requested" ? "ยืนยันยกเลิก" : "ปฏิเสธ"}
              onClick={() => {
                if (canConfirm) onReject(b);
                else handleStatus("cancelled");
              }}
            >
              {b.status === "cancel_requested" ? "ยืนยันยกเลิก" : b.status === "confirmed" ? "ยกเลิก" : "ปฏิเสธ"}
            </Button>
          )}
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
  onReject,
}: {
  dateStr: string;
  branchFilter: string;
  branches: Array<{ id: string; name: string }>;
  onMutate: () => void;
  onEdit: (item: BookingItem) => void;
  onReject: (item: BookingItem) => void;
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
      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold text-mauve-800">หน้างานวันนี้</h2>
        <p className="font-body text-sm text-mauve-400 mt-0.5">คิวเรียงตามเวลา — เรียกคิวเมื่อลูกค้ามา แตะเสร็จสิ้นเมื่อให้บริการแล้ว</p>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 font-body text-sm font-medium text-mauve-600">
            <span>วันที่</span>
            <input
              type="date"
              value={queueDate}
              onChange={(e) => setQueueDate(e.target.value)}
              className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 text-sm text-mauve-800 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 transition-all"
            />
          </label>
          <select
            value={queueBranch}
            onChange={(e) => setQueueBranch(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 transition-all"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 font-body text-sm font-medium text-mauve-700 cursor-pointer">
            <input
              type="checkbox"
              checked={groupByDoctor}
              onChange={(e) => setGroupByDoctor(e.target.checked)}
              className="rounded border-cream-300 text-rg-500"
            />
            <span>แยกตามแพทย์</span>
          </label>
        </div>

        {queueItems.length === 0 ? (
          <p className="font-body text-sm text-mauve-400 py-8 text-center">ไม่มีคิววันนี้</p>
        ) : groupByDoctor ? (
          <div className="space-y-4">
            {Array.from(byDoctor.entries()).map(([doctor, items]) => (
              <div key={doctor} className="space-y-0">
                <button
                  type="button"
                  className="w-full flex justify-between items-center px-0 py-2 text-left font-body text-sm font-medium text-mauve-800 hover:opacity-80 transition-opacity"
                  onClick={() => setExpandedDoctor((x) => (x === doctor ? null : doctor))}
                >
                  <span className="font-medium text-mauve-800">{doctor}</span>
                  <span className="font-body text-sm text-mauve-400">{items.length} คิว</span>
                </button>
                {(expandedDoctor === null || expandedDoctor === doctor) && (
                  <div className="space-y-3 pt-1">
                    {items.map((b) => (
                      <BookingCard key={b.id} item={b} onEdit={() => onEdit(b)} onMutate={onMutate} onReject={onReject} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {queueItems.map((b) => (
              <BookingCard key={b.id} item={b} onEdit={() => onEdit(b)} onMutate={onMutate} onReject={onReject} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Enterprise: Stat cards สำหรับวันนี้ — การจองทั้งหมด, รอยืนยัน, ยืนยันแล้ว, ยกเลิก */
function TodayStatCards({
  total,
  pending,
  confirmed,
  cancelled,
}: {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="การจองทั้งหมด" value={total} />
      <StatCard label="รอยืนยัน" value={pending} />
      <StatCard label="ยืนยันแล้ว" value={confirmed} />
      <StatCard label="ยกเลิก" value={cancelled} />
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
      <div className="h-4 w-3/4 rounded-2xl bg-cream-200 animate-pulse" />
      <div className="h-16 grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-8 rounded-xl bg-cream-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
  if (slots.length === 0)
    return (
      <div className="py-4 text-center font-body text-sm text-mauve-400">
        วันนี้งดให้บริการ{doctorName ? ` (${doctorName})` : ""}
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="font-body text-xs font-medium text-mauve-500">
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
            className={cn(
              "rounded-xl p-2 font-body text-xs truncate leading-snug transition-colors duration-200",
              s.status === "free" && "bg-cream-100 text-mauve-500",
              s.status === "busy" && "bg-rg-50 text-rg-700 font-medium",
              s.status === "completed" && "bg-cream-100 text-mauve-400 line-through",
              clickable && "cursor-pointer hover:opacity-90"
            )}
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
              <span className="block truncate mt-0.5 text-[10px] text-mauve-600">{s.customerName}</span>
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
      <span className="font-body text-xs font-medium text-mauve-500">หรือเลือกเวลาว่าง: </span>
      <div className="flex flex-wrap gap-2 mt-1">
        {slots.slice(0, 12).map((s) => (
          <button
            key={`${s.startISO}-${s.doctorId ?? ""}`}
            type="button"
            className="min-h-[34px] px-3 py-2 rounded-xl font-body text-xs font-medium bg-cream-200 text-mauve-700 hover:bg-rg-100 hover:text-rg-700 transition-all duration-200"
            onClick={() => onSelect(s.startISO, s.doctorId, s.doctorName)}
            title={s.doctorName ? `${s.start} - ${s.doctorName}` : s.start}
          >
            {s.start}
            {s.doctorName && <span className="text-[11px] text-mauve-400 ml-0.5">({s.doctorName})</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

type DateStats = { active: number; completed: number };

/** Dot สีตามสถานะ: เขียว=ว่าง, เหลือง=เกือบเต็ม, แดง=เต็ม (ใช้ count 0, 1-4, 5+) */
function getDayDotColor(count: number): string {
  if (count === 0) return "bg-emerald-400";
  if (count <= 4) return "bg-amber-400";
  return "bg-red-400";
}

const SLOT_START = 8;
const SLOT_END = 19;
const WEEK_SLOT_MINUTES = 30;
const DAY_SLOT_MINUTES = 15;

/** Week view: 7 columns × 30min slots, booking blocks by status, click slot → CreateBookingModal */
function WeekView({
  viewWeekStart,
  items,
  doctorFilter,
  onSlotClick,
  onBookingClick,
}: {
  viewWeekStart: string;
  items: BookingItem[];
  doctorFilter: string;
  onSlotClick: (dateStr: string, time: string) => void;
  onBookingClick: (b: BookingItem) => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(viewWeekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const slots = Array.from({ length: ((SLOT_END - SLOT_START) * 60) / WEEK_SLOT_MINUTES }, (_, i) => {
    const h = SLOT_START + Math.floor((i * WEEK_SLOT_MINUTES) / 60);
    const m = (i * WEEK_SLOT_MINUTES) % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  const filtered = doctorFilter === "all" ? items : items.filter((b) => (b.doctor ?? b.doctor_id ?? "") === doctorFilter);
  const getBookingsForSlot = (dateStr: string, slotStart: string) => {
    const [sh, sm] = slotStart.split(":").map(Number);
    const slotStartDate = new Date(`${dateStr}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`);
    const slotEndDate = new Date(slotStartDate.getTime() + WEEK_SLOT_MINUTES * 60 * 1000);
    return filtered.filter((b) => {
      const at = new Date(b.scheduledAt);
      return b.scheduledAt.startsWith(dateStr) && at >= slotStartDate && at < slotEndDate && !["cancelled"].includes(b.status);
    });
  };

  return (
    <div className="overflow-x-auto -mx-2">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-8 gap-px border border-cream-200 rounded-2xl overflow-hidden">
          <div className="bg-cream-100 p-2 font-body text-xs font-medium text-mauve-500" />
          {weekDays.map((d) => (
            <div key={d} className="bg-cream-100 p-2 text-center font-body text-xs font-medium text-mauve-600">
              {DAY_NAMES_TH_FULL[new Date(d + "T12:00:00").getDay()]}
              <br />
              <span className="text-mauve-400">{d.slice(8, 10)}</span>
            </div>
          ))}
        </div>
        <div className="max-h-[400px] overflow-y-auto border border-t-0 border-cream-200 rounded-b-2xl">
          {slots.map((slotStart) => (
            <div key={slotStart} className="grid grid-cols-8 gap-px min-h-[36px]">
              <div className="bg-cream-50 p-1 font-body text-[10px] text-mauve-500 flex items-center">{slotStart}</div>
              {weekDays.map((dateStr) => {
                const bookings = getBookingsForSlot(dateStr, slotStart);
                return (
                  <div
                    key={`${dateStr}-${slotStart}`}
                    className={cn(
                      "p-1 min-h-[36px] border-b border-cream-100 cursor-pointer hover:bg-cream-50/80 transition-colors",
                      bookings.length > 0 && "bg-cream-50"
                    )}
                    onClick={() => {
                      if (bookings.length > 0) onBookingClick(bookings[0]!);
                      else onSlotClick(dateStr, `${dateStr}T${slotStart}`);
                    }}
                  >
                    {bookings.map((b) => (
                      <div
                        key={b.id}
                        className={cn("rounded-lg px-2 py-1 text-[10px] truncate border", getBookingBlockColor(b.status))}
                        onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                      >
                        {b.customerName}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Day view: 1 column × 15min slots, show patient + service, doctor filter */
function DayView({
  dateStr,
  items,
  doctors,
  doctorFilter,
  onSlotClick,
  onBookingClick,
}: {
  dateStr: string;
  items: BookingItem[];
  doctors: Array<{ id: string; doctor_id?: string; doctor_name?: string }>;
  doctorFilter: string;
  onSlotClick: (dateStr: string, time: string) => void;
  onBookingClick: (b: BookingItem) => void;
}) {
  const slots = Array.from({ length: ((SLOT_END - SLOT_START) * 60) / DAY_SLOT_MINUTES }, (_, i) => {
    const h = SLOT_START + Math.floor((i * DAY_SLOT_MINUTES) / 60);
    const m = (i * DAY_SLOT_MINUTES) % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  const filtered = doctorFilter === "all" ? items : items.filter((b) => (b.doctor ?? b.doctor_id ?? "") === doctorFilter);
  const dayItems = filtered.filter((b) => b.scheduledAt.startsWith(dateStr) && !["cancelled"].includes(b.status));
  const getBookingsForSlot = (slotStart: string) => {
    const [sh, sm] = slotStart.split(":").map(Number);
    const slotStartDate = new Date(`${dateStr}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`);
    const slotEndDate = new Date(slotStartDate.getTime() + DAY_SLOT_MINUTES * 60 * 1000);
    return dayItems.filter((b) => {
      const at = new Date(b.scheduledAt);
      return at >= slotStartDate && at < slotEndDate;
    });
  };

  return (
    <div className="space-y-2">
      {doctorFilter !== "all" && (
        <p className="font-body text-xs text-mauve-500">แสดงเฉพาะ: {doctors.find((d) => (d.doctor_id ?? d.doctor_name ?? d.id) === doctorFilter)?.doctor_name ?? doctorFilter}</p>
      )}
      <div className="max-h-[500px] overflow-y-auto border border-cream-200 rounded-2xl">
        {slots.map((slotStart) => {
          const bookings = getBookingsForSlot(slotStart);
          return (
            <div
              key={slotStart}
              className={cn(
                "flex gap-4 p-2 border-b border-cream-100 cursor-pointer hover:bg-cream-50/50 transition-colors min-h-[52px]",
                bookings.length > 0 && "bg-cream-50/30"
              )}
              onClick={() => {
                if (bookings.length > 0) onBookingClick(bookings[0]!);
                else onSlotClick(dateStr, `${dateStr}T${slotStart}`);
              }}
            >
              <div className="w-14 flex-shrink-0 font-body text-sm text-mauve-600">{slotStart}</div>
              <div className="flex-1 min-w-0 space-y-1">
                {bookings.length === 0 ? (
                  <span className="text-mauve-400 text-sm">ว่าง</span>
                ) : (
                  bookings.map((b) => (
                    <div
                      key={b.id}
                      className={cn("rounded-xl px-3 py-2 border text-sm", getBookingBlockColor(b.status))}
                      onClick={(e) => { e.stopPropagation(); onBookingClick(b); }}
                    >
                      <p className="font-medium truncate">{b.customerName}</p>
                      <p className="text-xs opacity-80 truncate">{b.service}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Enterprise: ปฏิทิน — ว่าง / มีคิวรอ (active) / เสร็จแล้ว (completed) */
function CalendarGrid({
  year,
  month,
  datesWithCount,
  datesWithStatus,
  selectedDate,
  onSelectDate,
  onAddBooking,
}: {
  year: number;
  month: number;
  datesWithCount: Record<string, number>;
  datesWithStatus?: Record<string, DateStats>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onAddBooking?: (dateStr: string) => void;
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
        <div key={d} className="text-center font-body text-xs font-medium text-mauve-400 py-3 uppercase tracking-wider">
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
              ? "bg-cream-100 text-mauve-500"
              : "bg-rg-50 text-rg-700 font-medium"
            : "";
        const dotColor = getDayDotColor(c.count);
        return (
          <div
            key={i}
            className={cn(
              "min-h-[80px] p-2 border-b border-r border-cream-200 text-left transition-colors duration-200 font-body text-sm flex flex-col",
              !c.dateStr && "border-transparent",
              c.isCurrentMonth ? "" : "opacity-40",
              cellStyle,
              selectedDate === c.dateStr && "bg-rg-100",
              !c.dateStr ? "" : "hover:bg-cream-100 cursor-pointer",
              c.dateStr === todayStr && "font-semibold"
            )}
            onClick={() => c.dateStr && onSelectDate(c.dateStr)}
            role="button"
            tabIndex={c.dateStr ? 0 : -1}
            onKeyDown={(e) => c.dateStr && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectDate(c.dateStr))}
            aria-label={c.dateStr ? (c.dateStr === todayStr ? `วันนี้ ${c.day}` : `วันที่ ${c.day}`) : undefined}
          >
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center font-body text-sm transition-all",
                  c.dateStr === todayStr
                    ? "bg-rg-500 text-white font-semibold shadow-luxury"
                    : "text-mauve-600"
                )}
              >
                {c.day}
              </div>
              {c.dateStr && onAddBooking && (
                <button
                  type="button"
                  className="w-5 h-5 rounded-full bg-rg-200 text-rg-600 hover:bg-rg-300 flex items-center justify-center text-xs leading-none shrink-0"
                  onClick={(e) => { e.stopPropagation(); onAddBooking(c.dateStr); }}
                  aria-label={`จอง ${c.dateStr}`}
                >
                  +
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {c.count > 0 && (
                <span className="text-[10px] font-normal text-mauve-500">
                  {hasCompletedOnly ? <>✓ {stats.completed}</> : hasBoth ? <>{stats.active} · ✓ {stats.completed}</> : <>{stats.active} จอง</>}
                </span>
              )}
              {c.dateStr && <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />}
            </div>
          </div>
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
  const [calendarViewMode, setCalendarViewMode] = useState<"month" | "week" | "day">("month");
  const [viewWeekStart, setViewWeekStart] = useState(() => getMondayOfWeek(new Date().toISOString().slice(0, 10)));
  useEffect(() => {
    if (calendarViewMode === "day" && !selectedDate) setSelectedDate(new Date().toISOString().slice(0, 10));
  }, [calendarViewMode, selectedDate]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalInitialDate, setCreateModalInitialDate] = useState<string | null>(null);
  const [createModalInitialTime, setCreateModalInitialTime] = useState<string | null>(null);
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
  const [rejectTarget, setRejectTarget] = useState<BookingItem | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("today");
  const seenAiBookingIdsRef = useRef<Set<string>>(new Set());
  const { addToast, removeToast } = useToast();

  const dayViewDate = selectedDate ?? new Date().toISOString().slice(0, 10);
  const effectiveYear = calendarViewMode === "week" ? parseInt(viewWeekStart.slice(0, 4), 10) : calendarViewMode === "day" ? parseInt(dayViewDate.slice(0, 4), 10) : viewYear;
  const effectiveMonth = calendarViewMode === "week" ? parseInt(viewWeekStart.slice(5, 7), 10) : calendarViewMode === "day" ? parseInt(dayViewDate.slice(5, 7), 10) : viewMonth;
  const calendarParams = new URLSearchParams({
    year: String(effectiveYear),
    month: String(effectiveMonth),
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
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterFrom, setDateFilterFrom] = useState("");
  const [dateFilterTo, setDateFilterTo] = useState("");
  const [allDoctorFilter, setAllDoctorFilter] = useState<string>("all");
  const [allStatusFilter, setAllStatusFilter] = useState<string>("");

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

  const filteredAllItems = useMemo(() => {
    let list = [...allItems];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((b) =>
        b.customerName.toLowerCase().includes(q) ||
        (b.phoneNumber ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    }
    if (dateFilterFrom) list = list.filter((b) => b.scheduledAt >= dateFilterFrom + "T00:00:00");
    if (dateFilterTo) list = list.filter((b) => b.scheduledAt.slice(0, 10) <= dateFilterTo);
    if (allDoctorFilter !== "all") list = list.filter((b) => (b.doctor ?? "") === allDoctorFilter || (b.doctor_id ?? b.doctor ?? "") === allDoctorFilter);
    if (allStatusFilter) list = list.filter((b) => b.status === allStatusFilter);
    return list;
  }, [allItems, searchQuery, dateFilterFrom, dateFilterTo, allDoctorFilter, allStatusFilter]);

  const items = filteredAllItems;
  const calendarItems = calendarData?.items ?? [];
  const selectedDayItems = selectedDate
    ? calendarItems.filter((b) => b.scheduledAt.startsWith(selectedDate))
    : [];

  const branches = branchesData?.items ?? [];
  const services = servicesData?.items ?? [];

  const doctors = doctorsData?.items ?? [];
  const reports = useMemo(() => {
    const data = reportData as {
      totalCount?: number;
      totalAmount?: number;
      cancelledCount?: number;
      cancellationRate?: number;
      byChannel?: Array<{ channel: string; count: number; amount: number }>;
      byProcedure?: Array<{ name: string; count: number }>;
      byDate?: Array<{ date: string; count: number; amount?: number }>;
      byDoctor?: Array<{ doctor: string; count: number; amount: number; cancelledCount: number; cancellationRate: number }>;
    } | undefined;
    if (!data)
      return {
        totalCount: 0,
        totalAmount: 0,
        cancelledCount: 0,
        cancellationRate: 0,
        byChannel: [] as Array<[string, { count: number; amount: number }]>,
        byProcedure: [] as Array<[string, number]>,
        byDate: [] as Array<[string, { count: number; amount: number }]>,
        byDoctor: [] as Array<{ doctor: string; count: number; amount: number; cancelledCount: number; cancellationRate: number }>,
      };
    return {
      totalCount: data.totalCount ?? 0,
      totalAmount: data.totalAmount ?? 0,
      cancelledCount: data.cancelledCount ?? 0,
      cancellationRate: data.cancellationRate ?? 0,
      byChannel: (data.byChannel ?? []).map((x) => [x.channel, { count: x.count, amount: x.amount }] as const),
      byProcedure: (data.byProcedure ?? []).slice(0, 10).map((x) => [x.name, x.count] as const),
      byDate: (data.byDate ?? []).map((x) => [x.date, { count: x.count, amount: x.amount ?? 0 }] as const),
      byDoctor: data.byDoctor ?? [],
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

  const todayStats = useMemo(() => {
    const todayItems = calendarItems.filter((b) => b.scheduledAt.startsWith(todayStr));
    const total = todayItems.length;
    const pending = todayItems.filter((b) => ["pending", "pending_admin_confirm", "reschedule_pending_admin"].includes(b.status)).length;
    const confirmed = todayItems.filter((b) => b.status === "confirmed" || b.status === "in_progress").length;
    const cancelled = todayItems.filter((b) => b.status === "cancelled" || b.status === "no-show").length;
    return { total, pending, confirmed, cancelled };
  }, [calendarItems, todayStr]);

  /** Toast เมื่อมี AI จองใหม่ — ใช้ queue ที่ refresh ทุก 10s */
  const queueParamsForToast = activeTab === "today" ? `date=${todayStr}&groupByDoctor=true${branchFilter !== "all" ? `&branchId=${branchFilter}` : ""}` : null;
  const { data: queueDataForToast } = useSWR<{ items: BookingItem[] }>(
    queueParamsForToast ? `/api/clinic/bookings/queue?${queueParamsForToast}` : null,
    apiFetcher,
    { refreshInterval: 10000 }
  );
  const queueItemsForToast = queueDataForToast?.items ?? [];
  useEffect(() => {
    const aiPending = queueItemsForToast.filter((b) => b.source === "ai" && (b.status === "pending_admin_confirm" || b.status === "pending"));
    for (const b of aiPending) {
      if (!seenAiBookingIdsRef.current.has(b.id)) {
        seenAiBookingIdsRef.current.add(b.id);
        const toastId = addToast({
          title: "🔔 การจองใหม่จาก LINE",
          message: `ลูกค้า: ${b.customerName} | บริการ: ${b.service} | วันที่: ${formatDate(b.scheduledAt)} ${formatTime(b.scheduledAt)}`,
          variant: "ai",
          duration: 0,
          actions: (
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => { removeToast(toastId); setEditingItem(b); }}>
                ดูรายละเอียด
              </Button>
            </div>
          ),
        });
      }
    }
  }, [queueItemsForToast, addToast, removeToast]);

  const handleRejectConfirm = useCallback(async (reason: string) => {
    if (!rejectTarget) return;
    const r = await fetch(`/api/clinic/bookings/${rejectTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", rejectReason: reason }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "เกิดข้อผิดพลาด");
    setRejectTarget(null);
    void mutateList();
    void mutateCalendar();
  }, [rejectTarget, mutateList, mutateCalendar]);

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
    <div className="min-h-screen bg-cream-100/50 font-sans antialiased relative">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-6">
        <PageHeader
          title="การจอง"
          subtitle="จัดการนัดหมายและตารางเวลาของคลินิก"
          actions={
            <Button
                variant="primary"
                size="sm"
                shimmer
                onClick={() => setShowCreateModal(true)}
              >
                + จองใหม่
              </Button>
          }
        />

      {activeTab === "today" && (
        <div className="pt-4 pb-2">
          <h2 className="font-display text-xl font-semibold text-mauve-800">หน้างานวันนี้</h2>
          <p className="font-body text-sm text-mauve-400 mt-0.5">คิวเรียงตามเวลา — เรียกคิวเมื่อลูกค้ามา แตะเสร็จสิ้นเมื่อให้บริการแล้ว</p>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-cream-200 rounded-2xl w-fit mb-6" role="tablist" aria-label="Workspace tabs">
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
            className={cn(
              "relative min-h-[40px] px-4 py-2 rounded-xl text-sm font-body font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rg-300 focus:ring-offset-2",
              activeTab === tab ? "bg-white text-mauve-700 shadow-luxury" : "text-mauve-400 hover:text-mauve-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "today" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pt-8 pb-10">
          {/* ซ้าย: สรุปสถิติวันนี้ */}
          <div className="xl:col-span-3 space-y-4">
            <TodayStatCards
              total={todayStats.total}
              pending={todayStats.pending}
              confirmed={todayStats.confirmed}
              cancelled={todayStats.cancelled}
            />
            <div className="luxury-card p-4">
              <p className="font-body text-xs text-mauve-500">
                สาขา: {branchFilter === "all" ? "ทุกสาขา" : branches.find((b) => b.id === branchFilter)?.name ?? branchFilter}
              </p>
              <p className="font-body text-sm text-mauve-700 mt-1">{formatDate(todayStr + "T12:00:00")}</p>
            </div>
          </div>
          {/* กลาง: รายการจองวันนี้ */}
          <div className="xl:col-span-5">
            <div className="luxury-card p-6">
              <QueueWorkbench
                dateStr={todayStr}
                branchFilter={branchFilter}
                branches={branches}
                onMutate={() => {
                  void mutateList();
                  void mutateCalendar();
                }}
                onEdit={(item) => setEditingItem(item)}
                onReject={(item) => setRejectTarget(item)}
              />
            </div>
          </div>
          {/* ขวา: Timeline หมอแต่ละคน */}
          <div className="xl:col-span-4 space-y-4">
            <h2 className="font-display text-lg font-semibold text-mauve-800">Timeline หมอ</h2>
            {doctors.length > 0 ? (
              doctors.map((d) => (
                <div key={d.id} className="luxury-card p-4">
                  <DayTimelineView
                    dateStr={todayStr}
                    branchId={branchFilter !== "all" ? branchFilter : branches[0]?.id ?? ""}
                    doctorId={d.doctor_id ?? d.id}
                    doctorName={d.doctor_name ?? d.doctor_id ?? `แพทย์ ${d.id.slice(0, 6)}`}
                    onSelectBooking={(id) => {
                      const item = calendarItems.find((b) => b.id === id);
                      if (item) setEditingItem(item);
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="luxury-card p-6">
                <DayTimelineView
                  dateStr={todayStr}
                  branchId={branchFilter !== "all" ? branchFilter : branches[0]?.id ?? ""}
                  onSelectBooking={(id) => {
                    const item = calendarItems.find((b) => b.id === id);
                    if (item) setEditingItem(item);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "calendar" && (
      <section className="py-8 relative">
        {/* Slide panel: คลิกวัน → แสดงรายการจองของวันนั้น */}
        <AnimatePresence>
          {selectedDate && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white border-l border-cream-300 shadow-luxury-lg z-40 flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-cream-200 flex items-center justify-between shrink-0">
                <h3 className="font-display text-lg font-semibold text-mauve-800">
                  รายการจอง — {formatDate(selectedDate + "T12:00:00")}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="p-2 rounded-xl text-mauve-500 hover:bg-cream-100 hover:text-mauve-700"
                  aria-label="ปิด"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedDayItems.length === 0 ? (
                  <p className="font-body text-sm text-mauve-400 py-8 text-center">ไม่มีรายการจองวันนี้</p>
                ) : (
                  selectedDayItems.map((b) => (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      className="luxury-card p-4 cursor-pointer hover:shadow-luxury transition-all"
                      onClick={() => setEditingItem(b)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setEditingItem(b))}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-display font-semibold text-mauve-800">{formatTime(b.scheduledAt)}</span>
                        {b.source === "ai" && <Badge variant="ai" size="sm">🤖 AI</Badge>}
                        <Badge variant={b.status === "confirmed" ? "success" : b.status === "pending" || b.status === "pending_admin_confirm" ? "warning" : "default"} size="sm">
                          {STATUS_LABEL[b.status] ?? b.status}
                        </Badge>
                      </div>
                      <p className="font-body text-sm text-mauve-700">{b.customerName}</p>
                      <p className="font-body text-xs text-mauve-400">{b.service} · {b.doctor || "—"} · {CHANNEL_LABEL[b.channel ?? ""] ?? b.channel ?? "—"}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-cream-200 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  onClick={() => { setCreateModalInitialDate(selectedDate); setShowCreateModal(true); }}
                >
                  + จองใหม่
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sticky top-[52px] z-[9] bg-cream-100/80 backdrop-blur -mx-4 px-4 md:-mx-6 md:px-6 py-3 mb-8 flex flex-wrap gap-3 items-center">
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 transition-all"
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
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 transition-all"
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
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 transition-all"
            title="กรองตามช่องทาง"
            aria-label="เลือกช่องทาง"
          >
            <option value="all">ทุกช่องทาง</option>
            {BOOKING_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant="primary" shimmer onClick={() => setShowCreateModal(true)}>
            + จองคิว
          </Button>
        </div>
        <div className="luxury-card p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-xs font-medium text-mauve-400 uppercase tracking-wide">ปฏิทิน</p>
              <div className="flex items-center gap-1 p-1 bg-cream-200 rounded-xl">
                {(["month", "week", "day"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCalendarViewMode(mode)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-all",
                      calendarViewMode === mode ? "bg-gradient-to-r from-rg-400 to-rg-600 text-white shadow-sm" : "text-mauve-500 hover:text-mauve-700"
                    )}
                  >
                    {mode === "month" ? "เดือน" : mode === "week" ? "สัปดาห์" : "วัน"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-mauve-800">
                {calendarViewMode === "month" && `${MONTH_NAMES_TH[viewMonth - 1]} ${viewYear + 543}`}
                {calendarViewMode === "week" && (() => {
                  const mon = new Date(viewWeekStart + "T12:00:00");
                  const sun = new Date(mon);
                  sun.setDate(sun.getDate() + 6);
                  return `${mon.getDate()}–${sun.getDate()} ${MONTH_NAMES_TH[mon.getMonth()]} ${mon.getFullYear() + 543}`;
                })()}
                {calendarViewMode === "day" && selectedDate && (() => {
                  const d = new Date(selectedDate + "T12:00:00");
                  return `${d.getDate()} ${MONTH_NAMES_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
                })()}
                {calendarViewMode === "day" && !selectedDate && "เลือกรายการด้านซ้าย"}
              </h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (calendarViewMode === "month") prevMonth();
                    else if (calendarViewMode === "week") {
                      const d = new Date(viewWeekStart + "T12:00:00");
                      d.setDate(d.getDate() - 7);
                      setViewWeekStart(d.toISOString().slice(0, 10));
                    } else if (calendarViewMode === "day" && selectedDate) {
                      const d = new Date(selectedDate + "T12:00:00");
                      d.setDate(d.getDate() - 1);
                      setSelectedDate(d.toISOString().slice(0, 10));
                    }
                  }}
                  className="w-9 h-9 rounded-xl bg-cream-200 hover:bg-rg-100 text-mauve-600 hover:text-rg-600 transition-all flex items-center justify-center font-body"
                  aria-label="ก่อนหน้า"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (calendarViewMode === "month") nextMonth();
                    else if (calendarViewMode === "week") {
                      const d = new Date(viewWeekStart + "T12:00:00");
                      d.setDate(d.getDate() + 7);
                      setViewWeekStart(d.toISOString().slice(0, 10));
                    } else if (calendarViewMode === "day" && selectedDate) {
                      const d = new Date(selectedDate + "T12:00:00");
                      d.setDate(d.getDate() + 1);
                      setSelectedDate(d.toISOString().slice(0, 10));
                    } else if (calendarViewMode === "day") {
                      setSelectedDate(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  className="w-9 h-9 rounded-xl bg-cream-200 hover:bg-rg-100 text-mauve-600 hover:text-rg-600 transition-all flex items-center justify-center font-body"
                  aria-label="ถัดไป"
                >
                  →
                </button>
              </div>
            </div>
            {calendarError && (
              <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-2xl bg-red-50 text-sm text-red-700 font-body" role="alert">
                <span>โหลดปฏิทินไม่สำเร็จ: {calendarError.message}</span>
                <button type="button" className="shrink-0 font-medium text-red-700 hover:opacity-80" onClick={() => void mutateCalendar()}>
                  ลองใหม่
                </button>
              </div>
            )}
            {calendarLoading && !calendarData && (
              <div className="py-8 space-y-3" aria-busy="true">
                <div className="h-4 w-24 rounded-2xl bg-cream-200 animate-pulse mx-auto" />
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-2xl bg-cream-200 animate-pulse" />
                  ))}
                </div>
              </div>
            )}
            {!calendarLoading && (
              <AnimatePresence mode="wait">
                {calendarViewMode === "month" && (
                  <motion.div key="month" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <CalendarGrid
                      year={viewYear}
                      month={viewMonth}
                      datesWithCount={calendarData?.datesWithCount ?? {}}
                      datesWithStatus={calendarData?.datesWithStatus}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      onAddBooking={(dateStr) => {
                        setCreateModalInitialDate(dateStr);
                        setShowCreateModal(true);
                      }}
                    />
                    <p className="mt-5 font-body text-xs text-mauve-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" /> ว่าง</span>
                      <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 align-middle" /> เกือบเต็ม</span>
                      <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 align-middle" /> เต็ม</span>
                    </p>
                  </motion.div>
                )}
                {calendarViewMode === "week" && (
                  <motion.div key="week" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <WeekView
                      viewWeekStart={viewWeekStart}
                      items={calendarItems}
                      doctorFilter={doctorFilter}
                      onSlotClick={(dateStr, time) => {
                        setCreateModalInitialDate(dateStr);
                        setCreateModalInitialTime(time);
                        setShowCreateModal(true);
                      }}
                      onBookingClick={(b) => setEditingItem(b)}
                    />
                  </motion.div>
                )}
                {calendarViewMode === "day" && (
                  <motion.div key="day" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <DayView
                      dateStr={selectedDate ?? new Date().toISOString().slice(0, 10)}
                      items={calendarItems}
                      doctors={doctors}
                      doctorFilter={doctorFilter}
                      onSlotClick={(dateStr, time) => {
                        setCreateModalInitialDate(dateStr);
                        setCreateModalInitialTime(time);
                        setShowCreateModal(true);
                      }}
                      onBookingClick={(b) => setEditingItem(b)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
      </section>
      )}

      {activeTab === "all" && (
      <section className="py-8">
        <div className="sticky top-[52px] z-[9] bg-cream-100/80 backdrop-blur -mx-4 px-4 md:-mx-6 md:px-6 py-3 mb-8 flex flex-wrap gap-3 items-center">
          <Input
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-[36px] w-48 sm:w-64"
            aria-label="ค้นหา"
          />
          <input
            type="date"
            value={dateFilterFrom}
            onChange={(e) => setDateFilterFrom(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 text-sm text-mauve-800 bg-white"
            aria-label="จากวันที่"
          />
          <input
            type="date"
            value={dateFilterTo}
            onChange={(e) => setDateFilterTo(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 text-sm text-mauve-800 bg-white"
            aria-label="ถึงวันที่"
          />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white"
            aria-label="สาขา"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={allDoctorFilter}
            onChange={(e) => setAllDoctorFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white"
            aria-label="แพทย์"
          >
            <option value="all">ทุกแพทย์</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.doctor_id ?? d.doctor_name ?? d.id}>{d.doctor_name ?? d.doctor_id ?? d.id}</option>
            ))}
          </select>
          <select
            value={allStatusFilter}
            onChange={(e) => setAllStatusFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white"
            aria-label="สถานะ"
          >
            <option value="">ทุกสถานะ</option>
            {["pending", "pending_admin_confirm", "confirmed", "in_progress", "completed", "cancelled", "no-show"].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-700 bg-white"
            aria-label="ช่องทาง"
          >
            <option value="all">ทุกช่องทาง</option>
            {BOOKING_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => {
            const headers = ["วันที่", "เวลา", "ลูกค้า", "บริการ", "หมอ", "ช่องทาง", "จองโดย", "สถานะ"];
            const rows = items.map((b) => [
              b.scheduledAt.slice(0, 10),
              formatTime(b.scheduledAt),
              b.customerName,
              b.service,
              b.doctor ?? "",
              CHANNEL_LABEL[b.channel ?? ""] ?? b.channel ?? "",
              SOURCE_LABEL[b.source ?? ""] ?? b.source ?? "",
              STATUS_LABEL[b.status] ?? b.status,
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `booking-export-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}>
            Export CSV
          </Button>
          <Button type="button" size="sm" variant="primary" shimmer onClick={() => setShowCreateModal(true)}>
            + จองใหม่
          </Button>
        </div>
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            {items.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={<TableCellsIcon className="w-12 h-12 text-mauve-300" />}
                  title="ยังไม่มีรายการจอง"
                  description="การจองใหม่จะแสดงที่นี่"
                  action={
                    <Button variant="primary" shimmer onClick={() => setShowCreateModal(true)}>
                      + จองใหม่
                    </Button>
                  }
                />
              </div>
            ) : (
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-100/80">
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">วันที่</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">เวลา</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">ลูกค้า</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">บริการ</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">หมอ</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">ช่องทาง</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">จองโดย</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">สถานะ</th>
                    <th className="text-left px-4 py-3 font-medium text-mauve-600">action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-cream-200 hover:bg-cream-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-mauve-700">{b.scheduledAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-mauve-700">{formatTime(b.scheduledAt)}</td>
                      <td className="px-4 py-3 text-mauve-800 font-medium">{b.customerName}</td>
                      <td className="px-4 py-3 text-mauve-600">{b.service}</td>
                      <td className="px-4 py-3 text-mauve-600">{b.doctor ?? "—"}</td>
                      <td className="px-4 py-3 text-mauve-600">{CHANNEL_LABEL[b.channel ?? ""] ?? b.channel ?? "—"}</td>
                      <td className="px-4 py-3">
                        {b.source === "ai" ? <Badge variant="ai" size="sm">AI</Badge> : <span className="text-mauve-600">Admin</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={b.status === "confirmed" ? "success" : b.status === "pending" || b.status === "pending_admin_confirm" ? "warning" : "default"} size="sm">
                          {STATUS_LABEL[b.status] ?? b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingItem(b)}>แก้ไข</Button>
                          {(b.status === "pending" || b.status === "pending_admin_confirm") && (
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setRejectTarget(b)}>ปฏิเสธ</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {lastId && items.length > 0 && (
            <div className="p-4 border-t border-cream-200">
              <Button variant="ghost" size="sm" fullWidth onClick={loadMore}>โหลดเพิ่ม</Button>
            </div>
          )}
        </div>
        <p className="mt-2 font-body text-xs text-mauve-400">{items.length} รายการ</p>
      </section>
      )}

      {activeTab === "reports" && (
      <section className="py-8">
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold text-mauve-800">รายงานการจอง</h2>
          <p className="font-body text-sm text-mauve-400 mt-0.5">สรุปตามช่องทาง หัตถการ จำนวนเงิน</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="จำนวนจอง" value={reports.totalCount} />
          <StatCard label="รายได้รวม (฿)" value={reports.totalAmount.toLocaleString()} />
          <StatCard label="อัตรายกเลิก" value={`${reports.cancellationRate.toFixed(1)}%`} subtext={`${reports.cancelledCount} รายการ`} />
        </div>
        <div className="flex flex-wrap gap-3 items-center mb-8">
          <label className="flex items-center gap-2 font-body text-sm font-medium text-mauve-600">
            <span>ช่วงวันที่</span>
            <input
              type="date"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
              className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-800 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 transition-all"
            />
            <span>-</span>
            <input
              type="date"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
              className="min-h-[36px] px-3 py-2 rounded-2xl border border-cream-300 font-body text-sm text-mauve-800 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 transition-all"
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const items = (reportData as { items?: Array<{ scheduledAt: string; customerName: string; service: string; procedure?: string; channel?: string; amount?: number; status: string; branchName?: string }> } | undefined)?.items ?? [];
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
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="luxury-card p-6">
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">จำนวนการจองต่อวัน</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports.byDate.map(([d, v]) => ({ date: d.slice(5), count: v.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke={CHART_COLORS.secondary} />
                  <YAxis tick={{ fontSize: 10 }} stroke={CHART_COLORS.secondary} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="จอง" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="luxury-card p-6">
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">รายได้จากการจอง</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reports.byDate.map(([d, v]) => ({ date: d.slice(5), amount: v.amount }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke={CHART_COLORS.secondary} />
                  <YAxis tick={{ fontSize: 10 }} stroke={CHART_COLORS.secondary} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(val: number | undefined) => [`฿${Number(val ?? 0).toLocaleString()}`, "รายได้"]} />
                  <Area type="monotone" dataKey="amount" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.primary} fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="luxury-card p-6 space-y-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-mauve-800">ตามช่องทาง</h3>
              <p className="font-body text-sm text-mauve-400 mt-0.5">รวม {reports.totalCount} รายการ · ฿{reports.totalAmount.toLocaleString()}</p>
            </div>
            <div className="space-y-3 font-body text-sm text-mauve-700">
              {reports.byChannel.map(([ch, v]) => (
                <div key={ch} className="flex justify-between">
                  <span>{CHANNEL_LABEL[ch] ?? SOURCE_LABEL[ch] ?? ch}</span>
                  <span className="tabular-nums text-mauve-500">
                    {v.count} รายการ
                    {v.amount > 0 && ` · ฿${v.amount.toLocaleString()}`}
                  </span>
                </div>
              ))}
              {reports.byChannel.length === 0 && (
                <p className="font-body text-sm text-mauve-400 py-2">ไม่มีข้อมูลในช่วงนี้</p>
              )}
              <div className="pt-4 mt-2 font-body text-sm font-medium text-mauve-800 flex justify-between">
                <span>รวมทั้งหมด</span>
                <span className="tabular-nums">฿{reports.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="luxury-card p-6 space-y-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-mauve-800">หัตถการยอดนิยม</h3>
              <p className="font-body text-sm text-mauve-400 mt-0.5">Top 10</p>
            </div>
            <div className="space-y-3">
              {reports.byProcedure.map(([proc, count]) => (
                <div key={proc} className="flex justify-between font-body text-sm">
                  <span className="truncate text-mauve-700">{proc}</span>
                  <span className="tabular-nums text-mauve-500">{count} คน</span>
                </div>
              ))}
              {reports.byProcedure.length === 0 && (
                <p className="font-body text-sm text-mauve-400 py-2">ไม่มีข้อมูล</p>
              )}
            </div>
          </div>
          <div className="luxury-card p-6">
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">สถิติหมอแต่ละคน</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-cream-300">
                    <th className="text-left py-2 font-medium text-mauve-600">แพทย์</th>
                    <th className="text-right py-2 font-medium text-mauve-600">จอง</th>
                    <th className="text-right py-2 font-medium text-mauve-600">รายได้</th>
                    <th className="text-right py-2 font-medium text-mauve-600">ยกเลิก %</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.byDoctor.map((d) => (
                    <tr key={d.doctor} className="border-b border-cream-200">
                      <td className="py-2 text-mauve-700">{d.doctor}</td>
                      <td className="py-2 text-right tabular-nums text-mauve-600">{d.count}</td>
                      <td className="py-2 text-right tabular-nums text-mauve-600">฿{d.amount.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums text-mauve-600">{d.cancellationRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reports.byDoctor.length === 0 && <p className="text-mauve-400 py-4 text-center text-sm">ไม่มีข้อมูล</p>}
            </div>
          </div>
          <div className="luxury-card p-6">
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">อัตราการยกเลิก</h3>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "ยกเลิก", value: reports.cancelledCount, color: PIE_COLORS[1] },
                      { name: "สำเร็จ", value: Math.max(0, reports.totalCount - reports.cancelledCount), color: PIE_COLORS[0] },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill={PIE_COLORS[1]} />
                    <Cell fill={PIE_COLORS[0]} />
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => [`${v ?? 0} (${reports.totalCount > 0 ? ((Number(v ?? 0) / reports.totalCount) * 100).toFixed(1) : 0}%)`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center font-body text-sm text-mauve-600 mt-2">
              {reports.cancelledCount} / {reports.totalCount} รายการ ({reports.cancellationRate.toFixed(1)}%)
            </p>
          </div>
        </div>
      </section>
      )}

      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        booking={rejectTarget}
        onConfirm={handleRejectConfirm}
      />

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
          initialDate={createModalInitialDate}
          initialTime={createModalInitialTime}
          onClose={() => { setShowCreateModal(false); setCreateModalInitialDate(null); setCreateModalInitialTime(null); }}
          onSuccess={() => {
            setShowCreateModal(false);
            setCreateModalInitialDate(null);
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
  doctors: _doctors,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-mauve-900/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-booking-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="luxury-card max-w-md w-full mx-4 max-h-[90vh] flex flex-col border border-cream-300 shadow-luxury-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-cream-200 shrink-0">
          <h2 id="edit-booking-title" className="font-display text-xl font-semibold text-mauve-800">แก้ไขการจอง</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-body" role="alert">{error}</div>
            )}
            <section className="space-y-3" aria-labelledby="edit-customer-heading">
              <h3 id="edit-customer-heading" className="font-body text-xs font-medium text-mauve-500 uppercase tracking-wide">ข้อมูลลูกค้า</h3>
              <div>
                <label className="block font-body text-sm font-medium text-mauve-700 mb-1">ชื่อลูกค้า *</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อ-นามสกุล" required className="min-h-[36px]" />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-mauve-700 mb-1">เบอร์โทร</label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08xxxxxxxx" className="min-h-[36px]" />
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="edit-service-heading">
              <h3 id="edit-service-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">บริการ และเวลา</h3>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">บริการ *</label>
            {services.length > 0 ? (
              <select value={service} onChange={(e) => setService(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-cream-300 min-h-[36px] text-rg-900" required>
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
                <label className="block text-sm font-medium text-rg-900 mb-1">หัตถการ/รายละเอียด</label>
                <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="เช่น Botox, ฟิลเลอร์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">แพทย์ (ถ้ามี)</label>
                <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อแพทย์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">จำนวนเงิน (บาท)</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">วันที่-เวลา *</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="min-h-[36px]" />
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="edit-status-heading">
              <h3 id="edit-status-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">สถานะ และช่องทาง</h3>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">สถานะ</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-cream-300 min-h-[36px] text-rg-900">
                  {(["pending", "pending_admin_confirm", "confirmed", "in_progress", "reschedule_pending_admin", "cancel_requested", "completed", "no-show", "cancelled"] as const).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">ช่องทางที่ลูกค้าจองเข้ามา</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)} className="w-full px-3 py-2 rounded-[8px] border border-cream-300 min-h-[36px] text-rg-900">
                  {BOOKING_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
                  ))}
                </select>
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="edit-notes-heading">
              <h3 id="edit-notes-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">หมายเหตุ</h3>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" className="min-h-[36px]" />
            </section>
          </div>
          <div className="sticky bottom-0 p-4 border-t border-cream-200 bg-cream-100/80 flex gap-2 shrink-0 rounded-b-2xl">
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-[36px]">ยกเลิก</Button>
            <Button type="submit" variant="primary" disabled={sending} className="min-h-[36px]">{sending ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type CustomerSearchItem = {
  id: string;
  name: string;
  phone?: string | null;
  pictureUrl?: string | null;
  externalId?: string;
  source?: string;
};

function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "ค้นหาชื่อลูกค้า...",
}: {
  value: string;
  onChange?: (name: string) => void;
  onSelect: (c: { id: string; name: string; phone?: string | null; externalId?: string } | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clinic/customers?search=${encodeURIComponent(debounced)}&limit=10&allBranches=true`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setResults(items.map((c: { id: string; name: string; phone?: string; pictureUrl?: string; externalId?: string; source?: string }) => ({
          id: c.id, name: c.name, phone: c.phone, pictureUrl: c.pictureUrl, externalId: c.externalId, source: c.source,
        })));
        setOpen(true);
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange?.(e.target.value);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder={placeholder}
        className="min-h-[36px]"
        aria-label="ค้นหาลูกค้า"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mauve-400">...</span>}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-cream-300 bg-white shadow-luxury max-h-60 overflow-y-auto">
          {results.length === 0 && !loading ? (
            <button type="button" className="w-full px-3 py-3 text-left text-sm text-mauve-500 hover:bg-cream-100" onClick={() => { onSelect(null); setOpen(false); setQuery(""); }}>
              สร้างลูกค้าใหม่
            </button>
          ) : (
            <>
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-cream-100 transition-colors"
                  onClick={() => {
                    onSelect({ id: c.id, name: c.name, phone: c.phone, externalId: c.externalId });
                    setQuery(c.name);
                    setOpen(false);
                  }}
                >
                  {c.pictureUrl ? (
                    <img src={c.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-cream-200 flex items-center justify-center text-mauve-500 text-sm font-medium flex-shrink-0">
                      {(c.name || "?").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm font-medium text-mauve-800 truncate">{c.name || "ลูกค้า"}</p>
                    {c.phone && <p className="font-body text-xs text-mauve-500 truncate">{c.phone}</p>}
                  </div>
                </button>
              ))}
              <button type="button" className="w-full px-3 py-2.5 text-left text-sm text-rg-600 hover:bg-cream-100 border-t border-cream-200 font-medium" onClick={() => { onSelect(null); setOpen(false); setQuery(""); }}>
                สร้างลูกค้าใหม่
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CreateBookingModal({
  branches,
  services,
  initialDate,
  initialTime,
  onClose,
  onSuccess,
}: {
  branches: Array<{ id: string; name: string }>;
  services: Array<{ id: string; service_name: string }>;
  initialDate?: string | null;
  initialTime?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [procedure, setProcedure] = useState("");
  const [amount, setAmount] = useState("");
  const [doctor, setDoctor] = useState("");
  const [channel, setChannel] = useState<BookingChannel>("line");
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (initialTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(initialTime)) return initialTime.slice(0, 16);
    if (initialDate && initialTime) return `${initialDate}T${initialTime}`;
    if (initialDate) return `${initialDate}T09:00`;
    const d = new Date();
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  useEffect(() => {
    if (initialTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(initialTime)) setScheduledAt(initialTime.slice(0, 16));
    else if (initialDate && initialTime) setScheduledAt(`${initialDate}T${initialTime}`);
    else if (initialDate) setScheduledAt(`${initialDate}T09:00`);
  }, [initialDate, initialTime]);
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
          customerId: customerId || undefined,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-mauve-900/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-booking-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="luxury-card max-w-md w-full mx-4 max-h-[90vh] flex flex-col border border-cream-300 shadow-luxury-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-cream-200 shrink-0">
          <h2 id="create-booking-title" className="font-display text-xl font-semibold text-mauve-800">จองคิวใหม่</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-body" role="alert">
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
              <h3 id="create-customer-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">ข้อมูลลูกค้า</h3>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">ค้นหาลูกค้า *</label>
                <CustomerAutocomplete
                  value={customerName}
                  onChange={(name) => {
                    setCustomerName(name);
                    setCustomerId(null);
                  }}
                  onSelect={(c) => {
                    if (c) {
                      setCustomerName(c.name);
                      setPhoneNumber(c.phone ?? "");
                      setCustomerId(c.id);
                    } else {
                      setCustomerName("");
                      setPhoneNumber("");
                      setCustomerId(null);
                    }
                  }}
                  placeholder="พิมพ์ชื่อหรือเบอร์โทร..."
                />
                {customerId && (
                  <p className="mt-1 text-xs text-mauve-500">เลือกจากรายการ หรือคลิก &quot;สร้างลูกค้าใหม่&quot; เพื่อกรอกเอง</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">เบอร์โทร</label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="08xxxxxxxx"
                  className="min-h-[36px]"
                />
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="create-service-heading">
              <h3 id="create-service-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">บริการ และเวลา</h3>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">บริการ *</label>
                {services.length > 0 ? (
                  <select value={service} onChange={(e) => setService(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-cream-300 min-h-[36px] text-rg-900" required>
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
                <label className="block text-sm font-medium text-rg-900 mb-1">หัตถการ/รายละเอียด</label>
                <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="เช่น Botox, ฟิลเลอร์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">แพทย์ (ถ้ามี)</label>
                <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ชื่อแพทย์" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">จำนวนเงิน (บาท)</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="min-h-[36px]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">วันที่-เวลา *</label>
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
              <h3 id="create-channel-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">ช่องทาง และสาขา</h3>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">ช่องทางที่ลูกค้าจองเข้ามา</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)} className="w-full px-3 py-2 rounded-[8px] border border-cream-300 min-h-[36px] text-rg-900">
                  {BOOKING_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>{CHANNEL_LABEL[ch] ?? ch}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-rg-900 mb-1">สาขา</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-cream-300 min-h-[36px] text-rg-900">
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </section>
            <section className="space-y-3" aria-labelledby="create-notes-heading">
              <h3 id="create-notes-heading" className="text-[12px] font-medium text-cream-500 uppercase tracking-wide leading-[1.35]">หมายเหตุ</h3>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" className="min-h-[36px]" />
            </section>
          </div>
          <div className="sticky bottom-0 p-4 border-t border-cream-200 bg-cream-100/80 flex gap-2 shrink-0 rounded-b-2xl">
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-[36px]">ยกเลิก</Button>
            <Button type="submit" variant="primary" disabled={sending} className="min-h-[36px]">{sending ? "กำลังบันทึก..." : "จองคิว"}</Button>
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
        <div className="min-h-screen bg-cream-100/50 p-6" aria-busy="true">
          <div className="h-10 w-48 rounded-2xl bg-cream-200 animate-pulse mb-6" />
          <div className="h-12 w-full max-w-md rounded-2xl bg-cream-200 animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-cream-200 animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
