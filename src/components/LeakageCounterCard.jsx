import { useEffect, useState } from 'react'
import { formatUSDWhole } from '../utils/currencyFormatter.js'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Count up to `target` once (~700ms, ease-out). Jumps straight there with reduced motion. */
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) return
    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(target * (1 - (1 - t) ** 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** T10: the one number that matters, with just enough context to trust it. */
export default function LeakageCounterCard({ summary }) {
  const leakage = summary.totalEstimatedLeakage
  const shown = useCountUp(leakage)
  const share = summary.totalContractValue > 0 ? (leakage / summary.totalContractValue) * 100 : 0

  const parts = [
    summary.criticalCount && `${summary.criticalCount} critical`,
    summary.warningCount && `${summary.warningCount} moderate`,
    summary.normalCount && `${summary.normalCount} within range`,
    summary.unmatchedCount && `${summary.unmatchedCount} without a benchmark`,
  ].filter(Boolean)

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Estimated overpayment</p>
      <p
        className={`mt-1 font-display text-3xl leading-none font-medium tabular-nums sm:text-4xl ${leakage > 0 ? 'text-error' : 'text-fg'}`}
      >
        <span aria-hidden>{formatUSDWhole(shown)}</span>
        <span className="sr-only">{formatUSDWhole(leakage)}</span>
      </p>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted">
        {leakage > 0
          ? `${share.toFixed(1)}% of the ${formatUSDWhole(summary.totalContractValue)} contract. `
          : `No overpricing found in the ${formatUSDWhole(summary.totalContractValue)} contract. `}
        {plural(summary.flaggedCount + summary.normalCount + summary.unmatchedCount, 'item')} checked: {parts.join(', ')}.
      </p>
    </div>
  )
}
