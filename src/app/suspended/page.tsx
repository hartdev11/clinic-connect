"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-8">
      <div className="luxury-card max-w-md w-full p-8 text-center">
        <PageHeader
          title="บัญชีถูกระงับชั่วคราว"
          subtitle="องค์กรของคุณถูกระงับโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุนเพื่อขอรายละเอียดเพิ่มเติม"
        />
        <Link
          href="/login"
          className="mt-6 inline-block font-body text-sm text-mauve-600 hover:text-mauve-800 hover:underline"
        >
          ← กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
