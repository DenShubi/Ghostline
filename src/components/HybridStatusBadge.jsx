const MODES = {
  checking: { label: 'Checking device', marker: 'bg-border' },
  local: { label: 'On-device · Gemini Nano', marker: 'bg-accent' },
  fallback: { label: 'On-device · basic filter', marker: 'bg-warning' },
  cloud: { label: 'Cloud · Gemini', marker: 'bg-cloud' },
}

/** Where AI work runs right now. Always visible. */
export default function HybridStatusBadge({ mode = 'checking' }) {
  const { label, marker } = MODES[mode] ?? MODES.checking

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className={`size-2 ${marker}`} />
      {label}
    </p>
  )
}
