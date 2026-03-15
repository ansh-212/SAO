import React, { useState, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { DEMO_CODING_CHALLENGE, DEMO_AI_EVALUATION } from '../data/demoData'
import { useAuth } from '../context/AuthContext'
import '../styles/demo-coding.css'

/* ─── Markdown-ish renderer for problem description ──────────────────── */
function ProblemDescription({ markdown }) {
    const lines = markdown.split('\n')
    const elements = []
    let inCodeBlock = false
    let codeLines = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(<pre key={`code-${i}`}>{codeLines.join('\n')}</pre>)
                codeLines = []
                inCodeBlock = false
            } else {
                inCodeBlock = true
            }
            continue
        }
        if (inCodeBlock) {
            codeLines.push(line)
            continue
        }
        if (line.startsWith('**') && line.endsWith('**')) {
            elements.push(<p key={i}><strong>{line.replace(/\*\*/g, '')}</strong></p>)
        } else if (line.startsWith('- ')) {
            elements.push(
                <p key={i} style={{ paddingLeft: 16, color: '#94a3b8' }}>
                    • {line.slice(2).replace(/`([^`]+)`/g, (_, c) => c)}
                </p>
            )
        } else if (line.trim()) {
            // Handle inline code
            const parts = line.split(/(`[^`]+`)/)
            elements.push(
                <p key={i}>
                    {parts.map((part, j) => {
                        if (part.startsWith('`') && part.endsWith('`')) {
                            return <code key={j}>{part.slice(1, -1)}</code>
                        }
                        // Handle bold
                        return part.split(/(\*\*[^*]+\*\*)/).map((seg, k) => {
                            if (seg.startsWith('**') && seg.endsWith('**')) {
                                return <strong key={`${j}-${k}`}>{seg.slice(2, -2)}</strong>
                            }
                            // Handle italic
                            return seg.split(/(\*[^*]+\*)/).map((s, l) => {
                                if (s.startsWith('*') && s.endsWith('*')) {
                                    return <em key={`${j}-${k}-${l}`}>{s.slice(1, -1)}</em>
                                }
                                return s
                            })
                        })
                    })}
                </p>
            )
        }
    }
    return <>{elements}</>
}

