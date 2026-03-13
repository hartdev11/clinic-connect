"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream-100 relative overflow-hidden">
      {/* Abstract circles — CSS-only */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-rg-100/80 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-rg-200/60 blur-3xl" />
      <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-rg-100/70 blur-2xl" />

      <div className="relative z-10 text-center px-6">
        <h1
          className="font-display text-[12rem] md:text-[14rem] font-light text-rg-200 tracking-tight animate-shimmer"
          style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
        >
          404
        </h1>
        <p className="font-body text-xl text-mauve-600 -mt-8" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
          ไม่พบหน้านี้
        </p>
        <p className="font-body text-sm text-mauve-400 mt-2 mb-8">
          หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบ หรือไม่มีอยู่
        </p>
        <Link href="/clinic">
          <Button variant="primary" size="lg" className="luxury-card shadow-luxury">
            กลับหน้าหลัก
          </Button>
        </Link>
      </div>
    </div>
  );
}
