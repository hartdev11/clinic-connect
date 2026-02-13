"use client";

import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { BillingSection } from "@/components/clinic/BillingSection";
import { OrganizationSettings } from "@/components/clinic/OrganizationSettings";
import { BranchManagement } from "@/components/clinic/BranchManagement";
import { LineConnectionSettings } from "@/components/clinic/LineConnectionSettings";
import { RequireRole } from "@/components/rbac/RequireRole";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Clinic Settings"
        description="จัดการข้อมูลคลินิก — โปรไฟล์ สาขา บริการและราคา เวลาทำการ"
      />

      <RequireRole allowed={["owner"]}>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-surface-100" />}>
          <BillingSection />
        </Suspense>
      </RequireRole>

      <OrganizationSettings />

      <LineConnectionSettings />

      <BranchManagement />

      <section>
        <SectionHeader title="Services & Pricing" description="บริการและราคา" />
        <Card padding="lg">
          <CardHeader title="Services & Pricing" subtitle="บริการและราคา" />
          <div className="space-y-3">
            {[
              { name: "เลเซอร์กำจัดขน", price: "2,500" },
              { name: "ฟิลเลอร์", price: "8,000" },
              { name: "โบท็อกซ์", price: "6,000" },
            ].map((s, i) => (
              <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-surface-50 border border-surface-100">
                <span className="text-surface-700 text-sm">{s.name}</span>
                <span className="font-semibold text-surface-900">฿{s.price}</span>
              </div>
            ))}
            <Button variant="outline" size="sm">+ เพิ่มบริการ</Button>
          </div>
        </Card>
      </section>

    </div>
  );
}
