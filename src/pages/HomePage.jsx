function Redacted({ chars }) {
  return (
    <span
      role="img"
      aria-label="redacted"
      className="inline-block h-[1.1em] translate-y-[0.15em] bg-ink align-baseline"
      style={{ width: `${chars}ch` }}
    />
  )
}

export default function HomePage({ nanoMissing }) {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-8 sm:pt-32">
      <h1 className="font-display text-2xl leading-tight font-medium tracking-[-0.01em] sm:text-3xl">
        <span className="block">Audit the prices.</span> <span className="block">Protect the source.</span>
      </h1>
      <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">
        Names, IDs, emails and phone numbers are blacked out on your device. Only the line items go to the cloud
        to be priced.
      </p>

      <p className="mt-14 border-y border-border py-4 font-mono text-sm leading-loose text-fg">
        Approved by <Redacted chars={11} />, <Redacted chars={16} />{' '}
        <span className="whitespace-nowrap"><span className="max-sm:hidden">· </span>Laptop 14&quot; × 500 @ $1,250.00</span>
      </p>

      {nanoMissing && (
        <details className="mt-10 max-w-[60ch] text-sm leading-relaxed text-muted">
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
    </main>
  )
}
