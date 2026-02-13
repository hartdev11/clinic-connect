"use client";

import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#fefbfb]/95 backdrop-blur-xl border-b border-primary-100/80 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/login"
            className="flex items-center gap-3 group transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 text-white font-bold text-lg shadow-md shadow-primary-400/30 transition-shadow duration-300 group-hover:shadow-lg group-hover:shadow-primary-400/35">
              ✦
            </span>
            <span className="text-xl font-bold text-surface-800 group-hover:text-primary-600 transition-colors duration-200">
              Clinic Connect
            </span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600 border border-primary-200/60">
              ระบบหลังบ้านคลินิก
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-900 rounded-xl transition-all duration-200 hover:bg-surface-100/80"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-sm font-semibold bg-primary-500 text-white rounded-xl shadow-md shadow-primary-400/30 hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-400/35 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              สมัครคลินิก
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
