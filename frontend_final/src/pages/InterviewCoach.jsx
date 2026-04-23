import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import DarkLayout from '../components/layout/DarkLayout'
import api, { interviewSessionsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { DEMO_INTERVIEW_TOPICS } from '../data/demoData'
import Proctor from '../components/Proctor'

const CAPTURE_PATTERN = /(draw|diagram|flow\s?chart|figure|sketch|illustrate|white\s?paper|whiteboard|write the steps|write steps|commands?|command sequence|workflow|architecture|block diagram|process flow|formula)/i

function needsWrittenUpload(questionText) {
    return CAPTURE_PATTERN.test(questionText || '')
}

function extractQuestionText(message) {
    if (!message) return ''
    const parts = String(message).split('\n')
    const trimmed = parts.map(p => p.trim()).filter(Boolean)
    const questionLine = [...trimmed].reverse().find(line => line.endsWith('?'))
    if (questionLine) return questionLine
    return trimmed[trimmed.length - 1] || ''
}

function getWrittenQuestionSlots(totalQuestions) {
    const total = Math.max(1, Number(totalQuestions) || 1)
    if (total <= 4) return [2].filter((n) => n <= total)
    return [3, Math.max(4, total - 1)].filter((n, i, arr) => n <= total && arr.indexOf(n) === i)
}

function isWrittenQuestionNumber(questionNumber, totalQuestions) {
    return getWrittenQuestionSlots(totalQuestions).includes(questionNumber)
}

function shortText(value, max = 180) {
    const text = String(value || '').trim()
    if (text.length <= max) return text
    return `${text.slice(0, max).trimEnd()}...`
}

function getDemoFreshQuestion(topicName, questionNumber, totalQuestions) {
    const topic = String(topicName || '').toLowerCase()
    const written = isWrittenQuestionNumber(questionNumber, totalQuestions)

    if (written) {
        if (topic.includes('system design')) {
            return 'Draw a simple high-level architecture for a URL shortener and then explain the data flow and one scaling bottleneck.'
        }
        if (topic.includes('database')) {
            return 'Draw a small ER diagram for users, orders, and products, then explain the primary/foreign key relationships.'
        }
        if (topic.includes('algorithm') || topic.includes('data structures')) {
            return 'Write the core time-complexity formula for your approach and draw a short flowchart for the key decision steps.'
        }
        return `Draw one concise ${topicName} diagram/flow and explain your reasoning verbally.`
    }

    const bank = {
        'data structures & algorithms': [
            'How would you choose between a hash map and a balanced BST for a latency-sensitive feature?',
            'What edge cases are commonly missed in DSA interviews, and how do you systematically catch them?',
            'When can an optimization make a DSA solution worse in production?',
        ],
        'system design': [
            'How would you design graceful degradation when a downstream dependency is unstable?',
            'When would you prioritize caching over database optimization, and why?',
            'How would you define measurable SLOs for a read-heavy service?',
        ],
        'operating systems': [
            'How do scheduling decisions affect latency-sensitive applications?',
            'Explain one practical deadlock scenario and how you would prevent it.',
            'How does virtual memory behavior show up in real application performance?',
        ],
        'database management': [
            'How would you decide between normalization and denormalization for a large-scale app?',
            'Which transaction isolation level would you choose for payments and why?',
            'How would you diagnose a slow SQL query in production?',
        ],
        'computer networks': [
            'How does TCP congestion control impact end-user latency?',
            'When does HTTP/2 help significantly over HTTP/1.1?',
            'How would you debug intermittent packet loss between services?',
        ],
    }

    const exact = bank[topic]
    if (exact && exact.length) return exact[(questionNumber - 1) % exact.length]
    return `What are the most practical trade-offs in ${topicName}, and how would you choose between options in production?`
}

function prettyAnswerStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'right') return 'Right'
    if (normalized === 'partially_right') return 'Partially Right'
    if (normalized === 'wrong') return 'Wrong'
    return 'Unable to Determine'
}

function answerStatusColor(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'right') return '#34d399'
    if (normalized === 'partially_right') return '#fbbf24'
    if (normalized === 'wrong') return '#f87171'
    return 'var(--dk-text-muted)'
}

/* ─── Typing indicator dots ──────────────────────────────────────────────── */
function TypingIndicator() {
    return (
        <div style={{ display: 'flex', gap: 4, padding: '12px 16px' }}>
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#6366f1',
                        animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                />
            ))}
        </div>
    )
}

