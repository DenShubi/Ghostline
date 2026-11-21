import { useEffect, useRef, useState } from 'react'
import SplitRedactionView from '../components/SplitRedactionView.jsx'
import HandoffPreview from '../components/HandoffPreview.jsx'
import { runLocalPipeline } from '../services/localPipeline.js'

const MAX_FILE_BYTES = 1024 * 1024
const BUSY = new Set(['redacting', 'extracting'])

const duration = (ms) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`)

export default function HomePage({ nanoMissing, onBusyChange }) {
  const [text, setText] = useState('')
  const [stage, setStage] = useState('idle') // idle | redacting | extracting | done | error
  const [partial, setPartial] = useState(null)
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const controller = useRef(null)

  useEffect(() => {
    onBusyChange?.(BUSY.has(stage))
  }, [stage, onBusyChange])

  useEffect(() => () => controller.current?.abort(), [])

  function reset() {
    controller.current?.abort()
    controller.current = null
    setStage('idle')
    setPartial(null)
    setResult(null)
    setProgress(null)
    setError(null)
  }

  function handleTextChange(value) {
    setText(value)
    if (stage !== 'idle') reset()
  }

  async function handleFile(file) {
    reset()
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is over 1 MB. Try a smaller CSV.')
      setStage('error')
      return
    }
    setText(await file.text())
  }

  // Must stay a direct click handler: Chrome only downloads the model on user activation.
  async function handleRedact() {
    reset()
    const ctrl = new AbortController()
    controller.current = ctrl
    setStage('redacting')

    try {
      const res = await runLocalPipeline(text, {
        signal: ctrl.signal,
        onDownloadProgress: setProgress,
        onStage: (next, data) => {
          if (ctrl.signal.aborted) return
          setStage(next)
          if (data) setPartial(data)
          if (next === 'extracting') setProgress(null)
        },
      })
      if (ctrl.signal.aborted) return
      setResult(res)
      setStage('done')
    } catch (err) {
      if (ctrl.signal.aborted) return
      console.error(err)
      setError('Something went wrong while redacting. Nothing was sent anywhere. Try again.')
      setStage('error')
    }
  }

  const view = result ?? partial
  const statusLine =
    stage === 'redacting' && progress != null
      ? `Downloading the on-device model… ${Math.round(progress * 100)}%`
      : stage === 'done'
        ? `Redacted in ${duration(result.redactMs)}`
        : stage === 'error'
          ? error
          : null

  const notice =
    view?.engine === 'fallback'
      ? 'Basic filter in use: names without a cue like “Mr.” or “Approved by” can slip through. Check the redacted copy before sending.'
      : null

  return (
    <main className="mx-auto max-w-6xl px-4 pt-14 pb-24 sm:px-8 sm:pt-20">
      <h1 className="font-display text-2xl leading-tight font-medium tracking-[-0.01em] sm:text-3xl">
        <span className="block">Audit the prices.</span> <span className="block">Protect the source.</span>
      </h1>
      <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-muted">
        Names, IDs, emails and phone numbers are blacked out on your device. Only the line items go to the cloud to
        be priced.
      </p>

      {nanoMissing && (
        <details className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">
          <summary className="cursor-pointer text-fg underline decoration-border underline-offset-4 hover:decoration-fg">
            Gemini Nano isn’t on in this browser
          </summary>
          <p className="mt-3">
            Ghostline will use a simpler on-device filter instead. Nothing leaves your device either way. For full
            redaction, use desktop Chrome:
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>
              Open <code className="font-mono text-fg">chrome://flags/#optimization-guide-on-device-model</code> and
              choose <em>Enabled BypassPerfRequirement</em>.
            </li>
            <li>
              Open <code className="font-mono text-fg">chrome://flags/#prompt-api-for-gemini-nano</code> and choose{' '}
              <em>Enabled</em>.
            </li>
            <li>Relaunch Chrome and reload this page.</li>
          </ol>
        </details>
      )}

      <SplitRedactionView
        text={text}
        onTextChange={handleTextChange}
        onFile={handleFile}
        onRedact={handleRedact}
        onClear={() => {
          setText('')
          reset()
        }}
        stage={stage}
        segments={view?.segments ?? null}
        counts={view?.counts ?? null}
        statusLine={statusLine}
        notice={notice}
      />

      {result && <HandoffPreview result={result} />}
    </main>
  )
}
