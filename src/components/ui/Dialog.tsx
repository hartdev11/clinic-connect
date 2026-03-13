"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** For form submit - use as form id */
  id?: string;
}

/** Enterprise: Modal dialog — Escape to close, click backdrop to close */
export function Dialog({ open, onClose, title, children, className, id }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-mauve-900/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={id ? `${id}-title` : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "luxury-card max-w-md w-full mx-4 max-h-[90vh] flex flex-col border border-cream-300 shadow-luxury-lg",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream-200 shrink-0">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-xl font-semibold text-mauve-800">
            {title}
          </h2>
        </div>
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
