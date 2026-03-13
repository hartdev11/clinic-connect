"use client";

import useSWR from "swr";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

export default function FranchiseRequestsPage() {
  const { data, error, isLoading, mutate } = useSWR<{
    success?: boolean;
    requests?: Array<{
      id: string;
      sub_name: string;
      sub_address?: string;
      sub_phone?: string;
      sub_email: string;
      status: string;
      createdAt: string;
    }>;
  }>("/api/clinic/franchise/requests", fetcher, { revalidateOnFocus: true });

  const isMain = data?.success === true;
  const requests = data?.requests ?? [];
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const handleApprove = async (requestId: string, approve: boolean) => {
    const res = await fetch("/api/auth/franchise-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ requestId, approve }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error ?? "ดำเนินการไม่สำเร็จ");
      return;
    }
    mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="คำขอเข้าร่วม Franchise"
          subtitle="จัดการคำขอจากคลินิกที่ต้องการเป็นสาขา"
        />
        <div className="luxury-card p-6">
          <p className="font-body text-sm text-mauve-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }
  if (!isMain) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="คำขอเข้าร่วม Franchise"
          subtitle="จัดการคำขอจากคลินิกที่ต้องการเป็นสาขา"
        />
        <div className="luxury-card p-6">
          <p className="font-body text-sm text-mauve-700">
            เฉพาะสาขาหลักเท่านั้นที่ดูและอนุมัติคำขอเข้าร่วมได้
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="คำขอเข้าร่วม Franchise"
        subtitle="จัดการคำขอจากคลินิกที่ต้องการเป็นสาขา"
      />

      {/* Stats row */}
      {!isLoading && !error && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="รอดำเนินการ"
            value={pendingCount}
            icon={<span>○</span>}
            delay={0}
          />
          <StatCard
            label="อนุมัติแล้ว"
            value={approvedCount}
            icon={<span>✓</span>}
            delay={0.08}
          />
          <StatCard
            label="ปฏิเสธแล้ว"
            value={rejectedCount}
            icon={<span>✕</span>}
            delay={0.16}
          />
        </div>
      )}

      {isLoading && (
        <div className="h-24 flex items-center justify-center font-body text-sm text-mauve-500">
          กำลังโหลด...
        </div>
      )}
      {error && (
        <p className="font-body text-sm text-red-600">
          โหลดข้อมูลไม่สำเร็จ
        </p>
      )}

      {/* Request list */}
      <div className="luxury-card overflow-hidden">
        <div className="px-6 py-5 border-b border-cream-200">
          <h3 className="font-display text-lg font-semibold text-mauve-800">
            คำขอทั้งหมด
          </h3>
        </div>

        <div className="divide-y divide-cream-200">
          {requests.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-6 py-5 hover:bg-cream-50 transition-colors"
            >
              {/* Clinic avatar */}
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rg-100 to-rg-200 flex items-center justify-center text-rg-600 font-display font-semibold flex-shrink-0">
                {req.sub_name?.[0] ?? "?"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-mauve-800 truncate">
                  {req.sub_name}
                </p>
                <p className="font-body text-xs text-mauve-400">
                  {req.sub_email} ·{" "}
                  {new Date(req.createdAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {req.sub_phone && (
                  <p className="font-body text-xs text-mauve-400">{req.sub_phone}</p>
                )}
                {req.sub_address && (
                  <p className="font-body text-xs text-mauve-400 truncate">
                    {req.sub_address}
                  </p>
                )}
              </div>

              {/* Status */}
              <Badge
                variant={
                  req.status === "approved"
                    ? "success"
                    : req.status === "rejected"
                    ? "danger"
                    : "warning"
                }
                dot
                size="sm"
              >
                {req.status === "approved"
                  ? "อนุมัติ"
                  : req.status === "rejected"
                  ? "ปฏิเสธ"
                  : "รอดำเนินการ"}
              </Badge>

              {/* Actions for pending — keep existing handlers */}
              {req.status === "pending" && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => handleApprove(req.id, false)}
                  >
                    ปฏิเสธ
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(req.id, true)}
                  >
                    อนุมัติ
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {(!requests || requests.length === 0) && !isLoading && !error && (
          <EmptyState
            icon={<span className="text-2xl">⬡</span>}
            title="ไม่มีคำขอ"
            description="คำขอเข้าร่วม Franchise จะแสดงที่นี่"
          />
        )}
      </div>
    </div>
  );
}
