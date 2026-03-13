"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useClinicContext } from "@/contexts/ClinicContext";
import { useFirebaseRealtime } from "@/hooks/useFirebaseRealtime";
import { getFirebaseFirestore, isFirebaseConfigReady } from "@/lib/firebase-client";
import { apiFetcher } from "@/lib/api-fetcher";

const STORAGE_KEY_PREFIX = "clinic_notif_last_seen";

function getReadStorageKey(orgId: string | null, branchId: string | null): string {
  return `${STORAGE_KEY_PREFIX}_${orgId ?? "na"}_${branchId ?? "all"}`;
}

function getLastSeenFetchedAt(orgId: string | null, branchId: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(getReadStorageKey(orgId, branchId));
  } catch {
    return null;
  }
}

function setLastSeenFetchedAt(
  orgId: string | null,
  branchId: string | null,
  fetchedAt: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getReadStorageKey(orgId, branchId), fetchedAt);
  } catch {
    /* ignore */
  }
}

type NotificationSeverity = "urgent" | "warning" | "info";

type Notification = {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  count?: number;
  timestamp: string;
  read?: boolean;
};

type NotificationsResponse = {
  notifications: Notification[];
  grouped: { urgent: Notification[]; warning: Notification[]; info: Notification[] };
  totalCount: number;
  fetchedAt: string;
};

const severityConfig: Record<
  NotificationSeverity,
  { label: string; bg: string; border: string; icon: string; text: string }
> = {
  urgent: {
    label: "เร่งด่วน",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-500",
    text: "text-red-800",
  },
  warning: {
    label: "ควรตรวจสอบ",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "text-amber-600",
    text: "text-amber-900",
  },
  info: {
    label: "ข้อมูล",
    bg: "bg-sky-50",
    border: "border-sky-200",
    icon: "text-sky-600",
    text: "text-sky-900",
  },
};

function RefreshIcon({ className, spinning }: { className?: string; spinning?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className ?? ""} ${spinning ? "animate-pulse" : ""}`}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UrgentIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function NotificationSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="h-3 w-24 bg-surface-200 rounded animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl border border-surface-200 bg-surface-50">
            <div className="w-4 h-4 rounded-full bg-surface-200 animate-pulse flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 bg-surface-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-surface-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeIcon({ type, severity }: { type: string; severity: NotificationSeverity }) {
  switch (type) {
    case "hot_lead":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 23a7 7 0 0 0 7-7c0-2.38-1.19-4.47-3-5.74V10c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V2c0-.55.45-1 1-1s1 .45 1 1v2h4V2c0-.55.45-1 1-1s1 .45 1 1v2h4V2c0-.55.45-1 1-1s1 .45 1 1v.26C21.81 4.53 23 6.62 23 9c0 3.87-3.13 7-7 7z" />
        </svg>
      );
    case "handoff_pending":
    case "handoff_assigned":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "pending_booking":
    case "booking.created":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "quota_warning":
    case "quota_exceeded":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case "payment_success":
    case "payment_failed":
    case "billing_reminder":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    default:
      return <SeverityIcon severity={severity} />;
  }
}

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  switch (severity) {
    case "urgent":
      return <UrgentIcon />;
    case "warning":
      return <WarningIcon />;
    case "info":
      return <InfoIcon />;
  }
}

function NotificationItem({
  n,
  config,
  onClose,
}: {
  n: Notification;
  config: (typeof severityConfig)[NotificationSeverity];
  onClose: () => void;
}) {
  const content = (
    <div
      className={`flex gap-3 p-3 rounded-xl border ${config.bg} ${config.border} transition-colors hover:opacity-90 ${n.read ? "opacity-75" : ""}`}
    >
      <span className={`flex-shrink-0 mt-0.5 ${config.icon} flex items-center`}>
        <TypeIcon type={n.type} severity={n.severity} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${config.text}`}>{n.title}</p>
        <p className="text-sm text-surface-600 mt-0.5">{n.message}</p>
        {n.count != null && (
          <span className="inline-block mt-1.5 text-xs font-medium text-surface-500 bg-white/80 px-2 py-0.5 rounded-full">
            {n.count} รายการ
          </span>
        )}
      </div>
    </div>
  );

  if (n.actionUrl) {
    return (
      <Link
        href={n.actionUrl}
        onClick={onClose}
        className="block group cursor-pointer hover:brightness-[0.98] active:brightness-[0.96]"
      >
        {content}
      </Link>
    );
  }
  return <div>{content}</div>;
}

type FilterMode = "all" | "unread";

