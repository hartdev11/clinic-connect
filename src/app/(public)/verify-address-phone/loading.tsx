"use client";

import { motion } from "framer-motion";

export default function VerifyAddressPhoneLoading() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-72 h-72 rounded-full bg-rg-200/15 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full bg-mauve-100/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-lg"
      >
        <div className="luxury-card p-10 shimmer-border">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-rg-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-rg-500 text-xl">⬡</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-mauve-800 mb-1">
              ยืนยันข้อมูลสาขา
            </h1>
            <p className="font-body text-sm text-mauve-400">
              กำลังตรวจสอบลิงก์ยืนยัน...
            </p>
          </div>
          <div className="flex justify-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-cream-200 rounded-2xl w-48 mx-auto" />
              <div className="h-4 bg-cream-100 rounded-xl w-32 mx-auto" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
