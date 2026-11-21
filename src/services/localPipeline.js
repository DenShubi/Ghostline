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

import { canRunNano, detectPIIWithNano, extractItemsWithNano, getNanoAvailability } from './localNanoService.js'
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

/**
 * @param {string} text raw input (never leaves this function except to the local model)
 * @param {object} [opts]
 * @param {(stage: 'redacting'|'extracting', partial?: object) => void} [opts.onStage]
 * @param {(fraction: number) => void} [opts.onDownloadProgress]
 * @param {AbortSignal} [opts.signal]
 */
export async function runLocalPipeline(text, { onStage, onDownloadProgress, signal } = {}) {
  const stopWatching = watchNetwork()
  const t0 = performance.now()
  const { status } = await getNanoAvailability()
  let engine = canRunNano(status) ? 'nano' : 'fallback'

  onStage?.('redacting')
  let entities = []
  if (engine === 'nano') {
    try {
      entities = await detectPIIWithNano(text, { onDownloadProgress, signal })
    } catch (err) {
      if (signal?.aborted) throw err
      console.warn('[pipeline] Gemini Nano redaction failed, using basic filter', err)
      engine = 'fallback'
    }
  }
  const { redactedText, segments, counts, secrets } = redactText(text, entities)
  const redactMs = performance.now() - t0

  onStage?.('extracting', { segments, counts, engine })
  let extracted = null
  const csvItems = looksLikeCSV(redactedText) ? csvToItems(redactedText) : null
  if (csvItems?.length) {
    extracted = { projectTitle: '', items: csvItems }
  } else if (engine === 'nano') {
    try {
      extracted = await extractItemsWithNano(redactedText, { signal })
    } catch (err) {
      if (signal?.aborted) throw err
      console.warn('[pipeline] Gemini Nano extraction failed, using line parser', err)
    }
  }
  if (!extracted || buildPayload(extracted).items.length === 0) {
    const heuristic = extractItemsHeuristic(redactedText)
    if (!extracted || heuristic.items.length) extracted = heuristic
  }

  const { payload, scrubbed } = scrubPayload(buildPayload(extracted), secrets)

  return {
    engine,
    segments,
    counts,
    payload,
    scrubbed,
    redactMs,
    totalMs: performance.now() - t0,
    networkRequests: stopWatching(),
  }
}