export function NotificationBell() {
  const { org_id, branch_id } = useClinicContext();
  const firebase = useFirebaseRealtime();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [markingRead, setMarkingRead] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const url = branch_id
    ? `/api/clinic/notifications?branchId=${branch_id}`
    : "/api/clinic/notifications";
  const { data, error, mutate, isValidating } = useSWR<NotificationsResponse>(url, apiFetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

  // Real-time: onSnapshot triggers refetch when Firestore notifications change
  useEffect(() => {
    if (
      !isFirebaseConfigReady() ||
      !firebase.ready ||
      !firebase.orgId ||
      !firebase.signedIn
    )
      return;
    const db = getFirebaseFirestore();
    const colRef = collection(db, "organizations", firebase.orgId, "notifications");
    const q = query(colRef, orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, () => mutate());
    return () => unsub();
  }, [firebase.ready, firebase.orgId, firebase.signedIn, mutate]);

  const lastSeenStored = lastSeen ?? getLastSeenFetchedAt(org_id, branch_id);
  const total = data?.totalCount ?? 0;
  const fetchedAt = data?.fetchedAt ?? null;
  const { urgent = [], warning = [], info = [] } = data?.grouped ?? {};
  const allNotifications = [...urgent, ...warning, ...info];
  const unreadCount =
    fetchedAt && lastSeenStored && fetchedAt <= lastSeenStored ? 0 : total;
  const filtered =
    filter === "unread"
      ? allNotifications.filter((n) => n.read !== true)
      : allNotifications;

  const handleMarkAllRead = useCallback(async () => {
    setMarkingRead(true);
    try {
      await fetch("/api/clinic/notifications", { method: "PATCH", credentials: "include" });
      if (data?.fetchedAt) {
        setLastSeenFetchedAt(org_id, branch_id, data.fetchedAt);
        setLastSeen(data.fetchedAt);
      }
      await mutate();
    } finally {
      setMarkingRead(false);
    }
  }, [data?.fetchedAt, org_id, branch_id, mutate]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg bg-surface-50 flex items-center justify-center text-surface-600 border border-surface-200/80 hover:bg-surface-100 hover:text-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:ring-offset-1"
        aria-label={`แจ้งเตือน ${unreadCount > 0 ? unreadCount : ""}`}
      >
        <BellIcon className="text-surface-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="ศูนย์แจ้งเตือน"
          className="absolute right-0 top-full mt-2 w-[min(360px,calc(100vw-2rem))] bg-white rounded-2xl shadow-card-hover border border-surface-200/80 overflow-hidden z-50 animate-fade-in-up"
        >
          <div className="p-4 border-b border-surface-100 bg-gradient-to-b from-surface-50/80 to-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-surface-800">ศูนย์แจ้งเตือน</h3>
                <p className="text-xs text-surface-500 mt-0.5">
                  {total === 0
                    ? "ไม่มีแจ้งเตือน"
                    : `รวม ${total} รายการ — แยกตามระดับความสำคัญ`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => mutate()}
                  disabled={isValidating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors disabled:opacity-50"
                  aria-label="รีเฟรช"
                >
                  <RefreshIcon spinning={isValidating} />
                </button>
                {total > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingRead}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline px-2 py-1 disabled:opacity-50"
                  >
                    {markingRead ? "กำลังอัปเดต…" : "อ่านทั้งหมดแล้ว"}
                  </button>
                )}
              </div>
            </div>
            {total > 0 && (
              <div className="flex gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`text-xs px-2 py-1 rounded-lg ${filter === "all" ? "bg-primary-100 text-primary-700" : "text-surface-500 hover:bg-surface-100"}`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className={`text-xs px-2 py-1 rounded-lg ${filter === "unread" ? "bg-primary-100 text-primary-700" : "text-surface-500 hover:bg-surface-100"}`}
                >
                  ยังไม่ได้อ่าน
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {!data && !error && <NotificationSkeleton />}
            {error && (
              <div className="p-4 text-center text-red-600 text-sm">
                โหลดไม่สำเร็จ โปรดลองใหม่
              </div>
            )}

            {data && filtered.length === 0 ? (
              <div className="p-6 text-center text-surface-500 text-sm">
                {filter === "unread" ? "ไม่มีแจ้งเตือนที่ยังไม่ได้อ่าน" : "ทุกอย่างเรียบร้อย"}
              </div>
            ) : data ? (
              <>
                {filtered.filter((n) => n.severity === "urgent").length > 0 && (
                  <section className="p-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-red-600 mb-2 px-1">
                      เร่งด่วน
                    </h4>
                    <div className="space-y-2">
                      {filtered
                        .filter((n) => n.severity === "urgent")
                        .map((n) => (
                          <NotificationItem
                            key={n.id}
                            n={n}
                            config={severityConfig.urgent}
                            onClose={() => setOpen(false)}
                          />
                        ))}
                    </div>
                  </section>
                )}
                {filtered.filter((n) => n.severity === "warning").length > 0 && (
                  <section className="p-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-2 px-1">
                      ควรตรวจสอบ
                    </h4>
                    <div className="space-y-2">
                      {filtered
                        .filter((n) => n.severity === "warning")
                        .map((n) => (
                          <NotificationItem
                            key={n.id}
                            n={n}
                            config={severityConfig.warning}
                            onClose={() => setOpen(false)}
                          />
                        ))}
                    </div>
                  </section>
                )}
                {filtered.filter((n) => n.severity === "info").length > 0 && (
                  <section className="p-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 mb-2 px-1">
                      ข้อมูล
                    </h4>
                    <div className="space-y-2">
                      {filtered
                        .filter((n) => n.severity === "info")
                        .map((n) => (
                          <NotificationItem
                            key={n.id}
                            n={n}
                            config={severityConfig.info}
                            onClose={() => setOpen(false)}
                          />
                        ))}
                    </div>
                  </section>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
