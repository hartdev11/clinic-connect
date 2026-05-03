"use client";

import { Suspense, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { BillingSection } from "@/components/clinic/BillingSection";
import { OrganizationSettings } from "@/components/clinic/OrganizationSettings";
import { BranchManagement } from "@/components/clinic/BranchManagement";
import { LineConnectionSettings } from "@/components/clinic/LineConnectionSettings";
import { AiConfigSettings } from "@/components/clinic/AiConfigSettings";
import { RequireRole } from "@/components/rbac/RequireRole";
import {
  BuildingStorefrontIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  BuildingOffice2Icon,
  WrenchScrewdriverIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { ClinicService } from "@/types/unified-knowledge";

const SETTINGS_TABS = [
  { value: "organization" as const, label: "ตั้งค่าทั่วไป", Icon: BuildingStorefrontIcon },
  { value: "billing" as const, label: "บิล", Icon: CreditCardIcon },
  { value: "line" as const, label: "LINE", Icon: ChatBubbleLeftRightIcon },
  { value: "ai-config" as const, label: "AI Config", Icon: CpuChipIcon },
  { value: "branches" as const, label: "สาขา", Icon: BuildingOffice2Icon },
  { value: "services" as const, label: "บริการ", Icon: WrenchScrewdriverIcon },
];

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<typeof SETTINGS_TABS[number]["value"]>("organization");
  const [services, setServices] = useState<ClinicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServicePrice, setEditServicePrice] = useState("");
  const [serviceToast, setServiceToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (tabParam && SETTINGS_TABS.some((t) => t.value === tabParam)) {
      setActiveTab(tabParam as typeof SETTINGS_TABS[number]["value"]);
      return;
    }
    setActiveTab("organization");
  }, [tabParam]);

  const loadServices = async () => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      const res = await fetch("/api/clinic/unified-knowledge/services", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServices([]);
        setServicesError(data?.error ?? "โหลดบริการไม่สำเร็จ");
        return;
      }
      const list = Array.isArray(data?.items) ? (data.items as ClinicService[]) : [];
      setServices(list.filter((x) => x.deleted_at == null));
    } catch {
      setServices([]);
      setServicesError("เกิดข้อผิดพลาดในการโหลดบริการ");
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "services") {
      void loadServices();
    }
  }, [activeTab]);

  const handleAddService = async () => {
    const title = newServiceName.trim();
    if (!title) {
      setServicesError("กรุณาใส่ชื่อบริการ");
      return;
    }
    setSavingService(true);
    setServicesError(null);
    setServiceToast(null);
    try {
      const res = await fetch("/api/clinic/unified-knowledge/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          custom_title: title,
          custom_price: newServicePrice.trim(),
          custom_highlight: "",
          custom_description: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(data?.error ?? "เพิ่มบริการไม่สำเร็จ");
        setServiceToast({ type: "error", text: data?.error ?? "เพิ่มบริการไม่สำเร็จ" });
        return;
      }
      setNewServiceName("");
      setNewServicePrice("");
      setServiceToast({ type: "success", text: "เพิ่มบริการสำเร็จ" });
      await loadServices();
    } catch {
      setServicesError("เกิดข้อผิดพลาดในการเพิ่มบริการ");
      setServiceToast({ type: "error", text: "เกิดข้อผิดพลาดในการเพิ่มบริการ" });
    } finally {
      setSavingService(false);
    }
  };

  const handleUpdateService = async (id: string) => {
    const title = editServiceName.trim();
    if (!title) {
      setServicesError("กรุณาใส่ชื่อบริการ");
      setServiceToast({ type: "error", text: "กรุณาใส่ชื่อบริการ" });
      return;
    }
    setUpdatingServiceId(id);
    setServicesError(null);
    setServiceToast(null);
    try {
      const res = await fetch(`/api/clinic/unified-knowledge/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          custom_title: title,
          custom_price: editServicePrice.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(data?.error ?? "บันทึกบริการไม่สำเร็จ");
        setServiceToast({ type: "error", text: data?.error ?? "บันทึกบริการไม่สำเร็จ" });
        return;
      }
      setEditingServiceId(null);
      setEditServiceName("");
      setEditServicePrice("");
      setServiceToast({ type: "success", text: "บันทึกบริการสำเร็จ" });
      await loadServices();
    } catch {
      setServicesError("เกิดข้อผิดพลาดในการบันทึกบริการ");
      setServiceToast({ type: "error", text: "เกิดข้อผิดพลาดในการบันทึกบริการ" });
    } finally {
      setUpdatingServiceId(null);
    }
  };

  const handleToggleServiceStatus = async (service: ClinicService) => {
    const nextStatus = service.status === "active" ? "inactive" : "active";
    setUpdatingServiceId(service.id);
    setServicesError(null);
    setServiceToast(null);
    try {
      const res = await fetch(`/api/clinic/unified-knowledge/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(data?.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
        setServiceToast({ type: "error", text: data?.error ?? "เปลี่ยนสถานะไม่สำเร็จ" });
        return;
      }
      setServiceToast({ type: "success", text: "อัปเดตสถานะบริการสำเร็จ" });
      await loadServices();
    } catch {
      setServicesError("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
      setServiceToast({ type: "error", text: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
    } finally {
      setUpdatingServiceId(null);
    }
  };

  const handleDeleteService = async (id: string) => {
    setDeletingServiceId(id);
    setServicesError(null);
    setServiceToast(null);
    try {
      const res = await fetch(`/api/clinic/unified-knowledge/services/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServicesError(data?.error ?? "ลบบริการไม่สำเร็จ");
        setServiceToast({ type: "error", text: data?.error ?? "ลบบริการไม่สำเร็จ" });
        return;
      }
      setServiceToast({ type: "success", text: "ลบบริการสำเร็จ" });
      await loadServices();
    } catch {
      setServicesError("เกิดข้อผิดพลาดในการลบบริการ");
      setServiceToast({ type: "error", text: "เกิดข้อผิดพลาดในการลบบริการ" });
    } finally {
      setDeletingServiceId(null);
    }
  };

  const handleSelectTab = (tab: typeof SETTINGS_TABS[number]["value"]) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "organization") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

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
                onClick={() => handleSelectTab(tab.value)}
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
                  <tab.Icon className="w-4 h-4" />
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
                  {serviceToast && (
                    <div
                      className={cn(
                        "rounded-xl px-4 py-2 text-sm border",
                        serviceToast.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-red-50 border-red-200 text-red-700"
                      )}
                    >
                      {serviceToast.text}
                    </div>
                  )}
                  {servicesError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                      {servicesError}
                    </div>
                  )}
                  <div className="space-y-3">
                    {servicesLoading && (
                      <div className="h-24 rounded-xl bg-cream-100 animate-pulse" />
                    )}
                    {!servicesLoading && services.length === 0 && (
                      <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-mauve-600">
                        ยังไม่มีบริการ กดเพิ่มบริการเพื่อเริ่มใช้งาน
                      </div>
                    )}
                    {!servicesLoading && services.map((s) => (
                      <div
                        key={s.id}
                        className="p-4 rounded-2xl bg-cream-100 border border-cream-200 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-body text-mauve-700 text-sm block truncate">{s.custom_title}</span>
                            {s.custom_price && (
                              <span className="font-display font-semibold text-mauve-800">฿{s.custom_price}</span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs border",
                              s.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            )}
                          >
                            {s.status === "active" ? "active" : "inactive"}
                          </span>
                        </div>
                        {editingServiceId === s.id ? (
                          <div className="space-y-2">
                            <Input value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} placeholder="ชื่อบริการ" />
                            <Input value={editServicePrice} onChange={(e) => setEditServicePrice(e.target.value)} placeholder="ราคา" />
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" loading={updatingServiceId === s.id} onClick={() => handleUpdateService(s.id)}>บันทึก</Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingServiceId(null);
                                  setEditServiceName("");
                                  setEditServicePrice("");
                                }}
                              >
                                ยกเลิก
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingServiceId(s.id);
                                setEditServiceName(s.custom_title);
                                setEditServicePrice(s.custom_price ?? "");
                              }}
                            >
                              แก้ไข
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={updatingServiceId === s.id}
                              onClick={() => handleToggleServiceStatus(s)}
                            >
                              {s.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={deletingServiceId === s.id}
                              onClick={() => setConfirmDeleteServiceId(s.id)}
                              aria-label="ลบบริการ"
                            >
                              <TrashIcon className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="rounded-2xl border border-cream-200 bg-cream-50 p-3 space-y-2">
                      <Input
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="ชื่อบริการ เช่น เลเซอร์กำจัดขน"
                        aria-label="ชื่อบริการ"
                      />
                      <Input
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        placeholder="ราคา เช่น 2500"
                        aria-label="ราคาบริการ"
                      />
                      <Button variant="outline" size="sm" loading={savingService} onClick={handleAddService}>
                        + เพิ่มบริการ
                      </Button>
                    </div>
                  </div>
                  {confirmDeleteServiceId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                      <div className="w-full max-w-sm rounded-2xl border border-cream-300 bg-white p-5 shadow-luxury space-y-4">
                        <h4 className="font-display text-base font-semibold text-mauve-800">ยืนยันการลบบริการ</h4>
                        <p className="text-sm text-mauve-600">เมื่อลบแล้ว AI จะไม่ใช้บริการนี้ในการตอบคำถามลูกค้า</p>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteServiceId(null)}>
                            ยกเลิก
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={deletingServiceId === confirmDeleteServiceId}
                            onClick={async () => {
                              const targetId = confirmDeleteServiceId;
                              setConfirmDeleteServiceId(null);
                              if (targetId) await handleDeleteService(targetId);
                            }}
                          >
                            ยืนยันลบ
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
