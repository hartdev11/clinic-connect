"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Knowledge Control Center — deprecated.
 * Redirect to unified AI Knowledge page.
 */
export default function KnowledgeBrainRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/clinic/knowledge");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-surface-500">กำลังนำคุณไปหน้าจัดการข้อมูลที่ AI ใช้ตอบลูกค้า...</p>
    </div>
  );
}
