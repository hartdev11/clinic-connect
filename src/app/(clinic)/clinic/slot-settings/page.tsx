"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { SlotSettings } from "@/components/clinic/SlotSettings";

export default function SlotSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าสล็อต"
        subtitle="จัดการเวลาทำการและสล็อตการจองของคลินิก"
      />
      <SlotSettings />
    </div>
  );
}
