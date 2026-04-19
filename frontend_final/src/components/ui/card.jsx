import * as React from 'react'
import { cn } from '@/lib/utils'

/* The `dk-glass-card` / `dk-glass-card-*` identifier classes are picked up by
 * `dashboard-dark.css` (scoped to `.dark-app`) to give all dashboard cards the
 * same glassmorphic, AI-Interview-Coach inspired look without having to
 * rewrite every page that uses them. Outside of `.dark-app`, these classes
 * are inert and the original Tailwind look applies. */
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    className={cn(
      'dk-glass-card',
      'rounded-xl border border-border/60 bg-card/60 text-card-foreground shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/40',
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn('dk-glass-card-header', 'flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-title"
    className={cn('dk-glass-card-title', 'text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-description"
    className={cn('dk-glass-card-description', 'text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn('dk-glass-card-content', 'p-6 pt-0', className)}
    {...props}
  />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn('dk-glass-card-footer', 'flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
