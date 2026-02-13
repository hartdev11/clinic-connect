"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/layout/SectionHeader";

const PLAN_ORDER: Record<string, number> = {
  starter: 0,
  professional: 1,
  multi_branch: 2,
  enterprise: 3,
};

interface SubscriptionData {
  subscription: {
    plan: string;
    planName: string;
    status: string;
    maxBranches: number;
    currentPeriodEnd: string;
  } | null;
  plans: { id: string; name: string; maxBranches: number; hasPrice: boolean }[];
  fairUse?: {
    warning: boolean;
    softBlock: boolean;
    usagePercent: number;
    currentBranches: number;
    maxBranches: number;
  };
  addOnEnabled?: boolean;
}

interface ProrationPreview {
  prorationAmount: number;
  currency: string;
  amountDue?: number;
}

export function BillingSection() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [prorationPlan, setProrationPlan] = useState<string | null>(null);
  const [prorationPreview, setProrationPreview] = useState<ProrationPreview | null>(null);
  const [prorationLoading, setProrationLoading] = useState(false);
  const checkoutStatus = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");
  const [verifiedStatus, setVerifiedStatus] = useState<"success" | "pending" | "failed" | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const fetchData = useCallback(() => {
    return fetch("/api/clinic/subscription")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // FE-7 — ยืนยัน transaction จาก backend (ไม่ถือ logic การเงินเอง)
  useEffect(() => {
    if (checkoutStatus !== "success" || !sessionId) return;
    setVerifyLoading(true);
    setVerifiedStatus(null);
    fetch(`/api/clinic/checkout/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((json) => {
        setVerifiedStatus(json.status ?? "failed");
        if (json.status === "success") {
          fetchData();
        }
      })
      .catch(() => setVerifiedStatus("failed"))
      .finally(() => setVerifyLoading(false));
  }, [checkoutStatus, sessionId, fetchData]);

  async function fetchProrationPreview(plan: string) {
    setProrationPlan(plan);
    setProrationLoading(true);
    setProrationPreview(null);
    try {
      const r = await fetch(`/api/clinic/checkout/preview?plan=${encodeURIComponent(plan)}`);
      const json = await r.json();
      if (r.ok && (json.prorationAmount != null || json.amountDue != null)) {
        setProrationPreview({
          prorationAmount: json.prorationAmount ?? json.amountDue ?? 0,
          currency: json.currency ?? "thb",
          amountDue: json.amountDue,
        });
      } else {
        setProrationPreview(null);
      }
    } catch {
      setProrationPreview(null);
    } finally {
      setProrationLoading(false);
    }
  }

  function formatCurrency(amount: number, currency: string): string {
    if (currency === "thb" || currency === "THB") return `฿${(amount / 100).toLocaleString("th-TH")}`;
    return `${amount} ${currency}`;
  }

  async function handleSubscribe(plan: string) {
    setCheckoutPlan(plan);
    try {
      const res = await fetch("/api/clinic/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else if (json.upgraded) {
        setUpgradeSuccess(true);
        setData(null);
        fetchData().catch(() => {});
        setCheckoutPlan(null);
        setProrationPreview(null);
        setProrationPlan(null);
        setTimeout(() => setUpgradeSuccess(false), 5000);
      } else {
        alert(json.error || "เกิดข้อผิดพลาด");
        setCheckoutPlan(null);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด");
      setCheckoutPlan(null);
    }
  }

  function handleUpgradeClick(plan: string) {
    const hasActive = !!data?.subscription && data.subscription.status === "active";
    if (hasActive) {
      fetchProrationPreview(plan);
    } else {
      handleSubscribe(plan);
    }
  }

  function confirmUpgradeWithProration(plan: string) {
    handleSubscribe(plan);
  }

  if (loading) {
    return (
      <section>
        <SectionHeader title="Billing & Subscription" description="แผนและค่าบริการรายเดือน" />
        <Card padding="lg">
          <p className="text-surface-500 text-sm">กำลังโหลด...</p>
        </Card>
      </section>
    );
  }

  const currentPlan = data?.subscription?.plan ?? "starter";
  const hasActiveSubscription = !!data?.subscription && data.subscription.status === "active";
  const fairUse = data?.fairUse;
  const addOnEnabled = data?.addOnEnabled ?? false;

  const isUpgrade = (planId: string) =>
    hasActiveSubscription && PLAN_ORDER[planId] > (PLAN_ORDER[currentPlan] ?? 0);
  const isDowngrade = (planId: string) =>
    hasActiveSubscription && PLAN_ORDER[planId] < (PLAN_ORDER[currentPlan] ?? 0);

  return (
    <section>
      <SectionHeader title="Billing & Subscription" description="แผนและค่าบริการรายเดือน" />
      {/* FE-7 — แสดงสถานะจาก backend verify (success | pending | failed) */}
      {checkoutStatus === "success" && sessionId && (
        <>
          {verifyLoading && (
            <div className="mb-4 p-4 rounded-xl bg-surface-50 border border-surface-200 text-surface-600 text-sm">
              กำลังตรวจสอบสถานะการชำระเงิน...
            </div>
          )}
          {!verifyLoading && verifiedStatus === "success" && (
            <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
              ชำระเงินสำเร็จ — แผนของคุณได้รับการอัปเดตแล้ว
            </div>
          )}
          {!verifyLoading && verifiedStatus === "pending" && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              รอการชำระเงิน — กำลังดำเนินการ กรุณารอสักครู่หรือ refresh หน้า
            </div>
          )}
          {!verifyLoading && verifiedStatus === "failed" && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              การชำระเงินไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง
            </div>
          )}
        </>
      )}
      {checkoutStatus === "success" && !sessionId && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          ชำระเงินสำเร็จ — แผนของคุณได้รับการอัปเดตแล้ว
        </div>
      )}
      {checkoutStatus === "cancelled" && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          ยกเลิกการชำระเงิน
        </div>
      )}
      {checkoutStatus === "pending" && !sessionId && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          รอการชำระเงิน — กรุณารอสักครู่แล้ว refresh หน้า
        </div>
      )}
      {checkoutStatus === "failed" && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          การชำระเงินไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง
        </div>
      )}
      {upgradeSuccess && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          อัปเกรดสำเร็จ — Stripe จะคิดเงินส่วนต่าง (proration) ทันที
        </div>
      )}

      {/* FE-6 — Fair Use: แสดง warning (ไม่ block UI) */}
      {fairUse?.warning && (
        <div
          className={`mb-4 p-4 rounded-xl border text-sm ${
            fairUse.softBlock
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-amber-50/70 border-amber-200 text-amber-700"
          }`}
        >
          <p className="font-medium">
            {fairUse.softBlock
              ? "ถึงขีดจำกัดสาขาแล้ว"
              : `การใช้สาขา ${Math.round(fairUse.usagePercent)}% (${fairUse.currentBranches}/${fairUse.maxBranches})`}
          </p>
          <p className="mt-1 text-amber-700">
            {fairUse.softBlock
              ? "ไม่สามารถเพิ่มสาขาได้ กรุณาอัปเกรด plan เพื่อเพิ่มสาขา"
              : "ใกล้ถึงขีดจำกัดแล้ว — พิจารณาอัปเกรด plan"}
          </p>
        </div>
      )}

      <Card padding="lg">
        <CardHeader
          title="Billing & Subscription"
          subtitle={
            data?.subscription
              ? `แผนปัจจุบัน: ${data.subscription.planName} • สาขา ${data.subscription.maxBranches} สาขา (per-branch)`
              : "ยังไม่มี subscription — สมัครเพื่อเปิดใช้ Professional ขึ้นไป"
          }
        />
        {data?.subscription && (
          <div className="mb-6 p-4 rounded-xl bg-surface-50 border border-surface-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-surface-900">{data.subscription.planName}</p>
                <p className="text-sm text-surface-500">
                  สถานะ: {data.subscription.status === "active" ? "ใช้งานอยู่" : data.subscription.status}
                </p>
                {data.subscription.currentPeriodEnd && (
                  <p className="text-xs text-surface-400 mt-1">
                    สิ้นสุดรอบ: {new Date(data.subscription.currentPeriodEnd).toLocaleDateString("th-TH")}
                  </p>
                )}
                {fairUse && (
                  <p className="text-xs text-surface-500 mt-1">
                    สาขา: {fairUse.currentBranches} / {fairUse.maxBranches}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.plans
            .filter((p) => p.id !== "starter")
            .map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const canUpgrade = plan.hasPrice && isUpgrade(plan.id);
              const isDowngradePlan = isDowngrade(plan.id);
              const canSubscribe = plan.hasPrice && !isCurrent && !isDowngradePlan;

              return (
                <div
                  key={plan.id}
                  className={`p-4 rounded-xl border ${
                    isCurrent ? "border-primary-300 bg-primary-50/50" : "border-surface-200"
                  }`}
                >
                  <p className="font-semibold text-surface-900">{plan.name}</p>
                  <p className="text-sm text-surface-500">สูงสุด {plan.maxBranches} สาขา</p>

                  {isCurrent ? (
                    <p className="mt-2 text-sm text-primary-600">แผนปัจจุบัน</p>
                  ) : isDowngradePlan ? (
                    <div className="mt-3">
                      <p className="text-xs text-surface-500">Downgrade — มีผลสิ้นรอบปัจจุบัน</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled
                        className="mt-2 text-surface-400 cursor-not-allowed"
                      >
                        ติดต่อทีมขาย
                      </Button>
                    </div>
                  ) : canUpgrade ? (
                    <div className="mt-3 space-y-2">
                      <Button
                        size="sm"
                        disabled={!!checkoutPlan}
                        loading={checkoutPlan === plan.id}
                        onClick={() => handleUpgradeClick(plan.id)}
                      >
                        อัปเกรด
                      </Button>
                      {prorationPlan === plan.id && (
                        <div className="rounded-lg bg-surface-50 p-3 text-sm">
                          {prorationLoading ? (
                            <p className="text-surface-500">กำลังโหลดประมาณการ...</p>
                          ) : prorationPreview && prorationPreview.prorationAmount > 0 ? (
                            <>
                              <p className="text-surface-700">
                                ส่วนต่าง (proration): {formatCurrency(prorationPreview.prorationAmount, prorationPreview.currency)}
                              </p>
                              <Button
                                size="sm"
                                variant="primary"
                                className="mt-2"
                                disabled={!!checkoutPlan}
                                loading={checkoutPlan === plan.id}
                                onClick={() => confirmUpgradeWithProration(plan.id)}
                              >
                                ยืนยันอัปเกรด
                              </Button>
                              <button
                                type="button"
                                className="ml-2 text-xs text-surface-500 hover:text-surface-700"
                                onClick={() => {
                                  setProrationPlan(null);
                                  setProrationPreview(null);
                                }}
                              >
                                ยกเลิก
                              </button>
                            </>
                          ) : prorationPreview && prorationPreview.prorationAmount === 0 ? (
                            <>
                              <p className="text-surface-600">ไม่มีค่าส่วนต่าง</p>
                              <Button
                                size="sm"
                                variant="primary"
                                className="mt-2"
                                disabled={!!checkoutPlan}
                                loading={checkoutPlan === plan.id}
                                onClick={() => confirmUpgradeWithProration(plan.id)}
                              >
                                ยืนยันอัปเกรด
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              disabled={!!checkoutPlan}
                              loading={checkoutPlan === plan.id}
                              onClick={() => handleSubscribe(plan.id)}
                            >
                              ดำเนินการอัปเกรด
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : canSubscribe ? (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        disabled={!!checkoutPlan}
                        loading={checkoutPlan === plan.id}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        สมัครใช้งาน
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-surface-400">เร็วๆ นี้</p>
                  )}
                </div>
              );
            })}
        </div>

        {/* FE-6 — Add-on: แสดงเฉพาะเมื่อ backend เปิด */}
        {addOnEnabled && (
          <div className="mt-6 pt-6 border-t border-surface-100">
            <h3 className="text-sm font-semibold text-surface-800 mb-2">Add-on</h3>
            <p className="text-sm text-surface-500">เพิ่มเติมเร็วๆ นี้</p>
          </div>
        )}
      </Card>
    </section>
  );
}
