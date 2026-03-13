"use client";

import { useEffect, useState } from "react";
interface SubData {
  subscription: {
    status: string;
    aiBlocked?: boolean;
  } | null;
}

export function FailedPaymentBanner() {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/clinic/subscription", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const status = data?.subscription?.status;
  const aiBlocked = data?.subscription?.aiBlocked === true;
  const showPastDueBanner = status === "past_due" || status === "unpaid";
  const showAiBlockedBanner = aiBlocked;

  if (loading) return null;

  // past_due / unpaid → ent-danger
  if (showPastDueBanner) {

  const handleUpdatePayment = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/clinic/billing-portal", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        window.location.href = "/clinic/settings?tab=billing";
      }
    } catch {
      window.location.href = "/clinic/settings?tab=billing";
    } finally {
      setPortalLoading(false);
    }
  };

    return (
      <div className="sticky top-0 z-50 w-full bg-[var(--ent-danger)] text-cream-50 px-4 py-3 flex items-center justify-center gap-4 flex-wrap">
        <span className="font-body text-sm font-medium">
          ⚠️ การชำระเงินล้มเหลว กรุณาอัพเดทข้อมูลการชำระเงิน
        </span>
        <button
          type="button"
          onClick={handleUpdatePayment}
          disabled={portalLoading}
          className="font-body text-sm font-semibold text-cream-50 underline hover:no-underline decoration-2 underline-offset-2 disabled:opacity-70"
        >
          {portalLoading ? "กำลังโหลด..." : "อัพเดทเลย →"}
        </button>
      </div>
    );
  }

  // aiBlocked → ent-warning
  if (showAiBlockedBanner) {
    return (
      <div className="sticky top-0 z-50 w-full bg-[var(--ent-warning)] text-mauve-900 px-4 py-3 flex items-center justify-center gap-4 flex-wrap">
        <span className="font-body text-sm font-medium">
          ⚠️ บริการ AI ถูกระงับ (โควต้าเกิน) — กรุณาปลดบล็อกที่ Settings
        </span>
        <a
          href="/clinic/settings?tab=billing"
          className="font-body text-sm font-semibold text-mauve-900 underline hover:no-underline decoration-2 underline-offset-2"
        >
          ไปที่ Settings →
        </a>
      </div>
    );
  }

  return null;
}
