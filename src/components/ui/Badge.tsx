import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'premium'
  | 'outline'
  | 'error'
  | 'ai'

export interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
  size?: 'sm' | 'md'
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-cream-200 text-mauve-600 border-cream-300',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-600 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  premium:
    'bg-gradient-to-r from-rg-100 to-cream-200 text-mauve-700 border-rg-200',
  outline: 'bg-transparent text-mauve-500 border-mauve-200',
  error: 'bg-red-50 text-red-600 border-red-200',
  ai: 'bg-rg-100 text-mauve-700 border-rg-200',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-mauve-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  premium: 'bg-rg-500',
  outline: 'bg-mauve-400',
  error: 'bg-red-500',
  ai: 'bg-rg-500',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

export function Badge({
  variant = 'default',
  dot,
  size = 'md',
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-body font-medium rounded-full border',
        'transition-all duration-200 select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot === true && (
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5',
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  )
}