export default function DemoCodingChallenge() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const editorRef = useRef(null)
    const challenge = DEMO_CODING_CHALLENGE

    const [code, setCode] = useState(challenge.boilerplate)
    const [activeTab, setActiveTab] = useState('tests')
    const [testResults, setTestResults] = useState(null)
    const [evaluating, setEvaluating] = useState(false)
    const [evaluation, setEvaluation] = useState(null)
    const [running, setRunning] = useState(false)

    const handleEditorMount = useCallback((editor) => {
        editorRef.current = editor
    }, [])

    const handleRunCode = useCallback(() => {
        setRunning(true)
        setActiveTab('tests')
        // Simulate running tests with a staggered reveal
        setTimeout(() => {
            setTestResults(challenge.testCases.map((tc, i) => ({
                ...tc,
                visible: false,
            })))
            // Stagger each test result
            challenge.testCases.forEach((_, i) => {
                setTimeout(() => {
                    setTestResults(prev => prev.map((r, j) => j === i ? { ...r, visible: true } : r))
                }, 200 * (i + 1))
            })
            setRunning(false)
        }, 1200)
    }, [challenge.testCases])

    const handleSubmit = useCallback(() => {
        if (!testResults) {
            handleRunCode()
            return
        }
        setEvaluating(true)
        setActiveTab('evaluation')
        // Simulate AI evaluation delay
        setTimeout(() => {
            setEvaluation(DEMO_AI_EVALUATION)
            setEvaluating(false)
        }, 3500)
    }, [testResults, handleRunCode])

    const scoreColor = (score) => {
        if (score >= 85) return '#4ade80'
        if (score >= 65) return '#fbbf24'
        return '#f87171'
    }

    const scoreClass = (score) => {
        if (score >= 85) return 'excellent'
        if (score >= 65) return 'good'
        return 'poor'
    }

    return (
        <div className="demo-coding">
            {/* Left: Problem Description */}
            <div className="demo-problem-panel">
                <div className="demo-problem-header">
                    <Link
                        to={user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'}
                        className="demo-back-btn"
                    >
                        ← Back
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="demo-mode-badge">✨ Demo</span>
                        <span className={`demo-difficulty-badge ${challenge.difficulty.toLowerCase()}`}>
                            {challenge.difficulty}
                        </span>
                    </div>
                </div>

                <div className="demo-problem-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: 'rgba(34,211,238,0.08)',
                            border: '1px solid rgba(34,211,238,0.2)',
                            color: '#22d3ee',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                        }}>
                            {challenge.category}
                        </span>
                    </div>

                    <h1>{challenge.title}</h1>
                    <ProblemDescription markdown={challenge.description} />
                </div>
            </div>

            {/* Right: Code Editor + Output */}
            <div className="demo-editor-panel">
                <div className="demo-editor-toolbar">
                    <div className="demo-lang-badge">
                        🐍 Python 3
                    </div>
                    <div className="demo-editor-actions">
                        <button
                            className="demo-run-btn"
                            onClick={handleRunCode}
                            disabled={running || evaluating}
                        >
                            {running ? (
                                <><span style={{
                                    width: 14, height: 14,
                                    border: '2px solid rgba(148,163,184,0.3)',
                                    borderTopColor: '#94a3b8',
                                    borderRadius: '50%',
                                    animation: 'dk-spin 0.6s linear infinite',
                                    display: 'inline-block',
                                }} /> Running...</>
                            ) : (
                                <>▶ Run Code</>
                            )}
                        </button>
                        <button
                            className="demo-submit-btn"
                            onClick={handleSubmit}
                            disabled={evaluating}
                        >
                            {evaluating ? (
                                <><span style={{
                                    width: 14, height: 14,
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: '#fff',
                                    borderRadius: '50%',
                                    animation: 'dk-spin 0.6s linear infinite',
                                    display: 'inline-block',
                                }} /> Evaluating...</>
                            ) : (
                                <>🤖 Submit & Evaluate</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Monaco Editor */}
                <div className="demo-editor-wrap">
                    <Editor
                        height="100%"
                        language="python"
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        onMount={handleEditorMount}
                        options={{
                            fontSize: 14,
                            fontFamily: "'Geist Mono', 'Fira Code', monospace",
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 },
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            renderWhitespace: 'selection',
                            lineNumbers: 'on',
                            glyphMargin: false,
                            folding: true,
                            lineDecorationsWidth: 0,
                            lineNumbersMinChars: 3,
                            automaticLayout: true,
                        }}
                    />
                </div>

                {/* Output Panel */}
                {(testResults || evaluating || evaluation) && (
                    <div className="demo-output-panel">
                        <div className="demo-output-tabs">
                            <button
                                className={`demo-output-tab ${activeTab === 'tests' ? 'active' : ''}`}
                                onClick={() => setActiveTab('tests')}
                            >
                                🧪 Test Results
                            </button>
                            <button
                                className={`demo-output-tab ${activeTab === 'evaluation' ? 'active' : ''}`}
                                onClick={() => setActiveTab('evaluation')}
                            >
                                🤖 AI Evaluation
                            </button>
                        </div>

                        {activeTab === 'tests' && testResults && (
                            <div className="demo-test-results">
                                <div style={{
                                    fontSize: '0.82rem',
                                    color: '#94a3b8',
                                    marginBottom: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}>
                                    <span style={{ color: '#4ade80', fontWeight: 700 }}>
                                        {testResults.filter(t => t.passed).length}/{testResults.length}
                                    </span>
                                    test cases passed
                                </div>
                                {testResults.map((tc, i) => (
                                    <div
                                        key={i}
                                        className="demo-test-case"
                                        style={{
                                            opacity: tc.visible ? 1 : 0,
                                            transform: tc.visible ? 'translateX(0)' : 'translateX(-10px)',
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        <div className={`demo-test-icon ${tc.passed ? 'pass' : 'fail'}`}>
                                            {tc.passed ? '✓' : '✕'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginBottom: 2 }}>
                                                Case {i + 1}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: "'Geist Mono', monospace" }}>
                                                {tc.input} → {tc.expected}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'evaluation' && (
                            <div style={{ overflowY: 'auto', maxHeight: 500 }}>
                                {evaluating ? (
                                    <div className="demo-ai-loading">
                                        <div className="demo-ai-brain">🧠</div>
                                        <div className="demo-ai-loading-text">AI is analyzing your code...</div>
                                        <div className="demo-ai-loading-sub">
                                            Evaluating correctness, complexity, and code quality
                                        </div>
                                    </div>
                                ) : evaluation ? (
                                    <div className="demo-eval-card">
                                        <div className="demo-eval-header">
                                            <div className={`demo-eval-score-circle ${scoreClass(evaluation.overall_score)}`}>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>
                                                    {evaluation.overall_score}
                                                </div>
                                                <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>/ 100</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                                                    {evaluation.verdict}
                                                </div>
                                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
                                                    Bloom's Level: <span style={{ color: '#818cf8', fontWeight: 600 }}>{evaluation.bloom_level}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="demo-eval-metrics">
                                            {[
                                                { label: 'Time Complexity', ...evaluation.time_complexity },
                                                { label: 'Space Complexity', ...evaluation.space_complexity },
                                                { label: 'Correctness', ...evaluation.correctness, score: evaluation.correctness.score },
                                                { label: 'Code Quality', ...evaluation.code_quality },
                                            ].map((m, i) => (
                                                <div key={i} className="demo-eval-metric" style={{
                                                    animation: `demo-eval-entrance 0.5s cubic-bezier(0.16,1,0.3,1) ${0.1 * (i + 1)}s both`,
                                                }}>
                                                    <div className="demo-eval-metric-label">{m.label}</div>
                                                    <div className="demo-eval-metric-score" style={{ color: scoreColor(m.score) }}>
                                                        {m.score}%
                                                    </div>
                                                    <div className="demo-eval-metric-desc">
                                                        {m.label === 'Correctness' ? `${m.tests_passed}/${m.tests_total} tests passed` : m.label_text || m.analysis?.slice(0, 60) + '...'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="demo-eval-feedback">
                                            <div style={{ fontWeight: 600, marginBottom: 8, color: '#818cf8' }}>💡 AI Feedback</div>
                                            {evaluation.feedback}
                                        </div>

                                        {evaluation.code_quality.suggestions && (
                                            <div className="demo-eval-suggestions">
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                                                    📝 Suggestions
                                                </div>
                                                {evaluation.code_quality.suggestions.map((s, i) => (
                                                    <div key={i} className="demo-eval-suggestion">
                                                        <span style={{ color: '#818cf8', flexShrink: 0 }}>•</span>
                                                        <span>{s}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
