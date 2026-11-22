import { useEffect, useState } from 'react'
import PublicAuditBrief from '../components/PublicAuditBrief.jsx'
import { getAuditReportById } from '../services/auditReportService.js'
import { isCloudConfigured } from '../services/auditHandoff.js'

/**
 * Standalone view for shared Public Audit Brief links (`/?report=<id>`).
 */
export default function ReportPage({ reportId }) {
  // Without a Firebase project the Firestore read never settles, so don't start it.
  const [status, setStatus] = useState(isCloudConfigured ? 'loading' : 'offline') // loading | ready | missing | error | offline
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!isCloudConfigured) return
    let active = true
    async function load() {
      try {
        const doc = await getAuditReportById(reportId)
        if (!active) return
        if (!doc) {
          setStatus('missing')
        } else {
          setReport(doc)
          setStatus('ready')
        }
      } catch (err) {
        console.error('[ReportPage] Failed to load shared report:', err)
        if (active) setStatus('error')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [reportId])

  return (
    <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-8 sm:pt-16">
      <a
        href="/"
        className="text-sm text-fg underline decoration-border underline-offset-4 hover:decoration-fg"
      >
        ← Audit another contract
      </a>

      {status === 'loading' && (
        <p role="status" className="mt-10 text-sm text-muted">
          Loading published audit brief…
        </p>
      )}

      {status === 'missing' && (
        <div className="mt-10">
          <h1 className="font-display text-2xl font-medium">Audit brief not found</h1>
          <p className="mt-2 max-w-[58ch] text-sm text-muted">
            No published audit brief exists for ID <code className="font-mono text-fg">{reportId}</code>.
          </p>
        </div>
      )}

      {status === 'offline' && (
        <div className="mt-10">
          <h1 className="font-display text-2xl font-medium">Shared briefs aren’t available here</h1>
          <p className="mt-2 max-w-[58ch] text-sm text-muted">
            This site isn’t connected to the cloud yet, so published audit briefs can’t be loaded.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-10">
          <h1 className="font-display text-2xl font-medium">Unable to load audit brief</h1>
          <p role="status" className="mt-2 max-w-[58ch] text-sm text-error">
            Could not reach Firestore to load this report. Check your connection and try reloading.
          </p>
        </div>
      )}

      {status === 'ready' && report && <PublicAuditBrief report={report} savedId={reportId} readOnly />}
    </main>
  )
}
