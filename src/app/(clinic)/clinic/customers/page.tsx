"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ChannelChips, getChannelLabel } from "@/components/clinic/ChannelChips";
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

function displayName(c: CustomerItem): string {
  const name = (c.name || "").trim();
  if (name && name !== "ลูกค้า LINE" && !DEFAULT_NAMES[c.source]) return name;
  return DEFAULT_NAMES[c.source] ?? "ลูกค้า";
}

/** รูปโปรไฟล์จาก LINE — แสดงรูปจริง หรือ fallback เป็นไอคอนเมื่อโหลดไม่ได้ */
function CustomerProfilePicture({ customer, size = "md" }: { customer: CustomerItem; size?: "sm" | "md" }) {
  const [imgError, setImgError] = useState(false);
  const className = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  if (customer.pictureUrl && !imgError) {
    return (
      <img
        src={customer.pictureUrl}
        alt=""
        className={`${className} rounded-full object-cover flex-shrink-0 ring-1 ring-surface-200`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0`}
      title="ยังไม่มีรูปโปรไฟล์จาก LINE"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size === "sm" ? 16 : 20}
        height={size === "sm" ? 16 : 20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-surface-400"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
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

function FeedbackTabContent({
  unlabeledCount,
  onMutate,
}: {
  unlabeledCount: number;
  onMutate: () => void;
}) {
  const [filterUnlabeled, setFilterUnlabeled] = useState(false);
  const [labelingId, setLabelingId] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const getFeedbackKey = (i: number, prev: { items: FeedbackItem[]; lastId: string | null } | null) => {
    if (i === 0) {
      const base = `/api/clinic/feedback?limit=20`;
      return filterUnlabeled ? `${base}&unlabeledOnly=true` : base;
    }
    if (prev?.lastId) {
      const base = `/api/clinic/feedback?limit=20&startAfter=${prev.lastId}`;
      return filterUnlabeled ? `${base}&unlabeledOnly=true` : base;
    }
    return null;
  };
  const { data: swrPages, error, size, setSize, isLoading, mutate } = useSWRInfinite(
    getFeedbackKey,
    apiFetcher as (url: string) => Promise<{ items: FeedbackItem[]; lastId: string | null }>,
    { revalidateOnFocus: true, dedupingInterval: 3000 }
  );

  const handleLabel = async (id: string, label: "success" | "fail" | null) => {
    setLabelError(null);
    setLabelingId(id);
    try {
      const res = await fetch(`/api/clinic/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        mutate();
        onMutate();
      } else {
        setLabelError(json.error ?? "ป้ายไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch {
      setLabelError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLabelingId(null);
    }
  };

  const allItems = swrPages?.flatMap((p) => p.items) ?? [];
  const items = allItems.filter((i) => i.source !== "admin");
  const lastPage = swrPages?.[swrPages.length - 1];
  const hasMoreFeedback = !!lastPage?.lastId;
  const isLoadingMoreFeedback = size > 0 && swrPages && swrPages.length < size;

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
        {error.message}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-surface-200 animate-pulse">
            <div className="h-3 w-24 bg-surface-200 rounded" />
            <div className="h-4 w-full bg-surface-100 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-surface-500">
        <p className="text-4xl mb-4">📭</p>
        <p>ยังไม่มี feedback</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {labelError && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm"
        >
          {labelError}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-surface-100">
        <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnlabeled}
            onChange={(e) => setFilterUnlabeled(e.target.checked)}
            className="rounded border-surface-300"
            aria-label="แสดงเฉพาะ feedback ที่รอป้าย"
          />
          เฉพาะรอป้าย
        </label>
      </div>
      {items.map((item) => {
        const labelColor =
          item.adminLabel === "success" ? "success" : item.adminLabel === "fail" ? "error" : "default";
        return (
          <div key={item.id} className="border border-surface-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-surface-400">
                {new Date(item.createdAt).toLocaleString("th-TH")}
              </span>
              {item.intent && <Badge variant="info" className="text-xs">{item.intent}</Badge>}
              {item.service && (
                <Badge variant="default" className="text-xs">
                  {item.service}
                  {item.area ? ` / ${item.area}` : ""}
                </Badge>
              )}
              <Badge variant={labelColor} className="text-xs">
                {item.adminLabel === "success" ? "✓ ดี" : item.adminLabel === "fail" ? "✗ แย่" : "รอป้าย"}
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-surface-500 font-medium">ลูกค้า:</span>{" "}
                <span className="text-surface-800">{item.userMessage}</span>
              </div>
              <div>
                <span className="text-surface-500 font-medium">บอท:</span>{" "}
                <span className="text-surface-800">{item.botReply}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant={item.adminLabel === "success" ? "primary" : "ghost"}
                loading={labelingId === item.id}
                disabled={labelingId !== null}
                onClick={() => handleLabel(item.id, "success")}
                aria-label="ป้ายว่าดี"
              >
                ✓ ดี
              </Button>
              <Button
                size="sm"
                variant={item.adminLabel === "fail" ? "danger" : "ghost"}
                loading={labelingId === item.id}
                disabled={labelingId !== null}
                onClick={() => handleLabel(item.id, "fail")}
                aria-label="ป้ายว่าแย่"
              >
                ✗ แย่
              </Button>
              {item.adminLabel && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={labelingId === item.id}
                  disabled={labelingId !== null}
                  onClick={() => handleLabel(item.id, null)}
                  aria-label="ล้างป้าย"
                >
                  ล้างป้าย
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {hasMoreFeedback && (
        <div className="pt-4">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            loading={isLoadingMoreFeedback}
            onClick={() => setSize((s) => s + 1)}
            aria-label="โหลด feedback เพิ่ม"
          >
            โหลดเพิ่ม
          </Button>
        </div>
      )}
    </div>
  );
}

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"customers" | "feedback">(
    tabParam === "feedback" ? "feedback" : "customers"
  );
  const { branch_id, currentOrg } = useClinicContext();
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState<"all" | CustomerSource>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
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
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
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
    const q = query(
      collection(db, "customers"),
      where("org_id", "==", firebase.orgId),
      orderBy("createdAt", "desc"),
      limit(51)
    );
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const items: CustomerItem[] = snap.docs
          .map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name ?? "",
              source: d.source ?? "line",
              branch_id: d.branch_id ?? undefined,
              pictureUrl: d.pictureUrl ?? undefined,
              status: d.status ?? "active",
              externalId: d.externalId,
              lastChatAt: d.lastChatAt ? toISO(d.lastChatAt) : undefined,
              aiResponded: d.aiResponded,
              deleted_at: d.deleted_at ? toISO(d.deleted_at) : null,
            };
          })
          .filter((c) => !c.deleted_at);
        setRealtimeCustomers(items);
      },
      (err) => console.error("[Realtime] customers error:", err)
    );
    return () => unsub();
  }, [useRealtime, firebase.orgId]);

  useEffect(() => {
    if (!useRealtime || !firebase.orgId || !selectedCustomer?.externalId) {
      setRealtimeChats([]);
      return;
    }
    const db = getFirebaseFirestore();
    const q = query(
      collection(db, "conversation_feedback"),
      where("org_id", "==", firebase.orgId),
      where("user_id", "==", selectedCustomer.externalId),
      orderBy("createdAt", "asc"),
      limit(101)
    );
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const items: ChatItem[] = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            userMessage: d.userMessage ?? "",
            botReply: d.botReply ?? "",
            source: d.source,
            createdAt: toISO(d.createdAt),
          };
        });
        setRealtimeChats(items);
      },
      (err) => console.error("[Realtime] chats error:", err)
    );
    return () => unsub();
  }, [useRealtime, firebase.orgId, selectedCustomer?.externalId]);

  const customersBaseUrl = useMemo(() => {
    const base = filterBranchId === "all"
      ? `/api/clinic/customers?limit=50&allBranches=true`
      : `/api/clinic/customers?limit=50&branchId=${filterBranchId}`;
    return filterChannel === "all" ? base : `${base}&source=${filterChannel}`;
  }, [filterBranchId, filterChannel]);
  const getCustomersKey = (i: number, prev: { items: CustomerItem[]; lastId: string | null } | null) => {
    if (i === 0) return customersBaseUrl;
    if (prev?.lastId) return `${customersBaseUrl}&startAfter=${prev.lastId}`;
    return null;
  };

  const { data: swrPages, error: customersError, size, setSize, isLoading: swrLoading, mutate: mutateCustomers } = useSWRInfinite(
    useRealtime ? () => null : getCustomersKey,
    apiFetcher as (url: string) => Promise<{ items: CustomerItem[]; lastId: string | null }>,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  useEffect(() => {
    if (!selectedCustomer || selectedCustomer.source !== "line" || !selectedCustomer.externalId) return;
    if (selectedCustomer.name !== "ลูกค้า LINE" && selectedCustomer.pictureUrl) return;
    if (useRealtime) {
      fetch(`/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/refresh-profile`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
      return;
    }
    fetch(`/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/refresh-profile`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (data?.ok) {
          mutateCustomers();
          setSelectedCustomer((prev) =>
            prev
              ? { ...prev, name: data.name ?? prev.name, pictureUrl: data.pictureUrl ?? prev.pictureUrl }
              : null
          );
        }
      })
      .catch(() => {});
  }, [useRealtime, selectedCustomer?.id, selectedCustomer?.name, selectedCustomer?.pictureUrl, mutateCustomers]);

  const apiItems = swrPages?.flatMap((p) => p.items) ?? [];
  const lastPage = swrPages?.[swrPages.length - 1];
  const hasMore = !!lastPage?.lastId;
  const isLoadingMore = size > 0 && swrPages && swrPages.length < size;

  const rawItems = useRealtime ? realtimeCustomers : apiItems;
  const filteredItems = rawItems.filter((c) => {
    if (c.deleted_at) return false;
    const matchSearch = !debouncedSearch.trim() || (c.name || "").toLowerCase().includes(debouncedSearch.trim().toLowerCase());
    const matchSource = filterChannel === "all" || c.source === filterChannel;
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchBranch = filterBranchId === "all" || c.branch_id === filterBranchId;
    return matchSearch && matchSource && matchStatus && matchBranch;
  });

  const getChatsKey = (i: number, prev: { items: ChatItem[]; lastId: string | null } | null) => {
    if (!selectedCustomer || useRealtime) return null;
    if (i === 0) return `/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/chats?limit=50`;
    if (prev?.lastId) return `/api/clinic/customers/${encodeURIComponent(selectedCustomer.id)}/chats?limit=50&startAfter=${prev.lastId}`;
    return null;
  };
  const { data: chatsPages, error: chatsError, size: chatsSize, setSize: setChatsSize, mutate: mutateChats } = useSWRInfinite(
    getChatsKey,
    apiFetcher as (url: string) => Promise<{ items: ChatItem[]; lastId: string | null }>,
    {
      revalidateOnFocus: true,
      dedupingInterval: 500,
    }
  );
  const baseChatItems = useRealtime ? realtimeChats : (chatsPages?.flatMap((p) => p.items) ?? []);
  const chatItems = optimisticChat ? [...baseChatItems, optimisticChat] : baseChatItems;
  const chatsLastPage = chatsPages?.[chatsPages.length - 1];
  const hasMoreChats = !!chatsLastPage?.lastId && !useRealtime;
  const isLoadingMoreChats = chatsSize > 0 && chatsPages && chatsPages.length < chatsSize;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const listParentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatItems.length]);

  const { data: feedbackStats, mutate: mutateFeedbackStats } = useSWR<{ unlabeledCount: number }>(
    "/api/clinic/feedback?limit=1",
    async (url) => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return { unlabeledCount: json.unlabeledCount ?? 0 };
    },
    { revalidateOnFocus: true, dedupingInterval: 10_000 }
  );
  const unlabeledCount = feedbackStats?.unlabeledCount ?? 0;

  const showError = useRealtime ? firebase.error : (customersError?.message ?? null);
  const showLoading = !useRealtime && swrLoading && swrPages?.length === 0 && !customersError;

  const canSendManualReply =
    selectedCustomer?.source === "line" && selectedCustomer?.externalId;

  const handleSendManualReply = async () => {
    if (!selectedCustomer || !manualReply.trim() || sending) return;
    const text = manualReply.trim();
    setSendError(null);
    setSending(true);
    const tempId = `opt_${Date.now()}`;
    const optimisticItem: ChatItem = {
      id: tempId,
      userMessage: "",
      botReply: text,
      source: "admin",
      createdAt: new Date().toISOString(),
    };
    setOptimisticChat(optimisticItem);
    setManualReply("");
    try {
      const res = await fetch(`/api/clinic/customers/${selectedCustomer.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOptimisticChat(null);
        setManualReply(text);
        setSendError(json.error ?? "ส่งไม่สำเร็จ");
        return;
      }
      setOptimisticChat(null);
      mutateChats?.();
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setOptimisticChat(null);
      setManualReply(text);
      setSendError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setSending(false);
      return;
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {!isOnline && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          คุณกำลังออฟไลน์ — ข้อมูลจะอัปเดตเมื่อกลับมาออนไลน์
        </div>
      )}
      <PageHeader
        title="Customers & Chat"
        description="จัดการแชทหลายแพลตฟอร์ม — LINE • Facebook • Instagram • TikTok • Web • รองรับปริมาณแชทสูง"
      />

      <div
        role="tablist"
        aria-label="แท็บ Customers และ Feedback"
        className="flex gap-2 border-b border-surface-200 pb-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "customers"}
          aria-label="รายชื่อลูกค้าและแชท"
          tabIndex={activeTab === "customers" ? 0 : -1}
          onClick={() => {
            setActiveTab("customers");
            router.replace("/clinic/customers", { scroll: false });
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "customers"
              ? "bg-primary-50 text-primary-700 border border-primary-200"
              : "text-surface-600 hover:bg-surface-50"
          }`}
        >
          รายชื่อลูกค้า & แชท
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "feedback"}
          aria-label={`Golden Dataset ${unlabeledCount > 0 ? `รอป้าย ${unlabeledCount}` : ""}`}
          tabIndex={activeTab === "feedback" ? 0 : -1}
          onClick={() => {
            setActiveTab("feedback");
            router.replace("/clinic/customers?tab=feedback", { scroll: false });
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "feedback"
              ? "bg-primary-50 text-primary-700 border border-primary-200"
              : "text-surface-600 hover:bg-surface-50"
          }`}
        >
          Golden Dataset
          {unlabeledCount > 0 && (
            <Badge variant="warning" className="text-[10px] px-1.5">
              รอป้าย {unlabeledCount}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === "feedback" ? (
        <section>
          <SectionHeader
            title="Conversation Feedback"
            description="ประเมินคำตอบบอท ✓ ดี / ✗ แย่ — เก็บเป็น golden dataset"
          />
          <Card padding="lg">
            <FeedbackTabContent
              unlabeledCount={unlabeledCount}
              onMutate={() => mutateFeedbackStats()}
            />
          </Card>
        </section>
      ) : (
        <section>
          <SectionHeader
            title="รายชื่อลูกค้า"
            description="เลือกรายละเอียดแพลตฟอร์ม • ค้นหา • กรองสาขา • โหลดเพิ่ม • ตอบแชทเอง"
          />
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1" padding="lg">
              <CardHeader title="รายชื่อลูกค้า" subtitle="LINE • Facebook • Instagram • TikTok • Web" />
              <div className="space-y-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-surface-500 mb-2">แพลตฟอร์มแชท</p>
                  <ChannelChips
                    value={filterChannel}
                    onChange={(v) => setFilterChannel(v)}
                    counts={useMemo(() => {
                      const c: Record<string, number> = { all: rawItems.length };
                      rawItems.forEach((x) => {
                        c[x.source] = (c[x.source] ?? 0) + 1;
                      });
                      return c as Partial<Record<"all" | CustomerSource, number>>;
                    }, [rawItems])}
                  />
                </div>
                <Input
                  placeholder="ค้นหาชื่อ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-sm"
                  aria-label="ค้นหาชื่อลูกค้า"
                />
                <div className="flex gap-2 flex-wrap">
                  {currentOrg && (currentOrg.branches?.length ?? 0) > 1 && (
                    <select
                      value={filterBranchId}
                      onChange={(e) => setFilterBranchId(e.target.value)}
                      className="text-sm px-3 py-2 rounded-lg border border-surface-200 bg-white"
                      aria-label="กรองตามสาขา"
                    >
                      <option value="all">ทุกสาขา</option>
                      {currentOrg.branches?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm px-3 py-2 rounded-xl border border-surface-200 bg-white"
                    aria-label="กรองตาม Status"
                  >
                    <option value="all">ทุก Status</option>
                    <option value="active">active</option>
                    <option value="pending">pending</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
              </div>
              {showError && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                  {showError}
                </div>
              )}
              {showLoading && (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 rounded-xl border border-surface-200/80 animate-pulse">
                      <div className="h-4 w-20 bg-surface-200 rounded" />
                      <div className="h-3 w-16 bg-surface-100 rounded mt-2" />
                    </div>
                  ))}
                </div>
              )}
              {!showLoading && !showError && (
                <div className="space-y-2">
                  {filteredItems.length === 0 ? (
                    <p className="text-sm text-surface-500 py-4">
                      {rawItems.length === 0
                        ? "ยังไม่มีลูกค้า — ลูกค้าที่แชท LINE จะแสดงที่นี่"
                        : "ไม่พบรายการตาม filter"}
                    </p>
                  ) : (
                    <>
                      <div
                        ref={listParentRef}
                        className="h-[400px] min-h-[280px] overflow-auto rounded-xl -mx-1 px-1"
                        role="list"
                        aria-label={`รายชื่อลูกค้า ${filteredItems.length} รายการ`}
                      >
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const c = filteredItems[virtualRow.index]!;
                            return (
                              <div
                                key={c.id}
                                role="listitem"
                                tabIndex={0}
                                onClick={() => setSelectedCustomer(c)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedCustomer(c);
                                  }
                                }}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className={`p-4 rounded-xl border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                                  selectedCustomer?.id === c.id
                                    ? "border-primary-400 bg-primary-50/50 shadow-sm"
                                    : "border-surface-200/80 hover:border-primary-200 bg-white"
                                }`}
                              >
                                <div className="flex gap-3">
                                  <CustomerProfilePicture customer={c} size="sm" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="min-w-0">
                                        <p className="font-medium text-surface-900 truncate">{displayName(c)}</p>
                                        <p className="text-xs text-surface-500">{getChannelLabel(c.source)}</p>
                                      </div>
                                      <Badge variant={c.status === "active" ? "success" : "warning"} className="flex-shrink-0">
                                        {c.status}
                                      </Badge>
                                    </div>
                                    {c.lastChatAt && (
                                      <p className="text-xs text-surface-400 mt-2">
                                        {new Date(c.lastChatAt).toLocaleString("th-TH")}
                                      </p>
                                    )}
                                    {c.aiResponded && (
                                      <Badge variant="info" className="mt-2 text-xs">AI ตอบแล้ว</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {!useRealtime && hasMore && (
                        <div className="pt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            loading={isLoadingMore}
                            onClick={() => setSize((s) => s + 1)}
                            aria-label="โหลดรายชื่อลูกค้าเพิ่ม"
                          >
                            โหลดเพิ่ม
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card className="lg:col-span-2" padding="lg">
              {selectedCustomer ? (
                <div className="flex items-center gap-3 pb-4 border-b border-surface-100">
                  <CustomerProfilePicture customer={selectedCustomer} size="md" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-surface-800 truncate">{displayName(selectedCustomer)}</h3>
                    <p className="text-xs text-surface-500">
                      {getChannelLabel(selectedCustomer.source) ?? selectedCustomer.source} • {selectedCustomer.status}
                    </p>
                  </div>
                </div>
              ) : (
                <CardHeader
                  title="แชท"
                  subtitle="เลือกลูกค้าด้านซ้าย"
                />
              )}
              <div className="min-h-[280px] max-h-[420px] overflow-y-auto rounded-2xl border border-surface-200/60 bg-gradient-to-b from-surface-50/80 to-white p-5 space-y-5 scroll-smooth">
                {!selectedCustomer ? (
                  <div className="flex flex-col items-center justify-center h-64 text-surface-400 text-sm">
                    <p>เลือกลูกค้าจากรายชื่อเพื่อดูแชท</p>
                    <p className="text-xs mt-2">
                      ลูกค้าที่แชท LINE กับบอทจะถูกบันทึกอัตโนมัติ
                    </p>
                  </div>
                ) : chatsError ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                    {chatsError.message}
                  </div>
                ) : chatItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-surface-400 text-sm">
                    <p>ยังไม่มีแชท</p>
                    <p className="text-xs mt-2">
                      แชทจะแสดงเมื่อลูกค้าส่งข้อความมาที่ LINE Bot
                    </p>
                  </div>
                ) : (
                  <>
                    {chatItems.map((chat) => (
                      <div key={chat.id} className="space-y-2">
                        {chat.userMessage ? (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/95 border border-surface-200/80 px-4 py-2.5 shadow-soft">
                              <p className="text-sm text-surface-800">{chat.userMessage}</p>
                              <p className="text-xs text-surface-400 mt-1">
                                {new Date(chat.createdAt).toLocaleString("th-TH")}
                              </p>
                            </div>
                          </div>
                        ) : null}
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary-50/90 border border-primary-200/80 px-4 py-2.5 shadow-soft">
                            <p className="text-sm text-surface-800">{chat.botReply}</p>
                            <p className="text-xs text-surface-500 mt-1">
                              {chat.source === "admin" ? "Admin" : "AI"} •{" "}
                              {new Date(chat.createdAt).toLocaleString("th-TH")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {hasMoreChats && (
                      <div className="flex justify-center py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={isLoadingMoreChats}
                          onClick={() => setChatsSize((s) => s + 1)}
                          aria-label="โหลดแชทเพิ่ม"
                        >
                          โหลดแชทเพิ่ม
                        </Button>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {canSendManualReply && (
                <div className="mt-4 p-4 rounded-xl border border-primary-200 bg-primary-50/30">
                  <p className="text-xs font-medium text-primary-800 mb-2">ตอบแชทเอง (Admin Reply)</p>
                  {sendError && (
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm text-red-600 flex-1" role="alert">{sendError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSendError(null);
                          if (manualReply.trim()) handleSendManualReply();
                        }}
                        aria-label="ลองส่งใหม่"
                      >
                        ลองใหม่
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="พิมพ์ข้อความที่ต้องการส่งถึงลูกค้า..."
                      value={manualReply}
                      onChange={(e) => {
                        setManualReply(e.target.value);
                        setSendError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendManualReply();
                        }
                      }}
                      disabled={sending}
                      className="flex-1"
                      aria-label="ข้อความที่จะส่งถึงลูกค้า"
                    />
                    <Button
                      variant="primary"
                      size="md"
                      loading={sending}
                      disabled={!manualReply.trim()}
                      onClick={handleSendManualReply}
                      aria-label="ส่งข้อความ"
                    >
                      ส่ง
                    </Button>
                  </div>
                  <p className="text-xs text-surface-500 mt-2">
                    ข้อความจะถูกส่งไปยัง LINE ของลูกค้าทันที
                  </p>
                </div>
              )}

              {selectedCustomer && !canSendManualReply && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-1">ส่งข้อความถึงลูกค้า</p>
                  <p className="text-sm text-amber-700">
                    {selectedCustomer.source !== "line"
                      ? "การตอบแชทด้วยตนเองรองรับเฉพาะลูกค้าจาก LINE"
                      : "ลูกค้ารายนี้ยังไม่มี LINE ID — รอลูกค้าแชทกับบอทก่อน"}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-surface-500">กำลังโหลด...</div>}>
      <CustomersPageContent />
    </Suspense>
  );
}
