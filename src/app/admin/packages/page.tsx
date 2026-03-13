"use client";

import { useState, useCallback, useEffect } from "react";
import { Bars3Icon, PlusIcon } from "@heroicons/react/24/outline";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { PricingPackage, PricingPackageCreate } from "@/types/pricing";

const FEATURE_KEYS = [
  "ai_chat",
  "analytics",
  "white_label",
  "api_access",
  "priority_support",
] as const;
const FEATURE_LABELS: Record<string, string> = {
  ai_chat: "AI Chat",
  analytics: "Analytics",
  white_label: "White Label",
  api_access: "API Access",
  priority_support: "Priority Support",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function SortablePackageCard({
  pkg,
  onToggleActive,
  onEdit,
}: {
  pkg: PricingPackage;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (pkg: PricingPackage) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pkg.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "luxury-card p-4 transition-all duration-200",
        isDragging && "opacity-90 shadow-luxury-lg z-10"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex shrink-0 items-center justify-center w-8 h-8 cursor-grab active:cursor-grabbing text-cream-400 hover:text-cream-600 rounded-lg"
          aria-label="ลากเพื่อจัดเรียง"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-mauve-800">{pkg.packageName}</h3>
            <Badge variant={pkg.isActive ? "default" : "outline"} size="sm">
              {pkg.isActive ? "ใช้งาน" : "ปิด"}
            </Badge>
          </div>
          <p className="mt-1 font-body text-sm text-mauve-600">
            ฿{pkg.price.toLocaleString("th-TH")}/{pkg.billingPeriod === "monthly" ? "เดือน" : "ปี"}
          </p>
          <p className="mt-1 text-xs text-mauve-400">
            {pkg.conversationsIncluded} คำถาม • {pkg.maxBranches} สาขา • {pkg.maxUsers} ผู้ใช้
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(pkg)}>
              แก้ไข
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggleActive(pkg.id, !pkg.isActive)}
            >
              {pkg.isActive ? "ปิด" : "เปิด"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPackagesPage() {
  const [items, setItems] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const formState = useState({
    packageName: "",
    packageSlug: "",
    description: "",
    price: 0,
    billingPeriod: "monthly" as "monthly" | "yearly",
    conversationsIncluded: 0,
    maxBranches: 1,
    maxUsers: 1,
    features: {} as Record<string, boolean>,
    allowTopup: false,
    topupPricePer100: 0,
    isActive: true,
    isPublic: true,
  });

  const [form, setForm] = formState;

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/packages", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(data.items ?? []);
      else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((p) => p.id === active.id);
      const newIndex = items.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);
      fetch("/api/admin/packages/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: reordered.map((p) => p.id) }),
      }).then((r) => {
        if (r.ok) setToast("จัดเรียงแล้ว");
        else setToast("จัดเรียงไม่สำเร็จ");
      });
    },
    [items]
  );

  const handleToggleActive = useCallback(
    async (id: string, active: boolean) => {
      const res = await fetch(`/api/admin/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: active }),
      });
      if (res.ok) {
        setToast(active ? "เปิดใช้งานแล้ว" : "ปิดแล้ว");
        fetchPackages();
      } else {
        setToast("อัปเดตไม่สำเร็จ");
      }
    },
    [fetchPackages]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      packageName: "",
      packageSlug: "",
      description: "",
      price: 0,
      billingPeriod: "monthly",
      conversationsIncluded: 0,
      maxBranches: 1,
      maxUsers: 1,
      features: {},
      allowTopup: false,
      topupPricePer100: 0,
      isActive: true,
      isPublic: true,
    });
    setModalOpen(true);
  };

  const openEdit = (pkg: PricingPackage) => {
    setEditing(pkg);
    setForm({
      packageName: pkg.packageName,
      packageSlug: pkg.packageSlug,
      description: pkg.description,
      price: pkg.price,
      billingPeriod: pkg.billingPeriod,
      conversationsIncluded: pkg.conversationsIncluded,
      maxBranches: pkg.maxBranches,
      maxUsers: pkg.maxUsers,
      features: { ...pkg.features },
      allowTopup: pkg.allowTopup,
      topupPricePer100: pkg.topupPricePer100,
      isActive: pkg.isActive,
      isPublic: pkg.isPublic,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        packageName: form.packageName,
        packageSlug: form.packageSlug || slugify(form.packageName),
        description: form.description,
        price: form.price,
        billingPeriod: form.billingPeriod,
        conversationsIncluded: form.conversationsIncluded,
        maxBranches: form.maxBranches,
        maxUsers: form.maxUsers,
        features: form.features,
        allowTopup: form.allowTopup,
        topupPricePer100: form.topupPricePer100,
        isActive: form.isActive,
        isPublic: form.isPublic,
      };
      if (editing) {
        const res = await fetch(`/api/admin/packages/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setToast("บันทึกแล้ว");
          setModalOpen(false);
          fetchPackages();
        } else {
          const d = await res.json().catch(() => ({}));
          setToast(d.error ?? "บันทึกไม่สำเร็จ");
        }
      } else {
        const res = await fetch("/api/admin/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setToast("สร้างแล้ว");
          setModalOpen(false);
          fetchPackages();
        } else {
          const d = await res.json().catch(() => ({}));
          setToast(d.error ?? "สร้างไม่สำเร็จ");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-mauve-800">แพ็กเกจราคา</h1>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon className="h-5 w-5 mr-1" />
          สร้างแพ็กเกจ
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-cream-200 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="luxury-card p-12 text-center text-mauve-500">
          ยังไม่มีแพ็กเกจ — คลิก &quot;สร้างแพ็กเกจ&quot; เพื่อเพิ่ม
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((pkg) => (
                <SortablePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onToggleActive={handleToggleActive}
                  onEdit={openEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onKeyDown={handleKeyDown}
        >
          <div className="luxury-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">
              {editing ? "แก้ไขแพ็กเกจ" : "สร้างแพ็กเกจ"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="ชื่อแพ็กเกจ"
                value={form.packageName}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    packageName: e.target.value,
                    packageSlug: f.packageSlug || slugify(e.target.value),
                  }));
                }}
                placeholder="Professional"
                required
              />
              <Input
                label="Slug"
                value={form.packageSlug}
                onChange={(e) => setForm((f) => ({ ...f, packageSlug: e.target.value }))}
                placeholder="professional"
              />
              <Textarea
                label="คำอธิบาย"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder=""
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="ราคา (บาท)"
                  type="number"
                  min={0}
                  value={form.price || ""}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                />
                <div>
                  <label className="block text-sm font-medium text-mauve-700 mb-1">ระยะเวลาบิล</label>
                  <select
                    value={form.billingPeriod}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        billingPeriod: e.target.value as "monthly" | "yearly",
                      }))
                    }
                    className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm"
                  >
                    <option value="monthly">รายเดือน</option>
                    <option value="yearly">รายปี</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="คำถามรวม"
                  type="number"
                  min={0}
                  value={form.conversationsIncluded || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, conversationsIncluded: Number(e.target.value) || 0 }))
                  }
                />
                <Input
                  label="สาขาสูงสุด"
                  type="number"
                  min={1}
                  value={form.maxBranches || ""}
                  onChange={(e) => setForm((f) => ({ ...f, maxBranches: Number(e.target.value) || 1 }))}
                />
                <Input
                  label="ผู้ใช้สูงสุด"
                  type="number"
                  min={1}
                  value={form.maxUsers || ""}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsers: Number(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-mauve-700 mb-2">Features</p>
                <div className="flex flex-wrap gap-3">
                  {FEATURE_KEYS.map((k) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.features[k]}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            features: { ...f.features, [k]: e.target.checked },
                          }))
                        }
                        className="rounded border-cream-300"
                      />
                      <span className="text-sm text-mauve-600">{FEATURE_LABELS[k]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowTopup}
                    onChange={(e) => setForm((f) => ({ ...f, allowTopup: e.target.checked }))}
                    className="rounded border-cream-300"
                  />
                  <span className="text-sm text-mauve-600">อนุญาต Top-up</span>
                </label>
                {form.allowTopup && (
                  <Input
                    label="ราคา/100 คำถาม"
                    type="number"
                    min={0}
                    value={form.topupPricePer100 || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, topupPricePer100: Number(e.target.value) || 0 }))
                    }
                    className="w-32"
                  />
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" variant="primary" loading={saving}>
                  บันทึก
                </Button>
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  ยกเลิก
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 rounded-2xl bg-mauve-800 px-4 py-2 font-body text-sm text-white shadow-luxury"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
