import RiskTag from './RiskTag.jsx'
import { RISK } from '../utils/riskLevels.js'
import { formatCount, formatMarkup, formatUSD, formatUSDWhole } from '../utils/currencyFormatter.js'

const ORDER = { critical: 0, warning: 1, normal: 2, unmatched: 3 }

/** T10: every line item against its fair price, worst first. */
export default function MarkupAlertTable({ items }) {
  const rows = [...items].sort(
    (a, b) => ORDER[a.riskLevel] - ORDER[b.riskLevel] || b.estimatedLeakage - a.estimatedLeakage,
  )

  return (
    <table className="mt-10 w-full border-collapse text-sm">
      <caption className="sr-only">Line items compared with fair market prices, highest risk first</caption>
      <thead>
        <tr className="border-y border-border text-left text-muted">
          <th scope="col" className="py-2.5 pr-4 font-medium">
            Item
          </th>
          <th scope="col" className="py-2.5 pr-4 text-right font-medium max-sm:hidden">
            Paid / unit
          </th>
          <th scope="col" className="py-2.5 pr-4 text-right font-medium max-sm:hidden">
            Fair / unit
          </th>
          <th scope="col" className="py-2.5 pr-4 text-right font-medium">
            Markup
          </th>
          <th scope="col" className="py-2.5 text-right font-medium">
            Overpaid
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((item, i) => {
          const risk = RISK[item.riskLevel] ?? RISK.unmatched
          return (
            <tr key={i} className="border-b border-border align-top">
              <td className="py-3 pr-4">
                <p className="font-medium text-fg">{item.itemName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  <RiskTag level={item.riskLevel} />
                  <span className="sm:hidden">
                    {formatUSD(item.unitPrice)} × {formatCount(item.quantity)}
                  </span>
                  <span className="max-sm:hidden">× {formatCount(item.quantity)}</span>
                </p>
                <p className="mt-1 max-w-[52ch] text-xs leading-relaxed text-muted">{item.reason}</p>
              </td>
              <td className="py-3 pr-4 text-right max-sm:hidden">{formatUSD(item.unitPrice)}</td>
              <td className="py-3 pr-4 text-right text-muted max-sm:hidden">
                {item.fairPriceAvg != null ? formatUSD(item.fairPriceAvg) : '—'}
              </td>
              <td className={`py-3 pr-4 text-right font-medium ${risk.text}`}>{formatMarkup(item.markupPercent)}</td>
              <td className={`py-3 text-right ${item.estimatedLeakage > 0 ? 'font-medium text-fg' : 'text-muted'}`}>
                {item.estimatedLeakage > 0 ? formatUSDWhole(item.estimatedLeakage) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
