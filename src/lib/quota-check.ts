/**
 * Phase 11 — Quota check logic
 * Phase 19 — Use multi-channel notification service
 * Run by quota-check BullMQ worker every hour
 */
import { db } from "@/lib/firebase-admin";
import { getCurrentMonthConversationsUsed } from "@/lib/ai-usage-daily";
import {
  getSubscriptionByOrgId,
  updateSubscriptionAiBlocked,
  updateSubscriptionQuotaWarningSent,
} from "@/lib/clinic-data";
import { PLAN_CONVERSATIONS_LIMIT } from "@/types/subscription";
import type { OrgPlan } from "@/types/organization";
import { getTodayKeyBangkok } from "@/lib/timezone";
import { sendNotification } from "@/lib/notifications/notification-service";

const WARNING_THRESHOLD = 0.8;
const EXCEEDED_THRESHOLD = 1;

export interface QuotaCheckResult {
  orgId: string;
  used: number;
  limit: number;
  percent: number;
  warningSent: boolean;
  exceeded: boolean;
  aiBlockedSet: boolean;
}

export interface QuotaCheckSummary {
  date: string;
  totalOrgs: number;
  warningsSent: number;
  exceededBlocked: number;
  results: QuotaCheckResult[];
}

/** Get all active org ids (subscription status = active) */
async function getActiveOrgIds(): Promise<string[]> {
  const snap = await db
    .collection("subscriptions")
    .where("status", "==", "active")
    .get();
  const orgIds = new Set<string>();
  for (const doc of snap.docs) {
    const orgId = doc.data()?.org_id;
    if (orgId) orgIds.add(orgId);
  }
  return Array.from(orgIds);
}

/** Run quota check for all active orgs */
export async function runQuotaCheck(): Promise<QuotaCheckSummary> {
  const today = getTodayKeyBangkok();
  const orgIds = await getActiveOrgIds();
  const results: QuotaCheckResult[] = [];
  let warningsSent = 0;
  let exceededBlocked = 0;

  for (const orgId of orgIds) {
    const sub = await getSubscriptionByOrgId(orgId);
    if (!sub) continue;
    const plan = sub.plan as OrgPlan;
    const limit = PLAN_CONVERSATIONS_LIMIT[plan] ?? PLAN_CONVERSATIONS_LIMIT.starter;
    if (limit <= 0) continue;

    const used = await getCurrentMonthConversationsUsed(orgId);
    const percent = limit > 0 ? used / limit : 0;
    const warningSentToday = sub.quota_warning_sent_at === today;

    const result: QuotaCheckResult = {
      orgId,
      used,
      limit,
      percent,
      warningSent: false,
      exceeded: false,
      aiBlockedSet: false,
    };

    if (percent >= EXCEEDED_THRESHOLD) {
      result.exceeded = true;
      await updateSubscriptionAiBlocked(sub.id, true);
      result.aiBlockedSet = true;
      exceededBlocked++;

      await sendNotification(orgId, "quota_exceeded", {
        title: "โควต้า AI หมดแล้ว",
        message: `ใช้ครบ ${limit} คำถาม/เดือนแล้ว บริการ AI ถูกระงับชั่วคราว กรุณาติดต่อผู้ดูแลระบบ`,
        severity: "urgent",
        actionUrl: "/clinic/settings",
      }).catch((e) => console.warn("[QuotaCheck] quota_exceeded notify:", (e as Error)?.message?.slice(0, 60)));
    } else if (percent >= WARNING_THRESHOLD && !warningSentToday) {
      result.warningSent = true;
      await updateSubscriptionQuotaWarningSent(sub.id, today);
      warningsSent++;

      await sendNotification(orgId, "quota_warning", {
        title: "โควต้า AI ใกล้เต็ม",
        message: `ใช้ไป ${Math.round(percent * 100)}% (${used}/${limit} คำถาม/เดือน)`,
        severity: "warning",
        actionUrl: "/clinic/settings",
      }).catch((e) => console.warn("[QuotaCheck] quota_warning notify:", (e as Error)?.message?.slice(0, 60)));
    }

    results.push(result);
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  await db
    .collection("global")
    .doc("platform_metrics")
    .collection(today)
    .doc("quota_check")
    .set(
      {
        date: today,
        totalOrgs: orgIds.length,
        warningsSent,
        exceededBlocked,
        results: results.map((r) => ({ orgId: r.orgId, used: r.used, limit: r.limit, percent: r.percent, exceeded: r.exceeded, aiBlockedSet: r.aiBlockedSet })),
        runAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return {
    date: today,
    totalOrgs: orgIds.length,
    warningsSent,
    exceededBlocked,
    results,
  };
}
