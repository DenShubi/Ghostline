import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BUNDLED_BENCHMARKS, runPriceAudit } from '../src/services/auditHandoff.js'
import { runLocalPipeline } from '../src/services/localPipeline.js'
import { SAMPLE_CONTRACTS } from '../src/data/sampleContracts.js'

const PII = ['Margaret Ellison', 'Ellison', 'Thomas Reyes', 'EMP-48213', '198203142010', 't.reyes@district-edu.gov', '013-2244']

async function samplePayload() {
  const { payload } = await runLocalPipeline(SAMPLE_CONTRACTS[0].text)
  return payload
}

test('bundled benchmarks use the same IDs as the Firestore seed script', () => {
  assert.equal(BUNDLED_BENCHMARKS.length, 40)
  assert.ok(BUNDLED_BENCHMARKS.some((b) => b.id === 'it-hardware__standard-student-laptop-14-inch'))
})

test('end to end: sample contract → local redaction → audit flags the planted markups', async () => {
  const report = await runPriceAudit(await samplePayload(), { configured: false })

  assert.equal(report.mode, 'local')
  assert.equal(report.benchmarkSource, 'bundled')
  const byName = Object.fromEntries(report.items.map((i) => [i.itemName, i]))
  assert.equal(byName['Standard Student Laptop 14-inch'].riskLevel, 'critical')
  assert.equal(byName['Standard Student Laptop 14-inch'].markupPercent, 130.5)
  assert.equal(byName['24-inch Monitor'].riskLevel, 'warning')
  assert.equal(byName['24-inch Monitor'].markupPercent, 45)
  assert.equal(report.summary.flaggedCount, 2)
  // (1210 - 525) * 500 + (232 - 160) * 120
  assert.equal(report.summary.totalEstimatedLeakage, 351_140)
})

test('not configured: Cloud Gemini and Firestore are never called', async () => {
  let called = 0
  await runPriceAudit(await samplePayload(), {
    configured: false,
    loadBenchmarks: async () => { called++; return [] },
    generateAudit: async () => { called++; return '{}' },
  })
  assert.equal(called, 0)
})

test('configured: Cloud Gemini only ever receives the anonymous payload', async () => {
  let prompt = ''
  const report = await runPriceAudit(await samplePayload(), {
    configured: true,
    loadBenchmarks: async () => BUNDLED_BENCHMARKS,
    generateAudit: async (p) => {
      prompt = p
      return JSON.stringify({ matches: [], executiveSummary: 'ok', recommendations: ['r'] })
    },
  })
  assert.equal(report.mode, 'cloud')
  assert.equal(report.engine, 'cloud-gemini')
  assert.ok(prompt.includes('Standard Student Laptop 14-inch'))
  for (const value of PII) assert.ok(!prompt.includes(value), `prompt leaked ${value}`)
})

test('configured but Firestore empty or down: falls back to bundled benchmarks', async () => {
  const payload = await samplePayload()
  for (const loadBenchmarks of [async () => [], async () => { throw new Error('permission-denied') }]) {
    const report = await runPriceAudit(payload, {
      configured: true,
      loadBenchmarks,
      generateAudit: async () => { throw new Error('offline') },
    })
    assert.equal(report.benchmarkSource, 'bundled')
    assert.equal(report.engine, 'benchmark-fallback')
    assert.equal(report.summary.flaggedCount, 2)
  }
})
