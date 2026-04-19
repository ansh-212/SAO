import React from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAllLearningPaths, useSwitchRole } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

/**
 * RoleSwitcher
 * ------------
 * Compact dropdown that exposes every role the user is currently preparing
 * for, lets them flip the *active* role (which gates Dashboard / Learning
 * Hub / Plan / Coach), and offers a one-click route to add a new role via
 * onboarding. Designed to live in the sidebar, but works anywhere.
 */
export default function RoleSwitcher({ compact = false, className }) {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const pathsQuery = useAllLearningPaths()
  const switchRole = useSwitchRole()

  const paths = pathsQuery.data?.paths || []
  const active = paths.find((p) => p.is_active) || paths[0]

  const handleSwitch = async (job_role) => {
    if (!job_role || job_role === active?.job_role) return
    try {
      const res = await switchRole.mutateAsync(job_role)
      await refreshUser()
      toast.success(`Switched to ${res.role_title}`)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not switch role')
    }
  }

  if (pathsQuery.isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs text-muted-foreground',
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading roles…
      </div>
    )
  }

  // No path yet → just send them to onboarding.
  if (paths.length === 0) {
    return (
      <button
        onClick={() => navigate('/onboarding')}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary',
          className,
        )}
      >
        <Plus className="h-3.5 w-3.5" /> Set up your first role
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'group flex w-full items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-left transition-colors hover:border-border/70 hover:bg-card/60',
            className,
          )}
        >
          <span className="text-base leading-none">{active?.role_icon || '🎯'}</span>
          {!compact && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                Active role
              </div>
              <div className="truncate text-xs font-semibold text-foreground">
                {active?.role_title || 'Choose a role'}
              </div>
            </div>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Switch active role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {paths.map((p) => (
          <DropdownMenuItem
            key={p.job_role}
            onSelect={() => handleSwitch(p.job_role)}
            className="flex items-center gap-2.5 px-2 py-2"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary/60 text-base">
              {p.role_icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {p.role_title}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {p.total_green} core · {p.total_yellow} stretch
              </div>
            </div>
            {p.is_active && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate('/onboarding?add=1')}
          className="gap-2 px-2 py-2 text-primary focus:text-primary"
        >
          <Plus className="h-4 w-4" /> Add another role
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
