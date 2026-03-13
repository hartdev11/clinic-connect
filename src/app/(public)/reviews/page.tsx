"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Review = {
  id: string;
  author?: string;
  content: string;
  rating?: number;
  createdAt?: string;
};

const reviews: Review[] = [];

export default function ReviewsPage() {
  const loading = false;

  return (
    <div className="min-h-screen bg-cream-100">
      <div
        className="relative overflow-hidden py-16 px-6 text-center"
        style={{
          background:
            "linear-gradient(145deg, var(--cream-100) 0%, var(--cream-200) 50%, var(--cream-300) 100%)",
        }}
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-rg-200/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <p className="font-body text-xs text-rg-500 uppercase tracking-widest mb-3">
            ความเห็นจากลูกค้า
          </p>
          <h1 className="font-display text-display-md font-semibold text-mauve-900">
            รีวิวจากคลินิกที่ใช้ Clinic Connect
          </h1>
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="luxury-card p-6 h-32 animate-pulse">
                <div className="h-4 bg-cream-200 rounded w-1/4 mb-4" />
                <div className="h-4 bg-cream-200 rounded w-full" />
                <div className="h-4 bg-cream-200 rounded w-3/4 mt-2" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card p-12 text-center"
          >
            <p className="font-body text-mauve-500 mb-4">
              ยังไม่มีรีวิวที่เผยแพร่
            </p>
            <Link
              href="/"
              className="font-body text-sm font-medium text-rg-600 hover:text-rg-700 transition-colors"
            >
              ← กลับหน้าหลัก
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -2 }}
                className="luxury-card p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rg-200 to-rg-400 flex-shrink-0" />
                  <div>
                    <p className="font-body font-medium text-mauve-800">
                      {review.author ?? "ผู้ใช้"}
                    </p>
                    {review.rating != null && (
                      <p className="font-body text-xs text-rg-500">
                        {review.rating}/5
                      </p>
                    )}
                  </div>
                </div>
                <p className="font-body text-mauve-600 leading-relaxed">
                  {review.content}
                </p>
                {review.createdAt && (
                  <p className="font-body text-xs text-mauve-400 mt-3">
                    {review.createdAt}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
        {!loading && (
          <p className="text-center mt-8">
            <Link
              href="/"
              className="font-body text-sm text-mauve-500 hover:text-rg-600 transition-colors"
            >
              ← กลับหน้าหลัก
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
