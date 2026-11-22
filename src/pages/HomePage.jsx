import { useEffect, useRef, useState } from 'react'
import StepRail from '../components/StepRail.jsx'
import ContractSheet from '../components/ContractSheet.jsx'
import HandoffPreview from '../components/HandoffPreview.jsx'
import AuditResults from '../components/AuditResults.jsx'
import PublicAuditBrief from '../components/PublicAuditBrief.jsx'
import { runLocalPipeline } from '../services/localPipeline.js'
import { isCloudConfigured, runPriceAudit } from '../services/auditHandoff.js'
import { SAMPLE_CONTRACTS } from '../data/sampleContracts.js'

const MAX_FILE_BYTES = 1024 * 1024
const BUSY = new Set(['redacting', 'extracting'])
const BUSY_LABEL = { redacting: 'Finding personal details…', extracting: 'Reading line items…' }

function fallbackNotice(reason, progress) {
  if (reason === 'downloading' || reason === 'downloadable') {
    const pct = progress != null ? ` (${Math.round(progress * 100)}%)` : ''
    return `Gemini Nano is still downloading${pct}, so the basic filter was used. Redact again once it’s ready.`
  }
  if (reason === 'timeout') return 'Gemini Nano took too long, so the basic filter was used.'
  if (reason === 'error') return 'Gemini Nano hit an error, so the basic filter was used.'
  return 'This browser can’t run Gemini Nano, so the basic filter was used.'
}

export default function HomePage({ nano, onActivityChange }) {
  const [text, setText] = useState('')
  const [stage, setStage] = useState('idle') // idle | redacting | extracting | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [auditing, setAuditing] = useState(false)
  const [auditError, setAuditError] = useState(null)
  const controller = useRef(null)
  const auditController = useRef(null)
  const redactButton = useRef(null)

  const busy = BUSY.has(stage)
  const activity = busy ? 'redacting' : auditing ? 'auditing' : null
  useEffect(() => {
    onActivityChange?.(activity)
  }, [activity, onActivityChange])
  useEffect(
    () => () => {
      controller.current?.abort()
      auditController.current?.abort()
    },
    [],
  )

  function reset() {
    controller.current?.abort()
    controller.current = null
    auditController.current?.abort()
    auditController.current = null
    setStage('idle')
    setResult(null)
    setError(null)
    setReport(null)
    setAuditing(false)
    setAuditError(null)
  }

  function loadText(value) {
    reset()
    setText(value)
  }

  async function handleFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      reset()
      setError('That file is over 1 MB. Try a smaller CSV.')
      return
    }
    loadText(await file.text())
  }

  function handleExample(sample = SAMPLE_CONTRACTS[0]) {
    nano.prepare()
    loadText(sample.text)
    requestAnimationFrame(() => redactButton.current?.focus())
  }

  async function handleRedact() {
    nano.prepare() // starts the model download inside this click, if needed
    reset()
    const ctrl = new AbortController()
    controller.current = ctrl
    setStage('redacting')

    try {
      const res = await runLocalPipeline(text, {
        signal: ctrl.signal,
        onStage: (next) => !ctrl.signal.aborted && setStage(next),
      })
      if (ctrl.signal.aborted) return
      setResult(res)
      setStage('done')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setStage('idle')
      setError('Something went wrong while redacting. Nothing was sent anywhere. Try again.')
    }
  }

  // T09: only `result.payload` (anonymous line items) ever reaches the audit.
  async function handleAudit() {
    auditController.current?.abort()
    const ctrl = new AbortController()
    auditController.current = ctrl
    setAuditing(true)
    setAuditError(null)
    try {
      const next = await runPriceAudit(result.payload, { signal: ctrl.signal })
      if (!ctrl.signal.aborted) setReport(next)
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setAuditError(
        err?.message?.startsWith('Privacy guard')
          ? 'Stopped before sending: a line item still looks like it has contact details. Edit the original and try again.'
          : 'The price check failed. Nothing personal was sent. Try again.',
      )
    } finally {
      if (!ctrl.signal.aborted) setAuditing(false)
    }
  }

  const mode = result ? 'redacted' : busy ? 'busy' : 'edit'
  const step = report ? 4 : result ? 3 : busy ? 2 : 1
  const hidden = result ? Object.values(result.counts).reduce((a, b) => a + b, 0) : 0
  const showNanoHelp = result?.engine === 'fallback' && (result.engineReason === 'unsupported' || result.engineReason === 'unavailable')

  return (
    <main className="mx-auto max-w-5xl px-4 pt-14 pb-28 sm:px-8 sm:pt-20">
      <h1 className="font-display text-2xl leading-tight font-medium tracking-[-0.01em] sm:text-3xl">
        <span className="block">Audit the prices.</span> <span className="block">Protect the source.</span>
      </h1>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-muted">
        Paste a procurement contract. Ghostline hides the people in it on your device, then checks the prices against
        fair market rates in the cloud.
      </p>

      <StepRail current={step} />

      <ContractSheet
        mode={mode}
        text={text}
        onTextChange={(value) => {
          setText(value)
          if (error) setError(null)
        }}
        examples={SAMPLE_CONTRACTS}
        onExample={handleExample}
        onFile={handleFile}
        onEdit={reset}
        segments={result?.segments}
        hidden={hidden}
      />

      {mode !== 'redacted' && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            ref={redactButton}
            type="button"
            onClick={handleRedact}
            disabled={busy || !text.trim()}
            className="min-h-11 rounded-xs bg-ink px-5 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Redacting…' : 'Redact on this device'}
          </button>
          <p role="status" className={`text-sm ${error ? 'text-error' : 'text-muted'}`}>
            {error ?? BUSY_LABEL[stage] ?? (text.trim() ? '' : 'Nothing is sent anywhere at this step.')}
          </p>
        </div>
      )}

      {result?.engine === 'fallback' && (
        <div className="mt-4 max-w-[64ch] text-sm leading-relaxed text-muted">
          <p className="flex gap-2">
            <span aria-hidden className="mt-[0.45em] size-2 shrink-0 bg-warning" />
            <span>
              {fallbackNotice(result.engineReason, nano.progress)} Names without a cue like “Mr.” or “Approved by” can
              slip through, so check the copy above.
            </span>
          </p>
          {showNanoHelp && (
            <details className="mt-3 pl-4">
              <summary className="cursor-pointer text-fg underline decoration-border underline-offset-4 hover:decoration-fg">
                Turn on Gemini Nano in Chrome
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Open <code className="font-mono text-fg">chrome://flags/#optimization-guide-on-device-model</code>{' '}
                  and choose <em>Enabled BypassPerfRequirement</em>.
                </li>
                <li>
                  Open <code className="font-mono text-fg">chrome://flags/#prompt-api-for-gemini-nano</code> and choose{' '}
                  <em>Enabled</em>.
                </li>
                <li>Relaunch Chrome and reload this page.</li>
              </ol>
            </details>
          )}
        </div>
      )}

      {report ? (
        <>
          <AuditResults report={report} />
          <PublicAuditBrief report={report} showFigures={false} canPublish={isCloudConfigured} />
        </>
      ) : (
        result && (
          <HandoffPreview
            result={result}
            onAudit={handleAudit}
            auditing={auditing}
            auditError={auditError}
            cloudConfigured={isCloudConfigured}
          />
        )
      )}
    </main>
  )
}
