/**
 * True for errors worth one more try: rate limits and server-side overload
 * (e.g. Gemini's 500 "This model is currently experiencing high demand").
 */
export function isTransientError(err) {
  return /\[(429|500|502|503|504)\b/.test(String(err?.message ?? ''))
}

/**
 * Run `fn`, retrying transient failures with a growing delay.
 * Stops immediately when `signal` aborts or the error is not transient.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, delayMs?: number, signal?: AbortSignal, isRetryable?: (err: unknown) => boolean }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { retries = 1, delayMs = 1500, signal, isRetryable = isTransientError } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries || signal?.aborted || !isRetryable(err)) throw err
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs * (attempt + 1))
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            reject(signal.reason)
          },
          { once: true },
        )
      })
    }
  }
}
