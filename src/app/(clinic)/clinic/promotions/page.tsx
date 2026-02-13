"use client";

import useSWR from "swr";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";

export default function PromotionsPage() {
  const { branch_id } = useClinicContext();
  const url = branch_id
    ? `/api/clinic/promotions?branchId=${encodeURIComponent(branch_id)}`
    : "/api/clinic/promotions";
  const { data, error, isLoading } = useSWR<{ items: Array<{
    id: string;
    name: string;
    targetGroup: string;
    agentId?: string;
    status: string;
    endAt: string;
  }> }>(
    url,
    apiFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const items = data?.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions"
        description="สร้างโปรโมชั่นและกำหนดกลุ่มเป้าหมาย — Assign to Agent • Target group • Active/Expired"
      />

      <section>
        <SectionHeader
          title="โปรโมชั่นทั้งหมด"
          description="Assign to agent • กลุ่มเป้าหมาย • Active/Expired"
        />
        <Card padding="lg">
          <CardHeader
            title="โปรโมชั่นทั้งหมด"
            subtitle="Assign to agent • Target group • Active/Expired"
            action={<Button>+ สร้างโปรโมชั่น</Button>}
          />
          {error && (
            <p className="text-sm text-red-600 py-4">{error.message}</p>
          )}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-xl border border-surface-200/80 animate-pulse">
                  <div className="h-4 w-40 bg-surface-200 rounded" />
                  <div className="h-3 w-32 bg-surface-100 rounded mt-2" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && !error && (
            <div className="space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-surface-500 py-4">ยังไม่มีโปรโมชั่น</p>
              ) : (
                items.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-surface-200/80"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium text-surface-900">{p.name}</h3>
                      <p className="text-sm text-surface-500 mt-1">กลุ่มเป้าหมาย: {p.targetGroup} {p.agentId ? `• Agent: ${p.agentId}` : ""}</p>
                      <p className="text-xs text-surface-400 mt-1">หมดอายุ: {new Date(p.endAt).toLocaleDateString("th-TH")}</p>
                    </div>
                    <Badge variant={p.status === "active" ? "success" : "default"} className="flex-shrink-0">{p.status}</Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionHeader title="สร้างโปรโมชั่นใหม่" description="กรอกข้อมูลโปรโมชั่น" />
        <Card padding="lg">
          <CardHeader title="สร้างโปรโมชั่นใหม่" subtitle="กรอกข้อมูลโปรโมชั่น" />
          <div className="space-y-4 max-w-md">
            <input
              type="text"
              placeholder="ชื่อโปรโมชั่น"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
            <select className="w-full px-4 py-3 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
              <option>Assign to Agent โปรโมชั่น</option>
            </select>
            <select className="w-full px-4 py-3 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
              <option>กลุ่มเป้าหมาย: ลูกค้าใหม่</option>
              <option>ลูกค้าปัจจุบัน</option>
              <option>ทุกคน</option>
            </select>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
            <Button>บันทึก</Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
