/**
 * SuspicionScorer — Weighted suspicion scoring engine for AI proctoring.
 *
 * Inspired by vardanagarwal/Proctoring-AI scoring logic.
 * Aggregates multiple proctoring signals into a single 0–100 "Overall Suspicion Score"
 * where 0 = no suspicion and 100 = maximum suspicion.
 *
 * Weights are tunable via the constructor or setWeights().
 */

// Default weight configuration
const DEFAULT_WEIGHTS = {
  // ── Face presence ──────────────────────────────────────────────
  noFace: 25,             // No face detected at all → high suspicion
  multipleFaces: 20,      // More than one face → likely external help

  // ── Prohibited objects ─────────────────────────────────────────
  cellPhone: 30,          // Mobile phone detected
  book: 25,               // Physical book / cheat sheet
  laptop: 20,             // Secondary laptop / screen
  remote: 10,             // TV remote (possible secondary screen control)
  extraPerson: 20,        // Extra person detected in frame

  // ── Gaze / head pose ──────────────────────────────────────────
  gazeAway: 10,           // Looking away from screen

  // ── Emotion / behavioural ──────────────────────────────────────
  sustainedStress: 5,     // Sustained fearful/angry expressions (minor weight)
  sustainedAnxiety: 5,    // Sustained surprise/sad (anxious) expressions

  // ── Decay ─────────────────────────────────────────────────────
  // Each "clean" frame reduces accumulated score by this factor
  decayRate: 0.92,
}

// High-stress emotion set (used for behavioural cue scoring)
const STRESS_EMOTIONS = new Set(['angry', 'fearful', 'disgusted'])
const ANXIETY_EMOTIONS = new Set(['surprised', 'sad'])

export default class SuspicionScorer {
  /**
   * @param {Partial<typeof DEFAULT_WEIGHTS>} customWeights – override any default weight
   */
  constructor(customWeights = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights }

