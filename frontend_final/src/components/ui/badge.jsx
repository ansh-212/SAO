import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/15 text-primary-foreground/90 text-primary',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        success:
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning:
          'border-amber-500/30 bg-amber-500/10 text-amber-300',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div
      data-variant={variant || 'default'}
      className={cn('dk-glass-badge', badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
