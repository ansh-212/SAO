import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as faceapi from 'face-api.js'
import { SuspicionScorer, YoloDetector } from './proctoring'

/**
 * Proctor — AI-powered exam proctoring component.
 *
 * Pipeline:  Face-API (face + landmarks + expressions)
 *          + YoloDetector (cell phone, book, laptop — toggleable)
 *          + SuspicionScorer (weighted score aggregation)
 *
 * Props:
 *   onViolation    – callback({ type, message })  per-violation
 *   onStatsUpdate  – callback(liveStats)           every detection tick
 *   enableObjects  – boolean (default true) — toggle object detection on/off
 *   detectionInterval – ms between detection ticks (default 2000)
 */
const Proctor = forwardRef(({ onViolation, onStatsUpdate, enableObjects = true, detectionInterval = 2000 }, ref) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)

  // Modular sub-systems (created once, stored in refs)
  const yoloRef = useRef(null)
  const scorerRef = useRef(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [status, setStatus] = useState('initializing')
  const [objectDetectionReady, setObjectDetectionReady] = useState(false)

  const statsRef = useRef({
    totalChecks: 0,
    facePresent: 0,
    faceAbsent: 0,
    multipleFaces: 0,
    gazeAway: 0,
    objectsDetected: [],
    expressionHistory: [],
    violations: [],
    startTime: Date.now(),
    // New: suspicion score history (per-frame snapshots)
    suspicionSnapshots: [],
    lastSuspicionResult: null,
  })

  // ──────────────────────────────────────────────────────────────
  //  Expose stats via ref  (backward-compatible + new fields)
  // ──────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getStats: () => {
      const s = statsRef.current
      const totalChecks = Math.max(s.totalChecks, 1)
      const scorer = scorerRef.current
      const suspicionSnapshot = scorer ? scorer.getSnapshot() : null

      return {
        // ── Existing contract (unchanged) ──
        face_present_pct: Math.round((s.facePresent / totalChecks) * 100),
        face_absent_count: s.faceAbsent,
        multiple_faces_count: s.multipleFaces,
        gaze_away_count: s.gazeAway,
        gaze_away_pct: Math.round((s.gazeAway / totalChecks) * 100),
        objects_detected: [...new Set(s.objectsDetected)],
        object_violation_count: s.objectsDetected.length,
        violations: s.violations,
        total_violations: s.violations.length,
        duration_seconds: Math.round((Date.now() - s.startTime) / 1000),
        expression_summary: getExpressionSummary(s.expressionHistory),
        confidence_score: calculateConfidence(s),
        integrity_score: calculateIntegrity(s),

        // ── New: weighted suspicion score ──
        suspicion_score: suspicionSnapshot ? suspicionSnapshot.suspicionScore : 0,
        suspicion_trend: suspicionSnapshot ? suspicionSnapshot.trend : 'stable',
        suspicion_emotion_stress_pct: suspicionSnapshot ? suspicionSnapshot.emotionStressPct : 0,
        suspicion_emotion_anxiety_pct: suspicionSnapshot ? suspicionSnapshot.emotionAnxietyPct : 0,
        object_detection_enabled: yoloRef.current ? yoloRef.current.enabled : false,
      }
    },
    stop: () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      const stream = videoRef.current?.srcObject
      if (stream) stream.getTracks().forEach(t => t.stop())
      if (yoloRef.current) yoloRef.current.dispose()
    },
    // New: runtime toggle for object detection
    toggleObjectDetection: () => {
      if (yoloRef.current) return yoloRef.current.toggle()
      return false
    },
  }))

  // ──────────────────────────────────────────────────────────────
  //  Scoring helpers (legacy — kept for backward-compat)
  // ──────────────────────────────────────────────────────────────
  const calculateConfidence = (s) => {
    const totalChecks = Math.max(s.totalChecks, 1)
    const facePct = s.facePresent / totalChecks
    const gazeOnPct = 1 - (s.gazeAway / totalChecks)
    const score = Math.round((facePct * 40) + (gazeOnPct * 40) + 20)
    return Math.min(100, Math.max(0, score))
  }

  const calculateIntegrity = (s) => {
    let score = 100
    score -= s.faceAbsent * 3
    score -= s.multipleFaces * 10
    score -= s.gazeAway * 2
    score -= s.objectsDetected.length * 8
    return Math.max(0, Math.min(100, score))
  }

  const getExpressionSummary = (history) => {
    if (history.length === 0) return { dominant: 'neutral', distribution: {} }
    const counts = {}
    history.forEach(e => { counts[e] = (counts[e] || 0) + 1 })
    const total = history.length
    const distribution = {}
    Object.keys(counts).forEach(k => { distribution[k] = Math.round((counts[k] / total) * 100) })
    const dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b)
    return { dominant, distribution }
  }

  // ──────────────────────────────────────────────────────────────
  //  Model loading — face-api + YoloDetector (if enabled)
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Instantiate scorer once
    if (!scorerRef.current) {
      scorerRef.current = new SuspicionScorer()
    }

    const loadModels = async () => {
      try {
        setStatus('loading face models...')
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        ])

        // Load object detection via modular YoloDetector (only if enabled)
        if (enableObjects) {
          setStatus('loading object detection...')
          try {
            const detector = new YoloDetector({ enabled: true, skipFrames: 2 })
            await detector.load()
            yoloRef.current = detector
            setObjectDetectionReady(true)
          } catch (e) {
            console.warn('[Proctor] Object detection load failed, continuing without it:', e)
          }
        }

        setModelsLoaded(true)
        setStatus('starting camera...')
      } catch (e) {
        console.error('[Proctor] Model loading error:', e)
        setStatus('model load failed')
      }
    }
    loadModels()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (yoloRef.current) yoloRef.current.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync enableObjects prop to YoloDetector at runtime
  useEffect(() => {
    if (yoloRef.current) {
      yoloRef.current.setEnabled(enableObjects)
    }
  }, [enableObjects])

  // ──────────────────────────────────────────────────────────────
  //  Camera start
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelsLoaded) return
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setCameraActive(true)
          setStatus('active')
        }
      } catch (e) {
        console.error('[Proctor] Camera error:', e)
        setStatus('camera denied')
      }
    }
    startCamera()
  }, [modelsLoaded])

  // ──────────────────────────────────────────────────────────────
  //  Main detection loop
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraActive || !modelsLoaded) return

    const detect = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      statsRef.current.totalChecks++
      const now = new Date().toLocaleTimeString()

      // ── 1. Face detection (face-api.js) ─────────────────────
      let detections = []
      try {
        detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceExpressions()
      } catch (e) {
        // face-api can occasionally throw on bad frames
      }

      let dominantEmotion = 'neutral'
      let gazeAway = false

      if (detections.length === 0) {
        statsRef.current.faceAbsent++
        addViolation('no_face', `No face detected at ${now}`)
      } else {
        statsRef.current.facePresent++

        if (detections.length > 1) {
          statsRef.current.multipleFaces++
          addViolation('multiple_faces', `${detections.length} faces detected at ${now}`)
        }

        // Gaze check from landmarks
        const landmarks = detections[0].landmarks
        const nose = landmarks.getNose()
        const leftEye = landmarks.getLeftEye()
        const rightEye = landmarks.getRightEye()

        if (nose.length > 0 && leftEye.length > 0 && rightEye.length > 0) {
          const noseX = nose[0].x
          const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2
          const faceWidth = rightEye[3].x - leftEye[0].x
          const gazeOffset = Math.abs(noseX - eyeCenterX) / Math.max(faceWidth, 1)

          if (gazeOffset > 0.35) {
            statsRef.current.gazeAway++
            gazeAway = true
            addViolation('gaze_away', `Looking away from screen at ${now}`)
          }
        }

        // Expression tracking
        const expressions = detections[0].expressions
        dominantEmotion = Object.keys(expressions).reduce((a, b) =>
          expressions[a] > expressions[b] ? a : b
        )
        statsRef.current.expressionHistory.push(dominantEmotion)
        if (statsRef.current.expressionHistory.length > 100) {
          statsRef.current.expressionHistory = statsRef.current.expressionHistory.slice(-100)
        }
      }

      // ── 2. Object detection via YoloDetector ────────────────
      let detectedObjects = []
      if (yoloRef.current) {
        const result = await yoloRef.current.detect(video)
        if (!result.skipped) {
          detectedObjects = result.objects
          // Record into legacy stats
          for (const obj of detectedObjects) {
            statsRef.current.objectsDetected.push(obj.class)
            if (obj.class === 'extra person') {
              addViolation('extra_person', `${obj.count || 2} people detected at ${now}`)
            } else {
              addViolation('object', `${obj.class} detected (${Math.round(obj.score * 100)}% conf) at ${now}`)
            }
          }
        }
      }

      // ── 3. Suspicion scoring ────────────────────────────────
      if (scorerRef.current) {
        statsRef.current.lastSuspicionResult = scorerRef.current.processFrame({
          faceCount: detections.length,
          dominantEmotion,
          detectedObjects,
          gazeAway,
        })
      }

      // ── 4. Update parent with live stats ────────────────────
      if (onStatsUpdate) {
        const suspicion = statsRef.current.lastSuspicionResult
        onStatsUpdate({
          faceDetected: detections.length > 0,
          multipleFaces: detections.length > 1,
          gazeOnScreen: statsRef.current.gazeAway === 0 || (statsRef.current.totalChecks - statsRef.current.gazeAway) > statsRef.current.gazeAway,
          totalViolations: statsRef.current.violations.length,
          integrity: calculateIntegrity(statsRef.current),
          expression: dominantEmotion,
          // New suspicion fields
          suspicionScore: suspicion ? suspicion.suspicionScore : 0,
          suspicionSignals: suspicion ? suspicion.signals : [],
          suspicionTrend: suspicion ? suspicion.trend : 'stable',
          objectDetectionActive: yoloRef.current ? yoloRef.current.ready : false,
        })
      }

      // ── 5. Draw on canvas ───────────────────────────────────
      if (canvasRef.current && video) {
        const displaySize = { width: video.videoWidth || 320, height: video.videoHeight || 240 }
        faceapi.matchDimensions(canvasRef.current, displaySize)
        const resized = faceapi.resizeResults(detections, displaySize)
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, displaySize.width, displaySize.height)
        faceapi.draw.drawDetections(canvasRef.current, resized)
        faceapi.draw.drawFaceLandmarks(canvasRef.current, resized)

        // Draw object detection boxes on canvas
        if (detectedObjects.length > 0) {
          ctx.strokeStyle = '#f87171'
          ctx.lineWidth = 2
          ctx.font = '11px sans-serif'
          ctx.fillStyle = '#f87171'
          const scaleX = displaySize.width / (video.videoWidth || 320)
          const scaleY = displaySize.height / (video.videoHeight || 240)
          for (const obj of detectedObjects) {
            if (obj.bbox && obj.bbox[2] > 0) {
              const [x, y, w, h] = obj.bbox
              ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
              ctx.fillText(`⚠ ${obj.class} ${Math.round(obj.score * 100)}%`, x * scaleX, Math.max(12, y * scaleY - 4))
            }
          }
        }
      }
    }

    intervalRef.current = setInterval(detect, detectionInterval)
    return () => clearInterval(intervalRef.current)
  }, [cameraActive, modelsLoaded, detectionInterval]) // eslint-disable-line react-hooks/exhaustive-deps

  const addViolation = (type, message) => {
    statsRef.current.violations.push({ type, message, timestamp: Date.now() })
    if (onViolation) onViolation({ type, message })
  }

  // ──────────────────────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', width: '100%', maxWidth: 320 }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', display: 'block', borderRadius: 12 }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
      {/* Status overlay */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        background: status === 'active' ? 'rgba(16,185,129,0.85)' : status === 'camera denied' ? 'rgba(239,68,68,0.85)' : 'rgba(99,102,241,0.85)',
        color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600
      }}>
        {status === 'active' ? '🟢 Proctoring' : status === 'camera denied' ? '🔴 Camera denied' : `⏳ ${status}`}
      </div>
      {/* Object detection indicator */}
      {status === 'active' && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: objectDetectionReady ? 'rgba(16,185,129,0.75)' : 'rgba(251,191,36,0.75)',
          color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 600
        }}>
          {objectDetectionReady ? '🔍 OD' : '— OD off'}
        </div>
      )}
    </div>
  )
})

Proctor.displayName = 'Proctor'
export default Proctor
