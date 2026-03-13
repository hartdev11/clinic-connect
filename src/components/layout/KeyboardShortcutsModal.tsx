"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: { keys: string; action: string; href?: string }[] = [
  { keys: "G then D", action: "Dashboard", href: "/clinic" },
  { keys: "G then C", action: "Customers", href: "/clinic/customers" },
  { keys: "G then B", action: "Bookings", href: "/clinic/booking" },
  { keys: "G then K", action: "Knowledge", href: "/clinic/knowledge" },
  { keys: "G then S", action: "Settings", href: "/clinic/settings" },
  { keys: "G then H", action: "Handoff", href: "/clinic/handoff" },
  { keys: "?", action: "แสดง shortcuts นี้" },
  { keys: "Escape", action: "ปิด modal ใดๆ" },
];

export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="luxury-card w-full max-w-md p-6 shadow-luxury-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="shortcuts-title"
          className="font-display text-xl font-semibold text-mauve-800 mb-4"
          style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
        >
          Keyboard Shortcuts
        </h2>
        <table className="w-full font-body text-sm" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
          <tbody>
            {SHORTCUTS.map((row, i) => (
              <tr key={i} className="border-b border-cream-200 last:border-0">
                <td className="py-2.5 pr-4 text-mauve-600">
                  <kbd className="px-2 py-0.5 rounded-lg bg-cream-200 text-mauve-700 font-mono text-xs">
                    {row.keys}
                  </kbd>
                </td>
                <td className="py-2.5 text-mauve-800">
                  {row.href ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(row.href!);
                      }}
                      className="text-left hover:text-rg-600 hover:underline"
                    >
                      {row.action}
                    </button>
                  ) : (
                    row.action
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-mauve-400 font-body">
          กด Escape เพื่อปิด
        </p>
      </div>
    </div>
  );
}
