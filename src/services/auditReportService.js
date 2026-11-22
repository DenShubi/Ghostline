/**
 * Firestore persistence & share-link service for anonymised Public Audit Briefs.
 *
 * PRIVACY CONTRACT: Only the anonymised CloudAuditReport (never raw contract
 * text or PII) is persisted to the `audit_reports` collection.
 */

export const AUDIT_REPORTS_COLLECTION = 'audit_reports'

/**
 * Pick only the safe, anonymised audit report fields for Firestore storage.
 *
 * @param {object} report
 */
export function prepareReportForStorage(report) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.items) || !report.summary) {
    throw new Error('Cannot save an incomplete audit report.')
  }

  return {
    projectTitle: String(report.projectTitle ?? 'Untitled procurement').trim(),
    currency: String(report.currency ?? 'USD').trim().toUpperCase(),
    engine: report.engine === 'cloud-gemini' ? 'cloud-gemini' : 'benchmark-fallback',
    modelName: report.modelName ? String(report.modelName) : null,
    items: report.items.map((item) => ({
      itemName: String(item.itemName ?? ''),
      specs: String(item.specs ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      lineTotal: Number(item.lineTotal ?? 0),
      benchmarkId: item.benchmarkId ?? null,
      matchedBenchmarkName: item.matchedBenchmarkName ?? null,
      category: item.category ?? null,
      fairPriceMin: item.fairPriceMin ?? null,
      fairPriceMax: item.fairPriceMax ?? null,
      fairPriceAvg: item.fairPriceAvg ?? null,
      sourceNote: item.sourceNote ?? null,
      markupPercent: item.markupPercent ?? null,
      estimatedLeakage: Number(item.estimatedLeakage ?? 0),
      riskLevel: String(item.riskLevel ?? 'unmatched'),
      reason: String(item.reason ?? ''),
    })),
    summary: {
      totalContractValue: Number(report.summary.totalContractValue ?? 0),
      totalFairValue: Number(report.summary.totalFairValue ?? 0),
      totalEstimatedLeakage: Number(report.summary.totalEstimatedLeakage ?? 0),
      flaggedCount: Number(report.summary.flaggedCount ?? 0),
      criticalCount: Number(report.summary.criticalCount ?? 0),
      warningCount: Number(report.summary.warningCount ?? 0),
      normalCount: Number(report.summary.normalCount ?? 0),
      unmatchedCount: Number(report.summary.unmatchedCount ?? 0),
      overallRiskLevel: String(report.summary.overallRiskLevel ?? 'low'),
    },
    executiveSummary: String(report.executiveSummary ?? ''),
    recommendations: Array.isArray(report.recommendations)
      ? report.recommendations.map((r) => String(r))
      : [],
    auditedAt: String(report.auditedAt ?? new Date().toISOString()),
  }
}

/**
 * Build a shareable URL for a saved Public Audit Brief.
 *
 * @param {string} reportId
 * @param {string} [origin]
 */
export function buildReportShareUrl(reportId, origin) {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/?report=${encodeURIComponent(reportId)}`
}

async function defaultCreateDoc(payload) {
  const [{ addDoc, collection, serverTimestamp }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase.js'),
  ])

  const docRef = await addDoc(collection(db, AUDIT_REPORTS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

async function defaultFetchDoc(reportId) {
  const [{ doc, getDoc }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase.js'),
  ])

  const snap = await getDoc(doc(db, AUDIT_REPORTS_COLLECTION, reportId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * Publish an anonymised audit report to Firestore `audit_reports`.
 *
 * @param {object} report - Output from `runCloudAudit()`
 * @param {object} [opts]
 * @param {string} [opts.origin] - Optional origin override for share URL
 * @param {(payload: object) => Promise<string>} [opts.createDoc] - Injectable writer for tests
 * @returns {Promise<{ id: string, shareUrl: string }>}
 */
export async function saveAuditReport(
  report,
  { origin, createDoc = defaultCreateDoc } = {},
) {
  const safePayload = prepareReportForStorage(report)
  const id = await createDoc(safePayload)
  return {
    id,
    shareUrl: buildReportShareUrl(id, origin),
  }
}

/**
 * Fetch a published Public Audit Brief from Firestore by document ID.
 *
 * @param {string} reportId
 * @param {object} [opts]
 * @param {(id: string) => Promise<object | null>} [opts.fetchDoc] - Injectable reader for tests
 * @returns {Promise<object | null>}
 */
export async function getAuditReportById(
  reportId,
  { fetchDoc = defaultFetchDoc } = {},
) {
  const trimmed = String(reportId ?? '').trim()
  if (!trimmed) return null
  return fetchDoc(trimmed)
}
