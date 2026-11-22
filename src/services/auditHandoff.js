/**
 * T09: hand the anonymous payload from the local pipeline to the price audit.
 *
 *   payload (no PII) ──► runCloudAudit (Kahfi, T08)
 *                         ├─ benchmarks: Firestore, or the bundled copy if Firestore is empty/unreachable
 *                         └─ matching + wording: Cloud Gemini via Firebase AI Logic, or name matching
 *
 * When no Firebase project is configured (e.g. a preview deploy without env
 * vars), the audit runs entirely on this device against the bundled
 * benchmarks and says so. Nothing is sent anywhere in that case.
 */

import { runCloudAudit } from './cloudAuditService.js'
import seedBenchmarks from '../data/seedBenchmarks.json' with { type: 'json' }

const env = import.meta.env ?? {}

export const isCloudConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID,
)

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Same IDs as scripts/seedFirestore.js, so Gemini's benchmarkId matches either source. */
export const BUNDLED_BENCHMARKS = seedBenchmarks.map((b) => ({
  id: `${slugify(b.category)}__${slugify(b.itemName)}`,
  ...b,
}))

async function loadFirestoreBenchmarks() {
  const { getAllBenchmarks } = await import('./benchmarkService.js')
  return getAllBenchmarks()
}

const offline = () => Promise.reject(new Error('cloud-not-configured'))

/**
 * @param {{ projectTitle: string, currency: string, items: object[] }} payload anonymous payload from runLocalPipeline
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @param {boolean} [opts.configured] defaults to whether Firebase env vars are set
 * @param {() => Promise<object[]>} [opts.loadBenchmarks] Firestore loader (injectable for tests)
 * @param {Function} [opts.generateAudit] Cloud Gemini runner (injectable for tests)
 * @returns {Promise<object>} CloudAuditReport + `mode` ('cloud' | 'local') and `benchmarkSource` ('firestore' | 'bundled')
 */
export async function runPriceAudit(
  payload,
  { signal, configured = isCloudConfigured, loadBenchmarks = loadFirestoreBenchmarks, generateAudit } = {},
) {
  if (!configured) {
    const report = await runCloudAudit(payload, {
      signal,
      loadBenchmarks: async () => BUNDLED_BENCHMARKS,
      generateAudit: offline,
    })
    return { ...report, mode: 'local', benchmarkSource: 'bundled', fallbackReason: 'not-configured' }
  }

  let benchmarkSource = 'firestore'
  const report = await runCloudAudit(payload, {
    signal,
    generateAudit,
    loadBenchmarks: async () => {
      try {
        const live = await loadBenchmarks()
        if (live.length > 0) return live
        console.warn('[audit] Firestore has no benchmarks, using the bundled copy')
      } catch (err) {
        console.warn('[audit] Firestore benchmarks unavailable, using the bundled copy', err)
      }
      benchmarkSource = 'bundled'
      return BUNDLED_BENCHMARKS
    },
  })
  return { ...report, mode: 'cloud', benchmarkSource }
}
