import { formatCount, formatUSD } from '../utils/currencyFormatter.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Step 3: exactly what would cross to the cloud, and nothing else. */
export default function HandoffPreview({ result }) {
  const { payload, counts, networkRequests } = result
  const kept = Object.values(counts).reduce((a, b) => a + b, 0)
  const hasItems = payload.items.length > 0

  return (
    <section aria-labelledby="handoff-heading" className="mt-14">
      <h2 id="handoff-heading" className="font-display text-xl font-medium">
        {hasItems ? 'Ready to check prices' : 'No line items found'}
      </h2>
      <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-muted">
        {hasItems
          ? `Only this table crosses to the cloud. The contract text and ${plural(kept, 'personal detail')} stay on this device, and redaction made ${plural(networkRequests, 'network request')}.`
          : 'Each item needs a name, a quantity and a unit price in USD, for example “Laptop - Qty: 500 - Unit price: $1,210.00”.'}
      </p>

      {hasItems && (
        <>
          <table className="mt-6 w-full border-collapse text-sm">
            <caption className="mb-3 text-left font-medium text-fg">
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

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled
              className="min-h-11 rounded-xs bg-ink px-5 text-sm font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-40"
            >
              Check prices in the cloud
            </button>
            <p className="text-sm text-muted">Price checking isn’t connected yet.</p>
          </div>
        </>
      )}
    </section>
  )
}
