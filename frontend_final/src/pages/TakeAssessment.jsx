import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '../context/LangContext'
import Proctor from '../components/Proctor'
import ProctorStats from '../components/ProctorStats'
import DarkLayout from '../components/layout/DarkLayout'
import api from '../api/client'

const CAPTURE_PATTERN = /(draw|diagram|flow\s?chart|figure|sketch|illustrate|white\s?paper|whiteboard|write the steps|write steps|commands?|command sequence|workflow|architecture|block diagram|process flow|formula)/i

function questionNeedsCapture(question) {
  if (!question) return false
  if (question.capture_required) return true
  const type = (question.type || '').toLowerCase()
  if (['whiteboard', 'whiteboard_capture', 'diagram', 'diagram_capture', 'flowchart', 'commands', 'steps', 'capture', 'visual'].includes(type)) {
    return true
  }
  return CAPTURE_PATTERN.test(question.text || '')
}

function getCaptureModeLabel(question) {
  const mode = (question?.capture_mode || question?.type || 'capture').toLowerCase()
  if (mode.includes('command')) return 'Commands'
  if (mode.includes('step')) return 'Steps'
  if (mode.includes('diagram') || mode.includes('flow')) return 'Diagram'
  return 'Written'
}

function isQuestionAnswered(question, index, answers, captureStatusByQuestion) {
  const hasText = !!answers[index]?.trim()
  const capture = captureStatusByQuestion[String(index)]
  const hasCapture = ['processing', 'completed'].includes(capture?.status)
  return questionNeedsCapture(question) ? (hasText || hasCapture) : hasText
}

/* ─── Evaluate Loading Skeleton ─────────────────────────────────────────── */
const EVAL_STEPS = [
  { icon: '📤', label: 'Submitting your answers...' },
  { icon: '🧠', label: 'Running AI evaluation...' },
  { icon: '🔍', label: 'Analyzing response quality...' },
  { icon: '📊', label: 'Generating detailed feedback...' },
  { icon: '🏅', label: 'Computing your score...' },
]

