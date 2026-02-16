"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { KnowledgeVersion, KnowledgeVersionStatus } from "@/types/knowledge";

const STATUS_LABELS: Record<KnowledgeVersionStatus, string> = {
  draft: "แบบร่าง",
  updating: "กำลังอัปเดต",
  active: "พร้อมใช้งาน",
  archived: "เก็บถาวร",
  failed: "มีปัญหา",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface KnowledgeVersionHistoryModalProps {
  topicId: string;
  onClose: () => void;
  onRollbackDone: () => void;
}

export function KnowledgeVersionHistoryModal({
  topicId,
  onClose,
  onRollbackDone,
}: KnowledgeVersionHistoryModalProps) {
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailVersion, setDetailVersion] = useState<KnowledgeVersion | null>(null);
  const [rollbackVersionId, setRollbackVersionId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinic/knowledge/topics/${topicId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.versions) setVersions(data.versions);
      else setVersions([]);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleRollback = async (versionId: string) => {
    if (!confirm("ย้อนกลับไปใช้เนื้อหาของเวอร์ชันนี้ใช่หรือไม่? ระบบจะสร้างเวอร์ชันใหม่และอัปเดตให้ AI ใช้")) return;
    setRollbackVersionId(versionId);
    try {
      const res = await fetch(`/api/clinic/knowledge/topics/${topicId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onRollbackDone();
      else throw new Error(data.error ?? "ย้อนกลับไม่สำเร็จ");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRollbackVersionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="version-history-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <h2 id="version-history-title" className="text-xl font-semibold text-surface-800">
            ประวัติการแก้ไข
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
            aria-label="ปิด"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-surface-100 animate-pulse" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-surface-600">ยังไม่มีประวัติเวอร์ชัน</p>
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => (
                <li key={v.id} className="border border-surface-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-surface-800">
                      เวอร์ชัน · {formatDate(v.createdAt)} · โดย {v.createdBy || "—"}
                    </span>
                    <span className="text-xs text-surface-500">{STATUS_LABELS[v.status]}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailVersion(detailVersion?.id === v.id ? null : v)}
                    >
                      ดูรายละเอียด
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRollback(v.id)}
                      disabled={rollbackVersionId !== null}
                      loading={rollbackVersionId === v.id}
                    >
                      ย้อนกลับเวอร์ชันนี้
                    </Button>
                  </div>
                  {detailVersion?.id === v.id && (
                    <div className="mt-4 p-4 rounded-lg bg-surface-50 text-sm text-surface-700 whitespace-pre-wrap border border-surface-100">
                      {v.content?.slice(0, 500)}
                      {(v.content?.length ?? 0) > 500 && "…"}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
