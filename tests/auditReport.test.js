import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportShareUrl,
  getAuditReportById,
  prepareReportForStorage,
  saveAuditReport,
} from '../src/services/auditReportService.js'

const SAMPLE_REPORT = {
  projectTitle: 'Public School IT Infrastructure Procurement',
  currency: 'USD',
  engine: 'cloud-gemini',
  modelName: 'gemini-2.5-flash',
  fallbackReason: null,
  rawContractLeak: 'MUST NOT BE SAVED',
  items: [
    {
      itemName: 'Standard Student Laptop 14-inch',
      specs: 'i3, 8GB, 256GB',
      quantity: 500,
      unitPrice: 1210,
      lineTotal: 605000,
      benchmarkId: 'it-hardware__standard-student-laptop-14-inch',
      matchedBenchmarkName: 'Standard Student Laptop 14-inch',
      category: 'IT Hardware',
      fairPriceMin: 450,
      fairPriceMax: 600,
      fairPriceAvg: 525,
      sourceNote: 'US GSA / Public Market Avg 2026',
      markupPercent: 130.5,
      estimatedLeakage: 342500,
      riskLevel: 'critical',
      reason: 'Severe overpricing compared to GSA catalog baseline.',
      unexpectedField: 'strip me',
    },
  ],
  summary: {
    totalContractValue: 605000,
    totalFairValue: 262500,
    totalEstimatedLeakage: 342500,
    flaggedCount: 1,
    criticalCount: 1,
    warningCount: 0,
    normalCount: 0,
    unmatchedCount: 0,
    overallRiskLevel: 'critical',
  },
  executiveSummary: 'Severe markup detected on student laptops.',
  recommendations: ['Request competing bids.'],
  auditedAt: '2026-11-22T15:00:00.000Z',
}

test('prepareReportForStorage strips unknown properties and preserves audit fields', () => {
  const safe = prepareReportForStorage(SAMPLE_REPORT)
  assert.equal('rawContractLeak' in safe, false)
  assert.equal('unexpectedField' in safe.items[0], false)
  assert.equal(safe.projectTitle, SAMPLE_REPORT.projectTitle)
  assert.equal(safe.summary.totalEstimatedLeakage, 342500)
  assert.equal(safe.items[0].markupPercent, 130.5)
})

test('saveAuditReport persists sanitized report and returns shareable URL', async () => {
  let stored = null
  const result = await saveAuditReport(SAMPLE_REPORT, {
    origin: 'https://auditzero-ghostline-2026.web.app',
    createDoc: async (payload) => {
      stored = payload
      return 'rep_abc123'
    },
  })

  assert.equal(result.id, 'rep_abc123')
  assert.equal(result.shareUrl, 'https://auditzero-ghostline-2026.web.app/?report=rep_abc123')
  assert.equal('rawContractLeak' in stored, false)
})

test('getAuditReportById returns document or null when missing', async () => {
  const found = await getAuditReportById('rep_abc123', {
    fetchDoc: async (id) => ({ id, projectTitle: 'School IT' }),
  })
  assert.deepEqual(found, { id: 'rep_abc123', projectTitle: 'School IT' })

  assert.equal(await getAuditReportById('   ', { fetchDoc: async () => ({}) }), null)
  assert.equal(buildReportShareUrl('abc 123', 'https://example.com'), 'https://example.com/?report=abc%20123')
})
