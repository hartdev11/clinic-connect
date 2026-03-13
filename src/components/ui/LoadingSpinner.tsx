'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  fullPage?: boolean
  className?: string
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

/** Enterprise: Skeleton loading (no spinner) */
export function LoadingSpinner({
  size = 'md',
  label,
  fullPage,
  className,
}: LoadingSpinnerProps) {
  const skeleton = (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn('rounded-xl bg-cream-200 animate-pulse', sizes[size])}
        aria-hidden
      />
      {label != null && (
        <div className="h-4 w-24 rounded bg-cream-200 animate-pulse" />
      )}
    </div>
  )

  if (fullPage === true) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-cream-100/80 backdrop-blur-sm z-50">
        {skeleton}
      </div>
    )
  }

  return skeleton
}

/** Enterprise: Skeleton page loading (no spinner) */
export function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[40vh] gap-6 p-8"
    >
      <div className="w-48 h-12 rounded-2xl bg-cream-200 animate-pulse" />
      <div className="w-64 h-4 rounded-lg bg-cream-200 animate-pulse" style={{ animationDelay: "100ms" }} />
      <div className="w-56 h-4 rounded-lg bg-cream-200 animate-pulse" style={{ animationDelay: "200ms" }} />
      <p className="font-body text-sm text-mauve-400 mt-2">
        กำลังโหลด...
      </p>
    </motion.div>
  )
}
