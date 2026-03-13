"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant?: "default" | "success" | "warning" | "error" | "ai";
  /** Auto-dismiss after ms. 0 = never */
  duration?: number;
  /** Custom actions rendered in the toast */
  actions?: React.ReactNode;
}

type ToastContextType = {
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const variantStyles: Record<string, string> = {
  default: "bg-cream-100 border-cream-300",
  success: "bg-emerald-50 border-emerald-200",
  warning: "bg-amber-50 border-amber-200",
  error: "bg-red-50 border-red-200",
  ai: "bg-purple-50 border-purple-300 border-2",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback((item: Omit<ToastItem, "id">): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: ToastItem = { ...item, id, duration: item.duration ?? 8000 };
    setToasts((prev) => [...prev.slice(-4), toast]);
    if (toast.duration && toast.duration > 0) {
      const t = setTimeout(() => removeToast(id), toast.duration);
      timersRef.current.set(id, t);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "luxury-card p-4 border pointer-events-auto shadow-luxury",
              variantStyles[t.variant ?? "default"]
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-mauve-800 text-sm">{t.title}</p>
                {t.message && <p className="font-body text-xs text-mauve-600 mt-1">{t.message}</p>}
                {t.actions && <div className="flex flex-wrap gap-2 mt-3">{t.actions}</div>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(t.id)}
                className="shrink-0 p-1 rounded-lg text-mauve-400 hover:text-mauve-600 hover:bg-mauve-100/50 transition-colors"
                aria-label="ปิด"
              >
                ×
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
