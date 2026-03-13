'use client'
import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react'
import { cn } from '@/lib/utils'

const baseInputClass = cn(
  'w-full font-body text-sm text-mauve-800',
  'bg-white/80 backdrop-blur-sm',
  'border border-cream-300 rounded-2xl',
  'px-4 transition-all duration-300',
  'placeholder:text-cream-400',
  'focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 focus:bg-white',
  'hover:border-rg-200',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-cream-100'
)

interface FieldWrapperProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

function FieldWrapper({
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label != null && (
        <label className="font-body text-sm font-medium text-mauve-600 tracking-wide flex items-center gap-1">
          {label}
          {required && <span className="text-rg-500 text-xs">*</span>}
        </label>
      )}
      {children}
      {error != null && (
        <p className="text-xs text-red-500 font-body flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {hint != null && !error && (
        <p className="text-xs text-cream-500 font-body">{hint}</p>
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      iconRight,
      wrapperClassName,
      className,
      required,
      id,
      ...props
    },
    ref
  ) => {
    const inputId =
      id ?? (label != null ? label.toLowerCase().replace(/\s/g, '-') : undefined)
    return (
      <FieldWrapper
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={wrapperClassName}
      >
        <div className="relative flex items-center">
          {icon != null && (
            <span className="absolute left-3.5 text-rg-400 flex items-center pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              baseInputClass,
              'h-11',
              icon != null && 'pl-10',
              iconRight != null && 'pr-10',
              error != null &&
                'border-red-300 focus:border-red-400 focus:ring-red-200/50',
              className
            )}
            required={required}
            {...props}
          />
          {iconRight != null && (
            <span className="absolute right-3.5 text-rg-400 flex items-center">
              {iconRight}
            </span>
          )}
        </div>
      </FieldWrapper>
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      wrapperClassName,
      className,
      required,
      ...props
    },
    ref
  ) => (
    <FieldWrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        className={cn(
          baseInputClass,
          'min-h-[100px] py-3 resize-y',
          error != null &&
            'border-red-300 focus:border-red-400 focus:ring-red-200/50',
          className
        )}
        required={required}
        {...props}
      />
    </FieldWrapper>
  )
)
Textarea.displayName = 'Textarea'
