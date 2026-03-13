"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-cream-100/80 backdrop-blur-[20px] border-b border-rg-200/40 shadow-luxury"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/login"
            className="flex items-center gap-3 group transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-rg-400 via-rg-500 to-rg-600 text-white font-bold text-lg shadow-md shadow-rg-400/30 transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-rg-400/35">
              ✦
            </span>
            <span className="font-display text-lg font-semibold text-mauve-800">
              Clinic Connect
            </span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rg-50 text-rg-600 border border-rg-200/60 font-body">
              ระบบหลังบ้านคลินิก
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/verify-email"
              className="px-4 py-2 rounded-2xl font-body text-sm font-medium text-mauve-600 hover:text-rg-600 hover:bg-rg-50 border border-cream-300 hover:border-rg-300 transition-all duration-200 inline-flex items-center justify-center"
            >
              ยืนยันอีเมล
            </Link>
            <Link
              href="/packages"
              className="px-5 py-2 rounded-2xl font-body text-sm font-medium bg-gradient-to-br from-rg-400 to-rg-600 text-white shadow-luxury hover:shadow-luxury-lg hover:from-rg-300 hover:to-rg-500 transition-all duration-300 inline-flex items-center justify-center"
            >
              เลือกแพ็คเกจ
            </Link>
          </div>
        </div>
      </div>
    </motion.header>
    <div className="h-16 flex-shrink-0" aria-hidden />
    </>
  );
}
