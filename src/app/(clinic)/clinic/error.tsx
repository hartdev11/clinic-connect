"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function ClinicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        route: typeof window !== "undefined" ? window.location.pathname : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        scope: "clinic",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
      <h2 className="text-xl font-semibold text-surface-800 mb-2">เกิดข้อผิดพลาด</h2>
      <p className="text-surface-600 text-sm mb-6 text-center max-w-md">
        เกิดข้อผิดพลาดในระบบหลังบ้าน กรุณาลองใหม่อีกครั้งหรือรีเฟรชหน้า
      </p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
    </div>
  );
}
