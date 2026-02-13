"use client";

/**
 * FE-4 — Duplicate Warning Modal
 * แสดงเมื่อพบ semantic similarity > 0.85
 */
import { type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DuplicateResult } from "@/types/knowledge";

interface DuplicateWarningModalProps {
  duplicate: DuplicateResult;
  onResolve: (action: "replace" | "keep" | "cancel") => void;
  loading?: boolean;
}

export function DuplicateWarningModal({
  duplicate,
  onResolve,
  loading = false,
}: DuplicateWarningModalProps) {
  const similarityPercent = duplicate.type === "semantic" && duplicate.score
    ? (duplicate.score * 100).toFixed(0)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onResolve("cancel")}>
      <Card padding="lg" className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-surface-900 mb-2">
          พบข้อความคล้ายกัน
        </h3>
        {similarityPercent && (
          <p className="text-sm text-surface-600 mb-4">
            ความคล้ายกัน: {similarityPercent}% (มากกว่า 85%)
          </p>
        )}
        <div className="mb-4 p-3 rounded-lg bg-surface-50 border border-surface-200">
          <p className="text-xs font-medium text-surface-500 mb-1">เอกสารเดิม:</p>
          <p className="text-sm text-surface-700 font-medium">
            {duplicate.existing.topic} / {duplicate.existing.category}
          </p>
          {duplicate.existing.text && (
            <p className="text-xs text-surface-500 mt-2 line-clamp-3">
              {duplicate.existing.text.slice(0, 150)}...
            </p>
          )}
        </div>
        <p className="text-sm text-surface-600 mb-4">
          เลือกการดำเนินการ:
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onResolve("replace")}
            disabled={loading}
          >
            Replace (แทนที่)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onResolve("keep")}
            disabled={loading}
          >
            Keep (เก็บเดิม)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolve("cancel")}
            disabled={loading}
          >
            Cancel (ยกเลิก)
          </Button>
        </div>
      </Card>
    </div>
  );
}
