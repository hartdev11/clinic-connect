'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8 text-center',
        className
      )}
    >
      {icon != null && (
        <div className="mb-4 p-4 rounded-2xl bg-rg-100 text-rg-400 animate-float">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl font-semibold text-mauve-700 mb-2">
        {title}
      </h3>
      {description != null && (
        <p className="text-sm font-body text-mauve-400 max-w-sm leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  )
}