    // Running state
    this._rawScore = 0                // accumulated raw score before clamping
    this._frameCount = 0
    this._history = []                // last N per-frame scores for trend analysis
    this._maxHistory = 120            // ~4 min at 2 s / frame
    this._emotionWindow = []          // rolling window of last 10 dominant emotions
    this._emotionWindowSize = 10
    this._lastObjectTimestamps = {}   // per-class cooldown to avoid double-counting
    this._objectCooldownMs = 6000     // 6 s cooldown per object class
  }

  // ──────────────────────────────────────────────────────────────
  //  Public API
  // ──────────────────────────────────────────────────────────────

  /**
   * Process a single frame's proctoring data and return the updated suspicion score.
   *
   * @param {Object} frameData
   * @param {number} frameData.faceCount       – number of faces detected (0, 1, 2+)
   * @param {string} frameData.dominantEmotion – e.g. 'neutral', 'fearful', etc.
   * @param {Array}  frameData.detectedObjects – array of { class: string, score: number }
   * @param {boolean} frameData.gazeAway       – true if user is looking away
   * @returns {{ suspicionScore: number, signals: string[], trend: string }}
   */
  processFrame(frameData) {
    this._frameCount++
    const { faceCount = 1, dominantEmotion = 'neutral', detectedObjects = [], gazeAway = false } = frameData
    const w = this.weights
    let framePenalty = 0
    const signals = []

    // ── 1. Face presence ───────────────────────────────────────
    if (faceCount === 0) {
      framePenalty += w.noFace
      signals.push('no_face')
    } else if (faceCount > 1) {
      framePenalty += w.multipleFaces
      signals.push(`multiple_faces(${faceCount})`)
    }

    // ── 2. Prohibited objects (with cooldown) ──────────────────
    const now = Date.now()
    const PROHIBITED_MAP = {
      'cell phone': w.cellPhone,
      'book': w.book,
      'laptop': w.laptop,
      'remote': w.remote,
    }

    for (const obj of detectedObjects) {
      const cls = obj.class
      // Extra person detected by YOLO / COCO
      if (cls === 'person' && obj.score > 0.4) {
        // Already counted in faceCount, but if YOLO separately detects a person body
        // beyond the first, treat as extra person
        continue // handled via faceCount
      }
      if (cls === 'extra person') {
        if (!this._isOnCooldown(cls, now)) {
          framePenalty += w.extraPerson
          signals.push('extra_person')
          this._lastObjectTimestamps[cls] = now
        }
        continue
      }
      const penalty = PROHIBITED_MAP[cls]
      if (penalty && !this._isOnCooldown(cls, now)) {
        framePenalty += penalty
        signals.push(`object:${cls}`)
        this._lastObjectTimestamps[cls] = now
      }
    }

    // ── 3. Gaze ────────────────────────────────────────────────
    if (gazeAway) {
      framePenalty += w.gazeAway
      signals.push('gaze_away')
    }

    // ── 4. Emotion / behavioural cues ──────────────────────────
    this._emotionWindow.push(dominantEmotion)
    if (this._emotionWindow.length > this._emotionWindowSize) {
      this._emotionWindow.shift()
    }
    const { stressPct, anxietyPct } = this._emotionStats()
    if (stressPct >= 60) {
      framePenalty += w.sustainedStress
      signals.push('sustained_stress')
    }
    if (anxietyPct >= 60) {
      framePenalty += w.sustainedAnxiety
      signals.push('sustained_anxiety')
    }

    // ── 5. Accumulate with exponential decay ───────────────────
    if (framePenalty === 0) {
      // Clean frame → decay
      this._rawScore *= w.decayRate
    } else {
      // Penalty frame → add penalty (capped contribution per frame)
      this._rawScore = this._rawScore * 0.95 + Math.min(framePenalty, 60)
    }

    const suspicionScore = this._clampedScore()

    // ── 6. History for trend ───────────────────────────────────
    this._history.push(suspicionScore)
    if (this._history.length > this._maxHistory) this._history.shift()

    return {
      suspicionScore,
      signals,
      trend: this._trend(),
    }
  }

  /**
   * Get the current overall suspicion score (0-100).
   */
  getScore() {
    return this._clampedScore()
  }

  /**
   * Get a full diagnostic snapshot of the scorer state.
   */
  getSnapshot() {
    const { stressPct, anxietyPct } = this._emotionStats()
    return {
      suspicionScore: this._clampedScore(),
      rawScore: Math.round(this._rawScore * 100) / 100,
      frameCount: this._frameCount,
      trend: this._trend(),
      emotionStressPct: stressPct,
      emotionAnxietyPct: anxietyPct,
      recentHistory: this._history.slice(-20),
    }
  }

  /**
   * Override weights at runtime (e.g., to disable object scoring).
   */
  setWeights(partial) {
    Object.assign(this.weights, partial)
  }

  /**
   * Reset the scorer state (e.g., between exam sessions).
   */
  reset() {
    this._rawScore = 0
    this._frameCount = 0
    this._history = []
    this._emotionWindow = []
    this._lastObjectTimestamps = {}
  }

  // ──────────────────────────────────────────────────────────────
  //  Internals
  // ──────────────────────────────────────────────────────────────

  _isOnCooldown(cls, now) {
    const last = this._lastObjectTimestamps[cls]
    return last && (now - last) < this._objectCooldownMs
  }

  _clampedScore() {
    return Math.min(100, Math.max(0, Math.round(this._rawScore)))
  }

  _emotionStats() {
    if (this._emotionWindow.length === 0) return { stressPct: 0, anxietyPct: 0 }
    const total = this._emotionWindow.length
    let stress = 0, anxiety = 0
    for (const e of this._emotionWindow) {
      if (STRESS_EMOTIONS.has(e)) stress++
      if (ANXIETY_EMOTIONS.has(e)) anxiety++
    }
    return {
      stressPct: Math.round((stress / total) * 100),
      anxietyPct: Math.round((anxiety / total) * 100),
    }
  }

  _trend() {
    const h = this._history
    if (h.length < 5) return 'stable'
    const recent = h.slice(-5)
    const older = h.slice(-10, -5)
    if (older.length === 0) return 'stable'
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length
    const diff = avgRecent - avgOlder
    if (diff > 8) return 'rising'
    if (diff < -8) return 'falling'
    return 'stable'
  }
}

