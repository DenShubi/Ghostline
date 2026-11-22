import { useRef } from 'react'
import RedactedText from './RedactedText.jsx'

const textButton =
  'min-h-8 text-sm text-muted underline decoration-border underline-offset-4 hover:text-fg hover:decoration-fg disabled:opacity-50'

/**
 * One document that changes state: editable contract → working → redacted copy.
 * @param {{ mode: 'edit'|'busy'|'redacted' }} props
 */
export default function ContractSheet({
  mode,
  text,
  onTextChange,
  examples = [],
  onExample,
  onFile,
  onEdit,
  segments,
  hidden,
}) {
  const fileInput = useRef(null)
  const body = 'min-h-80 w-full px-4 py-4 font-mono text-sm leading-relaxed sm:px-6 sm:py-5'

  return (
    <section aria-labelledby="sheet-title" className="mt-6 border border-border bg-paper">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-5 gap-y-1 border-b border-border px-4 sm:px-6">
        <h2 id="sheet-title" className="text-sm font-medium">
          {mode === 'redacted' ? 'Redacted copy' : 'Contract'}
        </h2>

        {mode === 'redacted' ? (
          <div className="flex items-center gap-5">
            <span className="text-sm text-muted">
              {hidden ? `${hidden} detail${hidden === 1 ? '' : 's'} hidden` : 'No personal details found'}
            </span>
            <button type="button" onClick={onEdit} className={textButton}>
              Edit original
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {examples.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs text-muted">Samples:</span>
                {examples.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => onExample(sample)}
                    disabled={mode === 'busy'}
                    className={textButton}
                  >
                    {sample.shortLabel || sample.title}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => onExample()} disabled={mode === 'busy'} className={textButton}>
                Try an example
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={mode === 'busy'}
              className={textButton}
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
        )}
      </div>

      {mode === 'busy' && (
        <div aria-hidden className="h-0.5 overflow-hidden bg-border">
          <div className="progress-sweep h-full w-1/3 bg-accent" />
        </div>
      )}

      {mode === 'edit' && (
        <>
          <label htmlFor="contract-input" className="sr-only">
            Contract text
          </label>
          <textarea
            id="contract-input"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            spellCheck={false}
            placeholder="Paste the contract or tender text here. Names, IDs, emails and phone numbers are hidden before anything else happens."
            className={`${body} block resize-y bg-transparent text-fg placeholder:font-sans placeholder:text-muted`}
          />
        </>
      )}
      {mode === 'busy' && (
        <div aria-busy="true" className={`${body} break-words whitespace-pre-wrap text-muted`}>
          {text}
        </div>
      )}
      {mode === 'redacted' && (
        <div className={`${body} break-words whitespace-pre-wrap text-fg`}>
          <RedactedText segments={segments} />
        </div>
      )}
    </section>
  )
}
