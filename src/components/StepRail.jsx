const STEPS = [
  { n: 1, label: 'Paste' },
  { n: 2, label: 'Redact' },
  { n: 3, label: 'Check prices' },
]

function Step({ n, label, current }) {
  const done = n < current
  const active = n === current
  const rule = active ? 'border-ink' : done ? 'border-accent' : 'border-border'

  return (
    <li aria-current={active ? 'step' : undefined} className={`flex min-w-0 items-baseline gap-2 border-t-2 pt-2.5 ${rule}`}>
      <span className={`font-mono text-xs ${done ? 'text-accent' : active ? 'text-fg' : 'text-muted'}`}>
        {done ? '✓' : n}
      </span>
      <span className={`truncate text-sm ${active ? 'font-medium text-fg' : done ? 'text-fg' : 'text-muted'}`}>
        {label}
        {done && <span className="sr-only"> (done)</span>}
      </span>
    </li>
  )
}

/**
 * The three steps, split by the privacy boundary: steps 1 and 2 happen on
 * this device, step 3 in the cloud. The dashed rule is Ghostline's signature.
 */
export default function StepRail({ current }) {
  return (
    <nav aria-label="Progress" className="mt-10">
      <div className="grid grid-cols-[1fr_1fr_auto_1fr] gap-x-3 text-xs text-muted sm:gap-x-5">
        <p className="col-span-2 flex items-center gap-2">
          <span aria-hidden className="size-2 bg-accent" />
          On your device
        </p>
        <span />
        <p className="flex items-center gap-2">
          <span aria-hidden className="size-2 bg-cloud" />
          In the cloud
        </p>
      </div>
      <ol className="mt-2 grid grid-cols-[1fr_1fr_auto_1fr] items-stretch gap-x-3 sm:gap-x-5">
        <Step {...STEPS[0]} current={current} />
        <Step {...STEPS[1]} current={current} />
        <li aria-hidden className="-mt-7 w-px border-l border-dashed border-muted" />
        <Step {...STEPS[2]} current={current} />
      </ol>
    </nav>
  )
}
