"use client";

import { useEffect, useMemo } from "react";

type ErrorWithDigest = Error & { digest?: string };

function inferStatus(error: ErrorWithDigest): 404 | 500 {
  const message = `${error.message ?? ""} ${error.digest ?? ""}`.toLowerCase();
  if (message.includes("404") || message.includes("not found") || message.includes("not_found")) {
    return 404;
  }
  return 500;
}

export default function AgencyError({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  const status = useMemo(() => inferStatus(error), [error]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[agency:error-boundary]", error);
    }
  }, [error]);

  const isNotFound = status === 404;

  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center px-6 py-12 text-center">
      <h2 className="text-xl font-semibold text-surface-800">
        {isNotFound ? "ไม่พบหน้าของเอเจนซี" : "เกิดข้อผิดพลาดในส่วนเอเจนซี"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-surface-600">
        {isNotFound
          ? "ไม่พบหน้าหรือข้อมูลเอเจนซีที่ต้องการ กรุณาตรวจสอบลิงก์อีกครั้ง"
          : "ระบบเอเจนซีเกิดปัญหาชั่วคราว กรุณากดลองใหม่เพื่อโหลดข้อมูลอีกครั้ง"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center rounded-lg bg-surface-900 px-4 py-2 text-sm font-medium text-white hover:bg-surface-800"
      >
        ลองใหม่
      </button>
    </div>
  );
}
