'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
  shimmer?: boolean
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  shimmer = false,
  className,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn('flex flex-col gap-1 mb-8', className)}
    >
      {breadcrumb != null && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className={cn(
              'font-sans text-xl font-semibold text-mauve-800',
              shimmer && 'shimmer-text'
            )}
          >
            {title}
          </h1>
          {subtitle != null && (
            <p className="mt-1.5 text-sm font-body text-mauve-400 leading-relaxed max-w-xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions != null && (
          <div className="flex items-center gap-3 flex-shrink-0 pt-1">
            {actions}
          </div>
        )}
      </div>
      <div className="mt-5 divider-rg" aria-hidden />
    </motion.div>
  )
}
