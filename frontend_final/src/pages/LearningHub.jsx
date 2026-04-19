import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpenCheck,
  Filter,
  GraduationCap,
  PlayCircle,
  Settings2,
  Sparkles,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { useLearningPath, useSkillProfile } from '@/lib/queries'

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  test_pending: 'Test pending',
  completed: 'Completed',
}

const STATUS_VARIANT = {
  not_started: 'outline',
  in_progress: 'default',
  test_pending: 'warning',
  completed: 'success',
}

export default function LearningHub() {
  const navigate = useNavigate()
  const pathQuery = useLearningPath()
  const skillProfileQuery = useSkillProfile()
  const [filter, setFilter] = useState('all')
  const [tone, setTone] = useState('green')

  const role = pathQuery.data?.job_role || ''
  const skillMap = useMemo(() => {
    const map = {}
    for (const item of skillProfileQuery.data?.items || []) {
      map[item.topic] = item
    }
    return map
  }, [skillProfileQuery.data])

  const greenTopics = pathQuery.data?.green_topics || []
  const yellowTopics = pathQuery.data?.yellow_topics || []
  const baseTopics = tone === 'yellow' ? yellowTopics : greenTopics

  const filtered = useMemo(() => {
    if (filter === 'all') return baseTopics
    return baseTopics.filter((t) => t.status === filter)
  }, [baseTopics, filter])

  const stats = pathQuery.data?.stats

  if (pathQuery.isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-6xl">
          <Skeleton className="mb-6 h-12 w-1/3" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        </div>
      </DarkLayout>
    )
  }

  if (!pathQuery.data?.has_path) {
    return (
      <DarkLayout>
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Build your learning path</CardTitle>
              <CardDescription>You don&apos;t have a path yet — let&apos;s set one up.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/onboarding')} variant="gradient">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </DarkLayout>
    )
  }

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-6xl px-2 sm:px-4">
        {/* ── Page header with progress meter ─────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="dk-glass-card"
          style={{
            padding: '28px 32px', marginBottom: 28,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            justifyContent: 'space-between', gap: 24,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, var(--dk-surface) 60%)',
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.7rem', color: 'var(--dk-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.32em', marginBottom: 12,
                fontWeight: 600,
              }}
            >
              <GraduationCap className="h-3 w-3" /> Learning hub
            </div>
            <h1
              style={{
                fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800,
                color: 'var(--dk-text)', letterSpacing: '-0.04em', margin: 0,
              }}
            >
              <span style={{ marginRight: 12 }}>{pathQuery.data.role_icon}</span>
              {pathQuery.data.role_title}
            </h1>
            {stats && (
              <div style={{ marginTop: 18, maxWidth: 460 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginBottom: 6, fontSize: '0.74rem',
                }}>
                  <span style={{ color: 'var(--dk-text-muted)' }}>
                    {stats.completed} of {stats.total_green} core topics
                  </span>
                  <span style={{ color: 'var(--dk-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {stats.completion_pct}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${stats.completion_pct}%`, height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                      transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={() => navigate('/onboarding/path')}>
              <Settings2 className="h-4 w-4" /> Edit path
            </Button>
            <Button variant="gradient" onClick={() => navigate('/plan')}>
              <Sparkles className="h-4 w-4" /> Personalize
            </Button>
          </div>
        </motion.header>

        {/* ── Tone tabs (Green / Yellow) ──────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Tabs value={tone} onValueChange={setTone}>
            <TabsList className="gap-1 bg-secondary/30 p-1">
              <TabsTrigger value="green" className="gap-2 px-4">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    tone === 'green' ? 'bg-emerald-400' : 'bg-emerald-500/40',
                  )}
                />
                Core
                <span className="ml-1 rounded-full bg-card/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {greenTopics.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="yellow" className="gap-2 px-4">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    tone === 'yellow' ? 'bg-amber-400' : 'bg-amber-500/40',
                  )}
                />
                Stretch
                <span className="ml-1 rounded-full bg-card/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {yellowTopics.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1 rounded-full border border-border/40 bg-card/40 p-1 text-xs">
            <Filter className="ml-2 h-3 w-3 text-muted-foreground" />
            {[
              { id: 'all', label: 'All' },
              { id: 'in_progress', label: 'In progress' },
              { id: 'test_pending', label: 'Test pending' },
              { id: 'not_started', label: 'New' },
              { id: 'completed', label: 'Done' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                  filter === opt.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topic count chip */}
        <div className="mb-5 text-xs text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'topic' : 'topics'}
        </div>

        {/* ── Topic grid ──────────────────────────────────────────────── */}
        <motion.div
          layout
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { staggerChildren: 0.04 } }}
        >
          {filtered.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary/40 text-muted-foreground">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div className="text-sm text-muted-foreground">
                  No topics match this filter — try clearing it.
                </div>
              </CardContent>
            </Card>
          )}
          {filtered.map((topic) => (
            <TopicCard
              key={topic.topic}
              topic={topic}
              tone={tone}
              skill={skillMap[topic.topic]}
              onOpen={() => navigate(`/learn/${encodeURIComponent(topic.topic)}?role=${role}`)}
            />
          ))}
        </motion.div>
      </div>
    </DarkLayout>
  )
}

function TopicCard({ topic, tone, skill, onOpen }) {
  const status = topic.status || 'not_started'
  const score = skill?.skill_score || 0
  const accent = tone === 'green' ? 'emerald' : 'amber'
  const attempts = (topic.quiz_scores || []).length
  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Card
        className={cn(
          'group relative h-full cursor-pointer overflow-hidden border border-border/40 transition-all',
          'hover:border-border/70 hover:shadow-2xl',
          tone === 'green'
            ? 'hover:shadow-emerald-500/10'
            : 'hover:shadow-amber-500/10',
        )}
        onClick={onOpen}
      >
        {/* Accent stripe at top */}
        <div
          className={cn(
            'h-[3px] w-full',
            status === 'completed'
              ? 'bg-linear-to-r from-emerald-500 via-emerald-400 to-emerald-500'
              : status === 'test_pending'
              ? 'bg-linear-to-r from-amber-500 via-amber-400 to-amber-500'
              : tone === 'green'
              ? 'bg-linear-to-r from-emerald-500/80 via-emerald-400/60 to-emerald-500/80'
              : 'bg-linear-to-r from-amber-500/80 via-amber-400/60 to-amber-500/80',
          )}
        />

        <CardHeader className="space-y-3 px-6 pt-6 pb-3">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-base font-semibold leading-snug text-foreground">
              {topic.topic}
            </CardTitle>
            <ProgressRing value={score} accent={accent} />
          </div>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            {attempts > 0 && (
              <span className="text-xs text-muted-foreground">
                {attempts} quiz attempt{attempts === 1 ? '' : 's'}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex items-center justify-between px-6 pt-0 pb-5">
          <div className="text-xs text-muted-foreground">
            {topic.article_read ? '✓ Article read' : 'New article'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary opacity-70 transition-opacity group-hover:opacity-100"
          >
            <PlayCircle className="h-4 w-4" /> Open
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ProgressRing({ value, accent = 'emerald' }) {
  const size = 44
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const dash = (pct / 100) * c
  const colorMap = {
    emerald: '#10b981',
    amber: '#f59e0b',
  }
  const color = colorMap[accent] || colorMap.emerald
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">{Math.round(pct)}</span>
    </div>
  )
}
