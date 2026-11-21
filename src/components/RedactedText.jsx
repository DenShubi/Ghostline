const LABELS = {
  NAME: 'name',
  ID: 'ID number',
  EMAIL: 'email',
  PHONE: 'phone number',
  ADDRESS: 'address',
  ACCOUNT: 'account number',
}

/** A solid ink bar the width of the text it hides (monospace `ch`). */
export function RedactionBar({ length, type }) {
  const label = `Redacted ${LABELS[type] ?? 'detail'}`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-block h-[1.15em] bg-ink align-[-0.2em]"
      style={{ width: `${Math.min(Math.max(length, 2), 32)}ch` }}
    />
  )
}

export default function RedactedText({ segments }) {
  return segments.map((s, i) =>
    s.kind === 'text' ? <span key={i}>{s.text}</span> : <RedactionBar key={i} length={s.length} type={s.type} />,
  )
}
