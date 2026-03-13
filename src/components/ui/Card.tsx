'use client'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLMotionProps<'div'> {
  glass?: boolean
  hover?: boolean
  shimmerBorder?: boolean
  noPadding?: boolean
  delay?: number
  variant?: 'default' | 'elevated' | 'subtle' | 'dark'
  /** Legacy: padding preset (maps to noPadding / p-* ) */
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variantStyles = {
  default: 'luxury-card',
  elevated: 'luxury-card shadow-luxury-lg',
  subtle: 'bg-cream-200/60 border border-cream-300 rounded-2xl',
  dark: 'glass-dark rounded-2xl',
}

const paddingStyles = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  glass,
  hover = true,
  shimmerBorder,
  noPadding = false,
  delay = 0,
  variant = 'default',
  padding,
  className,
  children,
  ...props
}: CardProps) {
  const usePadding =
    padding !== undefined
      ? paddingStyles[padding]
      : !noPadding
        ? 'p-6'
        : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        variantStyles[variant],
        usePadding,
        glass && 'glass',
        hover && 'hover:shadow-luxury-lg hover:-translate-y-0.5 cursor-default',
        shimmerBorder && 'shimmer-border',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Legacy: use with subtitle + action for existing pages */
  title?: string
  subtitle?: string
  action?: React.ReactNode
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  children,
  ...props
}: CardHeaderProps) {
  if (title !== undefined) {
    return (
      <div
        className={cn(
          'flex items-start justify-between gap-4 mb-5 pb-3 border-b border-cream-300',
          className
        )}
        {...props}
      >
        <div>
          <h3 className="text-lg font-semibold text-mauve-800">{title}</h3>
          {subtitle != null && (
            <p className="text-sm text-mauve-500 mt-1">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    )
  }
  return (
    <div
      className={cn('flex items-center justify-between mb-5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-display text-xl font-semibold text-mauve-700',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm font-body text-mauve-400 mt-0.5', className)}
      {...props}
    >
      {children}
    </p>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 mt-5 pt-5 border-t border-cream-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
