"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ChannelChips, getChannelLabel } from "@/components/clinic/ChannelChips";
import { UserGroupIcon, ChatBubbleLeftRightIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";
import { useFirebaseRealtime } from "@/hooks/useFirebaseRealtime";
import { getFirebaseFirestore, isFirebaseConfigReady } from "@/lib/firebase-client";
import type { CustomerSource } from "@/types/clinic";

type CustomerItem = {
  id: string;
  name: string;
  source: string;
  status: string;
  externalId?: string;
  branch_id?: string;
  pictureUrl?: string | null;
  lastChatAt?: string;
  lastBookingAt?: string;
  leadScore?: number;
  leadPriority?: string | null;
  leadScoreHistory?: Array<{ date: string; score: number }>;
  aiResponded?: boolean;
  deleted_at?: string | null;
};

type ChatItem = {
  id: string;
  userMessage: string;
  botReply: string;
  source?: string;
  createdAt: string;
};

const DEFAULT_NAMES: Record<string, string> = {
  line: "ผู้ใช้ LINE",
  facebook: "ผู้ใช้ Facebook",
  instagram: "ผู้ใช้ Instagram",
  tiktok: "ผู้ใช้ TikTok",
  web: "ผู้ใช้ Web",
};

function LeadScoreGauge({
  score,
  history,
}: {
  score: number | undefined;
  history?: Array<{ date: string; score: number }>;
}) {
  const pct = score != null ? Math.round((score ?? 0) * 100) : 0;
  const tier =
    score != null
      ? score >= 0.8
        ? "Very Hot"
        : score >= 0.6
          ? "Hot"
          : score >= 0.3
            ? "Warm"
            : "Cold"
      : "—";
  const emoji =
    score != null
      ? score >= 0.8
        ? "🔥"
        : score >= 0.6
          ? "🔥"
          : score >= 0.3
            ? "🌤"
            : "❄"
      : "";
  const fillPct = Math.min(100, Math.max(0, pct)) / 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-3 rounded-full overflow-hidden bg-cream-300">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rg-400 to-[var(--ent-danger)]"
          initial={{ width: "0%" }}
          animate={{ width: `${fillPct * 100}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <p className="font-body text-xs font-semibold text-mauve-700 tabular-nums">
        {score != null ? score.toFixed(2) : "—"}
      </p>
      <p className="font-body text-[10px] text-mauve-400">
        {emoji} {tier}
      </p>
      {history && history.length > 0 && (
        <div className="flex items-end gap-0.5 h-4 mt-0.5">
          {history.slice(-7).map((h, i) => (
            <motion.div
              key={h.date}
              className="w-1.5 rounded-sm bg-rg-300/60 min-h-[4px]"
              style={{ height: `${(h.score || 0) * 12 + 4}px` }}
              initial={{ height: 4 }}
              animate={{ height: (h.score || 0) * 12 + 4 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              title={`${h.date}: ${(h.score * 100).toFixed(0)}%`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getLeadScoreBadge(score: number | undefined): {
  emoji: string;
  label: string;
  className: string;
  scoreStr: string;
} | null {
  if (score == null) return null;
  const scoreStr = score.toFixed(2);
  if (score >= 0.8)
    return {
      emoji: "🔥",
      label: "Very Hot",
      className: "bg-[color:var(--ent-danger)]/10 text-[var(--ent-danger)]",
      scoreStr,
    };
  if (score >= 0.6)
    return {
      emoji: "🔥",
      label: "Hot",
      className: "bg-[color:var(--ent-danger)]/10 text-[var(--ent-danger)]",
      scoreStr,
    };
  if (score >= 0.3)
    return {
      emoji: "🌤",
      label: "Warm",
      className: "bg-[color:var(--ent-warning)]/10 text-[var(--ent-warning)]",
      scoreStr,
    };
  return {
    emoji: "❄",
    label: "Cold",
    className: "bg-cream-200 text-cream-600",
    scoreStr,
  };
}

function displayName(c: CustomerItem): string {
  const name = (c.name || "").trim();
  if (name && name !== "ลูกค้า LINE") return name;
  return DEFAULT_NAMES[c.source] ?? "ลูกค้า";
}

function ClinicAvatar() {
  const { currentOrg } = useClinicContext();
  const initial = (currentOrg?.name?.trim() || "คลินิก").charAt(0).toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-xl bg-gradient-to-br from-mauve-400 to-mauve-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-auto"
      title={currentOrg?.name ?? "คลินิก"}
    >
      {initial}
    </div>
  );
}

function CustomerProfilePicture({ customer, size = "md" }: { customer: CustomerItem; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  const className = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-11 h-11" : "w-10 h-10";
  const showImage = customer.pictureUrl && !imgError;
  const initial = (displayName(customer) || "?").charAt(0).toUpperCase();
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && !customer.pictureUrl) {
    console.debug("[CustomerProfilePicture] pictureUrl missing — ต้องดึงจาก LINE API แล้ว backfill Firestore", { id: customer.id, name: customer.name });
  }
  if (showImage) {
    return (
      <img
        src={customer.pictureUrl!}
        alt=""
        className={`${className} ${size === "lg" ? "rounded-2xl" : "rounded-full"} object-cover flex-shrink-0 ring-1 ring-cream-300`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div
      className={`${className} ${size === "lg" ? "rounded-2xl" : "rounded-full"} bg-gradient-to-br from-rg-200 to-rg-400 flex items-center justify-center flex-shrink-0 text-white font-display font-semibold shadow-luxury`}
      title={customer.pictureUrl ? "รูปโปรไฟล์โหลดไม่สำเร็จ" : "ยังไม่มีรูปโปรไฟล์"}
      style={{ fontSize: size === "sm" ? "0.75rem" : size === "lg" ? "1rem" : "0.875rem" }}
    >
      {initial}
    </div>
  );
}

function toISO(t: { toDate?: () => Date } | Date | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = t && typeof (t as { toDate?: () => Date }).toDate === "function" ? (t as { toDate: () => Date }).toDate() : null;
  return d ? new Date(d).toISOString() : String(t);
}

type FeedbackItem = {
  id: string;
  userMessage: string;
  botReply: string;
  adminLabel: string | null;
  intent?: string;
  service?: string;
  area?: string;
  source?: string;
  createdAt: string;
};

function FeedbackTabContent({ unlabeledCount, onMutate }: { unlabeledCount: number; onMutate: () => void }) {
  const [filterUnlabeled, setFilterUnlabeled] = useState(false);
  const [labelingId, setLabelingId] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const getFeedbackKey = (i: number, prev: { items: FeedbackItem[]; lastId: string | null } | null) => {
    if (i === 0) return filterUnlabeled ? `/api/clinic/feedback?limit=20&unlabeledOnly=true` : `/api/clinic/feedback?limit=20`;
    if (prev?.lastId) return filterUnlabeled ? `/api/clinic/feedback?limit=20&startAfter=${prev.lastId}&unlabeledOnly=true` : `/api/clinic/feedback?limit=20&startAfter=${prev.lastId}`;
    return null;
  };
  const { data: swrPages, error, size, setSize, isLoading, mutate } = useSWRInfinite(getFeedbackKey, apiFetcher as (url: string) => Promise<{ items: FeedbackItem[]; lastId: string | null }>, { revalidateOnFocus: true, dedupingInterval: 3000 });

  const handleLabel = async (id: string, label: "success" | "fail" | null) => {
    setLabelError(null);
    setLabelingId(id);
    try {
      const res = await fetch(`/api/clinic/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ label }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { mutate(); onMutate(); } else { setLabelError(json.error ?? "ป้ายไม่สำเร็จ กรุณาลองใหม่"); }
    } catch { setLabelError("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setLabelingId(null); }
  };

  const allItems = swrPages?.flatMap((p) => p.items) ?? [];
  const items = allItems.filter((i) => i.source !== "admin");
  const lastPage = swrPages?.[swrPages.length - 1];
  const hasMoreFeedback = !!lastPage?.lastId;
  const isLoadingMoreFeedback = size > 0 && swrPages && swrPages.length < size;

  if (error) return <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error.message}</div>;
  if (isLoading) return <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <div key={i} className="p-4 rounded-xl border border-surface-200 animate-pulse"><div className="h-3 w-24 bg-surface-200 rounded" /><div className="h-4 w-full bg-surface-100 rounded mt-2" /></div>)}</div>;
  if (items.length === 0) return <div className="py-12 text-center text-surface-500"><p className="text-4xl mb-4">📭</p><p>ยังไม่มี feedback</p></div>;

  return (
    <div className="space-y-4">
      {labelError && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">{labelError}</div>}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-surface-100">
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
          <input type="checkbox" checked={filterUnlabeled} onChange={(e) => setFilterUnlabeled(e.target.checked)} className="rounded border-surface-300" aria-label="แสดงเฉพาะ feedback ที่รอป้าย" />
          เฉพาะรอป้าย
        </label>
      </div>
      {items.map((item) => {
        const labelColor = item.adminLabel === "success" ? "success" : item.adminLabel === "fail" ? "error" : "default";
        return (
          <div key={item.id} className="border border-surface-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-surface-400">{new Date(item.createdAt).toLocaleString("th-TH")}</span>
              {item.intent && <Badge variant="info" className="text-xs">{item.intent}</Badge>}
              {item.service && <Badge variant="default" className="text-xs">{item.service}{item.area ? ` / ${item.area}` : ""}</Badge>}
              <Badge variant={labelColor} className="text-xs">{item.adminLabel === "success" ? "✓ ดี" : item.adminLabel === "fail" ? "✗ แย่" : "รอป้าย"}</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-surface-500 font-medium">ลูกค้า:</span> <span className="text-surface-800">{item.userMessage}</span></div>
              <div><span className="text-surface-500 font-medium">บอท:</span> <span className="text-surface-800">{item.botReply}</span></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                type="button"
                disabled={labelingId !== null}
                onClick={() => handleLabel(item.id, "success")}
                aria-label="ป้ายว่าดี"
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-medium transition-colors min-w-[4.5rem] justify-center disabled:opacity-60",
                  item.adminLabel === "success"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-emerald-300 text-emerald-600 hover:bg-emerald-50",
                  item.adminLabel && item.adminLabel !== "success" && "opacity-40"
                )}
              >
                <CheckIcon className="w-4 h-4" />
                ดี
              </button>
              <button
                type="button"
                disabled={labelingId !== null}
                onClick={() => handleLabel(item.id, "fail")}
                aria-label="ป้ายว่าแย่"
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-medium transition-colors min-w-[4.5rem] justify-center disabled:opacity-60",
                  item.adminLabel === "fail"
                    ? "bg-red-500 text-white border-red-500"
                    : "border-red-300 text-red-500 hover:bg-red-50",
                  item.adminLabel && item.adminLabel !== "fail" && "opacity-40"
                )}
              >
                <XMarkIcon className="w-4 h-4" />
                แย่
              </button>
              {item.adminLabel && (
                <Button size="sm" variant="ghost" loading={labelingId === item.id} disabled={labelingId !== null} onClick={() => handleLabel(item.id, null)} aria-label="ล้างป้าย">
                  ล้างป้าย
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {hasMoreFeedback && <div className="pt-4"><Button variant="secondary" size="sm" fullWidth loading={isLoadingMoreFeedback} onClick={() => setSize((s) => s + 1)} aria-label="โหลด feedback เพิ่ม">โหลดเพิ่ม</Button></div>}
    </div>
  );
}

export function CustomersPageClient({
  tabParam,
  selectCustomerId,
}: {
  tabParam: string | null;
  selectCustomerId?: string | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"customers" | "feedback">(tabParam === "feedback" ? "feedback" : "customers");
  const { branch_id, currentOrg, currentUser } = useClinicContext();
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState<"all" | CustomerSource>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLeadTier, setFilterLeadTier] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [sortBy, setSortBy] = useState<"lastChatAt" | "leadScore">("lastChatAt");
  const [manualReply, setManualReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [optimisticChat, setOptimisticChat] = useState<ChatItem | null>(null);

  const firebase = useFirebaseRealtime();
  const useRealtime = isFirebaseConfigReady() && firebase.signedIn && !!firebase.orgId && !firebase.error;

  const [realtimeCustomers, setRealtimeCustomers] = useState<CustomerItem[]>([]);
  const [realtimeChats, setRealtimeChats] = useState<ChatItem[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setActiveTab(tabParam === "feedback" ? "feedback" : "customers");
  }, [tabParam]);

  useEffect(() => {
    const onVisibilityChange = () => setIsTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedCustomer(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!selectedCustomer) return;
    if (useRealtime) {
      const updated = realtimeCustomers.find((c) => c.id === selectedCustomer.id);
      if (updated && (updated.name !== selectedCustomer.name || updated.pictureUrl !== selectedCustomer.pictureUrl)) {
        setSelectedCustomer(updated);
      }
    }
  }, [useRealtime, realtimeCustomers, selectedCustomer?.id]);

  useEffect(() => {
    if (!useRealtime || !firebase.orgId) return;
    const db = getFirebaseFirestore();
    const q = query(collection(db, "customers"), where("org_id", "==", firebase.orgId), orderBy("createdAt", "desc"), limit(51));
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const items: CustomerItem[] = snap.docs.map((doc) => {
        const d = doc.data();
        const name = (d.name ?? d.displayName ?? d.lineDisplayName ?? "").toString().trim();
        const pictureUrl = typeof d.pictureUrl === "string" ? d.pictureUrl : typeof d.lineProfilePicture === "string" ? d.lineProfilePicture : typeof d.avatarUrl === "string" ? d.avatarUrl : undefined;
        return { id: doc.id, name, source: d.source ?? "line", branch_id: d.branch_id ?? undefined, pictureUrl: pictureUrl || undefined, status: d.status ?? "active", externalId: d.externalId, lastChatAt: d.lastChatAt ? toISO(d.lastChatAt) : undefined, lastBookingAt: d.lastBookingAt ? toISO(d.lastBookingAt) : undefined, leadScore: typeof d.leadScore === "number" ? d.leadScore : undefined, leadPriority: typeof d.leadPriority === "string" ? d.leadPriority : null, leadScoreHistory: Array.isArray(d.leadScoreHistory) ? d.leadScoreHistory as Array<{ date: string; score: number }> : undefined, aiResponded: d.aiResponded, deleted_at: d.deleted_at ? toISO(d.deleted_at) : null };
      }).filter((c) => !c.deleted_at);
      setRealtimeCustomers(items);
    }, (err) => console.error("[Realtime] customers error:", err));
    return () => unsub();
  }, [useRealtime, firebase.orgId]);

  useEffect(() => {
    if (!useRealtime || !firebase.orgId || !selectedCustomer?.externalId) { setRealtimeChats([]); return; }
    const db = getFirebaseFirestore();
    const q = query(collection(db, "conversation_feedback"), where("org_id", "==", firebase.orgId), where("user_id", "==", selectedCustomer.externalId), orderBy("createdAt", "asc"), limit(101));
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const items: ChatItem[] = snap.docs.map((doc) => { const d = doc.data(); return { id: doc.id, userMessage: d.userMessage ?? "", botReply: d.botReply ?? "", source: d.source, createdAt: toISO(d.createdAt) }; });
      setRealtimeChats(items);
    }, (err) => console.error("[Realtime] chats error:", err));
    return () => unsub();
  }, [useRealtime, firebase.orgId, selectedCustomer?.externalId]);

  const customersBaseUrl = useMemo(() => {
    let base =
      filterBranchId === "all"
        ? `/api/clinic/customers?limit=50&allBranches=true`
        : `/api/clinic/customers?limit=50&branchId=${filterBranchId}`;
    if (filterChannel !== "all") base += `&source=${filterChannel}`;
    if (filterLeadTier !== "all") base += `&leadFilter=${filterLeadTier}`;
    if (sortBy) base += `&sortBy=${sortBy}`;
    return base;
  }, [filterBranchId, filterChannel, filterLeadTier, sortBy]);
  const getCustomersKey = (i: number, prev: { items: CustomerItem[]; lastId: string | null } | null) => {
    if (i === 0) return customersBaseUrl;
    if (prev?.lastId) return `${customersBaseUrl}&startAfter=${prev.lastId}`;
    return null;
  };

  const { data: swrPages, error: customersError, size, setSize, isLoading: swrLoading, mutate: mutateCustomers } = useSWRInfinite(useRealtime ? () => null : getCustomersKey, apiFetcher as (url: string) => Promise<{ items: CustomerItem[]; lastId: string | null }>, { revalidateOnFocus: true, dedupingInterval: 2000 });

  useEffect(() => {
    if (!selectedCustomer || selectedCustomer.source !== "line" || !selectedCustomer.externalId) return;
    if (selectedCustomer.name !== "ลูกค้า LINE" && selectedCustomer.pictureUrl) return;
    if (useRealtime) { fetch(`/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/refresh-profile`, { method: "POST", credentials: "include" }).catch(() => {}); return; }
    fetch(`/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/refresh-profile`, { method: "POST", credentials: "include" })
      .then((r) => r.ok && r.json())
      .then((data) => { if (data?.ok) { mutateCustomers(); setSelectedCustomer((prev) => prev ? { ...prev, name: data.name ?? prev.name, pictureUrl: data.pictureUrl ?? prev.pictureUrl } : null); } })
      .catch(() => {});
  }, [useRealtime, selectedCustomer?.id, selectedCustomer?.name, selectedCustomer?.pictureUrl, mutateCustomers]);

  const apiItems = swrPages?.flatMap((p) => p.items) ?? [];
  const lastPage = swrPages?.[swrPages.length - 1];
  const hasMore = !!lastPage?.lastId;
  const isLoadingMore = size > 0 && swrPages && swrPages.length < size;

  const rawItems = useRealtime ? realtimeCustomers : apiItems;

  useEffect(() => {
    if (selectCustomerId && rawItems.length > 0) {
      const found = rawItems.find((c) => c.id === selectCustomerId);
      if (found) setSelectedCustomer(found);
    }
  }, [selectCustomerId, rawItems]);

  let filteredItems = rawItems.filter((c) => {
    if (c.deleted_at) return false;
    const matchSearch = !debouncedSearch.trim() || (c.name || "").toLowerCase().includes(debouncedSearch.trim().toLowerCase());
    const matchSource = filterChannel === "all" || c.source === filterChannel;
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchBranch = filterBranchId === "all" || c.branch_id === filterBranchId;
    const score = c.leadScore ?? 0;
    const matchLead =
      filterLeadTier === "all" ||
      (filterLeadTier === "hot" && score >= 0.6) ||
      (filterLeadTier === "warm" && score >= 0.3 && score < 0.6) ||
      (filterLeadTier === "cold" && score < 0.3);
    return matchSearch && matchSource && matchStatus && matchBranch && matchLead;
  });
  if (sortBy === "leadScore") {
    filteredItems = [...filteredItems].sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0));
  } else if (sortBy === "lastChatAt") {
    filteredItems = [...filteredItems].sort((a, b) => {
      const ta = a.lastChatAt ? new Date(a.lastChatAt).getTime() : 0;
      const tb = b.lastChatAt ? new Date(b.lastChatAt).getTime() : 0;
      return tb - ta;
    });
  }

  const getChatsKey = (i: number, prev: { items: ChatItem[]; lastId: string | null } | null) => {
    if (!selectedCustomer || useRealtime) return null;
    if (i === 0) return `/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/chats?limit=50`;
    if (prev?.lastId) return `/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/chats?limit=50&startAfter=${prev.lastId}`;
    return null;
  };
  const { data: chatsPages, error: chatsError, size: chatsSize, setSize: setChatsSize, mutate: mutateChats } = useSWRInfinite(getChatsKey, apiFetcher as (url: string) => Promise<{ items: ChatItem[]; lastId: string | null }>, { revalidateOnFocus: true, dedupingInterval: 500 });
  const baseChatItems = useRealtime ? realtimeChats : (chatsPages?.flatMap((p) => p.items) ?? []);
  const chatItems = optimisticChat ? [...baseChatItems, optimisticChat] : baseChatItems;
  const chatsLastPage = chatsPages?.[chatsPages.length - 1];
  const hasMoreChats = !!chatsLastPage?.lastId && !useRealtime;
  const isLoadingMoreChats = chatsSize > 0 && chatsPages && chatsPages.length < chatsSize;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listParentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({ count: filteredItems.length, getScrollElement: () => listParentRef.current, estimateSize: () => 88, overscan: 8 });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatItems.length]);

  const { data: feedbackStats, mutate: mutateFeedbackStats } = useSWR<{ unlabeledCount: number }>("/api/clinic/feedback?limit=1", async (url) => { const res = await fetch(url, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); const json = await res.json(); return { unlabeledCount: json.unlabeledCount ?? 0 }; }, { revalidateOnFocus: true, dedupingInterval: 10_000 });
  const unlabeledCount = feedbackStats?.unlabeledCount ?? 0;

  const { data: templatesData } = useSWR<{ templates: string[] }>("/api/clinic/ai-config/message-templates", apiFetcher as (url: string) => Promise<{ templates: string[] }>, { revalidateOnFocus: false });
  const messageTemplates = templatesData?.templates ?? [];

  const channelCounts = useMemo(() => {
    const c: Record<string, number> = { all: rawItems.length };
    rawItems.forEach((x) => { c[x.source] = (c[x.source] ?? 0) + 1; });
    return c as Partial<Record<"all" | CustomerSource, number>>;
  }, [rawItems]);

  const showError = useRealtime ? firebase.error : (customersError?.message ?? null);
  const showLoading = !useRealtime && swrLoading && swrPages?.length === 0 && !customersError;
  const canSendManualReply = selectedCustomer?.source === "line" && selectedCustomer?.externalId;
  const canBackfill = (currentUser?.role === "owner" || currentUser?.role === "manager") && activeTab === "customers";
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ processed: number; success: number; failed: number } | null>(null);
  const handleBackfillProfiles = async () => {
    if (!canBackfill || backfilling) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/clinic/customers/backfill-line-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 10 }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setBackfillResult({ processed: json.processed ?? 0, success: json.success ?? 0, failed: json.failed ?? 0 });
        mutateCustomers();
      } else {
        setBackfillResult({ processed: 0, success: 0, failed: 0 });
      }
    } catch {
      setBackfillResult({ processed: 0, success: 0, failed: 0 });
    } finally {
      setBackfilling(false);
    }
  };

  const handleSendManualReply = async () => {
    if (!selectedCustomer || !manualReply.trim() || sending) return;
    const text = manualReply.trim();
    setSendError(null);
    setSending(true);
    const tempId = `opt_${Date.now()}`;
    setOptimisticChat({ id: tempId, userMessage: "", botReply: text, source: "admin", createdAt: new Date().toISOString() });
    setManualReply("");
    try {
      const res = await fetch(`/api/clinic/customers/${selectedCustomer.id}/send-message`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ text }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setOptimisticChat(null); setManualReply(text); setSendError(json.error ?? "ส่งไม่สำเร็จ"); return; }
      setOptimisticChat(null);
      mutateChats?.();
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch { setOptimisticChat(null); setManualReply(text); setSendError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"); setSending(false); return; }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-8">
      {!isOnline && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">คุณกำลังออฟไลน์ — ข้อมูลจะอัปเดตเมื่อกลับมาออนไลน์</div>}
      <PageHeader title="ลูกค้า & แชท" subtitle="จัดการข้อมูลลูกค้าและประวัติการสนทนาทั้งหมด" />
      <div role="tablist" aria-label="แท็บ Customers และ Feedback" className="flex items-center gap-1 p-1 bg-cream-200 rounded-2xl w-fit">
        <button type="button" role="tab" aria-selected={activeTab === "customers"} tabIndex={activeTab === "customers" ? 0 : -1} onClick={() => { setActiveTab("customers"); router.replace("/clinic/customers", { scroll: false }); }} className={cn("px-4 py-2 rounded-xl text-sm font-body font-medium transition-all duration-200", activeTab === "customers" ? "bg-white text-mauve-700 shadow-luxury" : "text-mauve-400 hover:text-mauve-600")}>รายชื่อลูกค้า & แชท</button>
        <button type="button" role="tab" aria-selected={activeTab === "feedback"} tabIndex={activeTab === "feedback" ? 0 : -1} onClick={() => { setActiveTab("feedback"); router.replace("/clinic/customers?tab=feedback", { scroll: false }); }} className={cn("px-4 py-2 rounded-xl text-sm font-body font-medium transition-all duration-200 flex items-center gap-2", activeTab === "feedback" ? "bg-white text-mauve-700 shadow-luxury" : "text-mauve-400 hover:text-mauve-600")}>Golden Dataset {unlabeledCount > 0 && <Badge variant="warning" className="text-[10px] px-1.5">รอป้าย {unlabeledCount}</Badge>}</button>
      </div>
      {activeTab === "feedback" ? (
        <section><SectionHeader title="Conversation Feedback" description="ประเมินคำตอบบอท ✓ ดี / ✗ แย่ — เก็บเป็น golden dataset" /><Card padding="lg"><FeedbackTabContent unlabeledCount={unlabeledCount} onMutate={() => mutateFeedbackStats()} /></Card></section>
      ) : (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <SectionHeader title="รายชื่อลูกค้า" description="เลือกรายละเอียดแพลตฟอร์ม • ค้นหา • กรองสาขา • โหลดเพิ่ม • ตอบแชทเอง" />
            {canBackfill && (
              <Button variant="outline" size="sm" loading={backfilling} onClick={handleBackfillProfiles} aria-label="Backfill รูปโปรไฟล์ LINE">
                {backfilling ? "กำลังดึงข้อมูล..." : "Backfill รูปโปรไฟล์ LINE"}
              </Button>
            )}
          </div>
          {backfillResult && backfillResult.processed > 0 && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 mb-4">
              Backfill สำเร็จ: อัปเดต {backfillResult.success} รายการ{backfillResult.failed > 0 ? ` (ล้มเหลว ${backfillResult.failed})` : ""}
            </div>
          )}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1"><Input placeholder="ค้นหาชื่อ, เบอร์โทร, LINE..." icon={<span className="text-sm">⌕</span>} value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white" aria-label="ค้นหาชื่อลูกค้า" /></div>
            <div className="flex items-center gap-1 p-1 bg-cream-200 rounded-2xl flex-shrink-0">
              {(["all", "hot", "warm", "cold"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterLeadTier(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-body transition-colors",
                    filterLeadTier === t
                      ? "bg-rg-200 text-rg-700 font-medium"
                      : "text-mauve-600 hover:bg-cream-300"
                  )}
                >
                  {t === "all" ? "ทั้งหมด" : t === "hot" ? "🔥 Hot" : t === "warm" ? "🌤 Warm" : "❄ Cold"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 bg-cream-200 rounded-2xl flex-shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "lastChatAt" | "leadScore")}
                className="h-9 px-3 rounded-xl text-xs font-body text-mauve-700 bg-white border border-cream-300 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
                aria-label="เรียงตาม"
              >
                <option value="lastChatAt">ล่าสุด</option>
                <option value="leadScore">Lead Score</option>
              </select>
            </div>
            <div className="flex items-center gap-1 p-1 bg-cream-200 rounded-2xl flex-shrink-0 flex-wrap"><ChannelChips value={filterChannel} onChange={(v) => setFilterChannel(v)} counts={channelCounts} /></div>
            {currentOrg && (currentOrg.branches?.length ?? 0) > 1 && (
              <div className="relative min-w-0 max-w-[180px] overflow-hidden">
                <select value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)} className="h-11 w-full min-w-0 pr-10 pl-4 rounded-2xl font-body text-sm text-mauve-600 bg-white border border-cream-300 focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236B7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat truncate" aria-label="กรองตามสาขา"><option value="all">ทุกสาขา</option>{currentOrg.branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </div>
            )}
            <div className="relative min-w-0 w-fit max-w-[140px] overflow-hidden">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-11 w-full min-w-0 pr-10 pl-4 rounded-2xl font-body text-sm text-mauve-600 bg-white border border-cream-300 focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236B7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat truncate" aria-label="กรองตาม Status"><option value="all">ทุก Status</option><option value="active">active</option><option value="pending">pending</option><option value="inactive">inactive</option></select>
            </div>
          </motion.div>
          {showError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">{showError}</div>}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              {showLoading && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-44 rounded-2xl bg-cream-200 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />)}</div>}
              {!showLoading && !showError && filteredItems.length === 0 && <EmptyState icon={<UserGroupIcon className="w-10 h-10 text-rg-300" />} title="ยังไม่มีลูกค้า" description="ลูกค้าที่เชื่อมต่อผ่าน LINE จะแสดงที่นี่" />}
              {!showLoading && !showError && filteredItems.length > 0 && (
                <>
                  <div ref={listParentRef} className="h-[400px] min-h-[280px] overflow-auto rounded-xl -mx-1 px-1 space-y-2" role="list" aria-label={`รายชื่อลูกค้า ${filteredItems.length} รายการ`}>
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const c = filteredItems[virtualRow.index]!;
                        return (
                          <motion.div key={c.id} role="listitem" tabIndex={0} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: virtualRow.index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }} whileHover={{ y: -3, transition: { duration: 0.2 } }} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }} onClick={() => setSelectedCustomer(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCustomer(c); } }} className={cn("luxury-card p-5 cursor-pointer group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-rg-400 focus-visible:ring-offset-2", selectedCustomer?.id === c.id && "ring-2 ring-rg-400 ring-offset-2")}>
                            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-rg-200/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative z-10">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <CustomerProfilePicture customer={c} size="lg" />
                                  <div className="min-w-0"><p className="font-body font-medium text-mauve-800 text-sm truncate">{displayName(c)}</p><p className="font-body text-xs text-mauve-400 truncate">{getChannelLabel(c.source)}</p></div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {getLeadScoreBadge(c.leadScore ?? 0) && (
                                    <span
                                      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", getLeadScoreBadge(c.leadScore ?? 0)!.className)}
                                      title={`Lead Score: ${getLeadScoreBadge(c.leadScore ?? 0)!.scoreStr}`}
                                    >
                                      {getLeadScoreBadge(c.leadScore ?? 0)!.emoji}{" "}
                                      {getLeadScoreBadge(c.leadScore ?? 0)!.label}
                                    </span>
                                  )}
                                  <Badge variant={c.externalId ? "success" : "default"} dot size="sm">{c.source === "line" && c.externalId ? "LINE" : c.source === "line" ? "ไม่มี LINE" : getChannelLabel(c.source)}</Badge>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-cream-200">
                                <div className="text-center"><p className="font-body text-sm font-semibold text-mauve-700">-</p><p className="font-body text-[10px] text-mauve-400 uppercase tracking-wide">จอง</p></div>
                                <div className="text-center"><p className="font-body text-sm font-semibold text-mauve-700">{c.lastChatAt ? "1" : "0"}</p><p className="font-body text-[10px] text-mauve-400 uppercase tracking-wide">แชท</p></div>
                                <div className="text-center"><p className="font-body text-sm font-semibold text-mauve-700">-</p><p className="font-body text-[10px] text-mauve-400 uppercase tracking-wide">ใช้จ่าย</p></div>
                              </div>
                              {c.lastChatAt && <p className="font-body text-[10px] text-mauve-300 mt-3 text-right">ล่าสุด: {new Date(c.lastChatAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</p>}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                  {!useRealtime && hasMore && <div className="pt-2"><Button variant="secondary" size="sm" fullWidth loading={isLoadingMore} onClick={() => setSize((s) => s + 1)} aria-label="โหลดรายชื่อลูกค้าเพิ่ม">โหลดเพิ่ม</Button></div>}
                </>
              )}
            </div>
            <Card className="lg:col-span-2" padding="lg">
              {selectedCustomer ? (
                <>
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-cream-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <CustomerProfilePicture customer={selectedCustomer} size="md" />
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-mauve-800 truncate">{displayName(selectedCustomer)}</h3>
                        <p className="text-xs font-body text-mauve-400">{getChannelLabel(selectedCustomer.source) ?? selectedCustomer.source} • {selectedCustomer.status}</p>
                      </div>
                    </div>
                    <LeadScoreGauge
                      score={selectedCustomer.leadScore}
                      history={selectedCustomer.leadScoreHistory}
                    />
                  </div>
                  {(() => {
                    const score = selectedCustomer.leadScore ?? 0;
                    const actions =
                      score >= 0.8
                        ? ["📞 โทรติดตามทันที", "📅 เสนอนัดหมาย", "💰 เสนอส่วนลด"]
                        : score >= 0.6
                          ? ["💬 ส่งข้อความติดตาม", "📸 ส่งรูปผลงาน"]
                          : score >= 0.3
                            ? ["📚 ส่งข้อมูลเพิ่มเติม", "🎁 แนะนำโปรโมชั่น"]
                            : ["⏰ ติดตามในอนาคต"];
                    return (
                      <div className="flex flex-wrap gap-2 py-3 border-b border-cream-200">
                        {actions.map((label, i) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 rounded-xl text-xs font-body bg-cream-200 text-mauve-600"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </>
              ) : <CardHeader title="แชท" subtitle="เลือกลูกค้าด้านซ้าย" />}
              <div className="min-h-[280px] max-h-[500px] overflow-y-auto rounded-2xl border border-cream-200 bg-cream-100/30 p-5 space-y-3 scroll-smooth pr-2">
                {!selectedCustomer ? <EmptyState icon={<UserGroupIcon className="w-10 h-10 text-rg-300" />} title="เลือกลูกค้าจากรายชื่อ" description="ลูกค้าที่แชท LINE กับบอทจะถูกบันทึกอัตโนมัติ" /> : chatsError ? <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{chatsError.message}</div> : chatItems.length === 0 ? <EmptyState icon={<ChatBubbleLeftRightIcon className="w-10 h-10 text-rg-300" />} title="ยังไม่มีประวัติแชท" description="การสนทนาผ่าน LINE จะแสดงที่นี่" /> : (
                  <>
                    {chatItems.map((chat, i) => (
                      <div key={chat.id} className="flex flex-col gap-2">
                        {chat.userMessage ? (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex gap-3 max-w-[80%] items-end">
                            <CustomerProfilePicture customer={selectedCustomer!} size="sm" />
                            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-cream-200 text-mauve-700 text-sm font-body leading-relaxed"><p>{chat.userMessage}</p><p className="text-[10px] text-mauve-400 mt-1.5">{new Date(chat.createdAt).toLocaleString("th-TH")}</p></div>
                          </motion.div>
                        ) : null}
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex flex-col items-end gap-1 max-w-[80%] ml-auto">
                          <div className="flex gap-3 flex-row-reverse items-end w-full justify-end">
                            <ClinicAvatar />
                            <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-br from-rg-500 to-rg-600 text-white text-sm font-body leading-relaxed shadow-luxury max-w-full"><p>{chat.botReply}</p><p className="text-[10px] text-white/60 mt-1.5">{chat.source === "admin" ? "Admin" : "AI"} • {new Date(chat.createdAt).toLocaleString("th-TH")}</p></div>
                          </div>
                        </motion.div>
                      </div>
                    ))}
                    {hasMoreChats && <div className="flex justify-center py-3"><Button variant="ghost" size="sm" loading={isLoadingMoreChats} onClick={() => setChatsSize((s) => s + 1)} aria-label="โหลดแชทเพิ่ม">โหลดแชทเพิ่ม</Button></div>}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>
              {canSendManualReply && (
                <div className="mt-4 p-4 rounded-2xl border border-cream-300 bg-cream-100/60">
                  <p className="text-xs font-body font-medium text-mauve-700 mb-2">ตอบแชทเอง (Admin Reply)</p>
                  {sendError && (
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm text-red-600 flex-1 font-body" role="alert">{sendError}</p>
                      <Button variant="outline" size="sm" onClick={() => { setSendError(null); if (manualReply.trim()) handleSendManualReply(); }} aria-label="ลองส่งใหม่">ลองใหม่</Button>
                    </div>
                  )}
                  {messageTemplates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {messageTemplates.map((tpl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const name = displayName(selectedCustomer!);
                            const text = tpl.replace(/\{name\}/g, name);
                            setManualReply(text);
                            setSendError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-body bg-cream-200 text-mauve-600 hover:bg-cream-300 transition-colors truncate max-w-[200px]"
                          title={tpl}
                        >
                          {tpl.length > 24 ? `${tpl.slice(0, 22)}…` : tpl}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="พิมพ์ข้อความที่ต้องการส่งถึงลูกค้า..."
                      value={manualReply}
                      onChange={(e) => { setManualReply(e.target.value); setSendError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendManualReply(); } }}
                      disabled={sending}
                      className="flex-1"
                      aria-label="ข้อความที่จะส่งถึงลูกค้า"
                    />
                    <Button variant="primary" size="md" loading={sending} disabled={!manualReply.trim()} onClick={handleSendManualReply} aria-label="ส่งข้อความ">ส่ง</Button>
                  </div>
                  <p className="text-xs font-body text-mauve-400 mt-2">ข้อความจะถูกส่งไปยัง LINE ของลูกค้าทันที</p>
                </div>
              )}
              {selectedCustomer && !canSendManualReply && <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200"><p className="text-xs font-body font-medium text-amber-800 mb-1">ส่งข้อความถึงลูกค้า</p><p className="text-sm font-body text-amber-700">{selectedCustomer.source !== "line" ? "การตอบแชทด้วยตนเองรองรับเฉพาะลูกค้าจาก LINE" : "ลูกค้ารายนี้ยังไม่มี LINE ID — รอลูกค้าแชทกับบอทก่อน"}</p></div>}
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
