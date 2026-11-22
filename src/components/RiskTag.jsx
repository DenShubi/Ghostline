import { RISK } from '../utils/riskLevels.js'

export default function RiskTag({ level }) {
  const risk = RISK[level] ?? RISK.unmatched
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${risk.text}`}>
      <span aria-hidden className={`size-2 shrink-0 ${risk.marker}`} />
      {risk.label}
    </span>
  )
}
