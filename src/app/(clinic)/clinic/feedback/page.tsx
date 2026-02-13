"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect — Golden Dataset ย้ายไปอยู่ใน Customers & Chat แทบ tab แล้ว */
export default function FeedbackPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/clinic/customers?tab=feedback");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px] text-surface-500">
      กำลังเปลี่ยนไปยัง Customers & Chat...
    </div>
  );
}