/* ─── Chat message bubble ────────────────────────────────────────────────── */
function ChatBubble({ role, content, animate = true }) {
    const isInterviewer = role === 'interviewer'
    const Wrapper = animate ? motion.div : 'div'
    const animProps = animate ? {
        initial: { opacity: 0, y: 12, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
    } : {}

    return (
        <Wrapper {...animProps} style={{
            display: 'flex', gap: 10,
            flexDirection: isInterviewer ? 'row' : 'row-reverse',
            marginBottom: 16,
        }}>
            {/* Avatar */}
            <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: isInterviewer
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                    : 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
                boxShadow: isInterviewer
                    ? '0 0 16px rgba(99,102,241,0.3)'
                    : '0 0 16px rgba(16,185,129,0.3)',
            }}>
                {isInterviewer ? '🎙️' : '👤'}
            </div>
            {/* Bubble */}
            <div style={{
                maxWidth: '75%', padding: '12px 16px', borderRadius: 16,
                background: isInterviewer
                    ? 'rgba(99,102,241,0.08)'
                    : 'rgba(16,185,129,0.08)',
                border: `1px solid ${isInterviewer ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'}`,
                fontSize: '0.88rem', lineHeight: 1.65,
                color: 'var(--dk-text)',
                whiteSpace: 'pre-wrap',
            }}>
                {content}
            </div>
        </Wrapper>
    )
}

/* ─── Score Bar component ────────────────────────────────────────────────── */
function ScoreBar({ label, score, max = 10 }) {
    const pct = (score / max) * 100
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>{label}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--dk-text)' }}>{score}/{max}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(99,102,241,0.1)' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        height: '100%', borderRadius: 99,
                        background: pct >= 70 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : pct >= 40 ? 'linear-gradient(90deg, #f59e0b, #eab308)' : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                    }}
                />
            </div>
        </div>
    )
}

