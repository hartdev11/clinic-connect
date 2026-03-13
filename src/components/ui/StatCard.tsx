'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label?: string
    positive?: boolean
  }
  delay?: number
  className?: string
  shimmer?: boolean
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  trend,
  delay = 0,
  shimmer = false,
  className,
}: StatCardProps) {
  const isPositive =
    trend != null
      ? trend.positive !== undefined
        ? trend.positive
        : trend.value >= 0
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cn(
        'luxury-card p-6 relative overflow-hidden group',
        className
      )}
    >
      <div
        aria-hidden
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-rg-200/25 blur-2xl group-hover:bg-rg-300/30 transition-all duration-500"
      />
      <div
        aria-hidden
        className="absolute top-3 right-4 w-1.5 h-1.5 rounded-full bg-rg-300/50 particle"
        style={{ animationDelay: '0s' }}
      />
      <div
        aria-hidden
        className="absolute top-8 right-8 w-1 h-1 rounded-full bg-rg-200/60 particle"
        style={{ animationDelay: '1.5s' }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
          <p className="text-xs font-body font-medium text-mauve-400 uppercase tracking-widest truncate min-w-0">
            {label}
          </p>
          {icon != null && (
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-rg-100 text-rg-500 flex-shrink-0">
              {icon}
            </span>
          )}
        </div>
        <p
          className={cn(
            'font-sans text-display-xs font-semibold text-mauve-800 leading-none mb-2 max-w-full truncate tabular-nums',
            shimmer && 'shimmer-text'
          )}
          title={typeof value === 'string' ? value : String(value)}
        >
          {value}
        </p>
        <div className="flex items-center gap-2 mt-1 min-w-0 max-w-full flex-wrap">
          {trend != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-sans font-medium px-1.5 py-0.5 rounded-lg shrink-0 max-w-full truncate tabular-nums',
                isPositive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-red-600 bg-red-50'
              )}
              title={`${isPositive ? '+' : '-'}${Math.abs(trend.value)}%`}
            >
              {isPositive ? '↑' : '↓'}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {subtext != null && (
            <p className="text-xs font-sans text-mauve-400 truncate min-w-0 max-w-full tabular-nums">{subtext}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
