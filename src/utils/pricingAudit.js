/**
 * Pure, deterministic procurement pricing audit math, benchmark matching,
 * and payload privacy validation.
 *
 * FINANCIAL INTEGRITY RULE: Markup percentages, line totals, risk levels,
 * and total estimated leakage are always computed in code from verified
 * numbers — never trusted directly from LLM arithmetic.
 */

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i
const PHONE_PATTERN = /(?:\+\d{1,3}[\s-]?)?\(?\d{3,4}\)?[\s-]\d{3}[\s-]\d{4}\b/

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'per', 'standard', 'the', 'to', 'with',
])

export const WARNING_MARKUP_PCT = 25
export const CRITICAL_MARKUP_PCT = 60

/** Round a numeric value to 2 decimal places. */
export function roundMoney(value) {
  return Math.round(value * 100) / 100
}

/** Round a percentage to 1 decimal place. */
export function roundPercent(value) {
  return Math.round(value * 10) / 10
}

/**
 * Validate and strip an anonymous handoff payload before it crosses to the cloud.
 * Throws if the payload is malformed or appears to contain unredacted PII.
 *
 * @param {object} payload
 * @returns {{ projectTitle: string, currency: string, items: Array<{ itemName: string, specs: string, quantity: number, unitPrice: number }> }}
 */
