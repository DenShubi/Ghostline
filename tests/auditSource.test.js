import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cloudFallbackKind, describeAuditSource } from '../src/utils/auditSource.js'

// Error texts as Firebase AI Logic returned them for this project.
const QUOTA = 'AI: Error fetching from …/gemini-3.8-flash:generateContent: [429 ] You exceeded your current quota … Generate content requests per day limit exceeded on Free Tier.'
const BUSY = 'AI: Error fetching from …/gemini-3.8-flash:generateContent: [500 ] This model is currently experiencing high demand.'
const AUTH = 'AI: Error fetching from …: [401 ] Firebase App Check token is invalid.'

test('classifies why Cloud Gemini fell back', () => {
  assert.equal(cloudFallbackKind(QUOTA), 'quota')
  assert.equal(cloudFallbackKind(BUSY), 'busy')
  assert.equal(cloudFallbackKind('timeout'), 'timeout')
  assert.equal(cloudFallbackKind(AUTH), 'error')
  assert.equal(cloudFallbackKind(null), 'error')
})

const report = (extra) => ({ items: [{}, {}, {}], mode: 'cloud', benchmarkSource: 'firestore', ...extra })

test('names the free daily limit instead of "didn’t respond"', () => {
  assert.equal(
    describeAuditSource(report({ engine: 'benchmark-fallback', fallbackReason: QUOTA }), 40),
    'Cloud Gemini’s free daily limit is used up, so Ghostline matched 3 line items against market benchmarks in Firestore. No personal details were sent.',
  )
  assert.match(describeAuditSource(report({ engine: 'benchmark-fallback', fallbackReason: BUSY }), 40), /^Cloud Gemini is busy right now/)
  assert.match(describeAuditSource(report({ engine: 'benchmark-fallback', fallbackReason: AUTH }), 40), /^Cloud Gemini didn’t respond/)
})

test('success, bundled benchmarks and on-device mode keep their wording', () => {
  assert.match(describeAuditSource(report({ engine: 'cloud-gemini' }), 40), /^Cloud Gemini matched 3 line items against market benchmarks in Firestore\./)
  assert.match(
    describeAuditSource(report({ engine: 'cloud-gemini', benchmarkSource: 'bundled' }), 40),
    /built-in market price list, because Firestore was unreachable/,
  )
  assert.match(describeAuditSource(report({ mode: 'local' }), 40), /^Checked 3 line items on this device against Ghostline’s built-in list of 40 market prices\./)
})
