"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { useToast } from "@/components/ui/Toast";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

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
    aiBlocked?: boolean;
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

interface PhaseIBillingPlanResponse {
  plan?: string;
  plan_name?: string;
  status?: string;
  billing_period?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  next_billing_date?: string;
}

interface PhaseIBillingUsageResponse {
  tokens_used?: number;
  tokens_remaining?: number;
  tokens_total?: number;
  usage_percent?: number;
  billing_period?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  next_billing_date?: string;
}

interface PhaseIBillingSubscriptionResponse {
  status?: string;
  plan?: string;
  plan_name?: string;
  next_billing_date?: string;
  billing_period_end?: string;
}

export function BillingSection() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
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
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [phaseIPlan, setPhaseIPlan] = useState<PhaseIBillingPlanResponse | null>(null);
  const [phaseIUsage, setPhaseIUsage] = useState<PhaseIBillingUsageResponse | null>(null);
  const [phaseISubscription, setPhaseISubscription] =
    useState<PhaseIBillingSubscriptionResponse | null>(null);
  const [phaseILoading, setPhaseILoading] = useState(true);
  const [phaseIError, setPhaseIError] = useState<string | null>(null);
  const [phaseIRetryKey, setPhaseIRetryKey] = useState(0);
  const [topupLoading, setTopupLoading] = useState(false);

  const fetchData = useCallback(() => {
    return fetch("/api/clinic/subscription")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const fetchPhaseIData = useCallback(async () => {
    setPhaseILoading(true);
    setPhaseIError(null);
    try {
      const [planRes, usageRes, subRes] = await Promise.allSettled([
        fetch("/api/billing/plan", { method: "GET", credentials: "include" }),
        fetch("/api/billing/usage", { method: "GET", credentials: "include" }),
        fetch("/api/billing/subscription", { method: "GET", credentials: "include" }),
      ]);

      let hasAtLeastOneSuccess = false;
      let hasAnyFailure = false;

      if (planRes.status === "fulfilled" && planRes.value.ok) {
        const json = (await planRes.value.json().catch(() => ({}))) as PhaseIBillingPlanResponse;
        setPhaseIPlan(json);
        hasAtLeastOneSuccess = true;
      } else {
        setPhaseIPlan(null);
        hasAnyFailure = true;
      }

      if (usageRes.status === "fulfilled" && usageRes.value.ok) {
        const json = (await usageRes.value.json().catch(() => ({}))) as PhaseIBillingUsageResponse;
        setPhaseIUsage(json);
        hasAtLeastOneSuccess = true;
      } else {
        setPhaseIUsage(null);
        hasAnyFailure = true;
      }

      if (subRes.status === "fulfilled" && subRes.value.ok) {
        const json = (await subRes.value.json().catch(() => ({}))) as PhaseIBillingSubscriptionResponse;
        setPhaseISubscription(json);
        hasAtLeastOneSuccess = true;
      } else {
        setPhaseISubscription(null);
        hasAnyFailure = true;
      }

      if (!hasAtLeastOneSuccess) {
        setPhaseIError("ไม่สามารถเชื่อมต่อข้อมูล Phase I ได้");
      } else if (hasAnyFailure) {
        setPhaseIError("ข้อมูล Phase I บางส่วนอาจไม่ครบถ้วน");
      }
    } catch {
      setPhaseIPlan(null);
      setPhaseIUsage(null);
      setPhaseISubscription(null);
      setPhaseIError("ไม่สามารถเชื่อมต่อข้อมูล Phase I ได้");
    } finally {
      setPhaseILoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhaseIData();
  }, [fetchPhaseIData, phaseIRetryKey]);

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
        addToast({ title: "อัปเกรดสำเร็จ", message: "ระบบอัปเดตแพ็กเกจเรียบร้อยแล้ว", variant: "success" });
        setTimeout(() => setUpgradeSuccess(false), 5000);
      } else {
        addToast({ title: json.error || "เกิดข้อผิดพลาด", variant: "error" });
        setCheckoutPlan(null);
      }
    } catch {
      addToast({ title: "เกิดข้อผิดพลาด", message: "ไม่สามารถดำเนินการอัปเกรดได้", variant: "error" });
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

  async function handleUnblockAi() {
    setUnblockLoading(true);
    try {
      const res = await fetch("/api/clinic/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiBlocked: false }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        addToast({ title: "ปลดบล็อก AI สำเร็จ", variant: "success" });
        fetchData();
      } else {
        addToast({ title: json.error ?? "ไม่สำเร็จ", variant: "error" });
      }
    } catch {
      addToast({ title: "เกิดข้อผิดพลาด", variant: "error" });
    } finally {
      setUnblockLoading(false);
    }
  }

  async function handleTopUpCredits() {
    setTopupLoading(true);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        addToast({ title: json?.message ?? "Top up request submitted", variant: "success" });
        setPhaseIRetryKey((k) => k + 1);
      } else {
        addToast({ title: json?.error ?? "ไม่สามารถเติมเครดิตได้", variant: "error" });
      }
    } catch {
      addToast({ title: "เกิดข้อผิดพลาดในการเติมเครดิต", variant: "error" });
    } finally {
      setTopupLoading(false);
    }
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
  const phaseILive = !!(phaseIPlan || phaseIUsage || phaseISubscription);
  const phaseIPlanName =
    phaseIPlan?.plan_name ??
    phaseIPlan?.plan ??
    phaseISubscription?.plan_name ??
    phaseISubscription?.plan ??
    null;
  const phaseIStatus =
    phaseISubscription?.status ??
    phaseIPlan?.status ??
    null;
  const phaseINextBillingDate =
    phaseIUsage?.next_billing_date ??
    phaseISubscription?.next_billing_date ??
    phaseISubscription?.billing_period_end ??
    phaseIPlan?.next_billing_date ??
    phaseIPlan?.billing_period_end ??
    null;
  const phaseIBillingPeriod =
    phaseIUsage?.billing_period ??
    phaseIPlan?.billing_period ??
    (phaseIUsage?.billing_period_start && phaseIUsage?.billing_period_end
      ? `${new Date(phaseIUsage.billing_period_start).toLocaleDateString("th-TH")} - ${new Date(phaseIUsage.billing_period_end).toLocaleDateString("th-TH")}`
      : null) ??
    (phaseIPlan?.billing_period_start && phaseIPlan?.billing_period_end
      ? `${new Date(phaseIPlan.billing_period_start).toLocaleDateString("th-TH")} - ${new Date(phaseIPlan.billing_period_end).toLocaleDateString("th-TH")}`
      : null);
  const tokensUsed = Math.max(0, phaseIUsage?.tokens_used ?? 0);
  const tokensRemaining = Math.max(0, phaseIUsage?.tokens_remaining ?? 0);
  const tokensTotalRaw =
    phaseIUsage?.tokens_total ??
    (tokensUsed + tokensRemaining > 0 ? tokensUsed + tokensRemaining : 0);
  const tokensTotal = Math.max(0, tokensTotalRaw);
  const usagePct =
    typeof phaseIUsage?.usage_percent === "number"
      ? Math.max(0, Math.min(100, phaseIUsage.usage_percent))
      : tokensTotal > 0
        ? Math.max(0, Math.min(100, Math.round((tokensUsed / tokensTotal) * 100)))
        : 0;
  const phaseISubscriptionOutOfSync =
    !!phaseISubscription?.status &&
    !!data?.subscription?.status &&
    phaseISubscription.status !== data.subscription.status;

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
      {phaseISubscriptionOutOfSync && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <span className="inline-flex items-center gap-2">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Subscription data may be out of sync
          </span>
        </div>
      )}

      <Card padding="lg">
        <CardHeader
          title="AI Usage & Credits"
          subtitle="ข้อมูลแผนและเครดิตจาก Phase I"
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {phaseILive && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Phase I Live
            </span>
          )}
          {phaseIStatus && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                phaseIStatus === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-surface-200 text-surface-600"
              }`}
            >
              {phaseIStatus === "active" ? "active" : "inactive"}
            </span>
          )}
        </div>

        {phaseILoading ? (
          <div aria-label="Loading Phase I billing data" className="space-y-3">
            <div className="h-4 w-48 rounded bg-surface-200 animate-pulse" />
            <div className="h-3 w-full rounded bg-surface-200 animate-pulse" />
            <div className="h-4 w-64 rounded bg-surface-200 animate-pulse" />
          </div>
        ) : phaseIError && !phaseILive ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{phaseIError}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              aria-label="Retry Phase I billing fetch"
              onClick={() => setPhaseIRetryKey((k) => k + 1)}
            >
              Retry
            </Button>
          </div>
        ) : !phaseILive ? (
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
            <p className="text-sm text-surface-500">ยังไม่มีข้อมูล Phase I</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              aria-label="Retry loading Phase I billing data"
              onClick={() => setPhaseIRetryKey((k) => k + 1)}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {phaseIError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {phaseIError}
              </div>
            )}
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-surface-500">Current plan</p>
                  <p className="text-base font-semibold text-surface-900">
                    {phaseIPlanName ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-surface-500">Billing period</p>
                  <p className="text-sm font-medium text-surface-800">{phaseIBillingPeriod ?? "—"}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-surface-600">
                  <span>Tokens used: {tokensUsed.toLocaleString("th-TH")}</span>
                  <span>Remaining: {tokensRemaining.toLocaleString("th-TH")}</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-200"
                  aria-label="Token usage progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={tokensTotal > 0 ? tokensTotal : 100}
                  aria-valuenow={tokensUsed}
                >
                  <div
                    className="h-full rounded-full bg-rg-500 transition-all duration-500"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-surface-500">
                  {tokensTotal > 0
                    ? `${tokensUsed.toLocaleString("th-TH")} / ${tokensTotal.toLocaleString("th-TH")} tokens (${usagePct}%)`
                    : "ไม่มีข้อมูลโควต้าโทเคน"}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-surface-500">
                  Next billing date:{" "}
                  {phaseINextBillingDate
                    ? new Date(phaseINextBillingDate).toLocaleDateString("th-TH")
                    : "—"}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={topupLoading}
                  aria-label="Top Up Credits"
                  onClick={handleTopUpCredits}
                >
                  Top Up Credits
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Phase 11 — AI Blocked: ปุ่มปลดบล็อก */}
      {data?.subscription?.aiBlocked === true && (
        <div className="mb-4 p-4 rounded-xl bg-[var(--ent-warning-soft)] border border-[var(--ent-warning)] text-[var(--ent-warning)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">บริการ AI ถูกระงับ (โควต้าเกิน)</p>
              <p className="text-sm mt-1 opacity-90">
                โควต้า AI หมดแล้ว — ปลดบล็อกเพื่อเปิดใช้งาน AI ใหม่
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={unblockLoading}
              disabled={unblockLoading}
              onClick={handleUnblockAi}
              className="border-[var(--ent-warning)] text-[var(--ent-warning)] hover:bg-[var(--ent-warning-soft)]"
            >
              ปลดบล็อก AI
            </Button>
          </div>
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
                    <p className="mt-2 text-xs text-surface-500">แพ็กเกจนี้ยังไม่พร้อมสำหรับการเปลี่ยนแผนอัตโนมัติ กรุณาติดต่อทีมดูแล</p>
                  )}
                </div>
              );
            })}
        </div>

        {/* FE-6 — Add-on: แสดงเฉพาะเมื่อ backend เปิด */}
        {addOnEnabled && (
          <div className="mt-6 pt-6 border-t border-surface-100">
            <h3 className="text-sm font-semibold text-surface-800 mb-2">Add-on</h3>
            <p className="text-sm text-surface-500">จัดการ Add-on ผ่านทีมดูแลลูกค้าเพื่อความถูกต้องของสัญญาและการคิดค่าบริการ</p>
          </div>
        )}
      </Card>
    </section>
  );
}
