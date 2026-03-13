"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, onSnapshot, type QuerySnapshot } from "firebase/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useClinicContext } from "@/contexts/ClinicContext";
import { useFirebaseRealtime } from "@/hooks/useFirebaseRealtime";
import { getFirebaseFirestore, isFirebaseConfigReady } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";
import type { HandoffSession, HandoffTriggerType } from "@/types/handoff";

const TRIGGER_LABELS: Record<HandoffTriggerType, string> = {
  angry_customer: "ไม่พอใจ",
  explicit_request: "ขอคนจริง",
  loop_detected: "วนซ้ำ",
  medical: "เรื่องแพทย์",
  consecutive_objections: "คัดค้านซ้ำ",
  complex_medical: "เรื่องแพทย์ซับซ้อน",
  low_ai_confidence: "AI ไม่แน่ใจ",
};

function formatWaitTime(createdAt: string): string {
  const sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (sec < 60) return `${sec} วินาที`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} นาที ${s} วินาที`;
}

function HandoffQueueItem({
  session,
  onAccept,
  accepting,
}: {
  session: HandoffSession;
  onAccept: () => void;
  accepting: boolean;
}) {
  const waitSec = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000);
  const isUrgent = waitSec >= 120;

  return (
    <div
      className={cn(
        "luxury-card p-4 space-y-2",
        isUrgent && "border-2 border-[var(--ent-danger)] animate-pulse"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cream-200 flex items-center justify-center text-mauve-600 font-semibold text-sm flex-shrink-0">
            {(session.customerName || "ลูกค้า").charAt(0)}
          </div>
          <span className="font-body font-medium text-mauve-800 truncate">
            {session.customerName || "ลูกค้า LINE"}
          </span>
        </div>
        <Badge
          variant={isUrgent ? "error" : "default"}
          size="sm"
          className={cn(isUrgent && "animate-pulse")}
        >
          {isUrgent ? "URGENT" : TRIGGER_LABELS[session.triggerType]}
        </Badge>
      </div>
      <p className="text-xs text-mauve-500 font-body">
        รอ: {formatWaitTime(session.createdAt)}
      </p>
      <p className="text-sm text-mauve-600 truncate" title={session.triggerMessage}>
        {session.triggerMessage.slice(0, 80)}
        {session.triggerMessage.length > 80 ? "…" : ""}
      </p>
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        loading={accepting}
        disabled={accepting}
        onClick={onAccept}
      >
        รับสาย
      </Button>
    </div>
  );
}

export default function HandoffPage() {
  useClinicContext(); // clinic layout requires context
  const { ready, orgId, signedIn } = useFirebaseRealtime();
  const [pendingSessions, setPendingSessions] = useState<HandoffSession[]>([]);
  const [acceptedSession, setAcceptedSession] = useState<HandoffSession | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [chatItems, setChatItems] = useState<Array<{ id: string; userMessage: string; botReply: string; source?: string; createdAt: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveMarkLearning, setResolveMarkLearning] = useState(false);
  const [resolveQuality, setResolveQuality] = useState<"excellent" | "good" | "poor">("good");
  const [resolving, setResolving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<Array<{ type: string; question?: string; answer?: string; service?: string; price?: string; confidence: number }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!ready || !orgId || !signedIn || !isFirebaseConfigReady()) return;
    const db = getFirebaseFirestore();
    const colRef = collection(db, "organizations", orgId, "handoff_sessions");
    const q = query(colRef, where("status", "==", "pending"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          conversationId: data.conversationId ?? "",
          customerId: data.customerId ?? "",
          customerName: data.customerName ?? "",
          customerLineId: data.customerLineId ?? "",
          triggerType: (data.triggerType as HandoffTriggerType) ?? "angry_customer",
          triggerMessage: data.triggerMessage ?? "",
          status: data.status ?? "pending",
          assignedStaffId: data.assignedStaffId ?? null,
          assignedStaffName: data.assignedStaffName ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
          acceptedAt: null,
          resolvedAt: null,
          resolutionNotes: null,
          learningQuality: null,
          markForLearning: false,
        } as HandoffSession;
      });
      setPendingSessions(items);
    });
    return () => unsub();
  }, [ready, orgId, signedIn]);

  const handleAccept = useCallback(
    async (session: HandoffSession) => {
      if (!session?.id) return;
      setAcceptingId(session.id);
      try {
        const res = await fetch(`/api/clinic/handoff/${session.id}/accept`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          setAcceptedSession({ ...session, status: "accepted" });
        }
      } finally {
        setAcceptingId(null);
      }
    },
    []
  );

  useEffect(() => {
    if (!acceptedSession?.customerId) return;
    let mounted = true;
    fetch(`/api/clinic/customers/${acceptedSession.customerId}/chats?limit=50`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (mounted && Array.isArray(data?.items)) {
          setChatItems(
            data.items.map((i: { id: string; userMessage: string; botReply: string; source?: string; createdAt: unknown }) => ({
              id: i.id,
              userMessage: i.userMessage ?? "",
              botReply: i.botReply ?? "",
              source: i.source,
              createdAt: typeof i.createdAt === "string" ? i.createdAt : new Date().toISOString(),
            }))
          );
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [acceptedSession?.customerId]);

  const handleSendMessage = useCallback(async () => {
    if (!acceptedSession || !chatInput.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/clinic/customers/${acceptedSession.customerId}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: chatInput.trim() }),
      });
      if (res.ok) {
        setChatInput("");
        setChatItems((prev) => [
          ...prev,
          {
            id: `opt_${Date.now()}`,
            userMessage: "",
            botReply: chatInput.trim(),
            source: "admin",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  }, [acceptedSession, chatInput]);

  const handleFetchPreview = useCallback(async () => {
    if (!acceptedSession?.id) return;
    setPreviewLoading(true);
    setExcludedIndices(new Set());
    try {
      const res = await fetch(`/api/clinic/handoff/${acceptedSession.id}/extract-preview`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.items)) {
        setPreviewItems(data.items);
        setPreviewOpen(true);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [acceptedSession?.id]);

  const toggleExcludeIndex = useCallback((idx: number) => {
    setExcludedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleResolve = useCallback(async () => {
    if (!acceptedSession) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/clinic/handoff/${acceptedSession.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resolutionNotes: resolveNotes,
          markForLearning: resolveMarkLearning,
          learningQuality: resolveMarkLearning ? resolveQuality : undefined,
          excludeIndices: resolveMarkLearning ? Array.from(excludedIndices) : undefined,
        }),
      });
      if (res.ok) {
        setResolveOpen(false);
        setPreviewOpen(false);
        setAcceptedSession(null);
        setResolveNotes("");
        setResolveMarkLearning(false);
        setResolveQuality("good");
        setExcludedIndices(new Set());
      }
    } finally {
      setResolving(false);
    }
  }, [acceptedSession, resolveNotes, resolveMarkLearning, resolveQuality, excludedIndices]);

  const QUICK_CHIPS = [
    "รอสักครู่นะคะ จะตรวจสอบให้",
    "ขอโทษด้วยนะคะ แก้ไขให้แล้วค่ะ",
    "ขอบคุณที่แจ้งค่ะ จะปรับปรุงให้ดีขึ้น",
    "โทรกลับให้ภายใน 10 นาทีนะคะ",
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Handoff"
        subtitle="คิวส่งต่อลูกค้า — รับสายและตอบแชท"
      />
      <div className="flex justify-end">
        <a
          href="/clinic/handoff/history"
          className="text-sm font-body text-rg-600 hover:underline"
        >
          ดูประวัติ Handoff →
        </a>
      </div>

      {!isFirebaseConfigReady() && (
        <div className="luxury-card p-4 border-amber-200 bg-amber-50 text-amber-800 text-sm">
          ยังไม่ได้ตั้งค่า Firebase Client — Handoff Queue จะใช้โหลดแบบ polling
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
        {/* LEFT — Queue */}
        <div className="luxury-card p-4 space-y-3">
          <h3 className="font-display font-semibold text-mauve-800">คิวรอ</h3>
          <div className="space-y-3 max-h-[400px] overflow-auto">
            {pendingSessions.length === 0 && (
              <p className="text-sm text-mauve-500 font-body">ไม่มีคิวรอรับสาย</p>
            )}
            {pendingSessions.map((s) => (
              <HandoffQueueItem
                key={s.id}
                session={s}
                onAccept={() => handleAccept(s)}
                accepting={acceptingId === s.id}
              />
            ))}
          </div>
        </div>

        {/* MIDDLE — Chat */}
        <div className="luxury-card p-4 flex flex-col min-h-[400px]">
          <h3 className="font-display font-semibold text-mauve-800 mb-3">แชท</h3>
          {!acceptedSession ? (
            <p className="text-sm text-mauve-500 font-body flex-1">เลือกรับสายจากคิวด้านซ้าย</p>
          ) : (
            <>
              <div className="flex-1 overflow-auto space-y-2 mb-3 min-h-[200px] max-h-[300px]">
                {chatItems.map((item) => (
                  <div key={item.id} className="space-y-1">
                    {item.userMessage && (
                      <div className="ml-0 mr-8 rounded-2xl rounded-tl-sm bg-cream-100 px-4 py-2 text-sm font-body text-mauve-800">
                        {item.userMessage}
                      </div>
                    )}
                    {item.botReply && (
                      <div
                        className={cn(
                          "mr-0 ml-8 rounded-2xl rounded-tr-sm px-4 py-2 text-sm font-body text-white",
                          item.source === "admin" ? "bg-[var(--rg-500)]" : "bg-gradient-to-br from-rg-400 to-rg-600"
                        )}
                      >
                        {item.botReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap mb-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setChatInput(chip)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-cream-200 text-mauve-600 hover:bg-cream-300 font-body"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="พิมพ์ข้อความ..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={sending}
                  disabled={!chatInput.trim()}
                  onClick={handleSendMessage}
                >
                  ส่ง
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setResolveOpen(true)}
              >
                แก้ไขแล้ว
              </Button>
            </>
          )}
        </div>

        {/* RIGHT — Customer Detail */}
        <div className="luxury-card p-4 space-y-4">
          <h3 className="font-display font-semibold text-mauve-800">รายละเอียดลูกค้า</h3>
          {!acceptedSession ? (
            <p className="text-sm text-mauve-500 font-body">เลือกรับสายจากคิว</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-mauve-700">{acceptedSession.customerName}</p>
                <p className="text-xs text-mauve-500">LINE ID: {acceptedSession.customerLineId?.slice(0, 12)}…</p>
              </div>
              <div>
                <p className="text-xs font-medium text-mauve-500 mb-1">ประวัติจอง (5 รายการล่าสุด)</p>
                <CustomerBookings customerId={acceptedSession.customerId} lineUserId={acceptedSession.customerLineId} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {resolveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setResolveOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setResolveOpen(false)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div
            className="luxury-card p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-4">ปิด Handoff</h3>
            <label className="block text-sm font-medium text-mauve-600 mb-2">หมายเหตุการแก้ไข</label>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="สรุปการแก้ไข..."
              className="w-full rounded-xl border border-cream-300 px-4 py-2 font-body text-sm mb-4 min-h-[80px]"
              rows={3}
            />
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={resolveMarkLearning}
                onChange={(e) => setResolveMarkLearning(e.target.checked)}
              />
              <span className="text-sm font-body text-mauve-600">มาร์คสำหรับ AI learning</span>
            </label>
            {resolveMarkLearning && (
              <div className="mb-4 space-y-2">
                <label className="text-sm font-medium text-mauve-600">คุณภาพการสนทนา</label>
                <div className="flex gap-2 mt-1">
                  {(["excellent", "good", "poor"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setResolveQuality(q)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-sm font-body",
                        resolveQuality === q ? "bg-rg-100 text-rg-700" : "bg-cream-200 text-mauve-600"
                      )}
                    >
                      {q === "excellent" ? "⭐⭐⭐ ยอดเยี่ยม" : q === "good" ? "⭐⭐ ดี" : "⭐ พอใช้"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-mauve-500 font-body">
                  {resolveQuality === "excellent"
                    ? "เรียนรู้ทันที"
                    : resolveQuality === "good"
                      ? "เรียนรู้ในพื้นหลัง"
                      : "ไม่เรียนรู้"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  loading={previewLoading}
                  disabled={previewLoading}
                  onClick={handleFetchPreview}
                  className="mt-2"
                >
                  ดูสิ่งที่ AI จะเรียน
                </Button>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setResolveOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={resolving}
                onClick={handleResolve}
                onKeyDown={(e) => e.key === "Enter" && handleResolve()}
              >
                ยืนยัน
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal — what AI will learn */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
          onClick={() => setPreviewOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div
            className="luxury-card p-6 w-full max-w-lg max-h-[80vh] mx-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-mauve-800 mb-2">
              สิ่งที่ AI จะเรียนรู้
            </h3>
            <p className="text-xs text-mauve-500 font-body mb-4">
              ปรับ checkbox เพื่อยกเว้นรายการที่ไม่อยากให้ AI เรียน
            </p>
            <div className="flex-1 overflow-auto space-y-3 mb-4 min-h-[120px]">
              {previewItems.length === 0 ? (
                <p className="text-sm text-mauve-500 font-body">ไม่พบคู่ Q&A หรือราคาที่จะเรียน</p>
              ) : (
                previewItems.map((item, i) => (
                  <label
                    key={i}
                    className={cn(
                      "flex gap-3 p-3 rounded-xl border cursor-pointer",
                      excludedIndices.has(i)
                        ? "border-cream-300 bg-cream-100 opacity-70"
                        : "border-cream-200 bg-white"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!excludedIndices.has(i)}
                      onChange={() => toggleExcludeIndex(i)}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      {item.type === "qa" && (
                        <>
                          <p className="text-sm font-medium text-mauve-700 truncate">
                            คำถาม: {item.question ?? "—"}
                          </p>
                          <p className="text-xs text-mauve-500 truncate">
                            คำตอบ: {(item.answer ?? "").slice(0, 80)}
                            {(item.answer?.length ?? 0) > 80 ? "…" : ""}
                          </p>
                        </>
                      )}
                      {item.type === "pricing" && (
                        <p className="text-sm text-mauve-700">
                          บริการ: {item.service ?? "—"} — {item.price ?? ""} บาท
                        </p>
                      )}
                      <span className="text-[10px] text-mauve-400">
                        confidence {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              ปิด
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerBookings({ lineUserId }: { customerId: string; lineUserId: string }) {
  const [bookings, setBookings] = useState<Array<{ scheduledAt: string; service: string; status: string }>>([]);
  useEffect(() => {
    if (!lineUserId) return;
    fetch(`/api/clinic/handoff/customer-bookings?lineUserId=${encodeURIComponent(lineUserId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        const items = d?.items ?? [];
        setBookings(
          Array.isArray(items)
            ? items.map((b: { scheduledAt?: string; service?: string; status?: string }) => ({
                scheduledAt: b.scheduledAt ?? "",
                service: b.service ?? "",
                status: b.status ?? "",
              }))
            : []
        );
      })
      .catch(() => setBookings([]));
  }, [lineUserId]);
  if (bookings.length === 0) return <p className="text-xs text-mauve-500">ไม่มีประวัติ</p>;
  return (
    <ul className="text-xs text-mauve-600 space-y-1">
      {bookings.map((b, i) => (
        <li key={i}>
          {b.service} — {b.scheduledAt ? new Date(b.scheduledAt).toLocaleDateString("th-TH") : ""} ({b.status})
        </li>
      ))}
    </ul>
  );
}
