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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
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
          <div className="flex w-full flex-wrap items-center gap-2 pt-1 sm:w-auto sm:justify-end sm:gap-3 sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      <div className="mt-5 divider-rg" aria-hidden />
    </motion.div>
  )
}
