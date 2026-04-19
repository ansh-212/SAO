import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useLearningPath } from '@/lib/queries'
import { diagnosticApi } from '@/api/client'

const LEVEL_LABEL = {
  easy: 'Easy',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const BUCKET_META = {
  weak: { label: 'Weak', color: 'text-rose-300', ring: 'ring-rose-500/40', badge: 'destructive' },
  intermediate: { label: 'Intermediate', color: 'text-amber-300', ring: 'ring-amber-500/40', badge: 'warning' },
  expert: { label: 'Expert', color: 'text-emerald-300', ring: 'ring-emerald-500/40', badge: 'success' },
}

export default function OnboardingDiagnostic() {
  const navigate = useNavigate()
  const pathQuery = useLearningPath()

  const [phase, setPhase] = useState('intro') // intro / asking / results
  const [session, setSession] = useState(null) // {session_id, topics, ...}
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [loadingQ, setLoadingQ] = useState(false)
  const [grading, setGrading] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [results, setResults] = useState(null)
  const [completing, setCompleting] = useState(false)

  const totalTopics = session?.topics?.length || 0
  const topicIndex = question ? question.topic_index : session?.current_topic_index || 0
  const progressPct = totalTopics > 0 ? Math.round((topicIndex / totalTopics) * 100) : 0

  const handleStart = async () => {
    if (!pathQuery.data?.has_path) {
      toast.error('Pick a role first')
      return
    }
    try {
      const res = await diagnosticApi.start({ job_role: pathQuery.data.job_role })
      setSession(res)
      setPhase('asking')
      await loadNext(res.session_id)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not start diagnostic')
    }
  }

  const loadNext = async (sid) => {
    setLoadingQ(true)
    setAnswer('')
    setLastResult(null)
    try {
      const res = await diagnosticApi.next(sid)
      if (res.done) return setPhase('done')
      setQuestion(res)
    } catch (e) {
      toast.error('Could not generate the next question')
    } finally {
      setLoadingQ(false)
    }
  }

  const handleSubmit = async () => {
    if (!question) return
    if (!answer.trim()) {
      toast.error('Type a short answer first.')
      return
    }
    setGrading(true)
    try {
      const res = await diagnosticApi.submit({
        session_id: session.session_id,
        question: question.question,
        answer,
        level: question.level,
      })
      setLastResult(res)
      if (res.finished) {
        setTimeout(() => setPhase('done'), 1100)
      }
    } catch (e) {
      toast.error('Could not grade your answer')
    } finally {
      setGrading(false)
    }
  }

  const goToNext = async () => {
    if (!session) return
    await loadNext(session.session_id)
  }

  // When phase becomes done, fetch the classification
  useEffect(() => {
    if (phase !== 'done' || !session) return
    let cancelled = false
    ;(async () => {
      setCompleting(true)
      try {
        const res = await diagnosticApi.complete(session.session_id, true)
        if (!cancelled) {
          setResults(res)
          setPhase('results')
          toast.success('Diagnostic complete — your path was rebalanced!')
        }
      } catch (e) {
        toast.error('Could not finalize diagnostic')
        setPhase('asking')
      } finally {
        if (!cancelled) setCompleting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, session])

  if (pathQuery.isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-3xl">
          <Skeleton className="h-72 w-full" />
        </div>
      </DarkLayout>
    )
  }

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-3xl">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <IntroCard
              key="intro"
              role={pathQuery.data?.role_title}
              topics={pathQuery.data?.green_topics?.map((t) => t.topic) || []}
              onStart={handleStart}
            />
          )}

          {(phase === 'asking' || phase === 'done') && (
            <motion.div key="asking" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      <Brain className="h-3.5 w-3.5" /> Adaptive diagnostic
                    </div>
                    <Badge variant="outline">
                      Topic {Math.min(topicIndex + 1, totalTopics)} / {totalTopics}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-xl">
                    {question?.topic || 'Loading...'}
                  </CardTitle>
                  <CardDescription>
                    Level: <span className="font-medium text-foreground">{LEVEL_LABEL[question?.level] || '...'}</span>
                  </CardDescription>
                  <Progress value={progressPct} className="mt-3" />
                </CardHeader>
                <CardContent className="space-y-5">
                  {loadingQ || !question ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating question...
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 text-sm leading-relaxed text-foreground">
                        {question.question}
                      </div>
                      <Textarea
                        rows={5}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Answer in 2-4 sentences. Focus on key ideas — depth beats length."
                        disabled={!!lastResult}
                      />

                      <AnimatePresence>
                        {lastResult && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              'rounded-lg border p-4 text-sm',
                              lastResult.passed
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                                : 'border-rose-500/40 bg-rose-500/10 text-rose-100',
                            )}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              {lastResult.passed ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              <span className="font-semibold">
                                {lastResult.passed ? 'Passed' : 'Not quite'} — score {lastResult.score}/100
                              </span>
                            </div>
                            {lastResult.feedback && (
                              <p className="text-foreground/90">{lastResult.feedback}</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex justify-end">
                        {lastResult ? (
                          <Button onClick={goToNext} variant="gradient" disabled={lastResult.finished}>
                            {lastResult.finished ? 'Wrapping up...' : 'Next question'}
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSubmit}
                            disabled={grading || !answer.trim()}
                            variant="gradient"
                          >
                            {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Submit answer
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              {completing && phase === 'done' && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Classifying your topics...
                </div>
              )}
            </motion.div>
          )}

          {phase === 'results' && results && (
            <ResultsCard
              key="results"
              results={results}
              onApply={() => navigate('/onboarding/path')}
              onSkip={() => navigate('/student/dashboard')}
              onRetake={() => {
                setSession(null)
                setQuestion(null)
                setLastResult(null)
                setResults(null)
                setPhase('intro')
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </DarkLayout>
  )
}

/* ─── Intro ───────────────────────────────────────────────────────────── */
function IntroCard({ role, topics, onStart }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Diagnostic
          </div>
          <CardTitle className="text-2xl md:text-3xl">
            Let&apos;s find your level for {role || 'your role'}
          </CardTitle>
          <CardDescription>
            We&apos;ll ask one question per topic in your Green list. Pass and the next question
            gets harder; struggle and we move on. Takes ~10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Topics we&apos;ll diagnose ({topics.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topics.slice(0, 12).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px] uppercase tracking-wider">
                  {t}
                </Badge>
              ))}
              {topics.length > 12 && <Badge variant="outline">+{topics.length - 12} more</Badge>}
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="lg" variant="gradient" onClick={onStart}>
              Start diagnostic <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ─── Results ─────────────────────────────────────────────────────────── */
function ResultsCard({ results, onApply, onSkip, onRetake }) {
  const buckets = ['expert', 'intermediate', 'weak']
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Diagnostic complete
          </div>
          <CardTitle className="text-2xl md:text-3xl">Your topic classification</CardTitle>
          <CardDescription>
            Weak and intermediate topics were moved to your Green list. Expert topics moved to
            Yellow so we don&apos;t spend time on what you already know.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {buckets.map((b) => {
            const meta = BUCKET_META[b]
            const items = results[b] || []
            return (
              <div
                key={b}
                className={cn(
                  'rounded-xl border border-border/60 bg-card/50 p-4 ring-1 backdrop-blur-md',
                  meta.ring,
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className={cn('text-sm font-semibold uppercase tracking-wider', meta.color)}>
                    {meta.label}
                  </div>
                  <Badge variant={meta.badge}>{items.length}</Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  {items.length === 0 && (
                    <div className="text-muted-foreground">No topics in this bucket.</div>
                  )}
                  {items.map((t) => (
                    <div key={t} className="rounded-md bg-secondary/40 px-2 py-1 text-foreground/90">
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onRetake}>
          <RefreshCw className="h-4 w-4" /> Retake
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip path setup
        </Button>
        <Button variant="gradient" onClick={onApply} size="lg">
          Review my path <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
