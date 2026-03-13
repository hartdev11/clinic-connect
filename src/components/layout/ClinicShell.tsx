"use client";

import { useState, useCallback } from "react";
import { ClinicSidebar } from "@/components/layout/ClinicSidebar";
import { ClinicTopbar } from "@/components/layout/ClinicTopbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { FailedPaymentBanner } from "@/components/layout/FailedPaymentBanner";
import { KeyboardShortcutsModal } from "@/components/layout/KeyboardShortcutsModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function ClinicShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useKeyboardShortcuts(useCallback(() => setShortcutsOpen(true), []));

  return (
    <div className="flex flex-col h-screen bg-cream-100 overflow-hidden">
      <FailedPaymentBanner />
      <div className="flex flex-1 min-h-0">
        <ClinicSidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ClinicTopbar onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 max-w-[1600px] mx-auto pb-20 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <MobileNav />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
