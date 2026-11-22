/**
 * Cloud Audit Engine powered by Firebase AI Logic (Cloud Gemini) + Firestore Benchmarks.
 *
 * PRIVACY CONTRACT:
 *   - Accepts ONLY the anonymised `result.payload` produced by `localPipeline.js`.
 *   - Runs `sanitizeCloudPayload()` to strip unknown properties and reject any
 *     unredacted email/phone before making any network request.
 *   - Computes all markup percentages, risk levels, and USD leakage totals
 *     deterministically in code (`pricingAudit.js`) so LLM arithmetic cannot drift.
 */

import { cleanJSON } from '../utils/itemExtraction.js'
import {
  buildFallbackBrief,
  evaluateLineItem,
  matchBenchmarkLocally,
  sanitizeCloudPayload,
  summarizeAuditItems,
} from '../utils/pricingAudit.js'

const env = import.meta.env ?? {}

export const DEFAULT_AUDIT_MODEL = env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'
const DEFAULT_TIMEOUT_MS = 30_000

const AUDIT_SYSTEM_INSTRUCTION = [
  'You are a forensic public procurement auditor for AuditZero (Ghostline).',
  'You receive ONLY anonymised line items (zero personal data) and a catalog of verified USD public market price benchmarks.',
  'For each input line item (by its 0-based `index`):',
  '1. Match it to the closest benchmark in the provided catalog and return its exact `benchmarkId`, or null if no benchmark in the catalog fits.',
  '2. If `benchmarkId` is null, optionally provide a conservative USD market estimate (`estimatedFairPriceMin`, `estimatedFairPriceMax`, `estimatedFairPriceAvg`).',
  '3. Write a concise, factual 1-sentence forensic `reason` explaining why the unit price appears normal or anomalous.',
  '4. Write a concise `executiveSummary` (2-3 sentences) and 2-3 actionable `recommendations` for an oversight auditor.',
  'Never invent personal names or vendor identities. Respond strictly in JSON matching the requested schema.',
].join(' ')

const AUDIT_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          benchmarkId: { type: 'string', nullable: true },
          estimatedFairPriceMin: { type: 'number', nullable: true },
          estimatedFairPriceMax: { type: 'number', nullable: true },
          estimatedFairPriceAvg: { type: 'number', nullable: true },
          reason: { type: 'string' },
        },
        required: ['index', 'benchmarkId', 'reason'],
      },
    },
    executiveSummary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['matches', 'executiveSummary', 'recommendations'],
}

/**
 * Build the compact prompt payload sent to Cloud Gemini.
 *
 * @param {ReturnType<typeof sanitizeCloudPayload>} cleanPayload
 * @param {Array<object>} benchmarks
 */
export function buildAuditPrompt(cleanPayload, benchmarks) {
  const catalog = benchmarks.map((b) => ({
    id: b.id,
    category: b.category,
    itemName: b.itemName,
    fairPriceMin: b.fairPriceMin,
    fairPriceMax: b.fairPriceMax,
    fairPriceAvg: b.fairPriceAvg,
    unit: b.unit,
  }))

  const indexedItems = cleanPayload.items.map((item, index) => ({
    index,
    itemName: item.itemName,
    specs: item.specs,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }))

  return JSON.stringify(
    {
      projectTitle: cleanPayload.projectTitle,
      currency: cleanPayload.currency,
      lineItems: indexedItems,
      benchmarkCatalog: catalog,
    },
    null,
    2,
  )
}

/**
 * Default Cloud Gemini invoker using Firebase AI Logic (`src/services/firebase.js`).
 */
async function defaultGenerateAudit(prompt, { modelName = DEFAULT_AUDIT_MODEL, signal } = {}) {
  const [{ getGenerativeModel }, { ai }] = await Promise.all([
    import('firebase/ai'),
    import('./firebase.js'),
  ])

  const model = getGenerativeModel(ai, {
    model: modelName,
    systemInstruction: AUDIT_SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseJsonSchema: AUDIT_RESPONSE_JSON_SCHEMA,
    },
  })

  const result = await model.generateContent(prompt, signal ? { signal } : undefined)
  return result.response.text()
}

/**
 * Default benchmark loader: reads live Firestore `price_benchmarks` collection.
 */
async function defaultLoadBenchmarks() {
  const { getAllBenchmarks } = await import('./benchmarkService.js')
  return getAllBenchmarks()
}

/**
 * Resolve a promise or reject as soon as `signal` aborts.
 */
function untilAborted(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    promise.then(resolve, reject)
  })
}

