/**
 * The whole on-device stage: raw text in, anonymous payload out.
 *
 *   raw text ──► PII spans (Gemini Nano + regex net) ──► redacted text
 *            ──► line items (CSV columns | Gemini Nano | line heuristic)
 *            ──► final scrub ──► payload for the cloud
 *
 * Nothing here touches the network. `networkRequests` in the result is an
 * observed count (PerformanceObserver), shown in the UI as proof.
 */

import { detectPIIWithNano, extractItemsWithNano, getNanoAvailability } from './localNanoService.js'
import { redactText, scrubPayload } from '../utils/redaction.js'
import { buildPayload, extractItemsHeuristic } from '../utils/itemExtraction.js'
import { csvToItems, looksLikeCSV } from '../utils/csvParser.js'

function watchNetwork() {
  let count = 0
  let observer = null
  try {
    observer = new PerformanceObserver((list) => {
      count += list.getEntries().length
    })
    observer.observe({ type: 'resource' })
  } catch {
    // PerformanceObserver unavailable: report what we can.
  }
  return () => {
    count += observer?.takeRecords?.().length ?? 0
    observer?.disconnect()
    return count
  }
}

const NANO_TIMEOUT_MS = 25_000

/**
 * Resolve with `promise`, or reject as soon as `signal` aborts, even if the
 * underlying API ignores the signal. Keeps a stuck model from hanging the UI.
 */
function untilAborted(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    promise.then(resolve, reject)
  })
}

/**
 * @param {string} text raw input (never leaves this function except to the local model)
 * @param {object} [opts]
 * @param {(stage: 'redacting'|'extracting', partial?: object) => void} [opts.onStage]
 * @param {AbortSignal} [opts.signal]
 * @param {number} [opts.nanoTimeoutMs] per model step
 *
 * Gemini Nano is only used when it is fully downloaded ("available"). While it
 * is missing or still downloading, the basic filter runs immediately and
 * `engineReason` says why, so the UI never waits on a multi-GB download.
 */
export async function runLocalPipeline(text, { onStage, signal, nanoTimeoutMs = NANO_TIMEOUT_MS } = {}) {
  const stopWatching = watchNetwork()
  const t0 = performance.now()
  const { status } = await getNanoAvailability()
  let engine = status === 'available' ? 'nano' : 'fallback'
  let engineReason = engine === 'nano' ? null : status

  const nanoStep = (run) => {
    const stepSignal = AbortSignal.any([AbortSignal.timeout(nanoTimeoutMs), ...(signal ? [signal] : [])])
    return untilAborted(run(stepSignal), stepSignal)
  }
  const fallBack = (err, step) => {
    if (signal?.aborted) throw err
    console.warn(`[pipeline] Gemini Nano ${step} failed, using local fallback`, err)
    return err?.name === 'TimeoutError' ? 'timeout' : 'error'
  }

  onStage?.('redacting')
  let entities = []
  if (engine === 'nano') {
    try {
      entities = await nanoStep((s) => detectPIIWithNano(text, { signal: s }))
    } catch (err) {
      engineReason = fallBack(err, 'redaction')
      engine = 'fallback'
    }
  }
  const { redactedText, segments, counts, secrets } = redactText(text, entities)
  const redactMs = performance.now() - t0

  onStage?.('extracting', { segments, counts, engine, engineReason })
  let extracted = null
  const csvItems = looksLikeCSV(redactedText) ? csvToItems(redactedText) : null
  if (csvItems?.length) {
    extracted = { projectTitle: '', items: csvItems }
  } else if (engine === 'nano') {
    try {
      extracted = await nanoStep((s) => extractItemsWithNano(redactedText, { signal: s }))
    } catch (err) {
      fallBack(err, 'extraction')
    }
  }
  if (!extracted || buildPayload(extracted).items.length === 0) {
    const heuristic = extractItemsHeuristic(redactedText)
    if (!extracted || heuristic.items.length) extracted = heuristic
  }

  const { payload, scrubbed } = scrubPayload(buildPayload(extracted), secrets)

  return {
    engine,
    engineReason,
    segments,
    counts,
    payload,
    scrubbed,
    redactMs,
    totalMs: performance.now() - t0,
    networkRequests: stopWatching(),
  }
}
