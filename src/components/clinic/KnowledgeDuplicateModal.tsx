"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export interface KnowledgeDuplicateModalProps {
  open: boolean;
  onClose: () => void;
  existingTopicId: string;
  newTopicTitle: string;
  newCategoryLabel: string;
  newContent: string;
  loadingAction?: boolean;
  onUseExisting: () => void;
  onOverwriteExisting: () => void;
  onCreateAsNew: () => void;
}

/**
 * P2-4 — Side-by-side duplicate resolution: existing topic vs draft content.
 */
export function KnowledgeDuplicateModal({
  open,
  onClose,
  existingTopicId,
  newTopicTitle,
  newCategoryLabel,
  newContent,
  loadingAction,
  onUseExisting,
  onOverwriteExisting,
  onCreateAsNew,
}: KnowledgeDuplicateModalProps) {
  const [existingTitle, setExistingTitle] = useState("");
  const [existingContent, setExistingContent] = useState("");
  const [existingCategory, setExistingCategory] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open || !existingTopicId) return;
    setFetchError(null);
    setFetching(true);
    void (async () => {
      try {
        const res = await fetch(`/api/clinic/knowledge/topics/${existingTopicId}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFetchError(typeof data?.error === "string" ? data.error : "โหลดข้อมูลไม่สำเร็จ");
          return;
        }
        const v = data.activeVersion ?? data.versions?.[0];
        setExistingTitle(data.topic?.topic ?? "");
        setExistingCategory(String(v?.category ?? ""));
        setExistingContent(typeof v?.content === "string" ? v.content : "");
      } catch {
        setFetchError("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setFetching(false);
      }
    })();
  }, [open, existingTopicId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="พบเนื้อหาซ้ำหรือใกล้เคียง"
      className="max-w-5xl w-full max-h-[92vh]"
    >
      <div className="p-5 space-y-4">
        <p className="font-body text-sm text-mauve-600">
          เปรียบเทียบกับหัวข้อที่มีอยู่แล้ว แล้วเลือกว่าจะใช้แบบไหน — การเขียนทับจะสร้างเวอร์ชันใหม่บนหัวข้อเดิม
        </p>
        {fetchError && (
          <p className="font-body text-sm text-red-600">{fetchError}</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 min-h-[200px] max-h-[45vh]">
          <div className="rounded-2xl border border-cream-200 bg-cream-50/80 p-4 flex flex-col min-h-0">
            <p className="font-body text-xs font-semibold text-mauve-500 uppercase tracking-wide">
              ของเดิมในระบบ
            </p>
            {fetching ? (
              <div className="mt-3 flex-1 rounded-xl bg-cream-200 animate-pulse" />
            ) : (
              <>
                <p className="mt-1 font-display text-sm font-semibold text-mauve-800">{existingTitle || "—"}</p>
                <p className="font-body text-xs text-mauve-500 mb-2">{existingCategory}</p>
                <pre className="font-body text-sm text-mauve-700 whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed">
                  {existingContent || "—"}
                </pre>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-rg-200/80 bg-white p-4 flex flex-col min-h-0">
            <p className="font-body text-xs font-semibold text-rg-600 uppercase tracking-wide">
              เนื้อหาที่คุณกำลังเขียน
            </p>
            <p className="mt-1 font-display text-sm font-semibold text-mauve-800">{newTopicTitle}</p>
            <p className="font-body text-xs text-mauve-500 mb-2">{newCategoryLabel}</p>
            <pre className="font-body text-sm text-mauve-700 whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed">
              {newContent || "—"}
            </pre>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-cream-200">
          <Button variant="secondary" size="sm" onClick={onUseExisting} disabled={!!loadingAction}>
            ใช้ของเดิม (ไปแก้หัวข้อนั้น)
          </Button>
          <Button variant="primary" size="sm" onClick={onOverwriteExisting} loading={loadingAction} disabled={fetching}>
            เขียนทับของเดิม
          </Button>
          <Button variant="secondary" size="sm" onClick={onCreateAsNew} disabled={!!loadingAction}>
            สร้างเป็นหัวข้อใหม่
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={!!loadingAction}>
            กลับไปแก้ไข
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
