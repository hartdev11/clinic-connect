"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { HandoffSession } from "@/types/handoff";

const TRIGGER_LABELS: Record<string, string> = {
  angry_customer: "ไม่พอใจ",
  explicit_request: "ขอคนจริง",
  loop_detected: "วนซ้ำ",
  medical: "เรื่องแพทย์",
  consecutive_objections: "คัดค้านซ้ำ",
  complex_medical: "เรื่องแพทย์ซับซ้อน",
};

function formatDuration(createdAt: string, resolvedAt: string | null): string {
  if (!resolvedAt) return "—";
  const s = (new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / 1000;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m} นาที` : `${sec} วินาที`;
}

function formatWaitTime(createdAt: string, acceptedAt: string | null): string {
  const end = acceptedAt ? new Date(acceptedAt) : new Date();
  const s = (end.getTime() - new Date(createdAt).getTime()) / 1000;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m} นาที ${sec} วินาที` : `${sec} วินาที`;
}

export default function HandoffHistoryPage() {
  const [items, setItems] = useState<HandoffSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchHistory = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (triggerFilter) params.set("triggerType", triggerFilter);
    params.set("limit", "200");
    fetch(`/api/clinic/handoff/history?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setItems(Array.isArray(d?.items) ? d.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const resolvedItems = items.filter((i) => i.status === "resolved");
  const avgWait =
    resolvedItems.length > 0
      ? resolvedItems.reduce((sum, i) => {
          const end = i.acceptedAt ? new Date(i.acceptedAt) : new Date(i.resolvedAt ?? i.createdAt);
          return sum + (end.getTime() - new Date(i.createdAt).getTime()) / 1000;
        }, 0) / resolvedItems.length
      : 0;
  const avgResolution =
    resolvedItems.length > 0
      ? resolvedItems
          .filter((i) => i.resolvedAt)
          .reduce((sum, i) => {
            return sum + (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 1000;
          }, 0) / resolvedItems.filter((i) => i.resolvedAt).length
      : 0;

  const handleExportCsv = () => {
    setExporting(true);
    const headers = ["วันที่", "ลูกค้า", "ประเภท", "เจ้าหน้าที่", "รอรับ", "เวลาปิด", "คุณภาพ"];
    const rows = resolvedItems.map((i) => [
      new Date(i.createdAt).toLocaleString("th-TH"),
      i.customerName,
      TRIGGER_LABELS[i.triggerType] ?? i.triggerType,
      i.assignedStaffName ?? "—",
      formatWaitTime(i.createdAt, i.acceptedAt ?? null),
      formatDuration(i.createdAt, i.resolvedAt ?? null),
      i.learningQuality ?? "—",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `handoff-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Handoff History"
        subtitle="ประวัติการส่งต่อลูกค้า"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="luxury-card p-4">
          <p className="text-xs text-mauve-500 font-body">รวม Sessions</p>
          <p className="font-display text-xl font-semibold text-mauve-800">{resolvedItems.length}</p>
        </div>
        <div className="luxury-card p-4">
          <p className="text-xs text-mauve-500 font-body">เวลารอรับเฉลี่ย</p>
          <p className="font-display text-xl font-semibold text-mauve-800">
            {avgWait > 0 ? `${Math.round(avgWait / 60)} นาที` : "—"}
          </p>
        </div>
        <div className="luxury-card p-4">
          <p className="text-xs text-mauve-500 font-body">เวลาปิดเฉลี่ย</p>
          <p className="font-display text-xl font-semibold text-mauve-800">
            {avgResolution > 0 ? `${Math.round(avgResolution / 60)} นาที` : "—"}
          </p>
        </div>
        <div className="luxury-card p-4 flex items-end">
          <Button variant="outline" size="sm" loading={exporting} onClick={handleExportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="luxury-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-mauve-500 mb-1">จากวันที่</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label className="block text-xs text-mauve-500 mb-1">ถึงวันที่</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label className="block text-xs text-mauve-500 mb-1">ประเภท</label>
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            className="h-10 px-4 rounded-xl border border-cream-300 font-body text-sm text-mauve-700"
          >
            <option value="">ทั้งหมด</option>
            {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" size="sm" onClick={fetchHistory}>
          ค้นหา
        </Button>
      </div>

      {/* Table */}
      <div className="luxury-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-mauve-500 font-body">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-mauve-500 font-body">ไม่มีข้อมูล</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-100/80">
                  <th className="text-left p-4 font-medium text-mauve-600">วันที่</th>
                  <th className="text-left p-4 font-medium text-mauve-600">ลูกค้า</th>
                  <th className="text-left p-4 font-medium text-mauve-600">ประเภท</th>
                  <th className="text-left p-4 font-medium text-mauve-600">เจ้าหน้าที่</th>
                  <th className="text-left p-4 font-medium text-mauve-600">รอรับ</th>
                  <th className="text-left p-4 font-medium text-mauve-600">เวลาปิด</th>
                  <th className="text-left p-4 font-medium text-mauve-600">คุณภาพ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-cream-100 hover:bg-cream-50/50">
                    <td className="p-4 text-mauve-700">
                      {new Date(i.createdAt).toLocaleString("th-TH")}
                    </td>
                    <td className="p-4 text-mauve-700">{i.customerName}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-lg bg-cream-200 text-mauve-600 text-xs">
                        {TRIGGER_LABELS[i.triggerType] ?? i.triggerType}
                      </span>
                    </td>
                    <td className="p-4 text-mauve-700">{i.assignedStaffName ?? "—"}</td>
                    <td className="p-4 text-mauve-600">{formatWaitTime(i.createdAt, i.acceptedAt ?? null)}</td>
                    <td className="p-4 text-mauve-600">{formatDuration(i.createdAt, i.resolvedAt ?? null)}</td>
                    <td className="p-4 text-mauve-600">{i.learningQuality ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