/* ─── Main Interview Coach Page ──────────────────────────────────────────── */
export default function InterviewCoach() {
    const [phase, setPhase] = useState('setup') // setup | interview | evaluation
    const [topics, setTopics] = useState([])
    const [selectedTopic, setSelectedTopic] = useState('dsa')
    const [difficulty, setDifficulty] = useState('intermediate')
    const [numQuestions, setNumQuestions] = useState(5)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [questionNum, setQuestionNum] = useState(0)
    const [totalQ, setTotalQ] = useState(5)
    const [evaluation, setEvaluation] = useState(null)
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)
    const proctorRef = useRef(null)
    const [isListening, setIsListening] = useState(false)
    const recognitionRef = useRef(null)
    const [savedSessionId, setSavedSessionId] = useState(null)
    const [savingSession, setSavingSession] = useState(false)
    const [activeQuestionText, setActiveQuestionText] = useState('')
    const [questionTextByNumber, setQuestionTextByNumber] = useState({})
    const [capturePromptedByQuestion, setCapturePromptedByQuestion] = useState({})
    const [captureByQuestion, setCaptureByQuestion] = useState({})
    const [showCapturePopup, setShowCapturePopup] = useState(false)
    const [captureQuestionNumber, setCaptureQuestionNumber] = useState(null)
    const [captureQuestionText, setCaptureQuestionText] = useState('')
    const [captureFile, setCaptureFile] = useState(null)
    const [capturePreviewUrl, setCapturePreviewUrl] = useState('')
    const [cameraActive, setCameraActive] = useState(false)
    const [cameraDevices, setCameraDevices] = useState([])
    const [selectedCameraId, setSelectedCameraId] = useState('')
    const [showCameraSelector, setShowCameraSelector] = useState(false)
    const [captureNote, setCaptureNote] = useState('')
    const [captureBusy, setCaptureBusy] = useState(false)
    const [captureError, setCaptureError] = useState('')
    const captureVideoRef = useRef(null)
    const captureCanvasRef = useRef(null)
    const captureStreamRef = useRef(null)
    const { isDemoMode, user } = useAuth()
    const navigate = useNavigate()

    const persistSession = async ({ evaluationData, transcript, behavioralStats }) => {
        if (isDemoMode) return
        setSavingSession(true)
        try {
            const topicLabel = topics.find((t) => t.id === selectedTopic)?.name || selectedTopic
            const res = await interviewSessionsApi.create({
                mode: 'studied_topics',
                job_role: user?.target_role || '',
                topic: selectedTopic,
                topics_covered: [topicLabel],
                transcript,
                behavioral_stats: behavioralStats || undefined,
                end_evaluation: evaluationData,
            })
            setSavedSessionId(res?.id)
            toast.success('Interview saved to your history')
        } catch (err) {
            console.error('Failed to persist interview', err)
            toast.error('Could not save this interview to history')
        } finally {
            setSavingSession(false)
        }
    }

    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*_#]/g, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        window.speechSynthesis.speak(utterance);
    }

    const stopCaptureCamera = () => {
        if (captureStreamRef.current) {
            captureStreamRef.current.getTracks().forEach((track) => track.stop())
            captureStreamRef.current = null
        }
        if (captureVideoRef.current) {
            captureVideoRef.current.srcObject = null
        }
        setCameraActive(false)
    }

    const startCaptureCamera = async (preferredCameraId = '') => {
        setCaptureError('')
        try {
            stopCaptureCamera()
            const constraints = preferredCameraId
                ? { video: { deviceId: { exact: preferredCameraId } }, audio: false }
                : {
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                }
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            captureStreamRef.current = stream
            if (captureVideoRef.current) {
                captureVideoRef.current.srcObject = stream
                await captureVideoRef.current.play()
            }
            setCameraActive(true)

            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoInputs = devices.filter((d) => d.kind === 'videoinput')
            setCameraDevices(videoInputs)

            const activeTrack = stream.getVideoTracks()[0]
            const activeDeviceId = activeTrack?.getSettings?.().deviceId || ''
            if (activeDeviceId) {
                setSelectedCameraId(activeDeviceId)
            } else if (!selectedCameraId && videoInputs[0]?.deviceId) {
                setSelectedCameraId(videoInputs[0].deviceId)
            }
        } catch {
            setCaptureError('Camera access is required for written-response capture. Please allow camera permission and retry.')
            setCameraActive(false)
        }
    }

    // Auto-scroll + cleanup speech logic
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    useEffect(() => {
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop()
            if (window.speechSynthesis) window.speechSynthesis.cancel()
            if (captureStreamRef.current) {
                captureStreamRef.current.getTracks().forEach((track) => track.stop())
                captureStreamRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (showCapturePopup) startCaptureCamera(selectedCameraId)
        else stopCaptureCamera()

        return () => stopCaptureCamera()
    }, [showCapturePopup])

    useEffect(() => {
        if (phase !== 'interview' || !messages.length || !questionNum) return
        const latestInterviewer = [...messages].reverse().find((m) => m.role === 'interviewer')
        if (!latestInterviewer?.content) return

        const questionText = extractQuestionText(latestInterviewer.content)
        if (!questionText) return
        setActiveQuestionText(questionText)
        setQuestionTextByNumber((prev) => ({ ...prev, [questionNum]: questionText }))

        if (needsWrittenUpload(questionText) && !capturePromptedByQuestion[questionNum]) {
            setCapturePromptedByQuestion((prev) => ({ ...prev, [questionNum]: true }))
            setCaptureQuestionNumber(questionNum)
            setCaptureQuestionText(questionText)
            setCaptureFile(null)
            setCaptureNote('')
            setCaptureError('')
            setShowCapturePopup(true)
        }
    }, [messages, phase, questionNum, capturePromptedByQuestion])

    // Load topics
    useEffect(() => {
        if (isDemoMode) {
            setTopics(DEMO_INTERVIEW_TOPICS)
        } else {
            api.get('/interview/topics')
                .then(r => setTopics(r.data))
                .catch(() => setTopics(DEMO_INTERVIEW_TOPICS))
        }
    }, [isDemoMode])

    const startInterview = async () => {
        setLoading(true)
        setPhase('interview')
        setMessages([])

        if (isDemoMode) {
            const topicInfo = topics.find(t => t.id === selectedTopic) || topics[0]
            setTimeout(() => {
                const text1 = `Hi there! Welcome to your ${topicInfo.name} interview. I'll ask you ${numQuestions} questions at ${difficulty} difficulty. Take your time and think through each answer. Let's start with your first question:`;
                const text2 = `Can you explain the fundamental concepts of ${topicInfo.name} and how they apply in real-world software engineering?`;
                setMessages([
                    { role: 'interviewer', content: text1 },
                    { role: 'interviewer', content: text2 },
                ])
                speakText(`${text1} ${text2}`);
                setQuestionNum(1)
                setTotalQ(numQuestions)
                setQuestionTextByNumber({ 1: text2 })
                setLoading(false)
            }, 1200)
            return
        }

        try {
            const res = await api.post('/interview/start', {
                topic: selectedTopic, difficulty, num_questions: numQuestions,
            })
            const data = res.data
            setMessages([
                { role: 'interviewer', content: data.greeting },
                { role: 'interviewer', content: data.first_question },
            ])
            speakText(`${data.greeting} ${data.first_question}`);
            setQuestionNum(1)
            setTotalQ(data.total_questions || numQuestions)
            setQuestionTextByNumber({ 1: data.first_question || '' })
        } catch {
            const errText = 'Sorry, I had trouble starting the interview. Please try again.';
            setMessages([{ role: 'interviewer', content: errText }])
            speakText(errText);
        }
        setLoading(false)
    }

    const sendResponse = async () => {
        const captured = captureByQuestion[questionNum]
        if ((!input.trim() && !captured) || loading) return
        const baseMsg = input.trim() || 'Submitted written response image.'
        const userMsg = captured?.interpreted_content || captured?.summary
            ? `${baseMsg}\n\n[Uploaded written response interpretation]\n${captured.interpreted_content || captured.summary}`
            : baseMsg
        setInput('')

        const newMessages = [...messages, { role: 'candidate', content: userMsg }]
        setMessages(newMessages)
        setLoading(true)

        const nextQ = questionNum + 1

        if (isDemoMode) {
            setTimeout(() => {
                if (nextQ > totalQ) {
                    const endText = "That's a great answer! Thank you for taking the time to explain your thinking.\n\nThat wraps up our interview. Let me prepare your evaluation...";
                    setMessages(prev => [
                        ...prev,
                        { role: 'interviewer', content: endText },
                    ])
                    speakText(endText);
                    setTimeout(() => showDemoEvaluation(), 1500)
                } else {
                    const topicInfo = topics.find(t => t.id === selectedTopic) || topics[0] || { name: selectedTopic }
                    const nextQuestionText = getDemoFreshQuestion(topicInfo.name, nextQ, totalQ)
                    const nextText = `Good response! I appreciate the detail.\n\nFor your next question (${nextQ}/${totalQ}):\n\n${nextQuestionText}`;
                    setMessages(prev => [
                        ...prev,
                        { role: 'interviewer', content: nextText },
                    ])
                    speakText(nextText);
                    setQuestionNum(nextQ)
                    setQuestionTextByNumber((prev) => ({ ...prev, [nextQ]: nextQuestionText }))
                }
                setLoading(false)
            }, 1500)
            return
        }

        try {
            const behavioralStats = proctorRef.current?.getStats() || null

            if (nextQ > totalQ) {
                // End interview
                const res = await api.post('/interview/end', {
                    topic: selectedTopic, difficulty,
                    history: newMessages, total_questions: totalQ,
                    behavioral_stats: behavioralStats
                })
                const evaluationPayload = {
                    ...res.data,
                    visual_capture_results: captureByQuestion,
                    question_text_by_number: questionTextByNumber,
                }
                const closingMsg = res.data.closing_message || "Thank you for completing the interview!";
                const finalTranscript = [
                    ...newMessages,
                    { role: 'interviewer', content: closingMsg },
                ]
                setMessages(finalTranscript)
                speakText(closingMsg);
                setEvaluation(evaluationPayload)
                setPhase('evaluation')
                persistSession({
                    evaluationData: evaluationPayload,
                    transcript: finalTranscript,
                    behavioralStats,
                })
            } else {
                const res = await api.post('/interview/respond', {
                    topic: selectedTopic, difficulty,
                    history: newMessages, student_response: userMsg,
                    question_number: nextQ, total_questions: totalQ,
                    behavioral_stats: behavioralStats
                })
                const ack = res.data.acknowledgment || ''
                const next = res.data.next_question || ''
                const msgText = `${ack}\n\nQuestion ${nextQ}/${totalQ}:\n${next}`;
                setMessages(prev => [
                    ...prev,
                    { role: 'interviewer', content: msgText },
                ])
                speakText(`${ack} ${next}`);
                setQuestionNum(nextQ)
                setQuestionTextByNumber((prev) => ({ ...prev, [nextQ]: next }))
            }
        } catch {
            const retryText = "I had a brief technical issue. Could you repeat your last point?";
            setMessages(prev => [
                ...prev,
                { role: 'interviewer', content: retryText },
            ])
            speakText(retryText);
        }
        setLoading(false)
        inputRef.current?.focus()
    }

    const showDemoEvaluation = () => {
        setEvaluation({
            overall_score: 72,
            verdict: 'Hire',
            strengths: ['Good understanding of core concepts', 'Clear communication style', 'Thoughtful responses'],
            weaknesses: ['Could provide more specific examples', 'Cover edge cases more thoroughly'],
            detailed_feedback: 'You demonstrated solid foundational knowledge and communicated your ideas clearly. To improve, practice providing specific code examples and discussing trade-offs in more depth. Focus on real-world scenarios and system design thinking.',
            category_scores: { technical_depth: 7, communication: 8, problem_solving: 6, clarity: 7, confidence: 8 },
            recommended_study_topics: ['Advanced algorithm patterns', 'System design fundamentals'],
            closing_message: 'Great effort! You showed real potential. Keep practicing and you\'ll nail your next interview! 🚀',
        })
        setPhase('evaluation')
    }

    const resetInterview = () => {
        setPhase('setup')
        setMessages([])
        setEvaluation(null)
        setQuestionNum(0)
        setSavedSessionId(null)
        setSavingSession(false)
        setActiveQuestionText('')
        setQuestionTextByNumber({})
        setCapturePromptedByQuestion({})
        setCaptureByQuestion({})
        setShowCapturePopup(false)
        setCaptureQuestionNumber(null)
        setCaptureQuestionText('')
        setCaptureFile(null)
        setCapturePreviewUrl('')
        setCaptureNote('')
        setCaptureError('')
        if (window.speechSynthesis) window.speechSynthesis.cancel()
    }

    const closeCapturePopup = () => {
        if (captureBusy) return
        setShowCapturePopup(false)
        setCaptureError('')
    }

    const takeCaptureSnapshot = async () => {
        const video = captureVideoRef.current
        const canvas = captureCanvasRef.current
        if (!video || !canvas || !cameraActive) {
            setCaptureError('Camera is not ready yet. Please wait a moment and try again.')
            return
        }

        const width = video.videoWidth || 1280
        const height = video.videoHeight || 720
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, width, height)

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
        if (!blob) {
            setCaptureError('Could not capture image. Please try again.')
            return
        }

        const file = new File([blob], `written_response_q${captureQuestionNumber || 'x'}.jpg`, { type: 'image/jpeg' })
        if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl)
        setCapturePreviewUrl(URL.createObjectURL(file))
        setCaptureFile(file)
        setCaptureError('')
    }

    const retakeCaptureSnapshot = () => {
        if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl)
        setCapturePreviewUrl('')
        setCaptureFile(null)
        setCaptureError('')
    }

    const uploadWrittenResponse = async () => {
        if (!captureFile || !captureQuestionText || !captureQuestionNumber) {
            setCaptureError('Please capture an image before analysis.')
            return
        }

        setCaptureBusy(true)
        setCaptureError('')
        try {
            const fd = new FormData()
            fd.append('response_file', captureFile)
            fd.append('question_text', captureQuestionText)
            fd.append('typed_context', captureNote || input || '')
            fd.append('language', 'en')

            const res = await api.post('/interview/capture/evaluate', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })

            setCaptureByQuestion((prev) => ({
                ...prev,
                [captureQuestionNumber]: {
                    status: 'completed',
                    question_number: captureQuestionNumber,
                    question_text: captureQuestionText,
                    summary: res.data.summary,
                    feedback: res.data.feedback,
                    overall_score: res.data.overall_score,
                    extracted_text: res.data.extracted_text,
                    interpretation_status: res.data.interpretation_status,
                    interpretation_confidence: res.data.interpretation_confidence,
                    interpreted_content: res.data.interpreted_content,
                    diagram_representation: res.data.diagram_representation,
                    formulae_detected: res.data.formulae_detected,
                    detected_points: res.data.detected_points,
                    answer_status: res.data.answer_status,
                    correctness_reason: res.data.correctness_reason,
                    missing_elements: res.data.missing_elements,
                    evaluator_used: res.data.evaluator_used,
                },
            }))
            toast.success('Written response image captured and analyzed')
            setShowCapturePopup(false)
            if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl)
            setCapturePreviewUrl('')
            setCaptureFile(null)
        } catch (err) {
            setCaptureError(err?.response?.data?.detail || 'Could not analyze the uploaded image.')
        } finally {
            setCaptureBusy(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendResponse()
        }
    }

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
            return
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in this browser. Please use Chrome.')
            return
        }
        
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognitionRef.current = recognition
        
        recognition.onresult = (e) => {
            let finalTranscript = ''
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' '
            }
            if (finalTranscript) setInput(prev => prev + ' ' + finalTranscript.trim())
        }
        
        recognition.start()
        setIsListening(true)
    }

    // ─── SETUP PHASE ───
    if (phase === 'setup') {
        return (
            <DarkLayout>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ maxWidth: 700, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 8 }}>
                        🎙️ AI Interview Coach
                    </h1>
                    <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem', marginBottom: 32 }}>
                        Practice with a realistic AI interviewer that adapts to your responses in real-time.
                    </p>
                    <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.78rem', marginTop: -18, marginBottom: 26 }}>
                        A few questions may ask you to write or draw your solution. When that happens, you will see a live camera capture prompt.
                    </p>

                    {/* Topic Selection */}
                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 16 }}>
                            Choose Your Topic
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                            {topics.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedTopic(t.id)}
                                    style={{
                                        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                                        background: selectedTopic === t.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${selectedTopic === t.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                        transition: 'all 0.2s ease',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{t.emoji}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: selectedTopic === t.id ? 700 : 500, color: selectedTopic === t.id ? 'var(--dk-primary-light)' : 'var(--dk-text)' }}>
                                        {t.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Settings Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="dk-card">
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--dk-text)', marginBottom: 8, display: 'block' }}>Difficulty</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['beginner', 'intermediate', 'advanced'].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDifficulty(d)}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            background: difficulty === d ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                            color: difficulty === d ? '#a78bfa' : 'var(--dk-text-muted)',
                                            fontSize: '0.76rem', fontWeight: 600, textTransform: 'capitalize',
                                            outline: difficulty === d ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="dk-card">
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--dk-text)', marginBottom: 8, display: 'block' }}>Questions</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[3, 5, 7, 10].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setNumQuestions(n)}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                            background: numQuestions === n ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                            color: numQuestions === n ? '#a78bfa' : 'var(--dk-text-muted)',
                                            fontSize: '0.82rem', fontWeight: 600,
                                            outline: numQuestions === n ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={startInterview}
                        className="dk-btn dk-btn-primary"
                        style={{
                            width: '100%', justifyContent: 'center', padding: '14px 0',
                            fontSize: '0.95rem', fontWeight: 700,
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        }}
                    >
                        🎙️ Start Interview
                    </button>
                </motion.div>
            </DarkLayout>
        )
    }

    // ─── EVALUATION PHASE ───
    if (phase === 'evaluation' && evaluation) {
        const verdictColors = {
            'Strong Hire': '#10b981', 'Hire': '#06b6d4', 'Lean Hire': '#f59e0b',
            'Lean No Hire': '#f97316', 'No Hire': '#ef4444',
        }
        const mergedCaptureResults = {
            ...(evaluation.visual_capture_results || {}),
            ...captureByQuestion,
        }
        const questionTexts = {
            ...(evaluation.question_text_by_number || {}),
            ...questionTextByNumber,
        }
        const questionAnalysisRows = Array.from({ length: totalQ }, (_, idx) => {
            const questionNumber = idx + 1
            return {
                questionNumber,
                questionText: questionTexts[questionNumber] || 'Question text unavailable.',
                capture: mergedCaptureResults[questionNumber] || mergedCaptureResults[String(questionNumber)] || null,
            }
        })
        return (
            <DarkLayout>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{ maxWidth: 700, margin: '0 auto' }}
                >
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.04em', marginBottom: 24 }}>
                        📋 Interview Evaluation
                    </h1>

                    {/* Score + Verdict */}
                    <div className="dk-card" style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--dk-text)', marginBottom: 4 }}>
                            {evaluation.overall_score}%
                        </div>
                        <div style={{
                            display: 'inline-block', padding: '6px 20px', borderRadius: 99,
                            background: `${verdictColors[evaluation.verdict] || '#6366f1'}20`,
                            border: `1px solid ${verdictColors[evaluation.verdict] || '#6366f1'}40`,
                            color: verdictColors[evaluation.verdict] || '#6366f1',
                            fontSize: '0.88rem', fontWeight: 700,
                        }}>
                            {evaluation.verdict}
                        </div>
                    </div>

                    {/* Category Scores */}
                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 16 }}>Category Scores</h3>
                        {Object.entries(evaluation.category_scores || {}).map(([key, val]) => (
                            <ScoreBar key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} score={val} />
                        ))}
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div className="dk-card">
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', marginBottom: 10 }}>✅ Strengths</h3>
                            {evaluation.strengths?.map((s, i) => (
                                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--dk-text)', marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid rgba(16,185,129,0.3)' }}>{s}</div>
                            ))}
                        </div>
                        <div className="dk-card">
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', marginBottom: 10 }}>⚠️ Areas to Improve</h3>
                            {evaluation.weaknesses?.map((w, i) => (
                                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--dk-text)', marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid rgba(245,158,11,0.3)' }}>{w}</div>
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 8 }}>💬 Detailed Feedback</h3>
                        <p style={{ fontSize: '0.84rem', color: 'var(--dk-text-muted)', lineHeight: 1.7 }}>{evaluation.detailed_feedback}</p>
                    </div>

                    <div className="dk-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 12 }}>
                            🧾 Question-Wise Capture Interpretation
                        </h3>
                        {questionAnalysisRows.map((row) => (
                            <div
                                key={row.questionNumber}
                                style={{
                                    border: '1px solid rgba(148,163,184,0.22)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    marginBottom: 10,
                                    background: 'rgba(15,23,42,0.45)',
                                }}
                            >
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--dk-text)', marginBottom: 4 }}>
                                    Q{row.questionNumber}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--dk-text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
                                    {shortText(row.questionText, 220)}
                                </div>
                                {row.capture ? (
                                    <>
                                        <div style={{ fontSize: '0.74rem', color: '#34d399', marginBottom: 4 }}>
                                            Score: {row.capture.overall_score ?? '-'}%
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', marginBottom: 4 }}>
                                            Interpretation: {String(row.capture.interpretation_status || 'not_interpretable').replace(/_/g, ' ')}
                                            {' · '}Confidence: {row.capture.interpretation_confidence ?? 0}%
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: answerStatusColor(row.capture.answer_status), marginBottom: 4 }}>
                                            Answer Verdict: {prettyAnswerStatus(row.capture.answer_status)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', lineHeight: 1.5 }}>
                                            {shortText(row.capture.interpreted_content || row.capture.summary || row.capture.feedback || 'Analyzed capture available.', 260)}
                                        </div>
                                        {!!row.capture.correctness_reason && (
                                            <div style={{ fontSize: '0.74rem', color: 'var(--dk-text-muted)', lineHeight: 1.5, marginTop: 6 }}>
                                                Why: {shortText(row.capture.correctness_reason, 240)}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)' }}>
                                        No whiteboard capture submitted for this question.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={resetInterview}
                            className="dk-btn"
                            style={{
                                flex: 1, justifyContent: 'center',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--dk-text)',
                            }}
                        >
                            🔄 Start New Interview
                        </button>
                        <button
                            onClick={() => savedSessionId && navigate(`/interviews/${savedSessionId}`)}
                            disabled={!savedSessionId || savingSession}
                            className="dk-btn dk-btn-primary"
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                background: savedSessionId
                                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                                    : 'rgba(99,102,241,0.18)',
                                opacity: savedSessionId ? 1 : 0.7,
                            }}
                        >
                            {savingSession ? 'Saving…' : '📊 View Full Report'}
                        </button>
                    </div>
                    {!isDemoMode && !savedSessionId && !savingSession && (
                        <p style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--dk-text-muted)', textAlign: 'center' }}>
                            Saving may have failed — your interview history is updated automatically when it succeeds.
                        </p>
                    )}
                </motion.div>
            </DarkLayout>
        )
    }

    // ─── INTERVIEW PHASE ───
    return (
        <DarkLayout>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--dk-text)', letterSpacing: '-0.03em' }}>
                            🎙️ Mock Interview
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>
                            Question {questionNum} of {totalQ} • {difficulty}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (messages.length > 2) {
                                setLoading(true)
                                if (isDemoMode) { showDemoEvaluation(); setLoading(false) }
                                else {
                                    const behavioralStats = proctorRef.current?.getStats() || null
                                    api.post('/interview/end', {
                                        topic: selectedTopic, difficulty, history: messages, total_questions: totalQ,
                                        behavioral_stats: behavioralStats
                                    }).then(r => {
                                        const evaluationPayload = {
                                            ...r.data,
                                            visual_capture_results: captureByQuestion,
                                            question_text_by_number: questionTextByNumber,
                                        }
                                        setEvaluation(evaluationPayload)
                                        setPhase('evaluation')
                                        persistSession({
                                            evaluationData: evaluationPayload,
                                            transcript: messages,
                                            behavioralStats,
                                        })
                                    })
                                        .catch(() => showDemoEvaluation())
                                        .finally(() => setLoading(false))
                                }
                            } else resetInterview()
                        }}
                        style={{
                            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                        }}
                    >
                        {messages.length > 2 ? '⏹ End Interview' : '← Back'}
                    </button>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, borderRadius: 99, background: 'rgba(99,102,241,0.1)', marginBottom: 20 }}>
                    <div style={{
                        height: '100%', borderRadius: 99,
                        background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                        width: `${(questionNum / totalQ) * 100}%`,
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    }} />
                </div>

                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Chat Messages */}
                    <div style={{
                        flex: 1,
                        minHeight: 350, maxHeight: 'calc(100vh - 340px)', overflowY: 'auto',
                        marginBottom: 16, padding: '4px 0',
                    }}>
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <ChatBubble key={i} role={msg.role} content={msg.content} />
                            ))}
                        </AnimatePresence>
                        {loading && <TypingIndicator />}
                        <div ref={chatEndRef} />
                    </div>

                    {/* AI Camera Panel */}
                    <div style={{
                        width: 320, flexShrink: 0,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 16, overflow: 'hidden',
                        padding: 12
                    }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--dk-text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                            <span>📷 AI Posture Camera</span>
                            <span className="badge badge-success" style={{ animation: 'pulse 2s infinite' }}>REC</span>
                        </div>
                        <Proctor ref={proctorRef} onViolation={() => {}} />
                        <p style={{ fontSize: '0.72rem', color: 'var(--dk-text-muted)', marginTop: 12, lineHeight: 1.5 }}>
                            Your posture, gaze, and expressions are being analyzed by AI to evaluate your interview confidence.
                        </p>
                    </div>
                </div>

                {/* Input */}
                {needsWrittenUpload(activeQuestionText) && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 10, marginBottom: 10, padding: '10px 12px', borderRadius: 10,
                        background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)' }}>
                            This question may require writing or drawing. Use camera capture for real-time evaluation.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {captureByQuestion[questionNum]?.status === 'completed' && (
                                <span className="badge badge-success" style={{ fontSize: 11 }}>Captured</span>
                            )}
                            <button
                                className="dk-btn dk-btn-ghost dk-btn-sm"
                                onClick={() => {
                                    setCaptureQuestionNumber(questionNum)
                                    setCaptureQuestionText(activeQuestionText)
                                    setCaptureFile(null)
                                    if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl)
                                    setCapturePreviewUrl('')
                                    setCaptureNote(input || '')
                                    setCaptureError('')
                                    setShowCameraSelector(false)
                                    setShowCapturePopup(true)
                                }}
                            >
                                Open Camera
                            </button>
                        </div>
                    </div>
                )}

                {captureByQuestion[questionNum]?.status === 'completed' && (
                    <div style={{
                        marginBottom: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, marginBottom: 4 }}>
                            Capture Interpretation (Q{questionNum})
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--dk-text-muted)', lineHeight: 1.5, marginBottom: 3 }}>
                            Interpreted as: {shortText(captureByQuestion[questionNum]?.interpreted_content || captureByQuestion[questionNum]?.summary || 'Capture analyzed successfully.', 220)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--dk-text-muted)', marginBottom: 3 }}>
                            Interpretation: {String(captureByQuestion[questionNum]?.interpretation_status || 'not_interpretable').replace(/_/g, ' ')}
                            {' · '}Confidence: {captureByQuestion[questionNum]?.interpretation_confidence ?? 0}%
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: answerStatusColor(captureByQuestion[questionNum]?.answer_status), marginBottom: 3 }}>
                            Verdict: {prettyAnswerStatus(captureByQuestion[questionNum]?.answer_status)}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--dk-text-muted)', lineHeight: 1.5 }}>
                            {shortText(captureByQuestion[questionNum]?.correctness_reason || captureByQuestion[questionNum]?.feedback || 'Capture analyzed successfully.')}
                        </div>
                    </div>
                )}

                <div style={{
                    display: 'flex', gap: 10, padding: 12, borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={toggleListen}
                        disabled={loading || phase === 'evaluation'}
                        style={{
                            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isListening ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                            color: isListening ? '#f87171' : 'var(--dk-text)',
                            fontSize: '1.2rem', transition: 'all 0.2s',
                            animation: isListening ? 'pulse 1.5s infinite' : 'none'
                        }}
                    >
                        {isListening ? '⏹' : '🎤'}
                    </button>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isListening ? "Listening... Start speaking." : "Type your answer or use microphone... (Enter to send)"}
                        disabled={loading || phase === 'evaluation'}
                        rows={2}
                        style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
                            background: 'rgba(255,255,255,0.04)', color: 'var(--dk-text)',
                            fontSize: '0.88rem', resize: 'none', outline: 'none',
                            fontFamily: "'Inter', sans-serif",
                        }}
                    />
                    <button
                        onClick={sendResponse}
                        disabled={(!input.trim() && !captureByQuestion[questionNum]) || loading}
                        style={{
                            padding: '0 20px', height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: (input.trim() || captureByQuestion[questionNum]) && !loading ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(99,102,241,0.1)',
                            color: (input.trim() || captureByQuestion[questionNum]) && !loading ? '#fff' : 'var(--dk-text-muted)',
                            fontSize: '0.88rem', fontWeight: 700,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Send →
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {showCapturePopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeCapturePopup}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 70,
                            background: 'rgba(2,6,23,0.66)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 14, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="dk-card"
                            style={{
                                width: 'min(560px, 100%)',
                                maxHeight: '92vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 8, color: 'var(--dk-text)' }}>Capture your written response</h3>
                                <p style={{ marginTop: 0, marginBottom: 10, color: 'var(--dk-text-muted)', fontSize: 13 }}>
                                    The current question looks like a write/draw prompt. Take a live photo with your camera to include it in evaluation.
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                                    <button
                                        type="button"
                                        className="dk-btn dk-btn-ghost"
                                        onClick={() => setShowCameraSelector((prev) => !prev)}
                                        style={{ fontSize: 12, padding: '6px 10px' }}
                                    >
                                        {showCameraSelector ? 'Hide Camera List' : 'Select Camera'}
                                    </button>
                                    {selectedCameraId && (
                                        <span style={{ fontSize: 11, color: 'var(--dk-text-muted)' }}>
                                            Active: {cameraDevices.find((d) => d.deviceId === selectedCameraId)?.label || 'Current camera'}
                                        </span>
                                    )}
                                </div>

                                {showCameraSelector && (
                                    <div style={{ marginBottom: 10, border: '1px solid var(--dk-border)', borderRadius: 10, background: 'var(--dk-surface-2)', maxHeight: 130, overflowY: 'auto' }}>
                                        {cameraDevices.length === 0 ? (
                                            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--dk-text-muted)' }}>
                                                No camera devices detected yet.
                                            </div>
                                        ) : cameraDevices.map((device, index) => (
                                            <button
                                                key={device.deviceId || index}
                                                type="button"
                                                onClick={async () => {
                                                    const nextId = device.deviceId || ''
                                                    setSelectedCameraId(nextId)
                                                    setShowCameraSelector(false)
                                                    await startCaptureCamera(nextId)
                                                }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    border: 'none',
                                                    background: selectedCameraId === device.deviceId ? 'rgba(99,102,241,0.18)' : 'transparent',
                                                    color: 'var(--dk-text)',
                                                    fontSize: 12,
                                                    cursor: 'pointer',
                                                    borderBottom: index === cameraDevices.length - 1 ? 'none' : '1px solid var(--dk-border)',
                                                }}
                                            >
                                                {device.label || `Camera ${index + 1}`}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--dk-border)', background: 'var(--dk-surface-2)', marginBottom: 10, fontSize: 12, color: 'var(--dk-text-sub)' }}>
                                    {captureQuestionText || activeQuestionText}
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    {!captureFile ? (
                                        <video
                                            ref={captureVideoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            style={{ width: '100%', maxHeight: '42vh', borderRadius: 12, border: '1px solid var(--dk-border)', background: '#020617', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <img
                                            src={capturePreviewUrl}
                                            alt="Written response capture"
                                            style={{ width: '100%', maxHeight: '42vh', borderRadius: 12, border: '1px solid var(--dk-border)', objectFit: 'cover' }}
                                        />
                                    )}
                                    <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
                                </div>

                                <textarea
                                    value={captureNote}
                                    onChange={(e) => setCaptureNote(e.target.value)}
                                    placeholder="Optional note: describe what you wrote/drew"
                                    rows={2}
                                    className="dk-input"
                                    style={{ resize: 'none', marginBottom: 6 }}
                                />

                                {captureError && (
                                    <div style={{ fontSize: 12, color: 'var(--dk-red)', marginBottom: 8 }}>{captureError}</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--dk-border)', marginTop: 8, background: 'var(--dk-surface)' }}>
                                <button className="dk-btn dk-btn-ghost" onClick={closeCapturePopup} disabled={captureBusy}>Skip</button>
                                {!captureFile ? (
                                    <button className="dk-btn dk-btn-primary" onClick={takeCaptureSnapshot} disabled={captureBusy || !cameraActive}>
                                        Take Photo
                                    </button>
                                ) : (
                                    <>
                                        <button className="dk-btn dk-btn-ghost" onClick={retakeCaptureSnapshot} disabled={captureBusy}>Retake</button>
                                        <button className="dk-btn dk-btn-primary" onClick={uploadWrittenResponse} disabled={captureBusy}>
                                            {captureBusy ? 'Analyzing...' : 'Analyze Capture'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
        </DarkLayout>
    )
}
