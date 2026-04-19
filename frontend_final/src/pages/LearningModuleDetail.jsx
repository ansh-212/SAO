import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  MessagesSquare,
  NotebookPen,
  RefreshCw,
  Send,
  Sparkles,
  User2,
  X,
  XCircle,
} from 'lucide-react'

import DarkLayout from '@/components/layout/DarkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import {
  useTopicArticle,
  useTopicNotes,
  useGenerateQuiz,
  useSubmitQuiz,
  useSaveNotes,
  useTopicChat,
  usePracticeQuestions,
  useUpdateTopicStatus,
} from '@/lib/queries'

/* ─────────────────────────────────────────────────────────────────────── */

export default function LearningModuleDetail() {
  const navigate = useNavigate()
  const { topic: rawTopic } = useParams()
  const [searchParams] = useSearchParams()
  const jobRole = searchParams.get('role') || ''
  const topic = decodeURIComponent(rawTopic || '')

  const articleQuery = useTopicArticle(topic, jobRole)
  const notesQuery = useTopicNotes(topic, jobRole)
  const saveNotes = useSaveNotes(topic, jobRole)
  const chatMutation = useTopicChat(topic, jobRole)
  const updateStatus = useUpdateTopicStatus(topic, jobRole)

  /* ── Notes (debounced autosave) ─────────────────────────────────────── */
  const [notes, setNotes] = useState('')
  const [notesSyncedAt, setNotesSyncedAt] = useState(null)

  useEffect(() => {
    if (notesQuery.data) setNotes(notesQuery.data.notes || '')
  }, [notesQuery.data])

  const noteTimer = useRef()
  useEffect(() => {
    if (!notesQuery.data) return
    if (notes === (notesQuery.data.notes || '')) return
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      saveNotes.mutate(notes, { onSuccess: () => setNotesSyncedAt(Date.now()) })
    }, 800)
    return () => clearTimeout(noteTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])

  /* ── Chat state ─────────────────────────────────────────────────────── */
  const [messages, setMessages] = useState([])
  const [chatExpanded, setChatExpanded] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')
  const chatScrollRef = useRef(null)

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages, chatMutation.isPending])

  const sendMessage = async (raw) => {
    const text = (raw ?? pendingMessage).trim()
    if (!text || chatMutation.isPending) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setPendingMessage('')
    setChatExpanded(true)
    try {
      const res = await chatMutation.mutateAsync({ message: text, history: messages })
      setMessages((curr) => [...curr, { role: 'assistant', content: res.reply }])
    } catch {
      toast.error('Could not get a reply')
      setMessages((curr) => [
        ...curr,
        { role: 'assistant', content: '_Sorry — try again._' },
      ])
    }
  }

  /* ── Modal state ────────────────────────────────────────────────────── */
  const [completionModal, setCompletionModal] = useState(false)
  const [practiceModal, setPracticeModal] = useState(false)

  /* ── Derived: is this topic already marked complete or pending? ─────── */
  // We can infer from the topic status if it's passed via the URL or we can
  // let the user re-trigger. The modals handle their own state.

  return (
    <DarkLayout>
      <div className="mx-auto w-full max-w-[1400px] px-2 sm:px-4 lg:px-6">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7 flex flex-wrap items-center gap-4"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/learn')}
          >
            <ArrowLeft className="h-4 w-4" /> Hub
          </Button>
          <div
            style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(99,102,241,0.15)', color: '#a78bfa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.66rem', color: 'var(--dk-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.32em', marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Topic module
            </div>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800,
                color: 'var(--dk-text)', letterSpacing: '-0.04em',
                margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {topic}
            </h1>
          </div>
          {/* Action buttons — top right for quick access */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPracticeModal(true)}
            >
              <ClipboardList className="h-4 w-4" />
              Practice
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => setCompletionModal(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Complete
            </Button>
          </div>
        </motion.header>

        {/* ── Main grid ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Article column */}
          <ArticlePane article={articleQuery} />

          {/* Right column: workspace OR chat */}
          <div className="relative w-full lg:w-[420px] lg:shrink-0 xl:w-[480px]">
            <AnimatePresence mode="wait">
              {chatExpanded ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ChatPane
                    messages={messages}
                    pending={chatMutation.isPending}
                    input={pendingMessage}
                    setInput={setPendingMessage}
                    onSend={() => sendMessage()}
                    onReset={() => { setMessages([]); setChatExpanded(false) }}
                    scrollRef={chatScrollRef}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <WorkspacePane
                    topic={topic}
                    jobRole={jobRole}
                    notes={notes}
                    setNotes={setNotes}
                    notesSaving={saveNotes.isPending}
                    notesSyncedAt={notesSyncedAt}
                    chatInput={pendingMessage}
                    setChatInput={setPendingMessage}
                    onSendChat={(t) => sendMessage(t)}
                    chatPending={chatMutation.isPending}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Floating "open notes" pill when chat is expanded */}
        <AnimatePresence>
          {chatExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              onClick={() => setChatExpanded(false)}
              className="fixed bottom-8 right-8 z-30 flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-4 py-2.5 text-xs font-medium text-foreground shadow-2xl backdrop-blur-xl transition-colors hover:border-primary/50 hover:bg-card"
            >
              <NotebookPen className="h-3.5 w-3.5 text-primary" />
              Open notes & quiz
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <CompletionQuizModal
        open={completionModal}
        onClose={() => setCompletionModal(false)}
        topic={topic}
        jobRole={jobRole}
        onCompleted={() => {
          setCompletionModal(false)
          toast.success('Topic marked as completed! 🎉')
          navigate('/learn')
        }}
        onPending={() => {
          setCompletionModal(false)
          updateStatus.mutate('test_pending', {
            onSuccess: () => toast('Marked as test pending — you can revisit anytime.'),
          })
        }}
      />
      <PracticeModal
        open={practiceModal}
        onClose={() => setPracticeModal(false)}
        topic={topic}
        jobRole={jobRole}
        chatMessages={messages}
      />
    </DarkLayout>
  )
}

/* ─── Article ─────────────────────────────────────────────────────────── */
function ArticlePane({ article }) {
  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 px-7 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Article
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => article.refetch()}
          disabled={article.isFetching}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {article.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </CardHeader>

      <div
        className="max-h-[calc(100vh-220px)] min-h-[600px] overflow-y-auto"
        style={{ padding: '36px 48px' }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {article.isLoading && <ArticleSkeleton />}
          {article.error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              Could not load this article. Try Refresh.
            </div>
          )}
          {article.data && <ArticleMarkdown content={article.data.content || ''} />}
        </div>
      </div>
    </Card>
  )
}

function ArticleSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
      <Skeleton className="h-7 w-1/3" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    </div>
  )
}

function ArticleMarkdown({ content }) {
  return (
    <article
      className={cn(
        'prose prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground',
        'prose-h1:mb-4 prose-h1:mt-0 prose-h1:text-4xl prose-h1:font-bold prose-h1:leading-tight',
        'prose-h2:mb-4 prose-h2:mt-12 prose-h2:text-2xl prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-2',
        'prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-lg',
        'prose-p:my-4 prose-p:leading-[1.75] prose-p:text-foreground/85',
        'prose-li:my-2 prose-li:leading-relaxed prose-li:text-foreground/85',
        'prose-strong:font-semibold prose-strong:text-foreground',
        'prose-blockquote:my-6 prose-blockquote:rounded-r-md prose-blockquote:border-l-4 prose-blockquote:border-primary/60 prose-blockquote:bg-primary/5 prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:not-italic prose-blockquote:text-foreground/90',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="my-6 overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-secondary/40 text-foreground" {...props} />,
          th: ({ node, ...props }) => (
            <th className="border-b border-border/60 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b border-border/30 px-4 py-3 align-top text-sm text-foreground/85 last:border-b-0" {...props} />
          ),
          tr: (props) => <tr className="even:bg-card/30" {...props} />,
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="rounded-[6px] border border-border/40 bg-secondary/40 px-1.5 py-0.5 font-mono text-[0.85em] text-primary" {...props}>
                  {children}
                </code>
              )
            }
            return <code className="font-mono text-sm leading-relaxed" {...props}>{children}</code>
          },
          pre: ({ node, ...props }) => (
            <pre className="my-6 overflow-x-auto rounded-xl border border-border/60 bg-[#0a0a14] p-5 text-sm leading-relaxed text-foreground/90 shadow-inner" {...props} />
          ),
          ul: (props) => <ul className="my-4 list-disc space-y-2 pl-6 marker:text-muted-foreground" {...props} />,
          ol: (props) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-muted-foreground" {...props} />,
          hr: () => <hr className="my-10 border-border/40" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}

