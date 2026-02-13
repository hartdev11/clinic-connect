"use client";

/**
 * FE-3 — Organization Settings Component
 * org_id, plan แก้ไม่ได้ (readonly)
 */
import { useState, useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { useClinicContext } from "@/contexts/ClinicContext";
import { RequireRole } from "@/components/rbac/RequireRole";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

export function OrganizationSettings() {
  const { currentOrg, org_id } = useClinicContext();
  const { data: profile, mutate } = useSWR<{
    id: string;
    clinicName: string;
    phone: string;
    email: string;
    createdAt: string;
  } | null>("/api/clinic/me", fetcher);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.clinicName,
        phone: profile.phone,
        email: profile.email,
      });
    }
  }, [profile]);

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/clinic/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setSaved(true);
      mutate();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  if (!currentOrg) return null;

  return (
    <section>
      <SectionHeader title="Organization Settings" description="ข้อมูลองค์กร" />
      <Card padding="lg">
        <CardHeader title="Organization Settings" subtitle="ข้อมูลองค์กร" />
        <div className="grid md:grid-cols-2 gap-5 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Organization ID
            </label>
            <Input value={org_id ?? ""} disabled className="bg-surface-50" />
            <p className="text-xs text-surface-400 mt-1">ไม่สามารถแก้ไขได้</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Plan</label>
            <Input value={currentOrg.plan} disabled className="bg-surface-50" />
            <p className="text-xs text-surface-400 mt-1">ไม่สามารถแก้ไขได้ (ดูที่ Billing)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">ชื่อองค์กร</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ชื่อคลินิก"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">เบอร์ติดต่อ</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="02-xxx-xxxx"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-surface-700 mb-1.5">อีเมล</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@clinic.com"
            />
          </div>
          <RequireRole allowed={["owner"]}>
            <div className="md:col-span-2 flex items-center gap-3">
              <Button onClick={handleSave} loading={loading} disabled={loading}>
                บันทึก
              </Button>
              {saved && <p className="text-sm text-green-600">บันทึกสำเร็จ</p>}
            </div>
          </RequireRole>
        </div>
      </Card>
    </section>
  );
}
