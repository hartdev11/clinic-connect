"use client";

import { useState, useCallback, useEffect } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { Coupon, CouponCreate } from "@/types/pricing";

const DISCOUNT_LABELS: Record<string, string> = {
  percentage: "%",
  fixed_amount: "฿",
  free_trial: "วัน",
};

export default function AdminCouponsPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<CouponCreate>({
    couponCode: "",
    discountType: "percentage",
    discountValue: 0,
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    maxTotalUses: 0,
    isActive: true,
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", { credentials: "include" });
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
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreate = () => {
    setForm({
      couponCode: "",
      discountType: "percentage",
      discountValue: 0,
      validFrom: new Date().toISOString().slice(0, 16),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      maxTotalUses: 0,
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: new Date(form.validUntil).toISOString(),
      };
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("สร้างแล้ว");
        setModalOpen(false);
        fetchCoupons();
      } else {
        setToast(data.error ?? "สร้างไม่สำเร็จ");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-mauve-800">คูปอง</h1>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon className="h-5 w-5 mr-1" />
          สร้างคูปอง
        </Button>
      </div>

      {loading ? (
        <div className="luxury-card p-6">
          <div className="h-8 bg-cream-200 animate-pulse rounded" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-cream-100 animate-pulse rounded" />
            ))}
          </div>
        </div>
      ) : (
        <div className="luxury-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50">
                <th className="p-4 text-left font-body text-sm font-medium text-mauve-700">รหัส</th>
                <th className="p-4 text-left font-body text-sm font-medium text-mauve-700">ประเภท</th>
                <th className="p-4 text-left font-body text-sm font-medium text-mauve-700">ค่า</th>
                <th className="p-4 text-left font-body text-sm font-medium text-mauve-700">ใช้แล้ว</th>
                <th className="p-4 text-left font-body text-sm font-medium text-mauve-700">หมดอายุ</th>
                <th className="p-4 text-left font-body text-sm font-medium text-mauve-700">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-cream-100 hover:bg-cream-50/50">
                  <td className="p-4 font-mono text-sm text-mauve-800">{c.couponCode}</td>
                  <td className="p-4 text-sm text-mauve-600">
                    {c.discountType === "percentage"
                      ? "เปอร์เซ็นต์"
                      : c.discountType === "fixed_amount"
                        ? "จำนวนเงิน"
                        : "ทดลองใช้ฟรี"}
                  </td>
                  <td className="p-4 text-sm text-mauve-600">
                    {c.discountValue}
                    {DISCOUNT_LABELS[c.discountType]}
                  </td>
                  <td className="p-4 text-sm text-mauve-600">
                    {c.currentUses}
                    {c.maxTotalUses > 0 ? `/${c.maxTotalUses}` : ""}
                  </td>
                  <td className="p-4 text-sm text-mauve-600">
                    {new Date(c.validUntil).toLocaleDateString("th-TH")}
                  </td>
                  <td className="p-4">
                    <Badge variant={c.isActive ? "default" : "outline"} size="sm">
                      {c.isActive ? "ใช้งาน" : "ปิด"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-12 text-center text-mauve-500">ยังไม่มีคูปอง</div>
          )}
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onKeyDown={(e) => e.key === "Escape" && setModalOpen(false)}
        >
          <div className="luxury-card w-full max-w-md p-6">
            <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">สร้างคูปอง</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="รหัสคูปอง"
                value={form.couponCode}
                onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value.toUpperCase() }))}
                placeholder="SAVE20"
                required
              />
              <div>
                <label className="block text-sm font-medium text-mauve-700 mb-1">ประเภทส่วนลด</label>
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountType: e.target.value as CouponCreate["discountType"],
                    }))
                  }
                  className="w-full rounded-xl border border-cream-200 px-3 py-2 text-sm"
                >
                  <option value="percentage">เปอร์เซ็นต์</option>
                  <option value="fixed_amount">จำนวนเงินคงที่</option>
                  <option value="free_trial">ทดลองใช้ฟรี (วัน)</option>
                </select>
              </div>
              <Input
                label={
                  form.discountType === "percentage"
                    ? "ส่วนลด (%)"
                    : form.discountType === "fixed_amount"
                      ? "ส่วนลด (บาท)"
                      : "จำนวนวัน"
                }
                type="number"
                min={0}
                value={form.discountValue || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountValue: Number(e.target.value) || 0 }))
                }
                required
              />
              <Input
                label="เริ่มต้น"
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
              />
              <Input
                label="หมดอายุ"
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              />
              <Input
                label="จำกัดการใช้งาน (0 = ไม่จำกัด)"
                type="number"
                min={0}
                value={form.maxTotalUses || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxTotalUses: Number(e.target.value) || 0 }))
                }
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-cream-300"
                />
                <span className="text-sm text-mauve-600">ใช้งานได้ทันที</span>
              </label>
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