/* ─── Workspace (Notes + Quiz + chat starter) ─────────────────────────── */
function WorkspacePane({
  topic, jobRole, notes, setNotes,
  notesSaving, notesSyncedAt,
  chatInput, setChatInput, onSendChat, chatPending,
}) {
  const [tab, setTab] = useState('notes')
  return (
    <Card className="overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
        <CardHeader className="border-b border-border/40 px-5 py-4">
          <TabsList className="w-full justify-start gap-1 bg-secondary/30 p-1">
            <TabsTrigger value="notes" className="gap-1.5 text-xs">
              <NotebookPen className="h-3.5 w-3.5" /> Notes
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" /> Quiz
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <TabsContent value="notes" className="m-0">
          <div className="flex flex-col gap-3 px-5 pt-5 pb-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jot down questions, examples, or your own summary as you read…"
              className="min-h-[260px] resize-none border-border/40 bg-secondary/20 text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{notes.length} characters</span>
              {notesSaving ? (
                <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
              ) : notesSyncedAt ? (
                <span>Synced at {new Date(notesSyncedAt).toLocaleTimeString()}</span>
              ) : null}
            </div>
          </div>
          <ChatStarter
            input={chatInput}
            setInput={setChatInput}
            onSend={onSendChat}
            pending={chatPending}
          />
        </TabsContent>

        <TabsContent value="quiz" className="m-0">
          <QuizPane topic={topic} jobRole={jobRole} />
        </TabsContent>
      </Tabs>
    </Card>
  )
}

