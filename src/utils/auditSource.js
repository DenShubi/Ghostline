const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Why Cloud Gemini didn't produce the match, from runCloudAudit's
 * `fallbackReason` ('timeout' or the error message).
 * @returns {'quota'|'timeout'|'busy'|'error'}
 */
export function cloudFallbackKind(reason) {
  const text = String(reason ?? '')
  if (text === 'timeout') return 'timeout'
  if (/\[429\b|quota/i.test(text)) return 'quota'
  if (/\[5\d\d\b|high demand|unavailable/i.test(text)) return 'busy'
  return 'error'
}

const FALLBACK_LEAD = {
  quota: 'Cloud Gemini’s free daily limit is used up, so Ghostline matched',
  timeout: 'Cloud Gemini took too long, so Ghostline matched',
  busy: 'Cloud Gemini is busy right now, so Ghostline matched',
  error: 'Cloud Gemini didn’t respond, so Ghostline matched',
}

/**
 * One honest sentence about where the prices were checked.
 * @param {object} report result of runPriceAudit
 * @param {number} bundledCount size of the built-in benchmark list
 */
export function describeAuditSource(report, bundledCount) {
  const items = plural(report.items.length, 'line item')
  if (report.mode === 'local') {
    return `Checked ${items} on this device against Ghostline’s built-in list of ${bundledCount} market prices. The cloud check isn’t connected on this site yet.`
  }
  const against =
    report.benchmarkSource === 'firestore'
      ? 'market benchmarks in Firestore'
      : 'the built-in market price list, because Firestore was unreachable'
  const who =
    report.engine === 'cloud-gemini' ? 'Cloud Gemini matched' : FALLBACK_LEAD[cloudFallbackKind(report.fallbackReason)]
  return `${who} ${items} against ${against}. No personal details were sent.`
}
