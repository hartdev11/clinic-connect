"use client";

import useSWR from "swr";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";
import { useClinicContext } from "@/contexts/ClinicContext";
import { apiFetcher } from "@/lib/api-fetcher";

type FinanceResponse = {
  revenueThisMonth: number;
  revenueLastMonth: number;
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    serviceName?: string;
    createdAt: string;
  }>;
  byService?: Array<{ name: string; revenue: number }>;
};

export default function FinancePage() {
  const { branch_id } = useClinicContext();
  const url = branch_id
    ? `/api/clinic/finance?branchId=${encodeURIComponent(branch_id)}`
    : "/api/clinic/finance";
  const { data, error, isLoading } = useSWR<FinanceResponse>(url, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const revenueThisMonth = data?.revenueThisMonth ?? 0;
  const revenueLastMonth = data?.revenueLastMonth ?? 0;
  const revenueLast = revenueLastMonth || 1;
  const change = ((revenueThisMonth - revenueLastMonth) / revenueLast) * 100;

  const byServiceList = data?.byService ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="รายได้และรายงานทางการเงิน — AI ใช้ข้อมูลส่วนนี้วิเคราะห์และส่งสรุปไป LINE คลินิก"
        aiAnalyze
      />

      <RequireRole
        allowed={["owner", "manager"]}
        fallback={
          <Card padding="lg" className="border-amber-200 bg-amber-50/50">
            <p className="text-amber-800 font-medium">🔒 Finance — จำกัดสิทธิ์เฉพาะ Owner / Manager</p>
            <p className="text-sm text-amber-700 mt-1">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </Card>
        }
      >
        <section>
        <SectionHeader
          title="Revenue Summary"
          description="รายได้รวม — เลือกช่วงเวลาได้"
        />
        <Card padding="lg" className="mb-6">
          <CardHeader title="Revenue Summary" subtitle="รายได้รวม" />
          {error && (
            <p className="text-sm text-red-600 py-4">{error.message}</p>
          )}
          {isLoading && (
            <div className="h-20 animate-pulse bg-surface-100 rounded-xl" />
          )}
          {!isLoading && !error && (
            <>
              <div className="flex flex-wrap items-end gap-8">
                <div>
                  <p className="text-sm text-surface-500">เดือนนี้</p>
                  <p className="text-3xl font-bold text-surface-900 mt-1">฿{revenueThisMonth.toLocaleString()}</p>
                  <p className={`text-sm mt-2 font-medium ${change >= 0 ? "text-primary-600" : "text-red-600"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(1)}% เทียบเดือนที่แล้ว
                  </p>
                </div>
                <div>
                  <p className="text-sm text-surface-500">เดือนที่แล้ว</p>
                  <p className="text-xl text-surface-600 mt-1">฿{revenueLastMonth.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-6">
                <select className="px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
                  <option>เดือนนี้</option>
                  <option>3 เดือนล่าสุด</option>
                  <option>ปีนี้</option>
                </select>
              </div>
            </>
          )}
        </Card>
      </section>

      <section>
        <SectionHeader
          title="แยกตามบริการ"
          description="รายได้แยกตามบริการ (จากรายการล่าสุด)"
        />
        <div className="grid md:grid-cols-2 gap-6">
          <Card padding="lg">
            <CardHeader title="รายการล่าสุด" subtitle="Transactions" />
            {!isLoading && !error && (
              <div className="space-y-3">
                {(data?.transactions ?? []).length === 0 ? (
                  <p className="text-sm text-surface-500 py-2">ยังไม่มีรายการ</p>
                ) : (
                  (data?.transactions ?? []).slice(0, 10).map((t) => (
                    <div key={t.id} className="flex justify-between items-center py-2 border-b border-surface-100 last:border-0 text-sm">
                      <span className="text-surface-700">{t.serviceName || "—"}</span>
                      <span className="font-semibold text-surface-900">฿{t.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
          <Card padding="lg">
            <CardHeader title="Booking → Revenue" subtitle="รายได้แยกตามบริการ" />
            <div className="space-y-3">
              {byServiceList.length === 0 && !isLoading ? (
                <p className="text-sm text-surface-500 py-2">ยังไม่มีข้อมูล</p>
              ) : (
                byServiceList.map((s) => (
                  <div key={s.name} className="flex justify-between items-center py-2 border-b border-surface-100 last:border-0">
                    <span className="text-surface-700 text-sm">{s.name}</span>
                    <span className="font-semibold text-surface-900">฿{s.revenue.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
      </RequireRole>
    </div>
  );
}
