import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Circle,
  GripVertical,
  Home,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useLearningPath, useConfigurePath } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { onboardingApi } from '@/api/client'

const STATUS_LABEL = {
  not_started: 'New',
  in_progress: 'In progress',
  completed: 'Completed',
}

const STATUS_VARIANT = {
  not_started: 'outline',
  in_progress: 'default',
  completed: 'success',
}

export default function LearningPathBuilder() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const pathQuery = useLearningPath()
  const configure = useConfigurePath()

  const [green, setGreen] = useState([])
  const [yellow, setYellow] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [completing, setCompleting] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  // Returning users (already onboarded) get a clearer two-action affordance —
  // "Back to dashboard" + "Start learning" — instead of just one CTA.
  const isOnboarded = !!user?.onboarding_complete

  // Hydrate local state from API
  useEffect(() => {
    if (pathQuery.data?.has_path) {
      setGreen(pathQuery.data.green_topics || [])
      setYellow(pathQuery.data.yellow_topics || [])
    }
  }, [pathQuery.data])

  const dirty = useMemo(() => {
    if (!pathQuery.data?.has_path) return false
    const origGreen = (pathQuery.data.green_topics || []).map((t) => t.topic)
    const origYellow = (pathQuery.data.yellow_topics || []).map((t) => t.topic)
    const curGreen = green.map((t) => t.topic)
    const curYellow = yellow.map((t) => t.topic)
    if (origGreen.length !== curGreen.length || origYellow.length !== curYellow.length) return true
    for (let i = 0; i < origGreen.length; i++) if (origGreen[i] !== curGreen[i]) return true
    for (let i = 0; i < origYellow.length; i++) if (origYellow[i] !== curYellow[i]) return true
    return false
  }, [pathQuery.data, green, yellow])

  const findContainer = (id) => {
    if (id === 'green' || green.find((t) => t.topic === id)) return 'green'
    if (id === 'yellow' || yellow.find((t) => t.topic === id)) return 'yellow'
    return null
  }

  const handleDragOver = ({ active, over }) => {
    if (!over) return
    const fromList = findContainer(active.id)
    const toList = findContainer(over.id)
    if (!fromList || !toList || fromList === toList) return
    if (fromList === 'green') {
      const item = green.find((t) => t.topic === active.id)
      if (!item) return
      setGreen((curr) => curr.filter((t) => t.topic !== active.id))
      setYellow((curr) => [item, ...curr])
    } else {
      const item = yellow.find((t) => t.topic === active.id)
      if (!item) return
      setYellow((curr) => curr.filter((t) => t.topic !== active.id))
      setGreen((curr) => [item, ...curr])
    }
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const fromList = findContainer(active.id)
    const toList = findContainer(over.id)
    if (fromList === toList && fromList) {
      const list = fromList === 'green' ? green : yellow
      const setter = fromList === 'green' ? setGreen : setYellow
      const oldIndex = list.findIndex((t) => t.topic === active.id)
      const newIndex = list.findIndex((t) => t.topic === over.id)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setter(arrayMove(list, oldIndex, newIndex))
      }
    }
  }

  const handleSave = async () => {
    if (green.length === 0) {
      toast.error('Green list cannot be empty.')
      return
    }
    try {
      await configure.mutateAsync({
        green_topics: green.map((t) => t.topic),
        yellow_topics: yellow.map((t) => t.topic),
      })
      toast.success('Learning path saved')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save')
    }
  }

  const handleStartLearning = async () => {
    if (green.length === 0) {
      toast.error('Add at least one topic to your Green list.')
      return
    }
    setCompleting(true)
    try {
      if (dirty) {
        await configure.mutateAsync({
          green_topics: green.map((t) => t.topic),
          yellow_topics: yellow.map((t) => t.topic),
        })
      }
      // Mark onboarding complete on the very first run; for returning users
      // the call is a harmless no-op so we still send it for safety.
      if (!isOnboarded) {
        await onboardingApi.complete()
        await refreshUser()
      }
      toast.success(isOnboarded ? 'Path saved — let\u2019s keep learning!' : 'Onboarding complete \u2014 let\u2019s learn!')
      // First green topic = "Continue learning" entry point.
      const firstTopic = green[0]?.topic
      const role = pathQuery.data?.job_role || ''
      if (firstTopic) {
        navigate(`/learn/${encodeURIComponent(firstTopic)}?role=${encodeURIComponent(role)}`)
      } else {
        navigate('/learn')
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not finalize')
    } finally {
      setCompleting(false)
    }
  }

  const handleBackToDashboard = async () => {
    if (dirty) {
      try {
        await configure.mutateAsync({
          green_topics: green.map((t) => t.topic),
          yellow_topics: yellow.map((t) => t.topic),
        })
        toast.success('Saved')
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Could not save before leaving')
        return
      }
    }
    // Brand-new users haven't been promoted past the onboarding gate yet —
    // do that here so they don't get bounced back to /onboarding.
    if (!isOnboarded) {
      try {
        await onboardingApi.complete()
        await refreshUser()
      } catch {/* silent — they can still browse if it fails */}
    }
    navigate('/student/dashboard')
  }

  if (pathQuery.isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </DarkLayout>
    )
  }

  if (!pathQuery.data?.has_path) {
    return (
      <DarkLayout>
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>No path yet</CardTitle>
            <CardDescription>Pick a target role to start.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/onboarding')} variant="gradient">
              Go to onboarding
            </Button>
          </CardContent>
        </Card>
      </DarkLayout>
    )
  }

  const { role_title, role_icon, stats } = pathQuery.data

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="dk-glass-card"
          style={{
            padding: '28px 32px', marginBottom: 28,
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
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
              <Sparkles className="h-3 w-3" /> Configure your path
            </div>
            <h1
              style={{
                fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800,
                color: 'var(--dk-text)', letterSpacing: '-0.04em', margin: 0,
              }}
            >
              <span style={{ marginRight: 12 }}>{role_icon}</span>
              {role_title}
            </h1>
            <p
              style={{
                marginTop: 10, maxWidth: 620,
                color: 'var(--dk-text-muted)', fontSize: '0.88rem', lineHeight: 1.6,
              }}
            >
              Drag topics between <span style={{ color: '#6ee7b7', fontWeight: 600 }}>Green</span> (committed) and
              <span style={{ color: '#fcd34d', fontWeight: 600, marginLeft: 4 }}>Yellow</span> (optional). Reorder
              by priority — the first Green topic is what you&apos;ll see in &quot;Continue Learning&quot;.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="ghost" onClick={handleBackToDashboard} disabled={completing}>
              <ChevronLeft className="h-4 w-4" /> Back to dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/plan')}>
              Personalize
            </Button>
            <Button onClick={handleSave} disabled={!dirty || configure.isPending}>
              {configure.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button variant="gradient" onClick={handleStartLearning} disabled={completing}>
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Start learning
            </Button>
          </div>
        </motion.div>

        {stats && (
          <Card className="mb-6">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Path completion
                </div>
                <div className="text-lg font-semibold text-foreground">
                  {stats.completed}/{stats.total_green} topics done
                </div>
              </div>
              <div className="w-full max-w-md">
                <Progress value={stats.completion_pct} />
              </div>
              <div className="text-sm text-muted-foreground">{stats.completion_pct}% mastered</div>
            </CardContent>
          </Card>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <TopicColumn
              id="green"
              tone="green"
              title="Green list — committed"
              subtitle="The syllabus we will guide you through."
              topics={green}
            />
            <TopicColumn
              id="yellow"
              tone="yellow"
              title="Yellow list — optional"
              subtitle="Extended topics to study after the core path."
              topics={yellow}
            />
          </div>
          <DragOverlay>
            {activeId ? (
              <TopicCard
                topic={[...green, ...yellow].find((t) => t.topic === activeId) || { topic: activeId }}
                tone={findContainer(activeId) || 'green'}
                dragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DarkLayout>
  )
}

/* ─── Column ──────────────────────────────────────────────────────────── */
function TopicColumn({ id, tone, title, subtitle, topics }) {
  const accent = tone === 'green' ? 'emerald' : 'amber'
  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden border-l-4',
        tone === 'green' ? 'border-l-emerald-500/70' : 'border-l-amber-500/70',
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Badge variant={tone === 'green' ? 'success' : 'warning'}>{topics.length}</Badge>
        </div>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <SortableContext id={id} items={topics.map((t) => t.topic)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {topics.length === 0 && (
              <div
                className={cn(
                  'rounded-lg border border-dashed py-10 text-center text-xs',
                  tone === 'green'
                    ? 'border-emerald-500/30 text-emerald-200/70'
                    : 'border-amber-500/30 text-amber-200/70',
                )}
              >
                Drag topics here
              </div>
            )}
            {topics.map((t) => (
              <SortableTopic key={t.topic} topic={t} tone={tone} />
            ))}
          </AnimatePresence>
        </SortableContext>
      </CardContent>
    </Card>
  )
}

function SortableTopic({ topic, tone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.topic,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <TopicCard topic={topic} tone={tone} attributes={attributes} listeners={listeners} />
    </div>
  )
}

function TopicCard({ topic, tone, attributes, listeners, dragging }) {
  const status = topic.status || 'not_started'
  const StatusIcon = status === 'completed' ? CheckCircle2 : Circle
  return (
    <motion.div
      layout
      whileHover={{ x: 2 }}
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card/60 p-3 backdrop-blur-md transition-shadow',
        tone === 'green'
          ? 'border-emerald-500/30 shadow-[inset_3px_0_0_0_#10b981]'
          : 'border-amber-500/30 shadow-[inset_3px_0_0_0_#f59e0b]',
        dragging && 'shadow-2xl',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag handle"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          status === 'completed' ? 'text-emerald-400' : 'text-muted-foreground/60',
        )}
      />
      <div className="flex-1 truncate text-sm font-medium text-foreground">{topic.topic}</div>
      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
    </motion.div>
  )
}
