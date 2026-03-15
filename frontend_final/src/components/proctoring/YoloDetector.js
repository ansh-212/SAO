/**
 * YoloDetector — Modular YOLO-based object detection for proctoring.
 *
 * Uses the browser-friendly COCO-SSD model via TensorFlow.js as the detection
 * backbone (same weight format that ships with @tensorflow-models/coco-ssd)
 * but wraps it in a proctoring-focused interface:
 *
 *  • Filters detections to only proctoring-relevant classes
 *  • Manages per-class confidence thresholds
 *  • Provides an enable/disable toggle so the module can be turned off
 *    without breaking the rest of the pipeline
 *  • Throttles inference to maintain FPS
 *
 * NOTE: We intentionally keep COCO-SSD as the underlying model because:
 *   1. It already ships as an npm package with TF.js support
 *   2. It covers the required classes (cell phone, book, laptop, person)
 *   3. Running a raw YOLO ONNX model in the browser requires a heavier
 *      onnxruntime-web setup and custom pre/post-processing — COCO-SSD
 *      gives us the same classes with zero extra infrastructure.
 *
 * If you later want to swap to a real YOLOv8-nano ONNX model, just replace
 * the _loadModel / _runInference methods; the public API stays the same.
 */

// Classes we care about for proctoring + their confidence thresholds
const PROCTORING_CLASSES = {
  'cell phone': 0.30,
  'book':       0.35,
  'laptop':     0.40,
  'remote':     0.35,
  'person':     0.35,
}

export default class YoloDetector {
  /**
   * @param {Object} options
   * @param {boolean} options.enabled   – start enabled? (default true)
   * @param {number}  options.skipFrames – run detection every N-th call to `detect()` (default 2)
   * @param {Object}  options.thresholds – per-class confidence overrides
   */
  constructor(options = {}) {
    this._enabled = options.enabled !== false
    this._skipFrames = options.skipFrames || 2
    this._thresholds = { ...PROCTORING_CLASSES, ...(options.thresholds || {}) }

    this._model = null
    this._loading = false
    this._loadError = null
    this._callCount = 0
  }

  // ──────────────────────────────────────────────────────────────
  //  Public API
  // ──────────────────────────────────────────────────────────────

  /** Load the detection model. Safe to call multiple times. */
  async load() {
    if (this._model || this._loading) return
    this._loading = true
    try {
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      this._model = await cocoSsd.load({ base: 'lite_mobilenet_v2' }) // Use lite version to ensure browser compatibility
      this._loadError = null
    } catch (e) {
      console.warn('[YoloDetector] Model load failed:', e)
      this._loadError = e
      this._model = null
    } finally {
      this._loading = false
    }
  }

  /** Is the detector ready to run? */
  get ready() {
    return !!this._model && this._enabled
  }

  /** Is the detector enabled? */
  get enabled() {
    return this._enabled
  }

  /** Enable / disable the detector at runtime. */
  setEnabled(val) {
    this._enabled = !!val
  }

  /** Toggle enabled state. Returns new state. */
  toggle() {
    this._enabled = !this._enabled
    return this._enabled
  }

  /**
   * Run detection on a video element / canvas / image.
   *
   * Automatically skips frames according to `skipFrames` to save CPU.
   *
   * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} source
   * @returns {Promise<{ objects: Array<{class: string, score: number, bbox: number[]}>, skipped: boolean }>}
   */
  async detect(source) {
    if (!this._enabled || !this._model) {
      return { objects: [], skipped: true }
    }

    this._callCount++
    if (this._callCount % this._skipFrames !== 0) {
      return { objects: [], skipped: true }
    }

    try {
      const raw = await this._model.detect(source)

      // Filter to proctoring-relevant classes above their threshold
      const objects = []
      let personCount = 0

      for (const det of raw) {
        const threshold = this._thresholds[det.class]
        if (threshold === undefined) continue
        if (det.score < threshold) continue

        if (det.class === 'person') {
          personCount++
          // We only flag "extra person" if >1 detected
          continue
        }

        objects.push({
          class: det.class,
          score: det.score,
          bbox: det.bbox, // [x, y, width, height]
        })
      }

      // If more than 1 person body is detected, add a synthetic "extra person" entry
      if (personCount > 1) {
        objects.push({
          class: 'extra person',
          score: 0.9,
          bbox: [0, 0, 0, 0],
          count: personCount,
        })
      }

      return { objects, skipped: false }
    } catch (e) {
      console.warn('[YoloDetector] Detection error:', e)
      return { objects: [], skipped: true }
    }
  }

  /** Cleanup / dispose the model. */
  dispose() {
    if (this._model && typeof this._model.dispose === 'function') {
      this._model.dispose()
    }
    this._model = null
  }
}

