"use client";

/**
 * Enterprise: หน้าจอเรียกคิว — สำหรับแสดงที่โถงรอ
 * คิวปัจจุบัน / คิวถัดไป แสดงใหญ่ อ่านง่าย
 * ใช้กับ ?branchId=xxx (optional) ใน URL
 */
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

function QueueDisplayContent() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get("branchId") ?? "all";
  const [dateStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const params = new URLSearchParams({ date: dateStr, groupByDoctor: "false" });
  if (branchId !== "all") params.set("branchId", branchId);

  const { data } = useSWR<{ items: Array<{ queueNumber: number; customerName: string; status: string; doctor?: string | null }> }>(
    `/api/clinic/bookings/queue?${params}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const items = data?.items ?? [];
  const inProgress = items.find((b) => b.status === "in_progress");
  const waiting = items.filter((b) => b.status === "confirmed" || b.status === "pending" || b.status === "pending_admin_confirm");
  const currentQueue = inProgress?.queueNumber ?? null;
  const nextQueue = waiting[0]?.queueNumber ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-950 text-white flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-4xl w-full">
        <h1 className="text-2xl font-medium text-primary-200 mb-12">
          หน้างานวันนี้ — {new Date(dateStr).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </h1>

        <div className="grid grid-cols-2 gap-8 mb-16">
          <div className="rounded-3xl bg-white/10 backdrop-blur border border-white/20 p-8">
            <p className="text-xl text-primary-200 mb-2">คิวปัจจุบัน</p>
            <p className="text-8xl font-bold text-white">
              {currentQueue ?? "—"}
            </p>
            {inProgress && (
              <p className="text-xl text-primary-100 mt-2 truncate">{inProgress.customerName}</p>
            )}
          </div>
          <div className="rounded-3xl bg-white/10 backdrop-blur border border-white/20 p-8">
            <p className="text-xl text-primary-200 mb-2">คิวถัดไป</p>
            <p className="text-8xl font-bold text-white">
              {nextQueue ?? "—"}
            </p>
            {waiting[0] && (
              <p className="text-xl text-primary-100 mt-2 truncate">{waiting[0].customerName}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 p-6 max-h-64 overflow-y-auto">
          <p className="text-sm text-primary-300 mb-3">รายการคิวรอ ({items.length} คน)</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {items.slice(0, 20).map((b) => (
              <span
                key={b.queueNumber}
                className={`px-4 py-2 rounded-lg text-lg font-semibold ${
                  b.status === "in_progress"
                    ? "bg-primary-500 text-white"
                    : "bg-white/20 text-primary-100"
                }`}
              >
                คิว {b.queueNumber}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QueueDisplayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-950 flex items-center justify-center text-white">กำลังโหลด...</div>}>
      <QueueDisplayContent />
    </Suspense>
  );
}
