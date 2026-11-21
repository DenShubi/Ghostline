import { formatCount, formatUSD } from '../utils/currencyFormatter.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** T07: what stays local vs what would go to the cloud, plus the exact line items. */
export default function HandoffPreview({ result }) {
  const { payload, counts, networkRequests } = result
  const kept = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <section aria-labelledby="handoff-heading" className="mt-16">
      <h2 id="handoff-heading" className="font-display text-xl font-medium">
        What leaves your device
      </h2>

      <dl className="mt-4 grid max-w-2xl grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-sm">
        <dt className="text-muted">Kept here</dt>
        <dd>Original text and {plural(kept, 'personal detail')}</dd>
        <dt className="text-muted">Sent to the cloud</dt>
        <dd>
          Nothing yet · {plural(networkRequests, 'network request')} during redaction
        </dd>
      </dl>

      {payload.items.length === 0 ? (
        <p className="mt-8 max-w-[60ch] text-sm text-muted">
          No line items found. Each item needs a name, a quantity and a unit price in USD.
        </p>
      ) : (
        <div className="mt-8">
          <table className="w-full border-collapse text-sm">
            <caption className="mb-3 text-left text-base font-medium text-fg">
              {payload.projectTitle}
              <span className="ml-2 font-normal text-muted">{plural(payload.items.length, 'line item')}</span>
            </caption>
            <thead>
              <tr className="border-y border-border text-left text-muted">
                <th scope="col" className="py-2.5 pr-4 font-medium">
                  Item
                </th>
                <th scope="col" className="py-2.5 pr-4 font-medium max-sm:hidden">
                  Specs
                </th>
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="py-2.5 text-right font-medium">
                  Unit price
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {payload.items.map((item, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2.5 pr-4 align-top">{item.itemName}</td>
                  <td className="py-2.5 pr-4 align-top text-muted max-sm:hidden">{item.specs || '—'}</td>
                  <td className="py-2.5 pr-4 text-right align-top">{formatCount(item.quantity)}</td>
                  <td className="py-2.5 text-right align-top">{formatUSD(item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