/**
 * Run a full Cloud Audit on an anonymised procurement payload.
 *
 * 1. Validates & strips payload via `sanitizeCloudPayload` (0 PII guarantee).
 * 2. Loads USD market benchmarks from Firestore (`price_benchmarks`).
 * 3. Calls Cloud Gemini via Firebase AI Logic for semantic benchmark matching
 *    and forensic reasoning, falling back cleanly to deterministic matching if
 *    Cloud Gemini is unavailable or times out.
 * 4. Computes all markup percentages, risk levels, and leakage totals in code.
 *
 * @param {object} payload - Anonymised payload `{ projectTitle, currency, items[] }` from `localPipeline.js`
 * @param {object} [opts]
 * @param {string} [opts.modelName] - Gemini model ID (default: `gemini-2.5-flash`)
 * @param {number} [opts.timeoutMs] - Cloud Gemini timeout in milliseconds
 * @param {AbortSignal} [opts.signal] - Optional cancellation signal
 * @param {() => Promise<Array<object>>} [opts.loadBenchmarks] - Injectable benchmark loader (for tests)
 * @param {(prompt: string, opts: { modelName: string, signal: AbortSignal }) => Promise<string | object>} [opts.generateAudit] - Injectable LLM runner (for tests)
 * @returns {Promise<object>} Structured CloudAuditReport ready for UI & Firestore persistence
 */
export async function runCloudAudit(
  payload,
  {
    modelName = DEFAULT_AUDIT_MODEL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    loadBenchmarks = defaultLoadBenchmarks,
    generateAudit = defaultGenerateAudit,
  } = {},
) {
  const t0 = performance.now()
  const cleanPayload = sanitizeCloudPayload(payload)
  const benchmarks = await loadBenchmarks()

  const benchmarkById = new Map(benchmarks.map((b) => [b.id, b]))

  let engine = 'cloud-gemini'
  let fallbackReason = null
  let aiParsed = null

  const stepSignal = AbortSignal.any([
    AbortSignal.timeout(timeoutMs),
    ...(signal ? [signal] : []),
  ])

  try {
    const prompt = buildAuditPrompt(cleanPayload, benchmarks)
    const raw = await untilAborted(generateAudit(prompt, { modelName, signal: stepSignal }), stepSignal)
    const parsed = cleanJSON(raw)
    if (!parsed || !Array.isArray(parsed.matches)) {
      throw new Error('Cloud Gemini returned malformed audit JSON.')
    }
    aiParsed = parsed
  } catch (err) {
    if (signal?.aborted) throw err
    engine = 'benchmark-fallback'
    fallbackReason = err?.name === 'TimeoutError' ? 'timeout' : err?.message || 'cloud-error'
    console.warn('[cloudAudit] Cloud Gemini unavailable, using deterministic benchmark matching:', err)
  }

  const aiMatchByIndex = new Map(
    (aiParsed?.matches ?? [])
      .filter((m) => Number.isInteger(m?.index))
      .map((m) => [m.index, m]),
  )

  const auditedItems = cleanPayload.items.map((item, idx) => {
    const aiMatch = aiMatchByIndex.get(idx)
    let matchedBenchmark

    if (aiMatch?.benchmarkId && benchmarkById.has(aiMatch.benchmarkId)) {
      matchedBenchmark = benchmarkById.get(aiMatch.benchmarkId)
    } else if (
      aiMatch &&
      aiMatch.benchmarkId === null &&
      Number.isFinite(aiMatch.estimatedFairPriceAvg) &&
      aiMatch.estimatedFairPriceAvg > 0
    ) {
      matchedBenchmark = {
        id: null,
        itemName: item.itemName,
        category: 'AI Market Estimate',
        fairPriceMin: Number.isFinite(aiMatch.estimatedFairPriceMin)
          ? aiMatch.estimatedFairPriceMin
          : aiMatch.estimatedFairPriceAvg,
        fairPriceMax: Number.isFinite(aiMatch.estimatedFairPriceMax)
          ? aiMatch.estimatedFairPriceMax
          : aiMatch.estimatedFairPriceAvg,
        fairPriceAvg: aiMatch.estimatedFairPriceAvg,
        unit: 'unit',
        sourceNote: 'Cloud Gemini 2026 Market Estimate',
      }
    } else {
      matchedBenchmark = matchBenchmarkLocally(item.itemName, benchmarks)
    }

    const reason = typeof aiMatch?.reason === 'string' ? aiMatch.reason.trim() : ''
    return evaluateLineItem(item, matchedBenchmark, reason)
  })

  const summary = summarizeAuditItems(auditedItems)
  const fallbackBrief = buildFallbackBrief(cleanPayload.projectTitle, auditedItems, summary)

  const executiveSummary =
    typeof aiParsed?.executiveSummary === 'string' && aiParsed.executiveSummary.trim()
      ? aiParsed.executiveSummary.trim()
      : fallbackBrief.executiveSummary

  const recommendations =
    Array.isArray(aiParsed?.recommendations) && aiParsed.recommendations.length > 0
      ? aiParsed.recommendations.map((r) => String(r).trim()).filter(Boolean)
      : fallbackBrief.recommendations

  return {
    projectTitle: cleanPayload.projectTitle,
    currency: cleanPayload.currency,
    engine,
    modelName: engine === 'cloud-gemini' ? modelName : null,
    fallbackReason,
    items: auditedItems,
    summary,
    executiveSummary,
    recommendations,
    durationMs: Math.round(performance.now() - t0),
    auditedAt: new Date().toISOString(),
  }
}
