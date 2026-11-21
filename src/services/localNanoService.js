/**
 * On-device inference via Chrome's built-in Prompt API (Gemini Nano).
 *
 * PRIVACY CONTRACT: nothing in this module may make a network request.
 * Raw contract text (with PII) only ever goes to the local model. Never route
 * it through a cloud model "as a fallback" — that would break "0 PII Sent".
 *
 * Chrome has shipped two shapes of this API:
 *   - current:  global `LanguageModel` with `availability()` / `create()`
 *   - legacy:   `window.ai.languageModel` with `capabilities()` / `create()`
 * Both are normalised here so the rest of the app doesn't care.
 */

import { chunkText, PII_TYPES, redactText } from '../utils/redaction.js'
import { cleanJSON } from '../utils/itemExtraction.js'

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

/** @returns {Promise<{ status: NanoStatus, api: string | null }>} */
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

export const canRunNano = (status) => ['available', 'downloadable', 'downloading'].includes(status)

/**
 * Create a local model session. If the model still needs downloading, this
 * starts the download — Chrome requires that to happen inside a user gesture.
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

/**
 * Prompt for JSON. Uses the Prompt API's JSON Schema constraint when the
 * browser supports it, and the cleanser either way (spec risk mitigation).
 */
async function promptJSON(session, input, schema, signal) {
  const constrained = getApi()?.kind === 'LanguageModel'
  const raw = await session.prompt(input, { signal, ...(constrained && { responseConstraint: schema }) })
  return cleanJSON(raw)
}

/**
 * Run `fn` once per chunk on a fresh copy of `base`, so earlier chunks don't
 * eat the context window of later ones.
 */
async function forEachChunk(base, text, fn) {
  const results = []
  for (const chunk of chunkText(text)) {
    const session = typeof base.clone === 'function' ? await base.clone() : base
    try {
      results.push(await fn(session, chunk))
    } finally {
      if (session !== base) session.destroy()
    }
  }
  return results
}

const PII_SYSTEM_PROMPT = [
  'You find personal data in government procurement documents so it can be hidden.',
  'List every span that identifies or contacts a private person: person names (officials, signatories, staff, supplier contacts),',
  'employee or staff ID numbers, email addresses, phone numbers, personal addresses and bank account numbers.',
  'Do NOT list company names, agency names, product names, prices, quantities, dates or contract numbers.',
  'Copy each span exactly as written in the document.',
].join(' ')

const PII_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, type: { type: 'string', enum: PII_TYPES } },
        required: ['text', 'type'],
      },
    },
  },
  required: ['entities'],
}

/**
 * Ask Gemini Nano which spans are personal data. Returns entities only;
 * replacement happens in code (see utils/redaction.js).
 *
 * @returns {Promise<{ text: string, type: string }[]>}
 */
export async function detectPIIWithNano(text, { onDownloadProgress, signal } = {}) {
  const base = await createNanoSession({ systemPrompt: PII_SYSTEM_PROMPT, onDownloadProgress, signal })
  try {
    const perChunk = await forEachChunk(base, text, (session, chunk) =>
      promptJSON(
        session,
        `Document:\n"""\n${chunk}\n"""\nReturn JSON only: {"entities":[{"text":"...","type":"${PII_TYPES.join('|')}"}]}`,
        PII_SCHEMA,
        signal,
      ),
    )
    return perChunk.flatMap((res) => (Array.isArray(res?.entities) ? res.entities : []))
  } finally {
    base.destroy()
  }
}

const EXTRACT_SYSTEM_PROMPT = [
  'You convert procurement contracts into JSON line items.',
  'For every purchased item return itemName (short product name), specs (technical details, may be empty),',
  'quantity (number of units) and unitPrice (price of ONE unit in USD, as a number).',
  'If only a line total is given, divide it by the quantity. Skip subtotals, taxes, shipping and grand totals.',
  'Also return projectTitle: a short title for the procurement.',
  'Text like [REDACTED_NAME] is hidden personal data. Never copy it into any field.',
].join(' ')

const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    projectTitle: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemName: { type: 'string' },
          specs: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
        },
        required: ['itemName', 'specs', 'quantity', 'unitPrice'],
      },
    },
  },
  required: ['projectTitle', 'items'],
}

/**
 * Extract structured line items from REDACTED text.
 * @returns {Promise<{ projectTitle: string, items: object[] }>}
 */
export async function extractItemsWithNano(redactedText, { signal } = {}) {
  const base = await createNanoSession({ systemPrompt: EXTRACT_SYSTEM_PROMPT, signal })
  try {
    const perChunk = await forEachChunk(base, redactedText, (session, chunk) =>
      promptJSON(session, `Contract:\n"""\n${chunk}\n"""\nReturn JSON only.`, ITEMS_SCHEMA, signal),
    )
    return {
      projectTitle: perChunk.find((r) => r?.projectTitle)?.projectTitle ?? '',
      items: perChunk.flatMap((r) => (Array.isArray(r?.items) ? r.items : [])),
    }
  } finally {
    base.destroy()
  }
}

export const SMOKE_TEST_INPUT =
  'Contract approved by John Miller (Employee ID: EMP-48213), contact j.miller@district.gov ' +
  'or +1 (555) 013-2244. Item: Student Laptop 14-inch, qty 500, unit price $1,250.00.'

/**
 * Dev check (T02): one tiny on-device redaction, timed.
 * Run `await ghostline.testNano()` in the dev console.
 */
export async function runLocalSmokeTest({ input = SMOKE_TEST_INPUT, onDownloadProgress } = {}) {
  const { status } = await getNanoAvailability()
  const t0 = performance.now()

  if (!canRunNano(status)) {
    return { output: redactText(input).redactedText, ms: performance.now() - t0, simulated: true }
  }

  const entities = await detectPIIWithNano(input, { onDownloadProgress })
  return { output: redactText(input, entities).redactedText, entities, ms: performance.now() - t0, simulated: false }
}
