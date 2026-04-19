import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Headphones,
  History,
  PlayCircle,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useInterviewHistory } from '@/lib/queries'

const VERDICT_VARIANT = {
  'Strong Hire': 'success',
  Hire: 'success',
  'Lean Hire': 'default',
  'Lean No Hire': 'warning',
  'No Hire': 'destructive',
}

const PAGE_SIZE = 10

export default function InterviewHistory() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const offset = page * PAGE_SIZE
  const { data, isLoading } = useInterviewHistory({ limit: PAGE_SIZE, offset })

  const items = data?.items || []
  const total = data?.total || 0
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-5xl">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Past interviews
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Your interview history
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse every mock interview, replay reports, and watch your scores climb.
            </p>
          </div>
          <Button onClick={() => navigate('/interview')} variant="gradient">
            <PlayCircle className="h-4 w-4" /> New interview
          </Button>
        </motion.header>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Headphones className="h-10 w-10 text-muted-foreground" />
              <CardTitle className="text-base">No interviews yet</CardTitle>
              <CardDescription>
                Take your first mock interview — every session is saved here automatically.
              </CardDescription>
              <Button variant="gradient" onClick={() => navigate('/interview')}>
                <ArrowRight className="h-4 w-4" /> Start one now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            layout
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { staggerChildren: 0.04 } }}
          >
            {items.map((it) => (
              <motion.div key={it.id} layout whileHover={{ x: 4 }}>
                <Card
                  className="group cursor-pointer transition-shadow hover:shadow-xl hover:shadow-primary/10"
                  onClick={() => navigate(`/interviews/${it.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                          <Headphones className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-foreground">
                            {it.mode?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
                              'Interview'}
                            {it.company ? ` · ${it.company}` : ''}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CalendarClock className="h-3 w-3" />
                            {it.created_at ? new Date(it.created_at).toLocaleString() : '—'}
                            {it.job_role && (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                {it.job_role.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <ScorePill score={it.overall_score} />
                        {it.verdict && (
                          <Badge variant={VERDICT_VARIANT[it.verdict] || 'default'}>{it.verdict}</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </CardHeader>
                  {(it.topics_covered || []).length > 0 && (
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        {it.topics_covered.slice(0, 6).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] uppercase tracking-wider">
                            {t}
                          </Badge>
                        ))}
                        {it.topics_covered.length > 6 && (
                          <Badge variant="outline">+{it.topics_covered.length - 6}</Badge>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} / {lastPage + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </DarkLayout>
  )
}

function ScorePill({ score }) {
  if (score == null) return <Badge variant="outline">No score</Badge>
  const color =
    score >= 80
      ? 'text-emerald-300 border-emerald-500/40'
      : score >= 60
        ? 'text-amber-300 border-amber-500/40'
        : 'text-rose-300 border-rose-500/40'
  return (
    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', color)}>
      {Math.round(score)}
    </span>
  )
}
