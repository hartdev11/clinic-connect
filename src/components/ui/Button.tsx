'use client'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'premium' | 'white'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  shimmer?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-rg-400 to-rg-600 text-white shadow-luxury hover:shadow-luxury-lg hover:from-rg-300 hover:to-rg-500 active:from-rg-600 active:to-rg-700',
  secondary:
    'glass border border-rg-300/60 text-mauve-600 hover:bg-rg-100 hover:border-rg-400 hover:text-mauve-700',
  ghost: 'text-rg-600 hover:bg-cream-200 hover:text-mauve-700 active:bg-cream-300',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-red-200',
  outline: 'border border-rg-400 text-rg-600 hover:bg-rg-50 hover:border-rg-500',
  premium:
    'bg-gradient-to-br from-mauve-500 to-mauve-700 text-cream-100 shadow-mauve hover:from-mauve-400 hover:to-mauve-600',
  white:
    'bg-white text-mauve-800 hover:bg-rg-50/80 shadow-soft border border-cream-300 hover:border-rg-200',
}

const sizeStyles: Record<Size, string> = {
  xs: 'h-7  px-3   text-xs  rounded-xl  gap-1',
  sm: 'h-8  px-4   text-sm  rounded-xl  gap-1.5',
  md: 'h-10 px-5   text-sm  rounded-2xl gap-2',
  lg: 'h-12 px-6   text-base rounded-2xl gap-2',
  xl: 'h-14 px-8   text-base rounded-3xl gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      shimmer = false,
      icon,
      iconPosition = 'left',
      fullWidth,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        whileTap={!isDisabled ? { scale: 0.97 } : undefined}
        whileHover={!isDisabled ? { scale: 1.015 } : undefined}
        transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        disabled={isDisabled}
        className={cn(
          'relative inline-flex items-center justify-center',
          'font-body font-medium tracking-wide',
          'transition-all duration-300 cursor-pointer select-none overflow-hidden',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rg-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {shimmer && !isDisabled && (
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2s_ease_infinite]"
            style={{ backgroundSize: '200% 100%' }}
          />
        )}

        {loading && (
          <span className="flex gap-0.5" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-current/60 animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current/60 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current/60 animate-pulse" style={{ animationDelay: "300ms" }} />
          </span>
        )}

        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}

        {loading ? (
          <span className="ml-2">กำลังดำเนินการ...</span>
        ) : (
          children
        )}

        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
