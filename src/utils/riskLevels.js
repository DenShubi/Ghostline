/** Risk levels from utils/pricingAudit.js. Spec wording: NORMAL / MODERATE / CRITICAL. */
export const RISK = {
  critical: { label: 'Critical', marker: 'bg-error', text: 'text-error' },
  warning: { label: 'Moderate', marker: 'bg-warning', text: 'text-fg' },
  normal: { label: 'Normal', marker: 'bg-muted/40', text: 'text-muted' },
  unmatched: { label: 'No benchmark', marker: 'border border-muted', text: 'text-muted' },
}
