import LeakageCounterCard from './LeakageCounterCard.jsx'
import MarkupAlertTable from './MarkupAlertTable.jsx'
import { BUNDLED_BENCHMARKS } from '../services/auditHandoff.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** One honest sentence about where the prices were checked. */
function sourceLine(report) {
  const items = plural(report.items.length, 'line item')
  if (report.mode === 'local') {
    return `Checked ${items} on this device against Ghostline’s built-in list of ${BUNDLED_BENCHMARKS.length} market prices. The cloud check isn’t connected on this site yet.`
  }
  const against =
    report.benchmarkSource === 'firestore'
      ? 'market benchmarks in Firestore'
      : 'the built-in market price list, because Firestore was unreachable'
  const who = report.engine === 'cloud-gemini' ? 'Cloud Gemini matched' : 'Cloud Gemini didn’t respond, so Ghostline matched'
  return `${who} ${items} against ${against}. No personal details were sent.`
}

export default function AuditResults({ report }) {
  return (
    <section aria-labelledby="audit-heading" className="mt-14">
      <h2 id="audit-heading" className="font-display text-xl font-medium">
        Price check
      </h2>
      <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-muted">{sourceLine(report)}</p>

      <LeakageCounterCard key={report.auditedAt} summary={report.summary} />
      <MarkupAlertTable items={report.items} />
    </section>
  )
}
