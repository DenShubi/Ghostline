import { useState } from 'react'
import { buildReportShareUrl, saveAuditReport } from '../services/auditReportService.js'
import { formatCount, formatUSD } from '../utils/currencyFormatter.js'

const RISK_META = {
  critical: { label: 'Critical markup', marker: 'bg-error', text: 'text-error' },
  warning: { label: 'Elevated price', marker: 'bg-warning', text: 'text-warning' },
  normal: { label: 'Within market range', marker: 'bg-accent', text: 'text-muted' },
  unmatched: { label: 'No benchmark', marker: 'bg-border', text: 'text-muted' },
}

const OVERALL_RISK_META = {
  critical: { label: 'Critical risk', marker: 'bg-error' },
  high: { label: 'High risk', marker: 'bg-warning' },
  medium: { label: 'Moderate risk', marker: 'bg-warning' },
  low: { label: 'Low risk', marker: 'bg-accent' },
}

function formatMarkup(value) {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Editorial Public Audit Brief displaying benchmark comparison, leakage totals,
 * executive findings, and Firestore save/share controls.
 */
export default function PublicAuditBrief({ report, savedId = null, readOnly = false }) {
  const [publishedId, setPublishedId] = useState(savedId)
  const [shareUrl, setShareUrl] = useState(savedId ? buildReportShareUrl(savedId) : '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const { summary, items } = report
  const overall = OVERALL_RISK_META[summary.overallRiskLevel] ?? OVERALL_RISK_META.low
  const auditedDate = formatDate(report.auditedAt)

  async function copyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  async function handlePublish() {
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveAuditReport(report)
      setPublishedId(saved.id)
      setShareUrl(saved.shareUrl)
      await copyToClipboard(saved.shareUrl)
    } catch (err) {
      console.error('[PublicAuditBrief] Failed to publish report:', err)
      setSaveError('Could not save this brief to Firestore. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="audit-brief-heading" className="mt-14 border-t border-border pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="font-mono text-xs tracking-wide text-muted uppercase">Public audit brief · 0 PII stored</p>
          <h2 id="audit-brief-heading" className="mt-1 font-display text-2xl font-medium tracking-[-0.01em]">
            {report.projectTitle}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-2 font-medium text-fg">
            <span aria-hidden className={`size-2 shrink-0 ${overall.marker}`} />
            {overall.label}
          </span>
          {auditedDate && <span>{auditedDate}</span>}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        {report.engine === 'cloud-gemini'
          ? `Benchmarked against Firestore USD market data via Cloud Gemini (${report.modelName}).`
          : 'Benchmarked against Firestore USD market data using deterministic matching (Cloud Gemini unavailable).'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 tabular-nums sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Estimated leakage</dt>
          <dd
            className={`mt-1 font-display text-xl font-medium ${
              summary.totalEstimatedLeakage > 0 ? 'text-error' : 'text-fg'
            }`}
          >
            {formatUSD(summary.totalEstimatedLeakage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Contract total</dt>
          <dd className="mt-1 font-display text-xl font-medium text-fg">
            {formatUSD(summary.totalContractValue)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Fair market baseline</dt>
          <dd className="mt-1 font-display text-xl font-medium text-fg">
            {formatUSD(summary.totalFairValue)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Flagged line items</dt>
          <dd className="mt-1 font-display text-xl font-medium text-fg">
            {summary.flaggedCount} <span className="text-sm font-normal text-muted">of {items.length}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-8">
        <h3 className="font-display text-lg font-medium">Executive summary</h3>
        <p className="mt-2 max-w-[64ch] text-base leading-relaxed text-fg">{report.executiveSummary}</p>
      </div>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="mb-3 text-left font-display text-lg font-medium text-fg">
            Line-item price comparison
          </caption>
          <thead>
            <tr className="border-y border-border text-left text-muted">
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Item
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium max-sm:hidden">
                Qty
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                Quoted
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium max-sm:hidden">
                Fair avg
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                Markup
              </th>
              <th scope="col" className="py-2.5 text-right font-medium">
                Leakage
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((item, i) => {
              const risk = RISK_META[item.riskLevel] ?? RISK_META.unmatched
              return (
                <tr key={i} className="border-b border-border">
                  <td className="py-3 pr-4 align-top">
                    <div className="font-medium text-fg">{item.itemName}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span aria-hidden className={`size-2 shrink-0 ${risk.marker}`} />
                      <span className={item.riskLevel === 'critical' || item.riskLevel === 'warning' ? risk.text : ''}>
                        {risk.label}
                      </span>
                      {item.matchedBenchmarkName && item.matchedBenchmarkName !== item.itemName && (
                        <span>· matched to {item.matchedBenchmarkName}</span>
                      )}
                    </div>
                    {item.reason && <p className="mt-1 max-w-[54ch] text-xs leading-relaxed text-muted">{item.reason}</p>}
                  </td>
                  <td className="py-3 pr-4 text-right align-top max-sm:hidden">{formatCount(item.quantity)}</td>
                  <td className="py-3 pr-4 text-right align-top">{formatUSD(item.unitPrice)}</td>
                  <td className="py-3 pr-4 text-right align-top text-muted max-sm:hidden">
                    {item.fairPriceAvg != null ? formatUSD(item.fairPriceAvg) : '—'}
                  </td>
                  <td className={`py-3 pr-4 text-right align-top font-medium ${risk.text}`}>
                    {formatMarkup(item.markupPercent)}
                  </td>
                  <td
                    className={`py-3 text-right align-top font-medium ${
                      item.estimatedLeakage > 0 ? 'text-error' : 'text-muted'
                    }`}
                  >
                    {item.estimatedLeakage > 0 ? formatUSD(item.estimatedLeakage) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {report.recommendations?.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-lg font-medium">Recommended oversight actions</h3>
          <ol className="mt-2 max-w-[64ch] list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg">
            {report.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-6">
        {!readOnly && !publishedId && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="min-h-11 rounded-xs bg-ink px-5 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Publishing brief…' : 'Publish & copy share link'}
          </button>
        )}

        {shareUrl && (
          <>
            <button
              type="button"
              onClick={() => copyToClipboard(shareUrl)}
              className="min-h-11 rounded-xs border border-border px-4 text-sm font-medium text-fg transition-colors hover:border-fg"
            >
              {copied ? 'Link copied' : 'Copy share link'}
            </button>
            <a
              href={shareUrl}
              className="font-mono text-xs text-fg underline decoration-border underline-offset-4 hover:decoration-fg"
            >
              {shareUrl}
            </a>
          </>
        )}

        {saveError && (
          <p role="status" className="text-sm text-error">
            {saveError}
          </p>
        )}
      </div>
    </section>
  )
}
