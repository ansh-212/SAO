import React, { useState, useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Upload, FileText, Activity, ShieldCheck, Link, Loader2, Code, Lightbulb,
    Target, Zap, Play, CheckCircle, RefreshCw, ArrowRight, Brain, Terminal, Send,
    Clock, Eye, EyeOff, AlertTriangle, Camera
} from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import DarkLayout from '../components/layout/DarkLayout'
import Proctor from '../components/Proctor'
import ProctorStats from '../components/ProctorStats'
import { useAuth } from '../context/AuthContext'
import { DEMO_AI_EVALUATION } from '../data/demoData'
import '../styles/page-animations.css'

/* ─── Toast Component ──────────────────────────────────────────────────── */
function Toast({ message, type = 'error', onDismiss }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 5000)
        return () => clearTimeout(t)
    }, [onDismiss])
    return (
        <motion.div
            className={`dk-toast dk-toast-${type}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
        >
            <span>{type === 'error' ? '⚠' : '✅'}</span>
            <span>{message}</span>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', marginLeft: 8 }}>×</button>
        </motion.div>
    )
}

const API_BASE = '/api/coding'

export default function CodingSkills() {
    const { isDemoMode } = useAuth()
    // View Mode: 'home' | 'coding' | 'results'
    const [viewMode, setViewMode] = useState('home')

    // Document Analysis State
    const [file, setFile] = useState(null)
    const [urlInput, setUrlInput] = useState("")
    const [analysis, setAnalysis] = useState(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [error, setError] = useState(null)

    // BATCH ASSESSMENT STATE (Always 4 questions)
    const [batchQuestions, setBatchQuestions] = useState([])
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [questionResults, setQuestionResults] = useState({})

    // Coding IDE State
    const editorRef = useRef(null)
    const proctorRef = useRef(null)
    const [output, setOutput] = useState("Click 'Run Code' to test with sample cases, or 'Submit' for full evaluation...")
    const [isRunning, setIsRunning] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [toast, setToast] = useState(null)
    const [evalPhaseText, setEvalPhaseText] = useState('')

    // Timer
    const [timeLeft, setTimeLeft] = useState(0)
    const [timerActive, setTimerActive] = useState(false)
    const [totalTimeLimit, setTotalTimeLimit] = useState(0)

    // Proctor
    const [proctorData, setProctorData] = useState(null)
    const [showProctor, setShowProctor] = useState(true)

    // Per-question persistent state
    const [perQuestionCode, setPerQuestionCode] = useState([])
    const [perQuestionOutput, setPerQuestionOutput] = useState([])
    const [perQuestionRunCount, setPerQuestionRunCount] = useState([])
    const [perQuestionLogs, setPerQuestionLogs] = useState([])

    // Default scenario
    const [scenario, setScenario] = useState({
        title: "Scenario: N-ary Tree Properties",
        description: `## Problem Statement
Given the root of an N-ary tree, count its leaf nodes, internal nodes, and find the maximum number of children any node has.

A **leaf node** is a node with no children.
An **internal node** is a node with at least one child.

## Examples
**Example 1:**
Input: root = [1, [2, [5, 6]], 3, [4, [7]]]
Output: [4, 3, 3]
Explanation: Leaf nodes: 5, 6, 3, 7 (count=4). Internal nodes: 1, 2, 4 (count=3). Max children: node 1 has 3 children.

**Example 2:**
Input: root = [10, [20, 30]]
Output: [2, 1, 2]

**Example 3:**
Input: root = [50]
Output: [1, 0, 0]

## Constraints
- The number of nodes is in the range [1, 10^4]
- 0 <= Node.data <= 10^5`,
        userCode: `from typing import List, Optional, Dict, Set, Tuple

class Node:
    def __init__(self, data: int = 0):
        self.data = data
        self.children: List['Node'] = []

class Solution:
    def countTreeProperties(self, root: 'Node') -> List[int]:
        """
        Count leaf nodes, internal nodes, and max children in an N-ary tree.
        
        Args:
            root: The root node of the N-ary tree
            
        Returns:
            A list of three integers: [num_leaf_nodes, num_internal_nodes, max_children_count]
        """
        pass`,
        sampleTests: "",
        comprehensiveTests: ""
    })

    // Telemetry
    const [runCount, setRunCount] = useState(0)
    const [sessionLogs, setSessionLogs] = useState([])

    // Anti-cheat telemetry
    const [tabSwitchCount, setTabSwitchCount] = useState(0)
    const [pasteCount, setPasteCount] = useState(0)
    const tabSwitchRef = useRef(0)
    const pasteRef = useRef(0)

    // Track tab switches
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && viewMode === 'coding') {
                tabSwitchRef.current += 1
                setTabSwitchCount(tabSwitchRef.current)
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [viewMode])

    // Track paste events
    useEffect(() => {
        const handlePaste = (e) => {
            if (viewMode === 'coding') {
                const pastedText = e.clipboardData?.getData('text') || ''
                if (pastedText.length > 20) {
                    pasteRef.current += 1
                    setPasteCount(pasteRef.current)
                }
            }
        }
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [viewMode])

    // Timer countdown
    useEffect(() => {
        if (!timerActive || timeLeft <= 0) return
        const timer = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    setTimerActive(false)
                    handleEvaluate() // Auto-submit on timer expiry
                    return 0
                }
                return t - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [timerActive, timeLeft])

    // Cleanup proctor on unmount
    useEffect(() => {
        return () => {
            if (proctorRef.current) proctorRef.current.stop()
        }
    }, [])

    const formatTime = (s) => {
        const mins = Math.floor(s / 60)
        const secs = s % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const [results, setResults] = useState(null)

    // ─── Document Analysis Handlers ───────────────────────────────────────────

    const handleFileUpload = async (e) => {
        const selectedFile = e.target.files[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setIsAnalyzing(true)
        setError(null)
        setAnalysis(null)

        const formData = new FormData()
        formData.append("file", selectedFile)

        try {
            const response = await fetch(`${API_BASE}/analyze-doc`, {
                method: "POST",
                body: formData,
            })
            if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`)
            const data = await response.json()

            if (data.is_fallback) {
                setError("AI service temporarily unavailable. Showing default challenge. Please try again.")
            }
            setAnalysis(data)

            if (data.user_code) {
                setScenario({
                    title: `Scenario: ${data.category}`,
                    description: data.summary,
                    userCode: data.user_code,
                    sampleTests: data.sample_tests || "",
                    comprehensiveTests: data.comprehensive_tests || ""
                })
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleUrlAnalysis = async () => {
        if (!urlInput.trim()) return

        setIsAnalyzing(true)
        setError(null)
        setAnalysis(null)
        setBatchQuestions([])

        try {
            const response = await fetch(`${API_BASE}/analyze-url`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: urlInput }),
            })
            if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`)
            let data
            try {
                data = await response.json()
            } catch (jsonErr) {
                throw new Error(`Server returned invalid JSON: ${response.statusText}`)
            }

            if (data.is_fallback) {
                setError("AI service temporarily unavailable. Showing default challenge. Please try again.")
            }
            setAnalysis(data)

            if (data.questions && data.questions.length > 0) {
                // Sanitize each question — ensure all fields have safe defaults
                const questions = data.questions.map((q, i) => ({
                    question_type: q.question_type || 'scratch',
                    title: q.title || `Question ${i + 1}`,
                    description: q.description || '## Problem\nNo description available.',
                    difficulty: q.difficulty || 'Medium',
                    time_limit_minutes: q.time_limit_minutes || 12,
                    user_code: q.user_code || 'class Solution:\n    def solve(self):\n        pass',
                    sample_tests: q.sample_tests || '',
                    comprehensive_tests: q.comprehensive_tests || '',
                    hints: Array.isArray(q.hints) ? q.hints : [],
                    tags: Array.isArray(q.tags) ? q.tags : [],
                }))
                setBatchQuestions(questions)
                setCurrentQuestionIndex(0)
                setQuestionResults({})
                setPerQuestionCode(questions.map(q => q.user_code))
                setPerQuestionOutput(questions.map((q, i) =>
                    `Question ${i + 1}/${questions.length}: ${q.title}\nType: ${q.question_type.toUpperCase()}\n\nClick 'Run Code' to test...`
                ))
                setPerQuestionRunCount(questions.map(() => 0))
                setPerQuestionLogs(questions.map(() => []))

                const firstQuestion = questions[0]
                setScenario({
                    title: firstQuestion.title,
                    description: firstQuestion.description,
                    userCode: firstQuestion.user_code,
                    sampleTests: firstQuestion.sample_tests || "",
                    comprehensiveTests: firstQuestion.comprehensive_tests || ""
                })
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const startCodingChallenge = () => {
        setViewMode('coding')
        setResults(null)

        // Start timer — use total time from questions or default 45 min
        const totalMinutes = batchQuestions.length > 0
            ? batchQuestions.reduce((sum, q) => sum + (q.time_limit_minutes || 12), 0)
            : (analysis?.estimated_time_minutes || 45)
        setTotalTimeLimit(totalMinutes * 60)
        setTimeLeft(totalMinutes * 60)
        setTimerActive(true)

        if (batchQuestions.length > 0) {
            setCurrentQuestionIndex(0)
            setOutput(perQuestionOutput[0] || "Click 'Run Code' to test with sample cases, or 'Submit' for full evaluation...")
            setRunCount(perQuestionRunCount[0] || 0)
            setSessionLogs(perQuestionLogs[0] || [])

            const question = batchQuestions[0]
            setScenario({
                title: question.title,
                description: question.description,
                userCode: perQuestionCode[0] || question.user_code,
                sampleTests: question.sample_tests || "",
                comprehensiveTests: question.comprehensive_tests || ""
            })
        } else {
            setOutput("Click 'Run Code' to test with sample cases, or 'Submit' for full evaluation...")
            setRunCount(0)
            setSessionLogs([])
        }
    }

    const saveCurrentQuestionState = () => {
        const idx = currentQuestionIndex
        if (idx < 0 || idx >= batchQuestions.length) return
        const currentCode = editorRef.current ? editorRef.current.getValue() : perQuestionCode[idx]
        setPerQuestionCode(prev => { const copy = [...prev]; copy[idx] = currentCode; return copy })
        setPerQuestionOutput(prev => { const copy = [...prev]; copy[idx] = output; return copy })
        setPerQuestionRunCount(prev => { const copy = [...prev]; copy[idx] = runCount; return copy })
        setPerQuestionLogs(prev => { const copy = [...prev]; copy[idx] = sessionLogs; return copy })
    }

    const loadQuestion = (index) => {
        if (index < 0 || index >= batchQuestions.length) return
        if (index === currentQuestionIndex) return
        saveCurrentQuestionState()
        const question = batchQuestions[index]
        setCurrentQuestionIndex(index)
        const savedCode = perQuestionCode[index] || question.user_code
        setScenario({
            title: question.title,
            description: question.description,
            userCode: savedCode,
            sampleTests: question.sample_tests || "",
            comprehensiveTests: question.comprehensive_tests || ""
        })
        if (editorRef.current) editorRef.current.setValue(savedCode)
        setOutput(perQuestionOutput[index] || `Question ${index + 1}/4: ${question.title}\nType: ${question.question_type.toUpperCase()}\n\nClick 'Run Code' to test...`)
        setRunCount(perQuestionRunCount[index] || 0)
        setSessionLogs(perQuestionLogs[index] || [])
    }

    const goToNextQuestion = () => {
        if (currentQuestionIndex < batchQuestions.length - 1) loadQuestion(currentQuestionIndex + 1)
    }

    const goToPreviousQuestion = () => {
        if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1)
    }

    const getQuestionTypeBadge = (type) => {
        const badges = {
            scratch: { cls: "badge badge-primary", label: "Scratch" },
            logic_bug: { cls: "badge badge-danger", label: "🐛 Logic Bug" },
            syntax_error: { cls: "badge badge-warning", label: "🔧 Syntax Fix" },
            optimization: { cls: "badge badge-cyan", label: "⚡ Optimize" }
        }
        return badges[type] || { cls: "badge", label: type }
    }

    const handleEditorMount = (editor) => { editorRef.current = editor }

    // ─── Code Execution Handlers ─────────────────────────────────────────────

    const handleRunCode = async () => {
        setIsRunning(true)
        setOutput("Running sample tests...")
        const userCode = editorRef.current.getValue()
        const currentAttempt = runCount + 1
        setRunCount(currentAttempt)
        const idx = currentQuestionIndex
        setPerQuestionCode(prev => { const copy = [...prev]; copy[idx] = userCode; return copy })
        setPerQuestionRunCount(prev => { const copy = [...prev]; copy[idx] = currentAttempt; return copy })

        try {
            const response = await fetch(`${API_BASE}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: userCode,
                    sample_tests: scenario.sampleTests,
                    comprehensive_tests: scenario.comprehensiveTests,
                    is_submit: false
                }),
            })
            let data
            try {
                data = await response.json()
            } catch (jsonErr) {
                const errMsg = `Server error: ${response.status} ${response.statusText}`
                setOutput(errMsg)
                setPerQuestionOutput(prev => { const copy = [...prev]; copy[idx] = errMsg; return copy })
                return
            }
            let resultText = ""
            if (data.stderr && data.stderr.trim()) resultText = `ERRORS:\n${data.stderr}\n\n`
            if (data.stdout && data.stdout.trim()) resultText += data.stdout
            if (!resultText.trim()) resultText = "No output. Make sure your solution returns a value."
            setOutput(resultText)
            setPerQuestionOutput(prev => { const copy = [...prev]; copy[idx] = resultText; return copy })

            const hasStderrError = data.stderr && data.stderr.trim()
            const stdoutText = data.stdout || ''
            const hasStdoutFailure = /FAIL|Wrong Answer|Runtime Error|Error Message:/.test(stdoutText)

            if (hasStderrError || hasStdoutFailure) {
                const errorContent = hasStderrError
                    ? data.stderr
                    : stdoutText.split('\n').filter(l => /FAIL|Wrong Answer|Runtime Error|Error/.test(l)).join('\n')
                const newLog = { attempt: currentAttempt, log: errorContent }
                setSessionLogs(prev => {
                    const updated = [...prev, newLog]
                    setPerQuestionLogs(prevLogs => { const copy = [...prevLogs]; copy[idx] = updated; return copy })
                    return updated
                })
            }
        } catch (err) {
            const errMsg = "Error: Could not connect to execution engine."
            setOutput(errMsg)
            setPerQuestionOutput(prev => { const copy = [...prev]; copy[idx] = errMsg; return copy })
        } finally {
            setIsRunning(false)
        }
    }

    const handleSubmitCode = async () => {
        setIsSubmitting(true)
        setOutput("Running comprehensive tests (50+ cases)...")
        const userCode = editorRef.current.getValue()
        const currentAttempt = runCount + 1
        setRunCount(currentAttempt)
        const idx = currentQuestionIndex
        setPerQuestionCode(prev => { const copy = [...prev]; copy[idx] = userCode; return copy })
        setPerQuestionRunCount(prev => { const copy = [...prev]; copy[idx] = currentAttempt; return copy })

        try {
            const response = await fetch(`${API_BASE}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: userCode,
                    sample_tests: scenario.sampleTests,
                    comprehensive_tests: scenario.comprehensiveTests,
                    is_submit: true
                }),
            })
            const data = await response.json()
            let resultText = ""
            if (data.stderr && data.stderr.trim()) resultText = `ERRORS:\n${data.stderr}\n\n`
            if (data.stdout && data.stdout.trim()) resultText += data.stdout
            if (!resultText.trim()) resultText = "No output. Make sure your solution returns a value."
            setOutput(resultText)
            setPerQuestionOutput(prev => { const copy = [...prev]; copy[idx] = resultText; return copy })

            const hasStderrError = data.stderr && data.stderr.trim()
            const stdoutText = data.stdout || ''
            const hasStdoutFailure = /FAIL|Wrong Answer|Runtime Error|Error Message:/.test(stdoutText)

            if (hasStderrError || hasStdoutFailure) {
                const errorContent = hasStderrError
                    ? data.stderr
                    : stdoutText.split('\n').filter(l => /FAIL|Wrong Answer|Runtime Error|Error/.test(l)).join('\n')
                const newLog = { attempt: currentAttempt, log: errorContent }
                setSessionLogs(prev => {
                    const updated = [...prev, newLog]
                    setPerQuestionLogs(prevLogs => { const copy = [...prevLogs]; copy[idx] = updated; return copy })
                    return updated
                })
            }
        } catch (err) {
            const errMsg = "Error: Could not connect to execution engine."
            setOutput(errMsg)
            setPerQuestionOutput(prev => { const copy = [...prev]; copy[idx] = errMsg; return copy })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEvaluate = async () => {
        setIsEvaluating(true)
        setTimerActive(false)
        saveCurrentQuestionState()
        setEvalPhaseText('Submitting code...')

        // Gather proctor stats
        const proctoringStats = proctorRef.current ? proctorRef.current.getStats() : null
        if (proctorRef.current) proctorRef.current.stop()

        const latestCode = editorRef.current ? editorRef.current.getValue() : perQuestionCode[currentQuestionIndex]
        const codeSnapshot = [...perQuestionCode]
        codeSnapshot[currentQuestionIndex] = latestCode
        const runCountSnapshot = [...perQuestionRunCount]
        runCountSnapshot[currentQuestionIndex] = runCount
        const logsSnapshot = [...perQuestionLogs]
        logsSnapshot[currentQuestionIndex] = sessionLogs

        const timeTaken = totalTimeLimit - timeLeft

        // Eval phase text animation
        const phaseTimers = [
            setTimeout(() => setEvalPhaseText('Analyzing AST structure...'), 1500),
            setTimeout(() => setEvalPhaseText('Evaluating code complexity...'), 3500),
            setTimeout(() => setEvalPhaseText('Running semantic analysis...'), 6000),
            setTimeout(() => setEvalPhaseText('Computing cognitive scores...'), 9000),
        ]

        // Demo mode bypass
        if (isDemoMode) {
            setTimeout(() => {
                phaseTimers.forEach(clearTimeout)
                const demoResult = {
                    ...DEMO_AI_EVALUATION,
                    _proctoring: proctoringStats || { integrity_score: 92, face_present_pct: 97, total_violations: 1, objects_detected: [], expression_summary: { dominant: 'neutral' } },
                    _timeTaken: timeTaken || 180,
                }
                setResults(demoResult)
                setViewMode('results')
                setIsEvaluating(false)
            }, 4000)
            return
        }

        if (batchQuestions.length > 0) {
            const batchPayload = {
                questions: batchQuestions.map((q, idx) => ({
                    question_type: q.question_type,
                    title: q.title,
                    code: codeSnapshot[idx] || q.user_code,
                    attempts: runCountSnapshot[idx] || 0,
                    logs: (logsSnapshot[idx] || []).map((log, logIdx) => ({
                        attempt: log.attempt || logIdx + 1,
                        log: log.log || ""
                    }))
                })),
                tab_switches: tabSwitchRef.current,
                paste_count: pasteRef.current,
                proctoring_data: proctoringStats,
                time_taken_seconds: timeTaken,
            }

            try {
                const response = await fetch(`${API_BASE}/batch-submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(batchPayload),
                })
                const data = await response.json()
                data._proctoring = proctoringStats
                data._timeTaken = timeTaken
                setResults(data)
                setViewMode('results')
            } catch (err) {
                setToast({ message: 'Could not connect to evaluation service. Check your connection.', type: 'error' })
            } finally {
                phaseTimers.forEach(clearTimeout)
                setIsEvaluating(false)
            }
        } else {
            const finalPayload = {
                code: latestCode,
                attempts: runCount,
                logs: sessionLogs,
                tab_switches: tabSwitchRef.current,
                paste_count: pasteRef.current,
                proctoring_data: proctoringStats,
                time_taken_seconds: timeTaken,
            }

            try {
                const response = await fetch(`${API_BASE}/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(finalPayload),
                })
                const data = await response.json()
                data._proctoring = proctoringStats
                data._timeTaken = timeTaken
                setResults(data)
                setViewMode('results')
            } catch (err) {
                setToast({ message: 'Could not connect to evaluation service. Check your connection.', type: 'error' })
            } finally {
                phaseTimers.forEach(clearTimeout)
                setIsEvaluating(false)
            }
        }
    }

    const resetAll = () => {
        setViewMode('home')
        setAnalysis(null)
        setFile(null)
        setUrlInput("")
        setError(null)
        setResults(null)
        setRunCount(0)
        setSessionLogs([])
        setBatchQuestions([])
        setCurrentQuestionIndex(0)
        setQuestionResults({})
        setPerQuestionCode([])
        setPerQuestionOutput([])
        setPerQuestionRunCount([])
        setPerQuestionLogs([])
        setTimerActive(false)
        setTimeLeft(0)
        setTotalTimeLimit(0)
        setProctorData(null)
        setShowProctor(true)
        setTabSwitchCount(0)
        setPasteCount(0)
        tabSwitchRef.current = 0
        pasteRef.current = 0
    }

    // ════════════════════════════════════════════════════════════
    // RENDER: RESULTS VIEW
    // ════════════════════════════════════════════════════════════

    if (viewMode === 'results' && results) {
        const chartData = [
            { subject: 'Logic', A: results.logic_score || 0, fullMark: 100 },
            { subject: 'Resilience', A: results.resilience_score || 0, fullMark: 100 },
            { subject: 'Clean Code', A: results.clean_code_score || 0, fullMark: 100 },
            { subject: 'Debugging', A: results.debugging_score || 0, fullMark: 100 },
            { subject: 'Originality', A: results.originality_score || 0, fullMark: 100 },
        ]

        return (
            <DarkLayout>
                <div className="dk-page">
                    <div className="dk-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1>📊 Cognitive Profile</h1>
                            <p>AI-powered skill assessment complete</p>
                        </div>
                        <button onClick={resetAll} className="dk-btn dk-btn-ghost">
                            <RefreshCw size={16} /> New Session
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        {/* Radar Chart */}
                        <div className="dk-spotlight-card" style={{ height: '320px', padding: 24 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                                    <PolarGrid stroke="rgba(99,102,241,0.2)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Radar name="Candidate" dataKey="A" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Executive Summary + Scores */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="dk-card">
                                <h3 style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    Executive Summary
                                </h3>
                                <p style={{ color: 'var(--dk-text-sub)', lineHeight: 1.7, fontSize: '0.9rem' }}>{results.executive_summary}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '16px' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dk-green)' }}>{results.logic_score}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Logic Score</div>
                                </div>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '16px' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a855f7' }}>{results.resilience_score}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Grit Metric</div>
                                </div>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '16px' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dk-primary-light)' }}>{results.clean_code_score}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Clean Code</div>
                                </div>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '16px' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dk-amber)' }}>{results.debugging_score}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Debugging</div>
                                </div>
                                <div className="dk-card" style={{
                                    textAlign: 'center', padding: '16px', gridColumn: 'span 2',
                                    background: results.originality_score < 30 ? 'rgba(248,113,113,0.08)' : 'var(--dk-surface)',
                                    borderColor: results.originality_score < 30 ? 'rgba(248,113,113,0.3)' : 'var(--dk-border)'
                                }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: results.originality_score < 30 ? 'var(--danger)' : 'var(--success)' }}>
                                        {results.originality_score}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
                                        Originality {results.originality_score < 30 && "— Flagged"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Telemetry Bar */}
                    <div className="dk-card" style={{ marginTop: '24px', padding: '16px 20px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Session Telemetry:</span>{' '}
                            {perQuestionRunCount.reduce((a, b) => a + b, 0) || runCount} total execution attempts,{' '}
                            {perQuestionLogs.reduce((a, b) => a + b.length, 0) || sessionLogs.length} total errors,{' '}
                            {batchQuestions.length || 1} question(s) evaluated
                            {results._timeTaken > 0 && (
                                <span style={{ fontWeight: 600 }}>
                                    {' '}| ⏱️ {Math.floor(results._timeTaken / 60)}m {results._timeTaken % 60}s
                                </span>
                            )}
                            {tabSwitchCount > 0 && (
                                <span style={{ color: tabSwitchCount >= 5 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                                    {' '}| 🔀 {tabSwitchCount} tab switch{tabSwitchCount !== 1 ? 'es' : ''}
                                </span>
                            )}
                            {pasteCount > 0 && (
                                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                    {' '}| 📋 {pasteCount} paste{pasteCount !== 1 ? 's' : ''} detected
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Proctoring Report */}
                    {results._proctoring && (
                        <div className="dk-card" style={{ marginTop: '16px', padding: '20px' }}>
                            <h3 style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '12px' }}>
                                🔒 Proctoring Report
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${results._proctoring.suspicion_score !== undefined ? 5 : 4}, 1fr)`, gap: '12px' }}>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                    <div style={{
                                        fontSize: '1.5rem', fontWeight: 800,
                                        color: results._proctoring.integrity_score >= 70 ? 'var(--dk-green)' : results._proctoring.integrity_score >= 40 ? 'var(--dk-amber)' : 'var(--dk-red)'
                                    }}>{results._proctoring.integrity_score}%</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Integrity</div>
                                </div>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dk-primary-light)' }}>{results._proctoring.face_present_pct}%</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Face Present</div>
                                </div>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                    <div style={{
                                        fontSize: '1.5rem', fontWeight: 800,
                                        color: results._proctoring.total_violations === 0 ? 'var(--dk-green)' : 'var(--dk-red)'
                                    }}>{results._proctoring.total_violations}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Violations</div>
                                </div>
                                <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                        {results._proctoring.expression_summary?.dominant === 'neutral' ? '😐' :
                                            results._proctoring.expression_summary?.dominant === 'happy' ? '😊' :
                                                results._proctoring.expression_summary?.dominant === 'surprised' ? '😲' : '😐'}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
                                        {results._proctoring.expression_summary?.dominant || 'neutral'}
                                    </div>
                                </div>
                                {results._proctoring.suspicion_score !== undefined && (
                                    <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                        <div style={{
                                            fontSize: '1.5rem', fontWeight: 800,
                                            color: results._proctoring.suspicion_score <= 20 ? 'var(--dk-green)' : results._proctoring.suspicion_score <= 50 ? 'var(--dk-amber)' : 'var(--dk-red)'
                                        }}>
                                            {results._proctoring.suspicion_score}
                                            <span style={{ fontSize: '0.75rem' }}>
                                                {results._proctoring.suspicion_trend === 'rising' ? '↗' : results._proctoring.suspicion_trend === 'falling' ? '↘' : '→'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>Suspicion</div>
                                    </div>
                                )}
                            </div>
                            {results._proctoring.objects_detected?.length > 0 && (
                                <div className="dk-alert dk-alert-error" style={{ marginTop: 12 }}>
                                    ⚠️ Objects detected: {results._proctoring.objects_detected.join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DarkLayout>
        )
    }

    // ════════════════════════════════════════════════════════════
    // RENDER: CODING IDE VIEW
    // ════════════════════════════════════════════════════════════

    if (viewMode === 'coding') {
        const currentQuestion = batchQuestions.length > 0 ? batchQuestions[currentQuestionIndex] : null
        const questionBadge = currentQuestion ? getQuestionTypeBadge(currentQuestion.question_type) : null

        return (
            <DarkLayout>
                {/* Toast */}
                <AnimatePresence>{toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}</AnimatePresence>

                {/* Evaluating Overlay */}
                <AnimatePresence>
                    {isEvaluating && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed', inset: 0, zIndex: 9999,
                                background: 'rgba(2,2,8,0.85)', backdropFilter: 'blur(12px)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
                            }}
                        >
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                                border: '2px solid rgba(99,102,241,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', position: 'relative',
                                animation: 'demo-brain-pulse 2s ease-in-out infinite',
                            }}>
                                🧠
                                <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#6366f1', animation: 'dk-spin 1.5s linear infinite' }} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                                AI Evaluation in Progress
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#818cf8', fontFamily: "'Geist Mono', monospace", animation: 'dk-eval-breathe 2s ease-in-out infinite' }}>
                                {evalPhaseText}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', overflow: 'hidden', margin: '-24px' }}>
                    {/* Timer + Anti-cheat Header Bar */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 16px', background: 'rgba(5,5,12,0.95)', borderBottom: '1px solid var(--dk-border)',
                        gap: '12px', flexShrink: 0, backdropFilter: 'blur(12px)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '6px', borderRadius: 10, color: '#fff', display: 'flex' }}>
                                <Brain size={16} />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)' }}>Coding Assessment</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Anti-cheat badges */}
                            {tabSwitchCount > 0 && (
                                <span className="badge" style={{
                                    background: tabSwitchCount >= 5 ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
                                    color: tabSwitchCount >= 5 ? '#f87171' : '#fbbf24',
                                    border: `1px solid ${tabSwitchCount >= 5 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
                                    fontSize: '0.7rem', padding: '4px 10px'
                                }}>
                                    🔀 {tabSwitchCount} tab switch{tabSwitchCount !== 1 ? 'es' : ''}
                                </span>
                            )}
                            {pasteCount > 0 && (
                                <span className="badge" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', fontSize: '0.7rem', padding: '4px 10px' }}>
                                    📋 {pasteCount} paste{pasteCount !== 1 ? 's' : ''}
                                </span>
                            )}
                            {/* Proctor integrity mini badge */}
                            {proctorData && (
                                <span className="badge" style={{
                                    background: proctorData.integrity >= 70 ? 'rgba(74,222,128,0.12)' : proctorData.integrity >= 40 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                                    color: proctorData.integrity >= 70 ? '#4ade80' : proctorData.integrity >= 40 ? '#fbbf24' : '#f87171',
                                    border: `1px solid ${proctorData.integrity >= 70 ? 'rgba(74,222,128,0.25)' : proctorData.integrity >= 40 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`,
                                    fontSize: '0.7rem', padding: '4px 10px'
                                }}>
                                    🛡️ {proctorData.integrity}%
                                </span>
                            )}
                            {/* Timer */}
                            <div style={{
                                background: timeLeft < 60 ? 'rgba(248,113,113,0.2)' : timeLeft < 300 ? 'rgba(251,191,36,0.12)' : 'var(--dk-surface-2)',
                                padding: '6px 14px', borderRadius: 10,
                                fontWeight: 800, fontSize: '1.1rem', fontFamily: "'Geist Mono', monospace",
                                color: timeLeft < 60 ? '#f87171' : timeLeft < 300 ? '#fbbf24' : 'var(--dk-text)',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                animation: timeLeft < 60 && timeLeft > 0 ? 'pulse 1s infinite' : 'none',
                                minWidth: '80px', justifyContent: 'center',
                                border: `1px solid ${timeLeft < 60 ? 'rgba(248,113,113,0.3)' : 'var(--dk-border)'}`,
                            }}>
                                <Clock size={14} />
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                    </div>

                    {/* Timer progress bar */}
                    {totalTimeLimit > 0 && (
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
                            <div style={{
                                height: '100%', transition: 'width 1s linear',
                                width: `${(timeLeft / totalTimeLimit) * 100}%`,
                                background: timeLeft < 60 ? '#f87171' : timeLeft < 300 ? '#fbbf24' : 'var(--dk-primary)'
                            }} />
                        </div>
                    )}

                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left Panel — Problem Description */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                width: showProctor ? '35%' : '40%', padding: '16px', borderRight: '1px solid var(--dk-border)',
                                display: 'flex', flexDirection: 'column', background: 'rgba(5,5,12,0.6)', overflow: 'hidden',
                                transition: 'width 0.3s'
                            }}>

                            {/* Question Navigation */}
                            {batchQuestions.length > 0 && (
                                <div className="dk-card" style={{ marginBottom: '16px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dk-text-sub)' }}>
                                            Question {currentQuestionIndex + 1} of {batchQuestions.length}
                                        </span>
                                        {questionBadge && <span className={questionBadge.cls}>{questionBadge.label}</span>}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                        {batchQuestions.map((q, idx) => {
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => loadQuestion(idx)}
                                                    className={idx === currentQuestionIndex ? 'dk-btn dk-btn-primary dk-btn-sm' : 'dk-btn dk-btn-ghost dk-btn-sm'}
                                                    style={{ justifyContent: 'center' }}
                                                >
                                                    {idx + 1}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                        <button onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0}
                                            className="dk-btn dk-btn-ghost dk-btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                            ← Previous
                                        </button>
                                        <button onClick={goToNextQuestion} disabled={currentQuestionIndex === batchQuestions.length - 1}
                                            className="dk-btn dk-btn-ghost dk-btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Problem Description */}
                            <div className="dk-card" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dk-primary-light)', marginBottom: '16px' }}>{scenario.title}</h3>
                                <div style={{ fontSize: '0.85rem', color: 'var(--dk-text-sub)', lineHeight: 1.7 }}>
                                    {scenario.description.split('\n').map((line, i) => {
                                        if (line.startsWith('## ')) {
                                            return <h4 key={i} style={{ color: 'var(--dk-primary-light)', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>{line.replace('## ', '')}</h4>
                                        } else if (line.startsWith('**') && line.endsWith('**')) {
                                            return <p key={i} style={{ fontWeight: 600, color: 'var(--dk-text)' }}>{line.replace(/\*\*/g, '')}</p>
                                        } else if (line.startsWith('- ')) {
                                            return <p key={i} style={{ paddingLeft: '16px', color: 'var(--dk-text-sub)' }}>• {line.replace('- ', '')}</p>
                                        } else if (line.startsWith('Input:') || line.startsWith('Output:') || line.startsWith('Explanation:')) {
                                            const [label, ...rest] = line.split(':')
                                            return (
                                                <p key={i} style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.85rem' }}>
                                                    <span style={{ color: '#a855f7', fontWeight: 600 }}>{label}:</span>
                                                    <span style={{ color: '#4ade80' }}>{rest.join(':')}</span>
                                                </p>
                                            )
                                        } else if (line.trim()) {
                                            return <p key={i}>{line}</p>
                                        }
                                        return null
                                    })}
                                </div>
                            </div>

                            {/* Live Telemetry */}
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--dk-border)' }}>
                                <h4 style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Live Telemetry</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>{runCount}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)' }}>Runs (this Q)</div>
                                    </div>
                                    <div className="dk-card" style={{ textAlign: 'center', padding: '12px' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>{sessionLogs.length}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--dk-text-muted)' }}>Errors (this Q)</div>
                                    </div>
                                </div>
                                {batchQuestions.length > 1 && (
                                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--dk-text-muted)', textAlign: 'center' }}>
                                        Total: {perQuestionRunCount.reduce((a, b) => a + b, 0)} runs, {perQuestionLogs.reduce((a, b) => a + b.length, 0)} errors across all questions
                                    </div>
                                )}
                            </div>

                            <button onClick={resetAll} className="dk-btn dk-btn-ghost dk-btn-sm" style={{ marginTop: '12px', justifyContent: 'center', width: '100%' }}>
                                ← Back to Home
                            </button>
                        </motion.div>

                        {/* Middle Panel — Code Editor + Terminal */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.1 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
                        >
                            {/* Toolbar */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 16px', background: 'rgba(5,5,12,0.8)', borderBottom: '1px solid var(--dk-border)',
                                backdropFilter: 'blur(8px)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Terminal size={16} style={{ color: 'var(--dk-text-muted)' }} />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--dk-text-sub)', fontWeight: 500, fontFamily: "'Geist Mono', monospace" }}>solution.py</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={handleRunCode} disabled={isRunning || isSubmitting} className="dk-btn dk-btn-ghost dk-btn-sm" style={{ gap: 6 }}>
                                        <Play size={14} style={{ color: '#4ade80' }} />
                                        {isRunning ? 'Running...' : 'Run Code'}
                                    </button>
                                    <button onClick={handleSubmitCode} disabled={isRunning || isSubmitting} className="dk-btn dk-btn-sm" style={{
                                        background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', gap: 6,
                                    }}>
                                        <Send size={14} />
                                        {isSubmitting ? 'Judging...' : 'Submit'}
                                    </button>
                                    <button onClick={handleEvaluate} disabled={isEvaluating} className="dk-btn dk-btn-sm dk-ai-evaluate-btn" style={{
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff',
                                        border: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.3)', gap: 6,
                                    }}>
                                        <CheckCircle size={14} />
                                        {isEvaluating ? 'Analyzing...' : '🤖 AI Evaluate'}
                                    </button>
                                </div>
                            </div>

                            {/* Monaco Editor */}
                            <div className="dk-editor-wrap" style={{ flex: 1 }}>
                                <Editor
                                    height="100%"
                                    defaultLanguage="python"
                                    theme="vs-dark"
                                    key={`editor-q${currentQuestionIndex}`}
                                    defaultValue={scenario.userCode}
                                    onMount={handleEditorMount}
                                    options={{
                                        minimap: { enabled: false }, fontSize: 14,
                                        fontFamily: "'Geist Mono', 'Fira Code', monospace",
                                        padding: { top: 16 }, scrollBeyondLastLine: false,
                                        smoothScrolling: true, cursorBlinking: 'smooth',
                                        cursorSmoothCaretAnimation: 'on',
                                    }}
                                />
                            </div>

                            {/* Terminal Output */}
                            <div style={{
                                height: '200px', background: '#0a0a12', borderTop: '1px solid var(--dk-border)',
                                padding: '16px', overflowY: 'auto'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Terminal size={12} /> Test Results
                                </div>
                                <pre style={{ fontSize: '0.8rem', fontFamily: "'Geist Mono', 'Fira Code', monospace", whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {output.split('\n').map((line, i) => {
                                        if (line.startsWith('--- Sample Test') || line.startsWith('--- Test')) {
                                            return <div key={i} style={{ color: '#60A5FA', fontWeight: 700, marginTop: '8px' }}>{line}</div>
                                        } else if (line.startsWith('Input:')) {
                                            return <div key={i} style={{ color: '#64748b' }}>{line}</div>
                                        } else if (line.startsWith('Expected:')) {
                                            return <div key={i} style={{ color: '#fbbf24' }}>{line}</div>
                                        } else if (line.startsWith('Actual:')) {
                                            const hasError = line.includes('ERROR') || line.includes('None')
                                            return <div key={i} style={{ color: hasError ? '#f87171' : '#22d3ee' }}>{line}</div>
                                        } else if (line.includes('Status: PASS') || line.includes('PASS')) {
                                            return <div key={i} style={{ color: '#4ade80', fontWeight: 600 }}>{line}</div>
                                        } else if (line.includes('Status: FAIL') || line.includes('FAIL') || line.includes('Wrong Answer')) {
                                            return <div key={i} style={{ color: '#f87171', fontWeight: 600 }}>{line}</div>
                                        } else if (line.includes('Accepted:') || line.includes('All test cases passed')) {
                                            return <div key={i} style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.9rem', marginTop: '8px' }}>{line}</div>
                                        } else if (line.includes('Sample Tests:') || line.includes('Passed')) {
                                            return <div key={i} style={{ color: '#fbbf24', fontWeight: 700 }}>{line}</div>
                                        } else if (line.startsWith('=')) {
                                            return <div key={i} style={{ color: '#1e293b' }}>{line}</div>
                                        } else if (line.includes('ERROR') || line.includes('Runtime Error') || line.includes('Error:')) {
                                            return <div key={i} style={{ color: '#f87171' }}>{line}</div>
                                        }
                                        return <div key={i} style={{ color: '#94a3b8' }}>{line}</div>
                                    })}
                                </pre>
                            </div>
                        </motion.div>

                        {/* Right Panel — Proctor Webcam */}
                        {showProctor && (
                            <motion.div
                                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                    width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column',
                                    gap: '8px', padding: '12px', background: 'rgba(5,5,12,0.6)',
                                    borderLeft: '1px solid var(--dk-border)', overflow: 'hidden'
                                }}
                            >
                                <div style={{ position: 'sticky', top: 0 }}>
                                    <Proctor
                                        ref={proctorRef}
                                        onViolation={(v) => console.log('Proctor violation:', v)}
                                        onStatsUpdate={setProctorData}
                                    />
                                    <div style={{ marginTop: '8px' }}>
                                        <ProctorStats proctorData={proctorData} />
                                    </div>
                                    <button
                                        className="dk-btn dk-btn-ghost dk-btn-sm"
                                        onClick={() => setShowProctor(false)}
                                        style={{ width: '100%', marginTop: '8px', fontSize: '0.65rem', justifyContent: 'center' }}
                                    >
                                        <EyeOff size={12} /> Hide Camera
                                    </button>
                                </div>
                            </motion.div>
                        )}
                        {/* Floating proctor toggle when hidden */}
                        {!showProctor && (
                            <button
                                onClick={() => setShowProctor(true)}
                                style={{
                                    position: 'fixed', bottom: 20, right: 20, zIndex: 50,
                                    width: 48, height: 48, borderRadius: '50%',
                                    border: '1px solid var(--dk-border)',
                                    background: proctorData?.faceDetected ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                                    color: proctorData?.faceDetected ? '#4ade80' : '#f87171',
                                    fontSize: 18, cursor: 'pointer',
                                    boxShadow: `0 4px 20px ${proctorData?.faceDetected ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                                    transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Show proctor camera"
                            >
                                {proctorData?.faceDetected ? '📷' : '⚠️'}
                            </button>
                        )}
                    </div> {/* end flex row */}
                </div >
            </DarkLayout >
        )
    }

    // ════════════════════════════════════════════════════════════
    // RENDER: HOME VIEW (Document Analysis)
    // ════════════════════════════════════════════════════════════

    return (
        <DarkLayout>
            <div className="dk-page">
                <div className="dk-page-header">
                    <h1>💻 Coding Skills</h1>
                    <p>Upload any technical document or paste a URL. AI generates bespoke coding challenges that measure real cognitive skills.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                    {/* Left: Upload Section */}
                    <div className="dk-stagger-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="dk-spotlight-card">
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap style={{ color: 'var(--warning)' }} size={20} />
                                Ingest Study Material
                            </h2>

                            {/* Marching ants upload zone */}
                            <label className="dk-upload-marching" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}>
                                {/* SVG border */}
                                <svg className="march-border" aria-hidden="true">
                                    <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="18" ry="18" />
                                </svg>
                                <Upload style={{ color: 'var(--dk-primary-light)', marginBottom: '12px' }} size={32} />
                                <span style={{ fontSize: '0.875rem', color: 'var(--dk-text-sub)', textAlign: 'center', fontWeight: 600 }}>
                                    Upload PDF or Text File
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', marginTop: '4px' }}>Textbooks, articles, docs</span>
                                <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                    accept=".pdf,.txt,.json,.md"
                                    disabled={isAnalyzing}
                                />
                            </label>

                            {/* Divider */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '20px 0' }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--dk-border)' }}></div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--dk-border)' }}></div>
                            </div>

                            {/* URL Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', borderRadius: 14, border: '1px solid var(--dk-border)', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', borderRight: '1px solid var(--dk-border)' }}>
                                        <Link size={16} style={{ color: 'var(--dk-text-muted)' }} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Paste GeeksForGeeks URL..."
                                        className="dk-input"
                                        style={{ border: 'none', borderRadius: 0, background: 'transparent', flex: 1 }}
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        disabled={isAnalyzing}
                                    />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', textAlign: 'center' }}>
                                    Generates 4 challenge types: Scratch • Debug • Syntax Fix • Optimization
                                </p>
                                <button onClick={handleUrlAnalysis} disabled={isAnalyzing || !urlInput.trim()} className="dk-btn-glow" style={{ width: '100%', justifyContent: 'center' }}>
                                    {isAnalyzing ? "⏳ Generating 4 Challenges..." : "🤖 Generate Assessment"}
                                </button>
                            </div>
                        </div>

                        {/* Quick Start */}
                        <button onClick={startCodingChallenge} className="dk-spotlight-card" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', background: 'var(--dk-surface)',
                            textAlign: 'left', width: '100%', border: '1px solid var(--dk-border)',
                            padding: '18px 20px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Code style={{ color: 'var(--dk-green)' }} size={20} />
                                <span style={{ fontWeight: 600, color: 'var(--dk-text)' }}>Try Demo Challenge</span>
                            </div>
                            <ArrowRight size={18} style={{ color: 'var(--dk-text-muted)' }} />
                        </button>
                    </div>

                    {/* Right: Results Section */}
                    <div>
                        {isAnalyzing ? (
                            <div className="dk-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
                                <Loader2 className="spinner" style={{ margin: '0 auto 16px', width: '48px', height: '48px', color: 'var(--dk-primary)' }} size={48} />
                                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--dk-text)' }}>Processing Document...</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--dk-text-muted)', marginTop: '8px' }}>AI is generating sample + comprehensive test suites</p>
                            </div>
                        ) : error ? (
                            <div className="dk-alert dk-alert-error" style={{ textAlign: 'center', padding: '32px', flexDirection: 'column', alignItems: 'center', display: 'flex' }}>
                                <p style={{ fontWeight: 600, marginBottom: '8px' }}>Analysis Failed</p>
                                <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>{error}</p>
                                <button onClick={() => setError(null)} style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--dk-primary-light)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                    Try Again
                                </button>
                            </div>
                        ) : analysis ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Assessment Header */}
                                <div className="dk-card" style={{ borderTop: '3px solid var(--dk-primary)', padding: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                📚 {analysis.topic || "Assessment"}
                                            </span>
                                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '12px', color: 'var(--dk-text)' }}>
                                                {batchQuestions.length} Questions Generated
                                            </h2>
                                        </div>
                                        <div className="badge badge-success" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                                            <ShieldCheck size={16} /> {analysis.estimated_time_minutes || 45} min
                                        </div>
                                    </div>
                                    {batchQuestions.length > 0 && (
                                        <div style={{ marginTop: '16px' }}>
                                            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dk-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Challenge Types</h3>
                                            <div className="grid-2">
                                                {batchQuestions.map((q, idx) => {
                                                    const badge = getQuestionTypeBadge(q.question_type)
                                                    return (
                                                        <div key={idx} className="dk-card" style={{ padding: '16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                <span className={badge.cls}>{badge.label}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)' }}>{q.time_limit_minutes} min</span>
                                                            </div>
                                                            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--dk-text)' }}>{q.title}</p>
                                                            <p style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', marginTop: '4px' }}>{q.difficulty}</p>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Assessment Overview */}
                                <div className="dk-card" style={{ padding: '24px' }}>
                                    <h3 style={{ fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--dk-text)' }}>
                                        <Target size={18} style={{ color: '#a855f7' }} /> Assessment Overview
                                    </h3>
                                    <div className="grid-2">
                                        <div className="dk-card" style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <Play size={14} style={{ color: 'var(--dk-green)' }} />
                                                <span style={{ fontWeight: 600, color: 'var(--dk-green)', fontSize: '0.85rem' }}>Run Code</span>
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--dk-text-sub)' }}>3 sample test cases per question</p>
                                        </div>
                                        <div className="dk-card" style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <Send size={14} style={{ color: 'var(--dk-primary-light)' }} />
                                                <span style={{ fontWeight: 600, color: 'var(--dk-primary-light)', fontSize: '0.85rem' }}>Submit</span>
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--dk-text-sub)' }}>20+ comprehensive tests per question</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Start Button */}
                                <button onClick={startCodingChallenge} className="dk-btn-glow" style={{ width: '100%', justifyContent: 'center', gap: '12px', fontSize: '1rem', padding: '16px 0' }}>
                                    <Play size={22} /> Start Coding Challenge
                                </button>
                            </div>
                        ) : (
                            <div className="dk-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
                                {/* Floating brain idle icon */}
                                <div className="dk-brain-idle" style={{ marginBottom: 24 }}>
                                    <Brain style={{ color: '#6366f1' }} size={64} />
                                </div>
                                <p style={{ color: 'var(--dk-text)', fontSize: '1.1rem', fontWeight: 600 }}>AI is waiting for input</p>
                                <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                                    Upload a document or paste a URL to generate challenges
                                </p>
                                <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
                                    AI will generate sample tests + 50 comprehensive edge cases
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DarkLayout>
    )
}
