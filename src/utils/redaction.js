/**
 * Pure redaction helpers. No network, no DOM. Runs in the browser and in Node tests.
 *
 * Redaction works on character ranges: detectors (Gemini Nano + the regex
 * safety net below) report spans, spans are merged, and the text is rebuilt
 * with [REDACTED_<TYPE>] tokens. The model never rewrites the document, so
 * prices and quantities cannot be altered by redaction.
 */

export const PII_TYPES = ['NAME', 'ID', 'EMAIL', 'PHONE', 'ADDRESS', 'ACCOUNT']

// Names stay on one line, are capitalised, and never start with a title.
const HONORIFIC = String.raw`(?:Mr|Ms|Mrs|Dr|Prof)\.?[ \t]`
const PROPER_NAME = String.raw`(?!(?:Mr|Ms|Mrs|Dr|Prof)\b)[A-Z][a-z]+(?:[ \t](?:[A-Z]\.[ \t]?)?[A-Z][a-z]+)*`

/** Regex safety net. Catches structured PII even if the model misses it. */
const PATTERNS = [
  { type: 'EMAIL', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { type: 'ID', re: /\b(?:EMP|NIP|NIK|STF)[-#]?\d{4,}\b/gi },
  {
    type: 'ID',
    re: /(?<=\b(?:NIP|NIK|Employee ID|Employee No\.?|Staff ID|Badge No\.?|ID No\.?)[\s:#]+)[A-Z0-9][A-Z0-9-]{4,}\b/gi,
  },
  {
    type: 'ACCOUNT',
    re: /(?<=\b(?:Account|Acct|IBAN)(?:\sNo\.?|\sNumber)?[\s:#]+)[A-Z0-9][A-Z0-9 -]{6,}[A-Z0-9]/gi,
  },
  { type: 'PHONE', re: /(?<![\w.-])(?:\+\d{1,3}[\s-]?)?\(?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}(?![\w.])/g },
  { type: 'NAME', re: new RegExp(`(?<=\\b${HONORIFIC})${PROPER_NAME}`, 'g') },
  {
    type: 'NAME',
    re: new RegExp(
      String.raw`(?<=\b(?i:approved|signed|prepared|issued|authori[sz]ed|reviewed|submitted|witnessed) (?i:by):?[ \t]+(?:${HONORIFIC})?)${PROPER_NAME}`,
      'g',
    ),
  },
  {
    type: 'NAME',
    re: new RegExp(
      String.raw`(?<=\b(?i:name|contact|contact person|official|officer|signatory|pic|attn)[ \t]*:[ \t]*(?:${HONORIFIC})?)${PROPER_NAME}`,
      'g',
    ),
  },
]

/** @typedef {{ start: number, end: number, type: string }} Range */

/** @returns {Range[]} */
export function detectPatternPII(text) {
  const ranges = []
  for (const { type, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (m[0].trim()) ranges.push({ start: m.index, end: m.index + m[0].length, type })
    }
  }
  return ranges
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Turn model-reported entities into ranges by locating every occurrence.
 * Multi-word names also add their individual words, so "John Miller" also
 * hides a later "Mr. Miller".
 *
 * @param {string} text
 * @param {{ text: string, type: string }[]} entities
 * @returns {Range[]}
 */
export function findEntityRanges(text, entities) {
  const needles = new Map()
  for (const entity of entities ?? []) {
    const value = String(entity?.text ?? '').trim()
    if (value.length < 3) continue
    const type = PII_TYPES.includes(entity.type) ? entity.type : 'NAME'
    needles.set(value, type)
    if (type === 'NAME') {
      for (const word of value.split(/\s+/)) {
        if (/^[A-Z][a-z]{2,}$/.test(word) && !needles.has(word)) needles.set(word, type)
      }
    }
  }

  const ranges = []
  for (const [value, type] of needles) {
    const re = new RegExp(`(?<![\\w@])${escapeRegExp(value)}(?![\\w@])`, 'g')
    for (const m of text.matchAll(re)) ranges.push({ start: m.index, end: m.index + m[0].length, type })
  }
  return ranges
}

/** Merge overlapping ranges, keeping the type of the widest span. */
export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged = []
  for (const r of sorted) {
    const last = merged.at(-1)
    if (last && r.start < last.end) {
      if (r.end - r.start > last.end - last.start) last.type = r.type
      last.end = Math.max(last.end, r.end)
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

/**
 * @typedef {{ kind: 'text', text: string } | { kind: 'redacted', type: string, length: number }} Segment
 * @returns {{ redactedText: string, segments: Segment[], counts: Record<string, number>, secrets: string[] }}
 */
export function applyRedactions(text, ranges) {
  const segments = []
  const counts = {}
  const secrets = new Set()
  let out = ''
  let cursor = 0

  for (const { start, end, type } of mergeRanges(ranges)) {
    if (start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, start) })
      out += text.slice(cursor, start)
    }
    segments.push({ kind: 'redacted', type, length: end - start })
    out += `[REDACTED_${type}]`
    counts[type] = (counts[type] ?? 0) + 1
    secrets.add(text.slice(start, end))
    cursor = end
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) })
    out += text.slice(cursor)
  }

  return { redactedText: out, segments, counts, secrets: [...secrets] }
}

/** Redact with the regex safety net plus any model-reported entities. */
export function redactText(text, entities = []) {
  return applyRedactions(text, [...detectPatternPII(text), ...findEntityRanges(text, entities)])
}

/**
 * Last gate before anything leaves the device: scrub every string in the
 * payload for known secrets and pattern PII.
 *
 * @template T
 * @param {T} payload
 * @param {string[]} secrets original values that were redacted
 * @returns {{ payload: T, scrubbed: number }}
 */
export function scrubPayload(payload, secrets = []) {
  let scrubbed = 0

  const scrubString = (value) => {
    const ranges = [
      ...detectPatternPII(value),
      ...findEntityRanges(
        value,
        secrets.map((s) => ({ text: s, type: 'ID' })),
      ),
    ]
    if (ranges.length === 0) return value
    const { redactedText, counts } = applyRedactions(value, ranges)
    scrubbed += Object.values(counts).reduce((a, b) => a + b, 0)
    return redactedText
  }

  const walk = (node) => {
    if (typeof node === 'string') return scrubString(node)
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]))
    }
    return node
  }

  return { payload: walk(payload), scrubbed }
}

/** Split long text on line boundaries so each chunk fits the local model's context. */
export function chunkText(text, maxChars = 3500) {
  const chunks = []
  let current = ''
  for (const line of text.split(/(?<=\n)/)) {
    if (current && current.length + line.length > maxChars) {
      chunks.push(current)
      current = ''
    }
    current += line
  }
  if (current) chunks.push(current)
  return chunks
}
