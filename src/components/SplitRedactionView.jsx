import { useRef } from 'react'
import RedactedText from './RedactedText.jsx'

const BUSY_LABEL = { redacting: 'Redacting…', extracting: 'Reading line items…' }

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function SplitRedactionView({
  text,
  onTextChange,
  onFile,
  onRedact,
  onClear,
  stage,
  segments,
  counts,
  statusLine,
  notice,
}) {
  const fileInput = useRef(null)
  const busy = stage === 'redacting' || stage === 'extracting'
  const hidden = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0

  return (
    <section aria-labelledby="workspace-heading" className="mt-12">
      <h2 id="workspace-heading" className="sr-only">
        Redact a contract
      </h2>

      <div className="grid border border-border lg:grid-cols-2">
        <div className="flex min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4">
            <label htmlFor="contract-input" className="text-sm font-medium">
              Original
            </label>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="min-h-8 text-sm text-muted underline decoration-border underline-offset-4 hover:text-fg hover:decoration-fg disabled:opacity-50"
            >
              Upload CSV
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) onFile(file)
              }}
            />
          </div>
          <textarea
            id="contract-input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            spellCheck={false}
            placeholder="Paste contract or tender text here."
            className="min-h-72 flex-1 resize-y bg-bg p-4 font-mono text-sm leading-relaxed text-fg placeholder:font-sans placeholder:text-muted lg:min-h-96"
          />
        </div>

        <div className="flex min-w-0 flex-col bg-surface">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4">
            <h3 className="text-sm font-medium">Redacted on this device</h3>
            {segments && (
              <span className="text-sm text-muted">
                {hidden ? `${plural(hidden, 'detail')} hidden` : 'No personal details found'}
              </span>
            )}
          </div>
          <div className="min-h-72 flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap lg:min-h-96">
            {segments ? (
              <RedactedText segments={segments} />
            ) : (
              <p className="font-sans text-muted">
                {stage === 'redacting' ? 'Finding personal details…' : 'The redacted copy appears here.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onRedact}
          disabled={busy || !text.trim()}
          className="min-h-11 rounded-xs bg-ink px-5 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {BUSY_LABEL[stage] ?? 'Redact on this device'}
        </button>
        {(text || segments) && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded-xs border border-border px-4 text-sm text-fg hover:border-fg"
          >
            Clear
          </button>
        )}
        <p role="status" className="text-sm text-muted">
          {statusLine}
        </p>
      </div>
      {notice && <p className="mt-3 max-w-[70ch] text-sm text-muted">{notice}</p>}
    </section>
  )
}
