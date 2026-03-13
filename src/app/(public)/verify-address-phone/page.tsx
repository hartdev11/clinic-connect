/**
 * Enterprise: หน้าเปิดลิงก์ยืนยันที่อยู่/โทร — redirect ไป API แล้วไป /login
 */
import { redirect } from "next/navigation";

export default async function VerifyAddressPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect("/login?error=invalid_address_phone_token");
  }
  redirect(`/api/public/verify-address-phone?token=${encodeURIComponent(token)}`);
}
