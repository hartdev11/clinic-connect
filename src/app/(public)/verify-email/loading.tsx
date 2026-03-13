"use client";

import { motion } from "framer-motion";

export default function VerifyEmailLoading() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-rg-200/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-mauve-100/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md"
      >
        <div className="luxury-card p-10 text-center shimmer-border">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rg-300 to-rg-600 flex items-center justify-center shadow-luxury-lg">
              <span className="text-white text-2xl">✦</span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-semibold text-mauve-800 mb-2">
            ยืนยันอีเมลของคุณ
          </h1>
          <p className="font-body text-sm text-mauve-400 mb-8 leading-relaxed">
            กำลังตรวจสอบลิงก์ยืนยัน...
          </p>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-cream-200 rounded-2xl w-48 mx-auto" />
            <div className="h-4 bg-cream-100 rounded-xl w-32 mx-auto" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
