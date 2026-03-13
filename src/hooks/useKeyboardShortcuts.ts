"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const G_MAP: Record<string, string> = {
  d: "/clinic",
  c: "/clinic/customers",
  b: "/clinic/booking",
  k: "/clinic/knowledge",
  s: "/clinic/settings",
  h: "/clinic/handoff",
};

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  const role = (el as HTMLElement).getAttribute?.("role");
  const isInput = tag === "input" || tag === "textarea" || tag === "select";
  const isContentEditable = (el as HTMLElement).isContentEditable;
  const isSearchbox = role === "searchbox" || role === "textbox";
  return isInput || isContentEditable || isSearchbox;
}

export function useKeyboardShortcuts(onShowShortcuts: () => void) {
  const router = useRouter();
  const gPressedAt = useRef<number | null>(null);
  const G_TIMEOUT_MS = 1000;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(document.activeElement)) return;

      const key = e.key.toLowerCase();

      if (key === "?") {
        e.preventDefault();
        onShowShortcuts();
        return;
      }

      if (key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        gPressedAt.current = Date.now();
        return;
      }

      const href = G_MAP[key];
      if (href && gPressedAt.current !== null) {
        const elapsed = Date.now() - gPressedAt.current;
        if (elapsed < G_TIMEOUT_MS) {
          e.preventDefault();
          gPressedAt.current = null;
          router.push(href);
        }
      } else {
        gPressedAt.current = null;
      }
    };

    const clearG = () => {
      if (gPressedAt.current && Date.now() - gPressedAt.current > G_TIMEOUT_MS) {
        gPressedAt.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", clearG);
    const id = setInterval(clearG, 500);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", clearG);
      clearInterval(id);
    };
  }, [router, onShowShortcuts]);
}
