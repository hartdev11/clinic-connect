'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
  quote?: string
  quoteAuthor?: string
  imageSide?: 'left' | 'right'
  /** Phase 20: White Label — custom logo + brand name */
  logoUrl?: string
  primaryColor?: string
  brandName?: string
}

function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={style}
      animate={{
        y: [0, -20, 0],
        opacity: [0.4, 0.8, 0.4],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: Math.random() * 3 + 3,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: Math.random() * 2,
      }}
    />
  )
}

export function AuthLayout({
  children,
  title,
  subtitle,
  quote,
  quoteAuthor,
  logoUrl,
  primaryColor,
  brandName,
}: AuthLayoutProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const particles = [
    { width: 6, height: 6, top: '15%', left: '20%', background: 'rgba(var(--rg-500-rgb), 0.5)' },
    { width: 4, height: 4, top: '30%', left: '70%', background: 'rgba(var(--rg-300-rgb), 0.4)' },
    { width: 8, height: 8, top: '55%', left: '15%', background: 'rgba(var(--rg-500-rgb), 0.3)' },
    { width: 5, height: 5, top: '70%', left: '60%', background: 'rgba(var(--mauve-300-rgb), 0.4)' },
    { width: 3, height: 3, top: '85%', left: '35%', background: 'rgba(var(--rg-500-rgb), 0.5)' },
    { width: 7, height: 7, top: '10%', left: '55%', background: 'rgba(var(--rg-300-rgb), 0.3)' },
  ]

  return (
    <div className="min-h-screen flex bg-cream-100">
      {/* ── LEFT PANEL ── */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden lg:flex lg:w-[42%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(145deg, var(--rg-900) 0%, var(--rg-800) 40%, var(--mauve-500) 70%, var(--rg-500) 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(var(--rg-500-rgb), 0.4) 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, rgba(var(--mauve-300-rgb), 0.3) 0%, transparent 50%)`,
          }}
        />

        {mounted &&
          particles.map((p, i) => (
            <Particle
              key={i}
              style={{
                position: 'absolute',
                width: p.width,
                height: p.height,
                top: p.top,
                left: p.left,
                background: p.background,
              }}
            />
          ))}

        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full border border-white/5" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-white/8" />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-rg-400/10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-10 h-10 rounded-2xl object-contain bg-white/10 shadow-luxury" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center shadow-luxury">
                <span className="text-white text-lg">✦</span>
              </div>
            )}
            <div>
              <p className="font-display text-xl font-semibold text-cream-100 tracking-wide">
                {brandName ?? "Clinic Connect"}
              </p>
              <p className="text-xs font-body text-rg-300 tracking-widest uppercase">
                Beauty Management
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="relative z-10"
        >
          <h2 className="font-display text-4xl font-light text-cream-100 leading-tight mb-4">
            {title}
          </h2>
          <p className="font-body text-sm text-rg-300 leading-relaxed max-w-xs">
            {subtitle}
          </p>

          <div className="my-8 h-px w-16 bg-gradient-to-r from-rg-400 to-transparent" />

          <div className="flex flex-col gap-3">
            {[
              {
                icon: '✦',
                text: 'จัดการลูกค้าและการจองอัจฉริยะ',
              },
              {
                icon: '◈',
                text: 'AI ตอบแชทลูกค้าอัตโนมัติผ่าน LINE',
              },
              {
                icon: '⬡',
                text: 'วิเคราะห์รายได้และ Insights ครบครัน',
              },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <span className="text-rg-400 text-xs">{f.icon}</span>
                <span className="text-sm font-body text-cream-200/80">
                  {f.text}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {quote != null && quote !== '' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="relative z-10"
          >
            <div className="glass-dark rounded-2xl p-5 border border-rg-400/20">
              <p className="font-display text-sm italic text-cream-200 leading-relaxed mb-2">
                &quot;{quote}&quot;
              </p>
              {quoteAuthor != null && quoteAuthor !== '' && (
                <p className="text-xs font-body text-rg-400">{quoteAuthor}</p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── RIGHT PANEL ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16 overflow-y-auto"
      >
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center">
            <span className="text-white text-sm">✦</span>
          </div>
          <p className="font-display text-lg font-semibold text-mauve-800">
            Clinic Connect
          </p>
        </div>

        <div className="w-full max-w-md">{children}</div>
      </motion.div>
    </div>
  )
}