function ChatStarter({ input, setInput, onSend, pending }) {
  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input) }
  }
  return (
    <div className="border-t border-border/40 bg-card/40 p-5">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <MessagesSquare className="h-3 w-3" /> Ask the AI tutor
      </div>
      <div className="relative">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder="e.g. Why are heaps faster than sorted arrays for top-K queries?"
          className="resize-none border-border/40 bg-secondary/20 pr-14 text-sm leading-relaxed"
        />
        {/* Enlarged send button */}
        <button
          onClick={() => onSend(input)}
          disabled={!input.trim() || pending}
          aria-label="Send"
          className={cn(
            'absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-lg transition-all',
            input.trim()
              ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105 hover:bg-primary/90'
              : 'bg-secondary/40 text-muted-foreground cursor-not-allowed',
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
        </button>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for newline</div>
    </div>
  )
}

/* ─── Chat (expanded mode) ─────────────────────────────────────────────── */
function ChatPane({ messages, pending, input, setInput, onSend, onReset, scrollRef }) {
  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }
  return (
    <Card className="flex h-[calc(100vh-180px)] min-h-[600px] flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
            <Bot className="h-3.5 w-3.5" />
          </span>
          AI tutor chat
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs text-muted-foreground">
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      </CardHeader>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Ask anything about this topic to begin.
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {pending && (
          <div className="flex items-start gap-3">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border/40 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 bg-card/40 p-4">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            placeholder="Ask a follow-up…"
            className="resize-none border-border/40 bg-secondary/20 pr-14 text-sm leading-relaxed"
          />
          {/* Enlarged send button */}
          <button
            onClick={onSend}
            disabled={!input.trim() || pending}
            aria-label="Send"
            className={cn(
              'absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-lg transition-all',
              input.trim()
                ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105 hover:bg-primary/90'
                : 'bg-secondary/40 text-muted-foreground cursor-not-allowed',
            )}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </Card>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs',
        isUser ? 'bg-secondary/60 text-foreground' : 'bg-primary/15 text-primary',
      )}>
        {isUser ? <User2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn(
        'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'rounded-tr-sm bg-primary/15 text-foreground'
          : 'rounded-tl-sm border border-border/40 bg-card/60 text-foreground/90',
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-pre:my-3 prose-pre:rounded-lg prose-pre:bg-[#0a0a14] prose-pre:p-3 prose-code:text-primary prose-headings:text-foreground prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Inline Quiz (Notes tab) ─────────────────────────────────────────── */
function QuizPane({ topic, jobRole }) {
  const generateQuiz = useGenerateQuiz(topic, jobRole)
  const submitQuiz = useSubmitQuiz(topic)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  const handleGenerate = async () => {
    setResult(null); setAnswers({})
    try {
      const res = await generateQuiz.mutateAsync()
      setQuestions(res.questions || [])
    } catch { toast.error('Could not generate quiz') }
  }

  const handleSubmit = async () => {
    if (!questions.length) return
    try {
      const res = await submitQuiz.mutateAsync({ topic, job_role: jobRole, questions, answers })
      setResult(res)
      if (res.score >= 70) toast.success(`Mastered! +${res.xp_gained} XP`)
      else toast(res.message || `Score ${res.score}%`)
    } catch { toast.error('Could not submit quiz') }
  }

  if (!questions.length && !result) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Ready to test what you read?</div>
          <div className="mt-1 text-xs text-muted-foreground">Generate a 5-question quiz to lock in the concepts.</div>
        </div>
        <Button onClick={handleGenerate} disabled={generateQuiz.isPending} variant="gradient" className="mt-1 px-6">
          {generateQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate quiz
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-h-[calc(100vh-260px)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {result && <ScoreSummary result={result} onRetake={handleGenerate} />}
        {!result && questions.map((q, i) => (
          <QuestionCard key={i} question={q} index={i} answer={answers[String(i)]}
            onChange={(v) => setAnswers((c) => ({ ...c, [String(i)]: v }))} />
        ))}
        {result && questions.map((q, i) => (
          <QuestionResult key={i} q={q} index={i} answer={answers[String(i)]} item={result.results[i]} />
        ))}
      </div>
      {!result && (
        <div className="border-t border-border/40 bg-card/40 p-4">
          <Button className="w-full" variant="gradient" onClick={handleSubmit} disabled={submitQuiz.isPending}>
            {submitQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit quiz
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─── Completion Quiz Modal ───────────────────────────────────────────── */
function CompletionQuizModal({ open, onClose, topic, jobRole, onCompleted, onPending }) {
  const generateQuiz = useGenerateQuiz(topic, jobRole)
  const submitQuiz = useSubmitQuiz(topic)
  const [phase, setPhase] = useState('intro')   // intro | loading | questions | result
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  // Reset when modal opens
  useEffect(() => {
    if (open) { setPhase('intro'); setQuestions([]); setAnswers({}); setResult(null) }
  }, [open])

  const startTest = async () => {
    setPhase('loading')
    try {
      const res = await generateQuiz.mutateAsync()
      setQuestions(res.questions || [])
      setPhase('questions')
    } catch {
      toast.error('Could not generate test')
      setPhase('intro')
    }
  }

  const submitTest = async () => {
    try {
      const res = await submitQuiz.mutateAsync({
        topic, job_role: jobRole, questions, answers,
        is_completion_attempt: true,
      })
      setResult(res)
      setPhase('result')
    } catch { toast.error('Could not submit test') }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Completion Test — {topic}
          </DialogTitle>
          <DialogDescription>
            Pass this test (≥ 70%) to mark the topic as complete.
          </DialogDescription>
        </DialogHeader>

        {phase === 'intro' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/90 leading-relaxed">
              <p className="font-semibold text-foreground mb-1">How this works</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>5 questions tailored to this topic</li>
                <li>Score 70% or above → topic is <span className="text-emerald-400 font-medium">Completed</span></li>
                <li>Below 70% → you can retry or mark as <span className="text-amber-400 font-medium">Test Pending</span> to continue later</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button variant="gradient" onClick={startTest} className="flex-1">
                <Sparkles className="h-4 w-4" /> Start test
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Generating your test…</div>
          </div>
        )}

        {phase === 'questions' && (
          <div className="space-y-4 py-2">
            {questions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i}
                answer={answers[String(i)]}
                onChange={(v) => setAnswers((c) => ({ ...c, [String(i)]: v }))} />
            ))}
            <Button
              className="w-full"
              variant="gradient"
              onClick={submitTest}
              disabled={submitQuiz.isPending}
            >
              {submitQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit test
            </Button>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="space-y-4 py-2">
            {/* Score card */}
            <div className={cn(
              'rounded-xl border p-5 text-center',
              result.score >= 70 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10',
            )}>
              <div className="text-5xl font-bold tracking-tight mb-1">
                {result.score}<span className="text-2xl text-muted-foreground">%</span>
              </div>
              <div className={cn(
                'text-sm font-semibold',
                result.score >= 70 ? 'text-emerald-400' : 'text-amber-400',
              )}>
                {result.score >= 70 ? '🎉 Topic mastered!' : 'Not quite there yet'}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {result.correct} / {result.total} correct
                {result.xp_gained ? ` · +${result.xp_gained} XP` : ''}
              </div>
              <Progress
                value={result.score}
                className={cn('mt-4 h-2', result.score >= 70 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500')}
              />
            </div>

            {/* Result questions */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {questions.map((q, i) => (
                <QuestionResult key={i} q={q} index={i} answer={answers[String(i)]} item={result.results[i]} />
              ))}
            </div>

            {/* Actions */}
            {result.score >= 70 ? (
              <Button className="w-full" variant="gradient" onClick={onCompleted}>
                <CheckCircle2 className="h-4 w-4" /> Mark as Completed & go to Hub
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button className="w-full" variant="gradient" onClick={startTest}>
                  <RefreshCw className="h-4 w-4" /> Retry test
                </Button>
                <Button variant="outline" onClick={onPending} className="w-full text-amber-400 border-amber-500/40 hover:bg-amber-500/10">
                  Mark as Test Pending &amp; continue later
                </Button>
                <Button variant="ghost" className="w-full" onClick={onClose}>
                  Stay here &amp; keep studying
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Practice Questions Modal ────────────────────────────────────────── */
function PracticeModal({ open, onClose, topic, jobRole, chatMessages }) {
  const practiceQ = usePracticeQuestions(topic, jobRole)
  const submitQuiz = useSubmitQuiz(topic)
  const [phase, setPhase] = useState('idle')   // idle | loading | questions | result
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (open) { setPhase('idle'); setQuestions([]); setAnswers({}); setResult(null) }
  }, [open])

  const generate = async () => {
    setPhase('loading')
    try {
      const res = await practiceQ.mutateAsync({ chat_messages: chatMessages, num_questions: 5 })
      setQuestions(res.questions || [])
      setPhase('questions')
    } catch {
      toast.error('Could not generate practice questions')
      setPhase('idle')
    }
  }

  const submit = async () => {
    try {
      const res = await submitQuiz.mutateAsync({
        topic, job_role: jobRole, questions, answers,
        is_completion_attempt: false,
      })
      setResult(res)
      setPhase('result')
      if (res.score >= 70) toast.success(`Great practice! +${res.xp_gained} XP`)
    } catch { toast.error('Could not submit') }
  }

  const contextNote = chatMessages.length > 0
    ? `Based on your article + ${chatMessages.length} chat messages`
    : 'Based on the article content'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Practice Questions — {topic}
          </DialogTitle>
          <DialogDescription>{contextNote}</DialogDescription>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground leading-relaxed">
              These questions are dynamically generated from{' '}
              <span className="text-foreground font-medium">what you actually read and discussed</span>,
              not a generic bank. Scores from practice questions also update your skill profile.
            </div>
            <div className="flex gap-2">
              <Button variant="gradient" onClick={generate} className="flex-1">
                <Sparkles className="h-4 w-4" /> Generate questions
              </Button>
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Analysing your study session…</div>
          </div>
        )}

        {phase === 'questions' && (
          <div className="space-y-4 py-2">
            {questions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i}
                answer={answers[String(i)]}
                onChange={(v) => setAnswers((c) => ({ ...c, [String(i)]: v }))} />
            ))}
            <Button className="w-full" variant="gradient" onClick={submit} disabled={submitQuiz.isPending}>
              {submitQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="space-y-4 py-2">
            <ScoreSummary result={result} onRetake={generate} />
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {questions.map((q, i) => (
                <QuestionResult key={i} q={q} index={i} answer={answers[String(i)]} item={result.results[i]} />
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Shared question components ──────────────────────────────────────── */
function QuestionCard({ question, index, answer, onChange }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="outline" className="font-mono">Q{index + 1}</Badge>
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
          {question.type === 'mcq' ? 'Multiple choice' : 'Short answer'}
        </Badge>
      </div>
      <div className="mb-4 text-sm leading-relaxed text-foreground">{question.question}</div>
      {question.type === 'mcq' ? (
        <div className="space-y-2">
          {(question.options || []).map((opt, idx) => {
            const selected = String(answer) === String(idx)
            return (
              <button key={idx} onClick={() => onChange(String(idx))}
                className={cn(
                  'block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-all',
                  selected
                    ? 'border-primary/70 bg-primary/15 text-foreground'
                    : 'border-border/40 bg-secondary/20 text-foreground/90 hover:border-border/70 hover:bg-secondary/30',
                )}
              >
                <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <Textarea rows={3} value={answer || ''} onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer…" className="border-border/40 bg-secondary/20" />
      )}
    </div>
  )
}

function QuestionResult({ q, index, answer, item }) {
  if (!item) return null
  const correct = item.is_correct
  return (
    <div className={cn(
      'rounded-xl border p-5',
      correct ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10',
    )}>
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="outline" className="font-mono">Q{index + 1}</Badge>
        {correct ? (
          <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Correct</Badge>
        ) : (
          <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Incorrect</Badge>
        )}
      </div>
      <div className="text-sm leading-relaxed text-foreground">{q.question}</div>
      {q.type === 'mcq' && (
        <div className="mt-3 text-xs text-muted-foreground">
          Your pick: <span className="text-foreground">{(q.options || [])[Number(answer)] ?? '—'}</span>
        </div>
      )}
      {q.type === 'short_answer' && (
        <div className="mt-3 text-xs text-muted-foreground">
          Your answer: <span className="text-foreground">{answer || '—'}</span>
        </div>
      )}
      {item.feedback && (
        <div className="mt-4 rounded-lg bg-card/60 p-3 text-xs leading-relaxed text-foreground/90">{item.feedback}</div>
      )}
      {item.follow_up && (
        <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground/90">
          <span className="font-semibold text-primary">Follow-up:</span> {item.follow_up}
        </div>
      )}
    </div>
  )
}

function ScoreSummary({ result, onRetake }) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Your score</CardTitle>
          <Badge variant={result.score >= 70 ? 'success' : 'warning'}>{result.correct} / {result.total}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={result.score} />
        <div className="flex items-center justify-between text-sm text-foreground">
          <div className="font-semibold">{result.score}%</div>
          <div className="text-xs text-muted-foreground">
            {result.message} {result.xp_gained ? `· +${result.xp_gained} XP` : ''}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onRetake}>
            <RefreshCw className="h-3.5 w-3.5" /> Retake
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
