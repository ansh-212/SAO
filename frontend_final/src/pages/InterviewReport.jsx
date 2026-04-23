import React, { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  MessageSquare,
  Mic,
  Quote,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { useInterviewReport } from '@/lib/queries'

const VERDICT_VARIANT = {
  'Strong Hire': 'success',
  Hire: 'success',
  'Lean Hire': 'default',
  'Lean No Hire': 'warning',
  'No Hire': 'destructive',
}

const ANSWER_BADGE_VARIANT = {
  right: 'success',
  partially_right: 'warning',
  wrong: 'destructive',
  unable_to_determine: 'secondary',
}

export default function InterviewReport() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useInterviewReport(interviewId)

  const session = data
  const report = session?.report || {}
  const comm = report.communication || {}
  const language = comm.language || {}

  const categoryData = useMemo(() => {
    const cs = report.category_scores || {}
    return Object.entries(cs).map(([k, v]) => {
      const n = Number(v) || 0
      // Backend reports both 0-10 (interview/end) and 0-100 (skill profile);
      // normalize anything <= 10 to a percentage scale for the radar.
      const score = n <= 10 ? Math.round(n * 10) : Math.round(n)
      return {
        name: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        score,
      }
    })
  }, [report.category_scores])

  const fillerData = useMemo(() => {
    const f = comm.filler_word_counts || {}
    return Object.entries(f).map(([word, count]) => ({ word, count }))
  }, [comm.filler_word_counts])

  const visualCaptureRows = useMemo(() => {
    const captures = report.visual_capture_results || {}
    const questionTextMap = report.question_text_by_number || {}
    return Object.entries(captures)
      .map(([q, payload]) => {
        const questionNumber = Number(q)
        return {
          questionNumber,
          questionText: questionTextMap[q] || questionTextMap[String(questionNumber)] || 'Question text unavailable.',
          ...payload,
        }
      })
      .filter((row) => row && !Number.isNaN(row.questionNumber))
      .sort((a, b) => a.questionNumber - b.questionNumber)
  }, [report.question_text_by_number, report.visual_capture_results])

  if (isLoading) {
    return (
      <DarkLayout>
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </DarkLayout>
    )
  }

  if (isError || !session) {
    return (
      <DarkLayout>
        <div className="mx-auto max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <h2 className="mt-3 text-xl font-semibold">Couldn't load this report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The interview session may have been deleted or you don't have access.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/interviews')}>
            <ArrowLeft className="h-4 w-4" /> Back to history
          </Button>
        </div>
      </DarkLayout>
    )
  }

  const overall = Math.round(session.overall_score ?? report.overall_score ?? 0)
  const verdict = session.verdict || report.verdict

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <button
              onClick={() => navigate('/interviews')}
              className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> All interviews
            </button>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> AI Interview Report
              {session.created_at && (
                <span className="text-[10px] tracking-normal normal-case text-muted-foreground/70">
                  · {new Date(session.created_at).toLocaleString()}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              {(session.mode || 'interview').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              {session.company ? ` · ${session.company}` : ''}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {(session.topics_covered || []).slice(0, 4).join(' · ') || 'Mixed topics'}
            </div>
          </div>

          <ScoreOrb score={overall} verdict={verdict} />
        </motion.div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="captures">Capture Interpretation</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-primary" /> Category breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No category scores yet.</p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={categoryData} outerRadius="78%">
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis
                            dataKey="name"
                            tick={{ fill: 'rgb(180,180,200)', fontSize: 11 }}
                          />
                          <Radar
                            name="Score"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.35}
                          />
                          <RTooltip
                            contentStyle={{
                              background: 'rgba(15,15,25,0.92)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> Highlights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Stat
                    icon={Gauge}
                    label="Overall"
                    value={`${overall}%`}
                    sub={verdict || 'Pending verdict'}
                  />
                  <Stat
                    icon={MessageSquare}
                    label="Words spoken"
                    value={comm.word_count ?? '—'}
                    sub={comm.speaking_pace_wpm ? `${comm.speaking_pace_wpm} wpm` : 'Pace n/a'}
                  />
                  <Stat
                    icon={Eye}
                    label="Eye contact"
                    value={comm.eye_contact_pct != null ? `${comm.eye_contact_pct}%` : '—'}
                    sub={
                      comm.eye_contact_pct == null
                        ? 'Camera not used'
                        : comm.eye_contact_pct >= 70
                          ? 'Strong gaze'
                          : 'Try to look at camera more'
                    }
                  />
                  <Stat
                    icon={Mic}
                    label="Filler words"
                    value={comm.filler_word_total ?? 0}
                    sub={
                      (comm.filler_word_total || 0) > 8
                        ? 'Trim the ums and likes'
                        : 'Crisp delivery'
                    }
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(report.strengths || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No strengths captured.</p>
                  )}
                  {(report.strengths || []).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm"
                    >
                      {s}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> Areas to improve
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(report.weaknesses || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nothing flagged — clean run!</p>
                  )}
                  {(report.weaknesses || []).map((w, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
                    >
                      {w}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {report.detailed_feedback && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Detailed feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {report.detailed_feedback}
                  </p>
                </CardContent>
              </Card>
            )}

            {(report.recommended_study_topics || []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> Recommended next topics
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {report.recommended_study_topics.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() =>
                        navigate(`/learn/${encodeURIComponent(String(t).toLowerCase().replace(/\s+/g, '-'))}`)
                      }
                    >
                      {t}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Mic className="h-4 w-4 text-primary" /> Filler words
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {fillerData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No filler words detected.</p>
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fillerData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="word"
                            tick={{ fill: 'rgb(180,180,200)', fontSize: 11 }}
                          />
                          <YAxis tick={{ fill: 'rgb(180,180,200)', fontSize: 11 }} />
                          <RTooltip
                            contentStyle={{
                              background: 'rgba(15,15,25,0.92)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 8,
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Language quality</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Meter label="Vocabulary richness" value={language.vocabulary_richness ?? 0} />
                  <Meter label="Grammar" value={language.grammar_score ?? 0} />
                  <Meter label="Coherence" value={language.coherence_score ?? 0} />
                  {language.summary && (
                    <p className="rounded-md bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                      {language.summary}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {language.best_moment && (
                      <Quote2
                        title="Best moment"
                        text={language.best_moment}
                        tone="positive"
                      />
                    )}
                    {language.weakest_moment && (
                      <Quote2
                        title="Weakest moment"
                        text={language.weakest_moment}
                        tone="negative"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {Object.keys(comm.expression_breakdown || {}).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Expression breakdown</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Object.entries(comm.expression_breakdown).map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border/40 bg-card/40 p-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {k}
                      </div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums">
                        {Math.round(Number(v) * 100)}
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transcript">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Transcript timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-3">
                    {(session.transcript || []).map((m, i) => (
                      <TranscriptBubble key={i} role={m.role} content={m.content} index={i} />
                    ))}
                    {(session.transcript || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No transcript was saved for this session.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="captures">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Question-wise capture interpretation</CardTitle>
              </CardHeader>
              <CardContent>
                {visualCaptureRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No capture interpretation data was saved for this interview.</p>
                ) : (
                  <div className="space-y-3">
                    {visualCaptureRows.map((row) => (
                      <div key={row.questionNumber} className="rounded-md border border-border/40 bg-card/40 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Q{row.questionNumber}
                        </div>
                        <p className="mb-2 text-sm text-foreground/90">{row.questionText}</p>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Score: {Math.round(Number(row.overall_score || 0))}%</Badge>
                          <Badge variant="secondary">
                            Interpretation: {String(row.interpretation_status || 'not_interpretable').replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="secondary">Confidence: {Math.round(Number(row.interpretation_confidence || 0))}%</Badge>
                          <Badge variant={ANSWER_BADGE_VARIANT[row.answer_status] || 'secondary'}>
                            Verdict: {String(row.answer_status || 'unable_to_determine').replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Interpreted content</p>
                        <p className="mb-2 text-sm text-foreground/85">{row.interpreted_content || row.summary || row.extracted_text || 'No interpreted content available.'}</p>
                        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Correctness reasoning</p>
                        <p className="text-sm text-foreground/85">{row.correctness_reason || row.feedback || 'No correctness rationale provided.'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {report.closing_message && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90"
          >
            <span className="mr-2 inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary">
              <Quote className="h-3 w-3" /> Closing
            </span>
            {report.closing_message}
          </motion.div>
        )}
      </div>
    </DarkLayout>
  )
}

function ScoreOrb({ score, verdict }) {
  const tone =
    score >= 80
      ? 'from-emerald-400 to-cyan-400'
      : score >= 60
        ? 'from-amber-400 to-orange-400'
        : 'from-rose-400 to-pink-400'
  return (
    <motion.div
      layoutId="score-orb"
      className="flex flex-col items-end gap-1"
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <div
        className={cn(
          'grid h-24 w-24 place-items-center rounded-full bg-linear-to-br text-2xl font-bold text-white shadow-lg shadow-primary/30',
          tone,
        )}
      >
        {score}
      </div>
      {verdict && (
        <Badge variant={VERDICT_VARIANT[verdict] || 'default'} className="text-[10px]">
          {verdict}
        </Badge>
      )}
    </motion.div>
  )
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/30 bg-card/40 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}

function Meter({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  )
}

function Quote2({ title, text, tone }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-xs',
        tone === 'positive'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-rose-500/30 bg-rose-500/5',
      )}
    >
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="leading-relaxed">"{text}"</div>
    </div>
  )
}

function TranscriptBubble({ role, content, index }) {
  const isInterviewer = ['interviewer', 'assistant', 'ai'].includes((role || '').toLowerCase())
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.02, 0.4) } }}
      className={cn('flex gap-3', isInterviewer ? 'justify-start' : 'flex-row-reverse')}
    >
      <div
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold',
          isInterviewer
            ? 'bg-primary/15 text-primary'
            : 'bg-emerald-500/15 text-emerald-300',
        )}
      >
        {isInterviewer ? 'AI' : 'You'}
      </div>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isInterviewer
            ? 'border border-border/40 bg-secondary/40'
            : 'border border-emerald-500/30 bg-emerald-500/5',
        )}
      >
        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" /> Turn {index + 1}
        </div>
        <div className="whitespace-pre-line">{content}</div>
      </div>
    </motion.div>
  )
}
