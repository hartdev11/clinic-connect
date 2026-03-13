/**
 * BullMQ worker: 24h booking reminders
 * Fetches booking + customer, builds Thai message, sends via LINE.
 * Run: npx tsx src/worker/booking-reminder-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { getBookingById, getCustomerById, getBranchesByOrgId } from "@/lib/clinic-data";
import { sendLinePushMessage } from "@/lib/booking-notification";
import type { BookingReminderJobData } from "@/lib/booking-reminder-queue";
import { db } from "@/lib/firebase-admin";

const QUEUE_NAME = "booking-reminders";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) {
      const eq = t.indexOf("=");
      if (eq > 0) {
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const REDIS_URL = process.env.REDIS_URL ?? "";
if (!REDIS_URL) {
  console.error("[Booking Reminder Worker] REDIS_URL required");
  process.exit(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildReminderMessage(booking: {
  customerName: string;
  service: string;
  procedure?: string | null;
  scheduledAt: string;
  branchName?: string | null;
}): string {
  const service = booking.procedure || booking.service;
  const date = formatDate(booking.scheduledAt);
  const time = formatTime(booking.scheduledAt);
  const branch = booking.branchName || "—";
  return [
    "สวัสดีค่ะ 😊 ขอเตือนนัดหมายพรุ่งนี้นะคะ",
    "",
    `📅 ${date}`,
    `⏰ ${time}`,
    `💉 ${service}`,
    `📍 ${branch}`,
    "",
    "ถ้าต้องการเปลี่ยนแปลง reply มาได้เลยค่ะ 💕",
  ].join("\n");
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

async function processJob(job: { id: string; data: BookingReminderJobData }): Promise<void> {
  const { bookingId, orgId, lineUserId: jobLineUserId, customerId } = job.data;

  const booking = await getBookingById(orgId, bookingId);
  if (!booking) {
    console.warn("[Booking Reminder] Booking not found:", bookingId);
    return;
  }
  if (["cancelled"].includes(booking.status)) {
    console.log("[Booking Reminder] Booking cancelled, skip:", bookingId);
    return;
  }

  let lineUserId = jobLineUserId ?? booking.chatUserId ?? null;
  if (!lineUserId && customerId) {
    const customer = await getCustomerById(orgId, customerId);
    if (customer?.source === "line" && customer.externalId) {
      lineUserId = customer.externalId;
    }
  }
  if (!lineUserId) {
    console.warn("[Booking Reminder] No LINE user for booking:", bookingId);
    return;
  }

  const branches = await getBranchesByOrgId(orgId);
  const branch = booking.branch_id ? branches.find((b) => b.id === booking.branch_id) : null;
  const branchName = booking.branchName ?? branch?.name ?? "—";

  const text = buildReminderMessage({
    customerName: booking.customerName,
    service: booking.service,
    procedure: booking.procedure,
    scheduledAt: booking.scheduledAt,
    branchName,
  });

  const result = await sendLinePushMessage(orgId, lineUserId, text);
  if (!result.ok) {
    throw new Error(result.error ?? "LINE send failed");
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  await db.collection("bookings").doc(bookingId).update({
    reminder_sent_at: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processJob({ id: job.id ?? "", data: job.data as BookingReminderJobData });
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Booking Reminder Worker] Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[Booking Reminder Worker] Job failed:", job?.id, err?.message);
});

console.log("[Booking Reminder Worker] Started, queue:", QUEUE_NAME);
