import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkText, findEntityRanges, mergeRanges, redactText, scrubPayload } from '../src/utils/redaction.js'
import { IT_CONTRACT } from './fixtures.js'

const PII = ['John Miller', 'EMP-48213', 'Sarah Lee', '198203142010', 'j.miller@district.gov', '(555) 013-2244', 'Miller']

test('regex safety net alone removes structured PII and cue-based names', () => {
  const { redactedText, counts } = redactText(IT_CONTRACT)
  for (const value of PII) assert.ok(!redactedText.includes(value), `leaked: ${value}`)
  assert.ok(counts.EMAIL >= 1 && counts.PHONE >= 1 && counts.ID >= 2 && counts.NAME >= 2)
})

test('redaction never touches prices, quantities or the contract number', () => {
  const { redactedText } = redactText(IT_CONTRACT)
  for (const keep of ['$1,250.00', 'Qty: 500', '$232.00', '40 units @ $180.00', '$660,040.00', 'PO-2026-001234']) {
    assert.ok(redactedText.includes(keep), `lost: ${keep}`)
  }
})

test('cue words are case-insensitive, titles are kept, lowercase words are not names', () => {
  const text = 'Prepared by: Dr. Hannah Okafor\nSupplier contact: Rafael Ortiz, PT Medika\napproved by the committee'
  assert.equal(
    redactText(text).redactedText,
    'Prepared by: Dr. [REDACTED_NAME]\nSupplier contact: [REDACTED_NAME], PT Medika\napproved by the committee',
  )
})

test('model entities add names the regex cannot know about', () => {
  const text = 'Supplier rep Budi Santoso confirmed. Budi will ship Friday.'
  assert.equal(redactText(text).redactedText, text)
  const { redactedText } = redactText(text, [{ text: 'Budi Santoso', type: 'NAME' }])
  assert.equal(redactedText, 'Supplier rep [REDACTED_NAME] confirmed. [REDACTED_NAME] will ship Friday.')
})

test('entity matching respects word boundaries and ignores tiny or junk entities', () => {
  assert.deepEqual(findEntityRanges('Leeds office, Lee signed', [{ text: 'Lee', type: 'NAME' }]), [
    { start: 14, end: 17, type: 'NAME' },
  ])
  assert.deepEqual(findEntityRanges('abc', [{ text: 'a', type: 'NAME' }, null, { text: '' }]), [])
})

test('overlapping ranges merge and keep the widest type', () => {
  assert.deepEqual(
    mergeRanges([
      { start: 5, end: 10, type: 'ID' },
      { start: 0, end: 12, type: 'NAME' },
      { start: 20, end: 25, type: 'EMAIL' },
    ]),
    [
      { start: 0, end: 12, type: 'NAME' },
      { start: 20, end: 25, type: 'EMAIL' },
    ],
  )
})

test('segments preserve the original length of each redacted span', () => {
  const { segments } = redactText('Mail a@b.co now')
  assert.deepEqual(segments, [
    { kind: 'text', text: 'Mail ' },
    { kind: 'redacted', type: 'EMAIL', length: 6 },
    { kind: 'text', text: ' now' },
  ])
})

test('payload scrub catches secrets that slipped into extracted fields', () => {
  const { payload, scrubbed } = scrubPayload(
    { projectTitle: 'Order by John Miller', items: [{ itemName: 'Laptop', specs: 'ask j.miller@district.gov', quantity: 5, unitPrice: 9 }] },
    ['John Miller'],
  )
  assert.equal(scrubbed, 2)
  assert.equal(payload.projectTitle, 'Order by [REDACTED_ID]')
  assert.equal(payload.items[0].specs, 'ask [REDACTED_EMAIL]')
  assert.equal(payload.items[0].quantity, 5)
})

test('chunkText splits on lines under the size limit', () => {
  const chunks = chunkText('aaaa\nbbbb\ncccc\n', 10)
  assert.deepEqual(chunks, ['aaaa\nbbbb\n', 'cccc\n'])
  assert.equal(chunks.join(''), 'aaaa\nbbbb\ncccc\n')
})
