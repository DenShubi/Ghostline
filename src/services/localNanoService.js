/**
 * On-device inference via Chrome's built-in Prompt API (Gemini Nano).
 *
 * PRIVACY CONTRACT: nothing in this module may make a network request.
 * Raw contract text (with PII) only ever goes to the local model, or to the
 * local regex fallback when Nano is unavailable. Never route this through a
 * cloud model "as a fallback" — that would break the "0 PII Sent" guarantee.
 *
 * Chrome has shipped two shapes of this API:
 *   - current:  global `LanguageModel` with `availability()` / `create()`
 *   - legacy:   `window.ai.languageModel` with `capabilities()` / `create()`
 * Both are normalised here so the rest of the app doesn't care.
 */

/** @typedef {'unsupported'|'unavailable'|'downloadable'|'downloading'|'available'} NanoStatus */

const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
}

function getApi() {
  if (typeof globalThis.LanguageModel !== 'undefined') {
    return { kind: 'LanguageModel', impl: globalThis.LanguageModel }
  }
  if (globalThis.ai?.languageModel) {
    return { kind: 'window.ai', impl: globalThis.ai.languageModel }
  }
  return null
}

const LEGACY_STATUS = { readily: 'available', 'after-download': 'downloadable', no: 'unavailable' }

/**
 * @returns {Promise<{ status: NanoStatus, api: string | null }>}
 */
export async function getNanoAvailability() {
  const api = getApi()
  if (!api) return { status: 'unsupported', api: null }

  try {
    if (api.kind === 'LanguageModel') {
      const status = await api.impl.availability(LANGUAGE_OPTIONS)
      return { status, api: api.kind }
    }
    const caps = await api.impl.capabilities()
    return { status: LEGACY_STATUS[caps.available] ?? 'unavailable', api: api.kind }
  } catch (err) {
    console.warn('[localNano] availability check failed', err)
    return { status: 'unavailable', api: api.kind }
  }
}

/**
 * Create a local model session. If the model still needs downloading, this
 * starts the download — Chrome requires that to happen inside a user gesture
 * (e.g. a click handler).
 *
 * @param {object} [opts]
 * @param {string} [opts.systemPrompt]
 * @param {(fraction: number) => void} [opts.onDownloadProgress] 0..1
 * @param {AbortSignal} [opts.signal]
 */
export async function createNanoSession({ systemPrompt, onDownloadProgress, signal } = {}) {
  const api = getApi()
  if (!api) throw new Error('Gemini Nano Prompt API is not available in this browser.')

  const monitor = onDownloadProgress
    ? (m) => m.addEventListener('downloadprogress', (e) => onDownloadProgress(e.loaded))
    : undefined

  if (api.kind === 'LanguageModel') {
    return api.impl.create({
      ...LANGUAGE_OPTIONS,
      ...(systemPrompt && { initialPrompts: [{ role: 'system', content: systemPrompt }] }),
      monitor,
      signal,
    })
  }
  return api.impl.create({ systemPrompt, monitor, signal })
}

const SMOKE_TEST_SYSTEM_PROMPT =
  'You redact personal data from procurement documents. ' +
  'Replace every person name with [REDACTED_NAME], every email with [REDACTED_EMAIL], ' +
  'every phone number with [REDACTED_PHONE] and every employee ID with [REDACTED_ID]. ' +
  'Keep everything else exactly as written. Output only the redacted text.'

export const SMOKE_TEST_INPUT =
  'Contract approved by John Miller (Employee ID: EMP-48213), contact j.miller@district.gov ' +
  'or +1 (555) 013-2244. Item: Student Laptop 14-inch, qty 500, unit price $1,250.00.'

/**
 * "Hello Hybrid" check: run one tiny redaction prompt fully on-device and
 * time it. Used to verify local inference works on this machine (T02).
 *
 * @returns {Promise<{ output: string, ms: number, simulated: boolean }>}
 */
export async function runLocalSmokeTest({ input = SMOKE_TEST_INPUT, onDownloadProgress } = {}) {
  const { status } = await getNanoAvailability()

  if (status === 'unsupported' || status === 'unavailable') {
    const t0 = performance.now()
    const output = simulateRedaction(input)
    return { output, ms: performance.now() - t0, simulated: true }
  }

  const session = await createNanoSession({
    systemPrompt: SMOKE_TEST_SYSTEM_PROMPT,
    onDownloadProgress,
  })
  try {
    const t0 = performance.now()
    const output = await session.prompt(input)
    return { output: output.trim(), ms: performance.now() - t0, simulated: false }
  } finally {
    session.destroy()
  }
}

/**
 * Transparent simulation mode for browsers without Gemini Nano (e.g. judges
 * on stock Chrome). Pattern-based, local-only, and clearly labelled in the UI.
 * Catches structured PII only (emails, phones, IDs, "Name Surname" after a
 * role cue) — it is a demo fallback, not a replacement for the model.
 */
export function simulateRedaction(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:EMP|NIP|ID)[-:\s]*\d{4,}\b/gi, '[REDACTED_ID]')
    .replace(/(?:\+\d{1,3}[\s-]?)?\(?\d{3,4}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(
      /\b((?:approved|signed|prepared|issued|authori[sz]ed) by|Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g,
      '$1 [REDACTED_NAME]',
    )
}
