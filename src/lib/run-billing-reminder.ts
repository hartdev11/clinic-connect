/**
 * Phase 18 — Billing reminder logic
 * ดึง orgs ที่ subscription.current_period_end อยู่ใน 3 วันข้างหน้า
 * ส่ง email + สร้าง notification
 */
import { db } from "@/lib/firebase-admin";
import { getUsersByOrgId } from "@/lib/clinic-data";
import { sendBillingReminderEmail } from "@/lib/email";
import {
  getBangkokDateKey,
  dateKeyToISOStart,
  dateKeyToISOEnd,
} from "@/lib/timezone";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";

export interface BillingReminderSummary {
  checked: number;
  reminded: number;
  errors: string[];
}

export async function runBillingReminder(): Promise<BillingReminderSummary> {
  const today = getBangkokDateKey(0);
  const endDate = getBangkokDateKey(3);
  const rangeStart = dateKeyToISOStart(today);
  const rangeEnd = dateKeyToISOEnd(endDate);

  const snap = await db
    .collection("subscriptions")
    .where("status", "==", "active")
    .where("current_period_end", ">=", rangeStart)
    .where("current_period_end", "<=", rangeEnd)
    .get();

  const summary: BillingReminderSummary = { checked: snap.size, reminded: 0, errors: [] };

  for (const doc of snap.docs) {
    const d = doc.data();
    const orgId = d.org_id as string;
    const periodEnd = (d.current_period_end as string) || "";

    if (!orgId) continue;

    const periodDate = periodEnd.slice(0, 10);
    const todayDate = new Date(today + "T12:00:00Z");
    const periodEndDate = new Date(periodDate + "T12:00:00Z");
    const diffMs = periodEndDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    const daysUntil = Math.max(1, Math.min(3, diffDays));

    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgName = (orgDoc.data()?.name as string) || "คลินิก";

    const users = await getUsersByOrgId(orgId);
    const owners = users.filter((u) => u.role === "owner" && u.email);
    const toEmail = owners[0]?.email;
    if (!toEmail) {
      summary.errors.push(`Org ${orgId}: no owner email`);
      continue;
    }

    const billingUrl = `${APP_URL.replace(/\/$/, "")}/clinic/settings?tab=billing`;
    const periodEndFormatted = new Date(periodEnd).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const { success, error } = await sendBillingReminderEmail({
      to: toEmail,
      orgName,
      daysUntilDue: daysUntil,
      periodEndDate: periodEndFormatted,
      billingUrl,
    });

    if (!success) {
      summary.errors.push(`Org ${orgId}: ${error ?? "email failed"}`);
      continue;
    }

    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("organizations").doc(orgId).collection("notifications").add({
      type: "billing_reminder",
      severity: "warning",
      title: "การชำระเงินจะครบกำหนด",
      message: `การชำระเงินจะครบกำหนดใน ${daysUntil} วัน (${periodEndFormatted})`,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });

    summary.reminded++;
  }

  return summary;
}
