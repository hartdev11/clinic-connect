import { cn } from '@/lib/utils'

interface DividerProps {
  label?: string
  className?: string
  variant?: 'default' | 'shimmer'
}

export function Divider({
  label,
  variant = 'default',
  className,
}: DividerProps) {
  if (label != null && label !== '') {
    return (
      <div className={cn('flex items-center gap-3 my-4', className)}>
        <div className="flex-1 divider-rg" />
        <span className="text-xs font-body text-mauve-400 tracking-widest uppercase px-2">
          {label}
        </span>
        <div className="flex-1 divider-rg" />
      </div>
    )
  }

  return (
    <hr
      className={cn(
        'border-none my-4',
        variant === 'shimmer' ? 'divider-rg' : 'h-px bg-cream-300',
        className
      )}
    />
  )
}