export function sanitizeCloudPayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new Error('Cloud audit requires an anonymised payload object with an items array.')
  }

  const projectTitle = String(payload.projectTitle ?? '').trim() || 'Untitled procurement'
  const currency = String(payload.currency ?? 'USD').trim().toUpperCase() || 'USD'

  const checkForPII = (value, field) => {
    if (EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value)) {
      throw new Error(`Privacy guard blocked cloud upload: possible unredacted contact info in ${field}.`)
    }
  }

  checkForPII(projectTitle, 'projectTitle')

  const items = payload.items.map((item, idx) => {
    const itemName = String(item?.itemName ?? '').trim()
    const specs = String(item?.specs ?? '').trim()
    const quantity = Number(item?.quantity)
    const unitPrice = Number(item?.unitPrice)

    if (!itemName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Invalid line item at index ${idx}: itemName, positive quantity, and positive unitPrice are required.`)
    }

    checkForPII(itemName, `items[${idx}].itemName`)
    checkForPII(specs, `items[${idx}].specs`)

    return { itemName, specs, quantity, unitPrice }
  })

  if (items.length === 0) {
    throw new Error('Cloud audit requires at least one valid line item.')
  }

  return { projectTitle, currency, items }
}

/**
 * Tokenize an item name for deterministic local benchmark matching.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

/**
 * Find the best-matching benchmark locally using exact name match or token overlap.
 * Used as a deterministic baseline and as fallback when Cloud Gemini is unavailable.
 *
 * @param {string} itemName
 * @param {Array<object>} benchmarks
 * @returns {object | null}
 */
export function matchBenchmarkLocally(itemName, benchmarks) {
  if (!itemName || !Array.isArray(benchmarks) || benchmarks.length === 0) return null

  const normalizedTarget = itemName.trim().toLowerCase()
  const exact = benchmarks.find((b) => String(b.itemName ?? '').trim().toLowerCase() === normalizedTarget)
  if (exact) return exact

  const targetTokens = new Set(tokenize(itemName))
  if (targetTokens.size === 0) return null

  let best = null
  let bestScore = 0

  for (const benchmark of benchmarks) {
    const benchTokens = new Set(tokenize(benchmark.itemName))
    if (benchTokens.size === 0) continue

    let overlap = 0
    for (const token of targetTokens) {
      if (benchTokens.has(token)) overlap += 1
    }
    if (overlap === 0) continue

    // Dice coefficient favors balanced precision & recall across short item names.
    const score = (2 * overlap) / (targetTokens.size + benchTokens.size)
    if (score > bestScore) {
      bestScore = score
      best = benchmark
    }
  }

  return bestScore >= 0.45 ? best : null
}

/**
 * Classify line-item price risk and compute deterministic markup & leakage.
 *
 * @param {{ itemName: string, specs: string, quantity: number, unitPrice: number }} item
 * @param {object | null} benchmark - Matched Firestore benchmark or Cloud Gemini estimate
 * @param {string} [aiReason] - Optional forensic explanation from Cloud Gemini
 */
export function evaluateLineItem(item, benchmark, aiReason = '') {
  const lineTotal = roundMoney(item.unitPrice * item.quantity)

  if (
    !benchmark ||
    !Number.isFinite(benchmark.fairPriceAvg) ||
    benchmark.fairPriceAvg <= 0
  ) {
    return {
      itemName: item.itemName,
      specs: item.specs,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal,
      benchmarkId: null,
      matchedBenchmarkName: null,
      category: null,
      fairPriceMin: null,
      fairPriceMax: null,
      fairPriceAvg: null,
      sourceNote: null,
      markupPercent: null,
      estimatedLeakage: 0,
      riskLevel: 'unmatched',
      reason: aiReason || 'No matching market price benchmark found for this item.',
    }
  }

  const fairMin = Number(benchmark.fairPriceMin ?? benchmark.fairPriceAvg)
  const fairMax = Number(benchmark.fairPriceMax ?? benchmark.fairPriceAvg)
  const fairAvg = Number(benchmark.fairPriceAvg)

  const markupPercent = roundPercent(((item.unitPrice - fairAvg) / fairAvg) * 100)

  let riskLevel = 'normal'
  if (item.unitPrice > fairMax) {
    if (markupPercent >= CRITICAL_MARKUP_PCT) {
      riskLevel = 'critical'
    } else if (markupPercent >= WARNING_MARKUP_PCT || item.unitPrice > fairMax) {
      riskLevel = 'warning'
    }
  }

  const estimatedLeakage =
    riskLevel === 'critical' || riskLevel === 'warning'
      ? roundMoney(Math.max(0, (item.unitPrice - fairAvg) * item.quantity))
      : 0

  const defaultReason =
    riskLevel === 'critical'
      ? `Severe overpricing: +${markupPercent}% above the $${fairAvg} fair market average (fair range $${fairMin}–$${fairMax}).`
      : riskLevel === 'warning'
        ? `Elevated pricing: +${markupPercent}% above the $${fairAvg} fair market average (exceeds $${fairMax} upper bound).`
        : `Within fair market range ($${fairMin}–$${fairMax} per ${benchmark.unit || 'unit'}).`

  return {
    itemName: item.itemName,
    specs: item.specs,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal,
    benchmarkId: benchmark.id ?? null,
    matchedBenchmarkName: benchmark.itemName ?? null,
    category: benchmark.category ?? null,
    fairPriceMin: fairMin,
    fairPriceMax: fairMax,
    fairPriceAvg: fairAvg,
    sourceNote: benchmark.sourceNote ?? null,
    markupPercent,
    estimatedLeakage,
    riskLevel,
    reason: aiReason || defaultReason,
  }
}

/**
 * Aggregate line-item evaluations into contract-level totals and risk tier.
 *
 * @param {Array<ReturnType<typeof evaluateLineItem>>} auditedItems
 */
export function summarizeAuditItems(auditedItems) {
  let totalContractValue = 0
  let totalFairValue = 0
  let totalEstimatedLeakage = 0
  let criticalCount = 0
  let warningCount = 0
  let normalCount = 0
  let unmatchedCount = 0

  for (const item of auditedItems) {
    totalContractValue += item.lineTotal
    totalFairValue += item.fairPriceAvg != null ? item.fairPriceAvg * item.quantity : item.lineTotal
    totalEstimatedLeakage += item.estimatedLeakage

    if (item.riskLevel === 'critical') criticalCount += 1
    else if (item.riskLevel === 'warning') warningCount += 1
    else if (item.riskLevel === 'normal') normalCount += 1
    else unmatchedCount += 1
  }

  const flaggedCount = criticalCount + warningCount

  let overallRiskLevel = 'low'
  if (criticalCount > 0) overallRiskLevel = 'critical'
  else if (warningCount >= 2 || (warningCount > 0 && totalEstimatedLeakage >= 10000)) overallRiskLevel = 'high'
  else if (warningCount > 0) overallRiskLevel = 'medium'

  return {
    totalContractValue: roundMoney(totalContractValue),
    totalFairValue: roundMoney(totalFairValue),
    totalEstimatedLeakage: roundMoney(totalEstimatedLeakage),
    flaggedCount,
    criticalCount,
    warningCount,
    normalCount,
    unmatchedCount,
    overallRiskLevel,
  }
}

/**
 * Build a deterministic executive summary and action items when Cloud Gemini
 * is unavailable or returns empty prose.
 */
export function buildFallbackBrief(projectTitle, auditedItems, summary) {
  if (summary.flaggedCount === 0) {
    return {
      executiveSummary: `${projectTitle} shows no significant price anomalies across ${auditedItems.length} audited line item(s). All matched items fall within expected USD public procurement market ranges.`,
      recommendations: [
        'Archive this benchmark check alongside standard procurement documentation.',
        'Verify delivery quantities and hardware/product specifications upon receipt.',
      ],
    }
  }

  const topFlagged = auditedItems
    .filter((i) => i.riskLevel === 'critical' || i.riskLevel === 'warning')
    .sort((a, b) => b.estimatedLeakage - a.estimatedLeakage)
    .slice(0, 2)
    .map((i) => `${i.itemName} (+${i.markupPercent}%)`)
    .join(' and ')

  return {
    executiveSummary: `${projectTitle} flagged ${summary.flaggedCount} overpriced line item(s) (${topFlagged}), representing an estimated $${summary.totalEstimatedLeakage.toLocaleString('en-US')} in potential budget leakage out of $${summary.totalContractValue.toLocaleString('en-US')} total contract value.`,
    recommendations: [
      'Request itemized vendor cost breakdowns and competing quotes for all flagged line items before disbursement.',
      'Cross-check contracted specifications against US GSA / public procurement catalog baselines.',
      'Escalate critical markup items (+60% or higher) to the inspector general or independent procurement review board.',
    ],
  }
}
