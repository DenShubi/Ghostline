import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  evaluateLineItem,
  matchBenchmarkLocally,
  sanitizeCloudPayload,
  summarizeAuditItems,
} from '../src/utils/pricingAudit.js'
import { runCloudAudit } from '../src/services/cloudAuditService.js'
import { extractItemsHeuristic } from '../src/utils/itemExtraction.js'
import { redactText } from '../src/utils/redaction.js'
import { SAMPLE_CONTRACTS } from '../src/data/sampleContracts.js'

const seedBenchmarks = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/seedBenchmarks.json', import.meta.url)), 'utf-8'),
).map((b) => ({
  id: `${b.category}__${b.itemName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  ...b,
}))

test('sanitizeCloudPayload strips extra properties and rejects unredacted PII', () => {
  const clean = sanitizeCloudPayload({
    projectTitle: 'School IT Procurement',
    currency: 'usd',
    rawText: 'SHOULD BE STRIPPED',
    items: [
      { itemName: '24-inch Monitor', specs: '1080p', quantity: 10, unitPrice: 200, vendorEmail: 'leak@evil.com' },
    ],
  })

  assert.equal(clean.currency, 'USD')
  assert.equal('rawText' in clean, false)
  assert.equal('vendorEmail' in clean.items[0], false)

  assert.throws(
    () =>
      sanitizeCloudPayload({
        projectTitle: 'Contact t.reyes@district-edu.gov',
        currency: 'USD',
        items: [{ itemName: 'Laptop', specs: '', quantity: 1, unitPrice: 500 }],
      }),
    /Privacy guard/,
  )

  assert.throws(
    () =>
      sanitizeCloudPayload({
        projectTitle: 'Office Supplies',
        currency: 'USD',
        items: [{ itemName: 'Chair', specs: 'Call +1 (555) 013-2244', quantity: 1, unitPrice: 300 }],
      }),
    /Privacy guard/,
  )
})

test('local matching + deterministic evaluation matches SAMPLE_CONTRACTS[0] markups accurately', () => {
  const { redactedText } = redactText(SAMPLE_CONTRACTS[0].text)
  const extracted = extractItemsHeuristic(redactedText)
  const evaluated = extracted.items.map((item) =>
    evaluateLineItem(item, matchBenchmarkLocally(item.itemName, seedBenchmarks)),
  )

  // 1. Laptop: $1,210 vs $525 avg (+130.5%) -> critical, leakage = (1210 - 525) * 500 = $342,500
  assert.equal(evaluated[0].riskLevel, 'critical')
  assert.equal(evaluated[0].markupPercent, 130.5)
  assert.equal(evaluated[0].estimatedLeakage, 342500)

  // 2. Monitor: $232 vs $160 avg (+45%) -> warning, leakage = (232 - 160) * 120 = $8,640
  assert.equal(evaluated[1].riskLevel, 'warning')
  assert.equal(evaluated[1].markupPercent, 45)
  assert.equal(evaluated[1].estimatedLeakage, 8640)

  // 3-5. Wi-Fi AP ($185), UPS ($215), Laser Printer ($290) -> all normal, $0 leakage
  assert.equal(evaluated[2].riskLevel, 'normal')
  assert.equal(evaluated[2].estimatedLeakage, 0)
  assert.equal(evaluated[3].riskLevel, 'normal')
  assert.equal(evaluated[3].estimatedLeakage, 0)
  assert.equal(evaluated[4].riskLevel, 'normal')
  assert.equal(evaluated[4].estimatedLeakage, 0)

  const summary = summarizeAuditItems(evaluated)
  // 500*1210 + 120*232 + 40*185 + 20*215 + 12*290 = 648,020
  assert.equal(summary.totalContractValue, 648020)
  assert.equal(summary.totalEstimatedLeakage, 351140)
  assert.equal(summary.flaggedCount, 2)
  assert.equal(summary.criticalCount, 1)
  assert.equal(summary.warningCount, 1)
  assert.equal(summary.normalCount, 3)
  assert.equal(summary.overallRiskLevel, 'critical')
})

test('runCloudAudit uses Cloud Gemini semantic matching and computes exact code-verified leakage', async () => {
  const laptopBenchmark = seedBenchmarks.find((b) => b.itemName === 'Standard Student Laptop 14-inch')
  const payload = {
    projectTitle: 'District Laptop Refresh',
    currency: 'USD',
    items: [
      { itemName: 'EduBook 14 Portable Computer', specs: 'i3, 8GB, 256GB', quantity: 100, unitPrice: 1155 },
      { itemName: 'Custom Acoustic Ceiling Baffle', specs: 'Studio grade', quantity: 10, unitPrice: 400 },
    ],
  }

  let capturedPrompt = ''
  const report = await runCloudAudit(payload, {
    loadBenchmarks: async () => seedBenchmarks,
    generateAudit: async (prompt) => {
      capturedPrompt = prompt
      return JSON.stringify({
        matches: [
          {
            index: 0,
            benchmarkId: laptopBenchmark.id,
            reason: 'Unit price is more than double the GSA average for 14-inch student laptops.',
          },
          {
            index: 1,
            benchmarkId: null,
            estimatedFairPriceMin: 180,
            estimatedFairPriceMax: 260,
            estimatedFairPriceAvg: 220,
            reason: 'Exceeds typical institutional acoustic panel pricing.',
          },
        ],
        executiveSummary: 'Two items show significant price inflation requiring procurement review.',
        recommendations: ['Request competing bids for laptops.', 'Verify acoustic baffle specifications.'],
      })
    },
  })

  assert.ok(capturedPrompt.includes('EduBook 14 Portable Computer'))
  assert.equal(report.engine, 'cloud-gemini')
  assert.equal(report.fallbackReason, null)
  assert.equal(report.items[0].benchmarkId, laptopBenchmark.id)
  assert.equal(report.items[0].riskLevel, 'critical')
  assert.equal(report.items[0].markupPercent, 120)
  assert.equal(report.items[0].estimatedLeakage, 63000)

  // Item 1 used Cloud Gemini's market estimate ($400 vs $220 avg = +81.8% -> critical)
  assert.equal(report.items[1].benchmarkId, null)
  assert.equal(report.items[1].category, 'AI Market Estimate')
  assert.equal(report.items[1].riskLevel, 'critical')
  assert.equal(report.items[1].estimatedLeakage, 1800)

  assert.equal(report.summary.totalEstimatedLeakage, 64800)
  assert.equal(report.summary.overallRiskLevel, 'critical')
  assert.equal(report.executiveSummary, 'Two items show significant price inflation requiring procurement review.')
})

test('runCloudAudit falls back cleanly to local benchmark matching when Cloud Gemini fails', async () => {
  const payload = {
    projectTitle: 'Clinic Emergency Supply Order',
    currency: 'USD',
    items: [
      { itemName: 'Infrared Thermometer', specs: 'Non-contact', quantity: 200, unitPrice: 74 },
      { itemName: 'Surgical Masks (Box of 50)', specs: '3-ply', quantity: 1000, unitPrice: 12 },
    ],
  }

  const report = await runCloudAudit(payload, {
    loadBenchmarks: async () => seedBenchmarks,
    generateAudit: async () => {
      throw new Error('Firebase AI Logic API not enabled')
    },
  })

  assert.equal(report.engine, 'benchmark-fallback')
  assert.match(report.fallbackReason, /not enabled/)
  // Thermometer: $74 vs $35 avg = +111.4% -> critical, leakage = (74 - 35) * 200 = $7,800
  assert.equal(report.items[0].riskLevel, 'critical')
  assert.equal(report.items[0].markupPercent, 111.4)
  assert.equal(report.items[0].estimatedLeakage, 7800)
  // Masks: $12 vs $12 avg = 0% -> normal, $0 leakage
  assert.equal(report.items[1].riskLevel, 'normal')
  assert.equal(report.items[1].estimatedLeakage, 0)
  assert.equal(report.summary.totalEstimatedLeakage, 7800)
  assert.ok(report.executiveSummary.includes('$7,800'))
})

test('runCloudAudit times out a hanging Cloud Gemini call instead of stalling forever', async () => {
  const payload = {
    projectTitle: 'Office Refresh',
    currency: 'USD',
    items: [{ itemName: 'Ergonomic Office Chair', specs: 'Mesh', quantity: 20, unitPrice: 500 }],
  }

  const report = await runCloudAudit(payload, {
    timeoutMs: 40,
    loadBenchmarks: async () => seedBenchmarks,
    generateAudit: () => new Promise(() => {}),
  })

  assert.equal(report.engine, 'benchmark-fallback')
  assert.equal(report.fallbackReason, 'timeout')
  assert.equal(report.items[0].riskLevel, 'critical')
  assert.equal(report.items[0].estimatedLeakage, 4200)
})

test('all 3 pre-loaded sample contracts redact PII, extract 5 items, and audit accurately', () => {
  assert.equal(SAMPLE_CONTRACTS.length, 3)

  const expectedTotals = [648020, 129240, 144355]
  const expectedLeakages = [351140, 52800, 0]
  const expectedRisk = ['critical', 'critical', 'low'] // sample 3 is the fair-price control

  SAMPLE_CONTRACTS.forEach((sample, idx) => {
    const { redactedText, counts } = redactText(sample.text)
    const totalHidden = Object.values(counts).reduce((a, b) => a + b, 0)
    assert.ok(totalHidden >= 4, `${sample.id} should contain redactable PII`)

    const extracted = extractItemsHeuristic(redactedText)
    assert.equal(extracted.items.length, 5, `${sample.id} should extract 5 line items`)

    const evaluated = extracted.items.map((item) =>
      evaluateLineItem(item, matchBenchmarkLocally(item.itemName, seedBenchmarks)),
    )
    const summary = summarizeAuditItems(evaluated)
    assert.equal(summary.totalContractValue, expectedTotals[idx], `${sample.id} total mismatch`)
    assert.equal(summary.totalEstimatedLeakage, expectedLeakages[idx], `${sample.id} leakage mismatch`)
    assert.equal(summary.overallRiskLevel, expectedRisk[idx], `${sample.id} overall risk mismatch`)
  })
})
