import LeakageCounterCard from './LeakageCounterCard.jsx'
import MarkupAlertTable from './MarkupAlertTable.jsx'
import { BUNDLED_BENCHMARKS } from '../services/auditHandoff.js'
import { describeAuditSource } from '../utils/auditSource.js'

export default function AuditResults({ report }) {
  return (
    <section aria-labelledby="audit-heading" className="mt-14">
      <h2 id="audit-heading" className="font-display text-xl font-medium">
        Price check
      </h2>
      <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-muted">
        {describeAuditSource(report, BUNDLED_BENCHMARKS.length)}
      </p>

      <LeakageCounterCard key={report.auditedAt} summary={report.summary} />
      <MarkupAlertTable items={report.items} />
    </section>
  )
}
