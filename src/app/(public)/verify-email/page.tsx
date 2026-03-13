/**
 * Enterprise: หน้าเปิดลิงก์ยืนยันอีเมล — ยืนยันแล้ว redirect ไป /login
 */
import { redirect } from "next/navigation";
import {
  getPurchaseRecordByVerificationToken,
  markEmailVerified,
} from "@/lib/purchase-record";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect("/login?error=missing_token");
  }
  const record = await getPurchaseRecordByVerificationToken(token);
  if (!record) {
    redirect("/login?error=invalid_token");
  }
  if (!record.email_verified) {
    await markEmailVerified(record.id);
  }
  redirect("/login?verified=1");
}
