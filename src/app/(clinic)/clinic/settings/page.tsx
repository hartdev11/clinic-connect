"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { BillingSection } from "@/components/clinic/BillingSection";
import { OrganizationSettings } from "@/components/clinic/OrganizationSettings";
import { BranchManagement } from "@/components/clinic/BranchManagement";
import { LineConnectionSettings } from "@/components/clinic/LineConnectionSettings";
import { AiConfigSettings } from "@/components/clinic/AiConfigSettings";
import { RequireRole } from "@/components/rbac/RequireRole";

const SETTINGS_TABS = [
  { value: "organization" as const, label: "ตั้งค่าทั่วไป", icon: "◇" },
  { value: "billing" as const, label: "บิล", icon: "◻" },
  { value: "line" as const, label: "LINE", icon: "◎" },
  { value: "ai-config" as const, label: "AI Config", icon: "◈" },
  { value: "branches" as const, label: "สาขา", icon: "▣" },
  { value: "services" as const, label: "บริการ", icon: "◆" },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<typeof SETTINGS_TABS[number]["value"]>("organization");

  useEffect(() => {
    if (tabParam && SETTINGS_TABS.some((t) => t.value === tabParam)) {
      setActiveTab(tabParam as typeof SETTINGS_TABS[number]["value"]);
    }
  }, [tabParam]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่า"
        subtitle="จัดการการตั้งค่าคลินิกและระบบ"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:w-56 flex-shrink-0"
        >
          <div className="luxury-card p-3 space-y-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                  "font-body text-sm transition-all duration-200 text-left",
                  activeTab === tab.value
                    ? "bg-rg-100 text-rg-700 font-medium"
                    : "text-mauve-500 hover:bg-cream-100 hover:text-mauve-700"
                )}
              >
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0",
                    activeTab === tab.value ? "bg-rg-200 text-rg-600" : "bg-cream-200 text-mauve-400"
                  )}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex-1 min-w-0"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "organization" && <OrganizationSettings />}
              {activeTab === "billing" && (
                <RequireRole allowed={["owner"]}>
                  <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-cream-200" />}>
                    <BillingSection />
                  </Suspense>
                </RequireRole>
              )}
              {activeTab === "line" && <LineConnectionSettings />}
              {activeTab === "ai-config" && <AiConfigSettings />}
              {activeTab === "branches" && <BranchManagement />}
              {activeTab === "services" && (
                <div className="luxury-card p-6 space-y-6">
                  <h3 className="font-display text-lg font-semibold text-mauve-800 pb-3 border-b border-cream-200">
                    บริการและราคา
                  </h3>
                  <div className="space-y-3">
                    {[
                      { name: "เลเซอร์กำจัดขน", price: "2,500" },
                      { name: "ฟิลเลอร์", price: "8,000" },
                      { name: "โบท็อกซ์", price: "6,000" },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-4 rounded-2xl bg-cream-100 border border-cream-200"
                      >
                        <span className="font-body text-mauve-700 text-sm">{s.name}</span>
                        <span className="font-display font-semibold text-mauve-800">฿{s.price}</span>
                      </div>
                    ))}
                    <Button variant="outline" size="sm">+ เพิ่มบริการ</Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
