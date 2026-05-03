"use client";

import { Button } from "@/components/ui/Button";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

interface KnowledgeErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function KnowledgeErrorState({ message, onRetry }: KnowledgeErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert" aria-live="polite">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon aria-hidden className="h-5 w-5 mt-0.5 text-red-700" />
        <div className="min-w-0">
          <p className="font-body text-sm font-semibold text-red-800">เกิดข้อผิดพลาดในระบบความรู้</p>
          <p className="mt-1 font-body text-sm text-red-700">{message}</p>
          {onRetry ? (
            <Button className="mt-3" variant="secondary" size="sm" onClick={onRetry}>
              ลองใหม่
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