function EvalLoadingSkeleton({ step }) {
  return (
    <motion.div
      className="dk-eval-skeleton"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="dk-eval-orb">🧠</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#f1f5f9', marginBottom: 6, letterSpacing: '-0.02em' }}>
          Evaluating Your Assessment
        </div>
        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
          This may take 15–30 seconds — AI is analyzing each answer individually
        </div>
      </div>
      <div className="dk-eval-steps">
        {EVAL_STEPS.map((s, i) => (
          <div key={i} className={`dk-eval-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
            <span style={{ width: 20, textAlign: 'center' }}>
              {i < step ? '✅' : i === step ? '⏳' : '○'}
            </span>
            {s.label}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Toast notification ────────────────────────────────────────────────── */
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

export default function TakeAssessment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const proctorRef = useRef(null)
  const [assessment, setAssessment] = useState(null)
  const [answers, setAnswers] = useState({})
  const [followups, setFollowups] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [evalStep, setEvalStep] = useState(0)
  const [loadingFollowup, setLoadingFollowup] = useState(false)
  const [showFollowup, setShowFollowup] = useState(null)
  const [toast, setToast] = useState(null)
  const [captureStatusByQuestion, setCaptureStatusByQuestion] = useState({})
  const [capturePanelFor, setCapturePanelFor] = useState(null)
  const [captureFile, setCaptureFile] = useState(null)
  const [captureBusy, setCaptureBusy] = useState(false)
  const [captureNote, setCaptureNote] = useState('')
  const captureFileRef = useRef(null)

  // Anti-cheat
  const [tabSwitches, setTabSwitches] = useState(0)
  const [copyPasteCount, setCopyPasteCount] = useState(0)

  // Proctoring
  const [proctorData, setProctorData] = useState(null)
  const [showProctor, setShowProctor] = useState(true)

  // Media recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const chunksRef = useRef([])

  // Speech-to-text
  const [isListening, setIsListening] = useState(false)
  const [speechConfidence, setSpeechConfidence] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    api.get(`/assessments/${id}`).then(r => {
      setAssessment(r.data)
      setTimeLeft(r.data.time_limit_minutes * 60)
    }).catch(() => navigate('/dashboard'))
  }, [id])

  useEffect(() => {
    api.get(`/assessments/${id}/captures/me`).then((res) => {
      const next = {}
      res.data.forEach((item) => {
        next[String(item.question_index)] = item
      })
      setCaptureStatusByQuestion(next)
    }).catch(() => {})
  }, [id])

  // Timer
  useEffect(() => {
    if (!assessment || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleSubmit(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [assessment])

  // Anti-cheat listeners
  useEffect(() => {
    const onVisChange = () => { if (document.hidden) setTabSwitches(c => c + 1) }
    const onPaste = () => setCopyPasteCount(c => c + 1)
    document.addEventListener('visibilitychange', onVisChange)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('visibilitychange', onVisChange)
      document.removeEventListener('paste', onPaste)
    }
  }, [])

  // Cleanup proctor on unmount
  useEffect(() => {
    return () => {
      if (proctorRef.current) proctorRef.current.stop()
    }
  }, [])

  useEffect(() => {
    const hasProcessing = Object.values(captureStatusByQuestion).some(item => item?.status === 'processing')
    if (!hasProcessing) return

    const timer = setInterval(() => {
      api.get(`/assessments/${id}/captures/me`).then((res) => {
        const next = {}
        res.data.forEach((item) => {
          next[String(item.question_index)] = item
        })
        setCaptureStatusByQuestion(next)
      }).catch(() => {})
    }, 3500)

    return () => clearInterval(timer)
  }, [captureStatusByQuestion, id])

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ─── Speech-to-Text (Web Speech API) ─────────────────────────────────────
  const startSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setToast({ message: 'Speech recognition is not supported. Please use Chrome.', type: 'error' })
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let totalConfidence = 0
      let confidenceCount = 0

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' '
          totalConfidence += result[0].confidence
          confidenceCount++
        }
      }

      if (finalTranscript) {
        setAnswers(prev => ({
          ...prev,
          [currentQ]: (prev[currentQ] || '') + finalTranscript
        }))
      }

      if (confidenceCount > 0) {
        setSpeechConfidence(Math.round((totalConfidence / confidenceCount) * 100))
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stopSpeechToText = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  // ─── Media Recording ──────────────────────────────────────────────────────
  const startRecording = async (type) => {
    try {
      const constraints = type === 'video'
        ? { audio: true, video: { facingMode: 'user', width: 320, height: 240 } }
        : { audio: true }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.play()
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType: type === 'audio' ? 'audio/webm' : mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' })
        handleRecordingComplete(blob, type)
        stream.getTracks().forEach(t => t.stop())
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingType(type)
    } catch (err) {
      setToast({ message: `Could not access ${type === 'video' ? 'camera' : 'microphone'}. Check permissions.`, type: 'error' })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setRecordingType(null)
    }
  }

  const handleRecordingComplete = async (blob, type) => {
    const text = `[${type === 'video' ? 'Video' : 'Audio'} response recorded — ${(blob.size / 1024).toFixed(0)}KB]`
    setAnswers(prev => ({ ...prev, [currentQ]: (prev[currentQ] || '') + '\n' + text }))
  }

  const openCapturePanel = (questionIndex) => {
    setCaptureFile(null)
    setCaptureNote(answers[questionIndex] || '')
    setCapturePanelFor(questionIndex)
  }

  const closeCapturePanel = () => {
    setCapturePanelFor(null)
    setCaptureFile(null)
  }

  const handleCaptureUpload = async (questionIndex) => {
    if (!captureFile) {
      setToast({ message: 'Please choose an image before uploading.', type: 'error' })
      return
    }

    setCaptureBusy(true)
    setCaptureStatusByQuestion(prev => ({
      ...prev,
      [String(questionIndex)]: { ...(prev[String(questionIndex)] || {}), status: 'uploading' }
    }))

    try {
      const formData = new FormData()
      formData.append('capture_file', captureFile)
      formData.append('typed_context', captureNote || answers[questionIndex] || '')
      formData.append('device_label', 'Uploaded image')

      const res = await api.post(`/assessments/${id}/questions/${questionIndex}/capture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setCaptureStatusByQuestion(prev => ({
        ...prev,
        [String(questionIndex)]: {
          ...(prev[String(questionIndex)] || {}),
          capture_id: res.data.capture_id,
          question_index: questionIndex,
          status: 'processing',
          analysis_summary: 'Image uploaded. Analysis is running in the background.',
        }
      }))
      setToast({ message: 'Image uploaded successfully. Analysis started.', type: 'success' })
      closeCapturePanel()
    } catch (err) {
      setToast({ message: err?.response?.data?.detail || 'Image upload failed.', type: 'error' })
      setCaptureStatusByQuestion(prev => ({
        ...prev,
        [String(questionIndex)]: { ...(prev[String(questionIndex)] || {}), status: 'failed' }
      }))
    } finally {
      setCaptureBusy(false)
    }
  }

  // ─── Follow-up Questions ──────────────────────────────────────────────────
  const requestFollowup = async (qIndex) => {
    const answer = answers[qIndex]
    if (!answer || answer.trim().length < 20) return

    setLoadingFollowup(true)
    try {
      const res = await api.post(`/assessments/${id}/followup`, {
        question_index: qIndex,
        student_answer: answer
      })
      if (res.data.followup) {
        setFollowups(prev => ({
          ...prev,
          [qIndex]: { question: res.data.followup, answer: '' }
        }))
        setShowFollowup(qIndex)
      }
    } catch (err) {
      console.error('Follow-up failed:', err)
    }
    setLoadingFollowup(false)
  }

  // ─── Submit with evaluation loading skeleton ─────────────────────────────
  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setEvalStep(0)

    // Simulate step progression during the long AI call
    const stepTimers = [
      setTimeout(() => setEvalStep(1), 2000),
      setTimeout(() => setEvalStep(2), 6000),
      setTimeout(() => setEvalStep(3), 12000),
      setTimeout(() => setEvalStep(4), 18000),
    ]

    // Get proctoring stats
    const proctoringStats = proctorRef.current ? proctorRef.current.getStats() : null

    // Stop proctor camera
    if (proctorRef.current) proctorRef.current.stop()

    // Merge followup answers
    const finalAnswers = { ...answers }
    Object.entries(followups).forEach(([idx, fu]) => {
      if (fu.answer) {
        finalAnswers[`${idx}_followup`] = fu.answer
      }
    })

    const visualCaptureIds = {}
    Object.entries(captureStatusByQuestion).forEach(([qIndex, item]) => {
      if (item?.capture_id && ['processing', 'completed'].includes(item.status)) {
        visualCaptureIds[qIndex] = item.capture_id
      }
    })

    try {
      const res = await api.post('/submissions', {
        assessment_id: parseInt(id),
        answers: finalAnswers,
        visual_capture_ids: visualCaptureIds,
        time_taken_seconds: assessment.time_limit_minutes * 60 - timeLeft,
        anticheat_flags: {
          tab_switches: tabSwitches,
          copy_paste_count: copyPasteCount
        },
        proctoring_data: proctoringStats
      })
      stepTimers.forEach(clearTimeout)
      navigate(`/result/${res.data.submission_id}`, { state: res.data })
    } catch (err) {
      stepTimers.forEach(clearTimeout)
      setToast({ message: 'Submission failed: ' + (err.response?.data?.detail || err.message), type: 'error' })
      setSubmitting(false)
    }
  }

  if (!assessment) return (
    <DarkLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="dk-spinner" />
        <p style={{ color: 'var(--dk-text-muted)', fontSize: '0.88rem' }}>Loading assessment...</p>
      </div>
    </DarkLayout>
  )

  const questions = assessment.questions || []
  const q = questions[currentQ]
  const progress = questions.filter((question, index) => isQuestionAnswered(question, index, answers, captureStatusByQuestion)).length

  return (
    <DarkLayout>
      {/* Evaluation Loading Skeleton */}
      <AnimatePresence>
        {submitting && <EvalLoadingSkeleton step={evalStep} />}
      </AnimatePresence>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </AnimatePresence>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header bar */}
            <motion.div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div>
                <h2 style={{ margin: 0, color: 'var(--dk-text)' }}>{assessment.title}</h2>
                <span className="badge badge-primary" style={{ marginTop: 4 }}>{assessment.difficulty}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {tabSwitches > 0 && (
                  <span className="badge badge-danger" style={{ fontSize: 11 }}>
                    Tab switches: {tabSwitches}
                  </span>
                )}
                <div style={{
                  background: timeLeft < 60 ? 'rgba(248,113,113,0.2)' : 'var(--dk-surface-2)',
                  border: `1px solid ${timeLeft < 60 ? 'rgba(248,113,113,0.3)' : 'var(--dk-border)'}`,
                  padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 20,
                  fontFamily: "'Geist Mono', monospace", color: timeLeft < 60 ? 'var(--dk-red)' : 'var(--dk-text)',
                }}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </motion.div>

            {/* Progress bar */}
            <div className="dk-progress-track" style={{ marginBottom: 24 }}>
              <div className="dk-progress-fill" style={{ width: `${(progress / questions.length) * 100}%` }} />
            </div>

            {/* Question navigator */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
              {questions.map((_, i) => (
                <button key={i} onClick={() => { setShowFollowup(null); setCurrentQ(i) }}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: '1px solid',
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    transition: 'all 0.2s ease',
                    background: i === currentQ ? 'rgba(99,102,241,0.2)' : isQuestionAnswered(questions[i], i, answers, captureStatusByQuestion) ? 'rgba(74,222,128,0.15)' : 'var(--dk-surface-2)',
                    color: i === currentQ ? 'var(--dk-primary-light)' : isQuestionAnswered(questions[i], i, answers, captureStatusByQuestion) ? 'var(--dk-green)' : 'var(--dk-text-muted)',
                    borderColor: i === currentQ ? 'rgba(99,102,241,0.4)' : isQuestionAnswered(questions[i], i, answers, captureStatusByQuestion) ? 'rgba(74,222,128,0.3)' : 'var(--dk-border)',
                  }}>{i + 1}</button>
              ))}
            </div>

            {/* Question card */}
            <motion.div
              key={currentQ}
              className="dk-card dk-card-accent"
              style={{ marginBottom: 24 }}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <span className="badge badge-primary">{q?.bloom_level}</span>
                <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--dk-primary-light)', borderColor: 'rgba(99,102,241,0.25)' }}>
                  Q{currentQ + 1} of {questions.length}
                </span>
              </div>

              <h3 style={{ marginBottom: 8, color: 'var(--dk-text)' }}>{q?.text}</h3>
              {q?.section_reference && (
                <p style={{ fontSize: 13, color: 'var(--dk-text-muted)', marginBottom: 16 }}>
                  Reference: {q.section_reference}
                </p>
              )}

              {questionNeedsCapture(q) && (
                <div style={{ marginBottom: 14, borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(34,211,238,0.28)', background: 'rgba(34,211,238,0.08)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dk-cyan)' }}>
                      This question expects a {getCaptureModeLabel(q).toLowerCase()} response.
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dk-text-muted)' }}>
                      Upload an image of your written page before submitting.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {captureStatusByQuestion[String(currentQ)]?.status && (
                      <span className="badge" style={{ fontSize: 11 }}>
                        {captureStatusByQuestion[String(currentQ)]?.status}
                      </span>
                    )}
                    <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => openCapturePanel(currentQ)}>
                      Upload Written Image
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={answers[currentQ] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ]: e.target.value }))}
                placeholder="Type your detailed answer here... Use specific examples and demonstrate your understanding."
                rows={8}
                className="dk-input"
                style={{ resize: 'vertical', minHeight: 180, lineHeight: 1.7 }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--dk-text-muted)' }}>
                  {(answers[currentQ] || '').split(/\s+/).filter(Boolean).length} {t('wordsCount')}
                </span>
                {speechConfidence !== null && (
                  <span className="badge badge-success" style={{ fontSize: 11 }}>
                    🎤 Voice confidence: {speechConfidence}%
                  </span>
                )}
              </div>

              {/* Recording & Speech controls */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {!isRecording && !isListening ? (
                  <>
                    <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={startSpeechToText}>
                      🗣️ Voice Answer
                    </button>
                    <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => startRecording('audio')}>
                      🎙️ {t('recordAudio')}
                    </button>
                    <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => startRecording('video')}>
                      📹 {t('recordVideo')}
                    </button>
                    {answers[currentQ]?.trim()?.length > 20 && !followups[currentQ] && (
                      <button className="dk-btn dk-btn-ghost dk-btn-sm" onClick={() => requestFollowup(currentQ)}
                        disabled={loadingFollowup}
                        style={{ marginLeft: 'auto' }}>
                        {loadingFollowup ? `⏳ ${t('generating')}` : `🔄 ${t('getFollowup')}`}
                      </button>
                    )}
                  </>
                ) : isListening ? (
                  <button className="dk-btn dk-btn-primary dk-btn-sm" onClick={stopSpeechToText}
                    style={{ animation: 'pulse 1s infinite' }}>
                    🗣️ Listening... (tap to stop)
                  </button>
                ) : (
                  <button className="dk-btn dk-btn-danger dk-btn-sm" onClick={stopRecording}
                    style={{ animation: 'pulse 1s infinite' }}>
                    ⏹ {t('stopRecording')}
                  </button>
                )}
              </div>

              {/* Video preview */}
              {isRecording && recordingType === 'video' && (
                <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', maxWidth: 320 }}>
                  <video ref={videoPreviewRef} muted style={{ width: '100%', borderRadius: 12, background: '#000' }} />
                </div>
              )}
            </motion.div>

            {/* Follow-up question (dynamic) */}
            {followups[currentQ] && showFollowup === currentQ && (
              <div className="dk-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--dk-amber)', background: 'rgba(251,191,36,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>🔄</span>
                  <h4 style={{ margin: 0, color: 'var(--dk-amber)' }}>{t('followupChallenge')}</h4>
                  <span className="badge badge-warning" style={{ fontSize: 11 }}>
                    {followups[currentQ].question?.probe_reason || 'deeper probe'}
                  </span>
                </div>
                <p style={{ marginBottom: 12, color: 'var(--dk-text-sub)' }}>{followups[currentQ].question?.text}</p>
                <textarea
                  value={followups[currentQ].answer || ''}
                  onChange={(e) => setFollowups(prev => ({
                    ...prev,
                    [currentQ]: { ...prev[currentQ], answer: e.target.value }
                  }))}
                  placeholder="Answer the follow-up question..."
                  rows={4}
                  className="dk-input"
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button className="dk-btn dk-btn-ghost" onClick={() => { setShowFollowup(null); setCurrentQ(Math.max(0, currentQ - 1)) }}
                disabled={currentQ === 0 || submitting}>
                {t('previous')}
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                {currentQ < questions.length - 1 ? (
                  <button className="dk-btn dk-btn-primary" onClick={() => { setShowFollowup(null); setCurrentQ(currentQ + 1) }}
                    disabled={submitting}>
                    {t('next')}
                  </button>
                ) : (
                  <button className="dk-btn dk-btn-primary dk-btn-lg" onClick={handleSubmit} disabled={submitting}
                    style={{ background: submitting ? 'var(--dk-text-muted)' : undefined, minWidth: 180 }}>
                    {submitting ? '⏳ Evaluating...' : `${t('submit')} (${progress}/${questions.length} ${t('answered')})`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Proctor sidebar */}
          {showProctor && (
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'sticky', top: 20 }}>
                <div className="dk-proctor-container">
                  <Proctor
                    ref={proctorRef}
                    onViolation={(v) => console.log('Proctor violation:', v)}
                    onStatsUpdate={setProctorData}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <ProctorStats proctorData={proctorData} />
                </div>
                <button
                  className="dk-btn dk-btn-ghost dk-btn-sm"
                  onClick={() => setShowProctor(false)}
                  style={{ width: '100%', marginTop: 8, fontSize: 11, justifyContent: 'center' }}
                >
                  Hide Camera
                </button>
              </div>
            </div>
          )}

          {/* Mini proctor toggle when hidden */}
          {!showProctor && (
            <button
              onClick={() => setShowProctor(true)}
              style={{
                position: 'fixed', bottom: 20, right: 20, zIndex: 50,
                width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--dk-border)',
                background: proctorData?.faceDetected ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                color: proctorData?.faceDetected ? 'var(--dk-green)' : 'var(--dk-red)',
                fontSize: 20, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)', transition: 'all 0.2s',
                backdropFilter: 'blur(12px)',
              }}
              title="Show proctor camera"
            >
              {proctorData?.faceDetected ? '📷' : '⚠️'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {capturePanelFor !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(2,6,23,0.66)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={closeCapturePanel}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="dk-card"
              style={{ width: 'min(560px, 100%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: 8, color: 'var(--dk-text)' }}>Upload your written response</h3>
              <p style={{ marginTop: 0, marginBottom: 14, color: 'var(--dk-text-muted)', fontSize: 13 }}>
                Take a clear photo of your page and upload it for analysis.
              </p>

              <input
                ref={captureFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setCaptureFile(e.target.files?.[0] || null)}
                className="dk-input"
                style={{ marginBottom: 12 }}
              />

              <textarea
                value={captureNote}
                onChange={(e) => setCaptureNote(e.target.value)}
                placeholder="Optional: add a short typed note for context"
                rows={4}
                className="dk-input"
                style={{ resize: 'vertical', marginBottom: 14 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="dk-btn dk-btn-ghost" onClick={closeCapturePanel} disabled={captureBusy}>Cancel</button>
                <button className="dk-btn dk-btn-primary" onClick={() => handleCaptureUpload(capturePanelFor)} disabled={captureBusy || !captureFile}>
                  {captureBusy ? 'Uploading...' : 'Upload & Analyze'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DarkLayout>
  )
}
