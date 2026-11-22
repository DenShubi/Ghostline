import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTransientError, withRetry } from '../src/utils/retry.js'

const highDemand = new Error('AI: Error fetching from …/gemini-3.8-flash:generateContent: [500 ] This model is currently experiencing high demand.')
const notFound = new Error('AI: Error fetching … [404 ] models/x is not found')

test('retries server overload only, not quota or other 4xx errors', () => {
  assert.equal(isTransientError(highDemand), true)
  assert.equal(isTransientError(new Error('[503 ] Unavailable')), true)
  assert.equal(isTransientError(new Error('[429 ] You exceeded your current quota … per day limit exceeded on Free Tier')), false)
  assert.equal(isTransientError(notFound), false)
  assert.equal(isTransientError(new Error('[401 ] Firebase App Check token is invalid.')), false)
  assert.equal(isTransientError(undefined), false)
})

test('retries a transient failure and returns the later success', async () => {
  let calls = 0
  const value = await withRetry(async () => {
    calls++
    if (calls === 1) throw highDemand
    return 'ok'
  }, { delayMs: 1 })
  assert.equal(value, 'ok')
  assert.equal(calls, 2)
})

test('gives up after the retry budget and rethrows the last error', async () => {
  let calls = 0
  await assert.rejects(
    withRetry(async () => { calls++; throw highDemand }, { retries: 1, delayMs: 1 }),
    /high demand/,
  )
  assert.equal(calls, 2)
})

test('does not retry permanent errors', async () => {
  let calls = 0
  await assert.rejects(withRetry(async () => { calls++; throw notFound }, { delayMs: 1 }), /not found/)
  assert.equal(calls, 1)
})

test('stops waiting as soon as the signal aborts', async () => {
  const ctrl = new AbortController()
  let calls = 0
  const pending = withRetry(async () => { calls++; throw highDemand }, { delayMs: 10_000, signal: ctrl.signal })
  setTimeout(() => ctrl.abort(new Error('cancelled')), 20)
  await assert.rejects(pending, /cancelled/)
  assert.equal(calls, 1)
})
