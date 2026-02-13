"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { SlotSettings } from "@/components/clinic/SlotSettings";

export default function SlotSettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="การตั้งค่าคิวและสล็อต"
        description="เวลาทำการสาขา ตารางแพทย์ วันปิด — ควบคุม slot ว่างสำหรับการจองแบบ Enterprise"
        aiAnalyze
      />
      <SlotSettings />
    </div>
  );
}
