# DESIGN.md - Ghostline

## Context (from discovery)

- Artifact type: SaaS app (single-page guided tool): paste, redact on device, check prices in the cloud.
- Positioning: utilitarian, editorial. Reads like a well-set audit report, not a startup landing page.
- Audience: investigative journalists, whistleblowers, watchdogs, hackathon judges | Primary action (Phase 2+): paste a contract and run a private audit
- Adjectives: quiet, exact, trustworthy, discreet
- Visual word translations:
  - quiet -> one accent used only for status and focus, no decoration, generous whitespace
  - exact -> hairline rules, monospace for document text, tabular figures
  - trustworthy -> readable serif headings, plain-spoken copy, status always visible
  - discreet -> solid ink redaction bars instead of icons or illustrations
- Aesthetic essence: quiet, exact, discreet
- Single-minded proposition: the prices stay visible and the people do not
- Mode: light only | Density: airy (landing), balanced (workspace, Phase 2)
- Constraints: React 18 + Vite + Tailwind v4, WCAG 2.2 AA, no developer UI in user-facing screens

## Aesthetic

- Direction: redacted document. Paper-white page, ink type, hairline rules.
- Defining trait: everything is typography and rules, with no cards, shadows or icons.
- Signature move: the privacy boundary. A dashed vertical rule in the step rail splits "On your device" (steps 1 to 2, accent marker) from "In the cloud" (step 3, cloud marker), and real ink redaction bars, sized in `ch`, hide the people while prices stay readable.

## Typography

- Display: Newsreader 500 | Google Fonts | OFL
- Body: IBM Plex Sans 400/500 | Google Fonts | OFL
- Mono: IBM Plex Mono 400 (document excerpts, flags, tokens)
- Scale: Major Third 1.25, base 16px

| step | size | line-height | use |
|------|------|-------------|-----|
| 3xl | 39px | 1.25 | page headline (desktop) |
| 2xl | 31px | 1.25 | page headline (mobile), section |
| xl | 25px | 1.3 | sub-section |
| lg | 20px | 1.6 | lead paragraph, wordmark |
| base | 16px | 1.6 | body |
| sm | 14px | 1.6 | meta, status, document excerpts |

- Tracking: -0.01em on display only. Measure: 56 to 60ch.

## Color

- Strategy: cool paper white, not cream. Ink neutral, one deep-teal accent far from the indigo band. Status colours always come with a text label.
- Distribution: 60 paper / 30 ink / 10 accent
- Palette:
  - bg: oklch(0.985 0.003 250) | #f7f8fa
  - paper (contract sheet): oklch(0.998 0.001 250) | #fdfdfe
  - surface: oklch(0.96 0.004 250) | #eef0f3
  - fg / ink: oklch(0.22 0.012 250) | #1b1f24
  - muted: oklch(0.5 0.012 250) | #63686f
  - border: oklch(0.9 0.006 250) | #dfe2e6
  - accent (on-device): oklch(0.48 0.085 185) | #1f6f68
  - accent-fg: oklch(0.985 0.003 250) | #f7f8fa
  - warning (fallback): oklch(0.62 0.14 70) | #b8741a
  - cloud: oklch(0.52 0.11 240) | #2f6aa3
  - error: oklch(0.52 0.17 27) | #b3362c

## Spacing, radius, shadow

- Spacing base 4px. Tight inside groups (12 to 20px), wide between blocks (56px+).
- Radius: 2px only. No pills.
- Shadow: none. Edges are 1px `border` rules.

## Layout and composition

- Left-aligned single column within max-w 64rem (header matches), 16px gutter on mobile, 32px from `sm`.
- Order: headline + one-sentence explanation, step rail, contract sheet, action row, step 3 (only after redaction).
- Signature layout move: the step rail grid `1fr 1fr auto 1fr`; the `auto` column is the dashed boundary, so the device/cloud split is structural, not decorative.
- One document, three states (edit, working, redacted) instead of two side-by-side panels: nothing on screen is empty or duplicated.
- Responsive: mobile-first; the rail keeps 3 steps on one row at 375px; the Specs column hides below `sm`.

## Components and states

- Status (header): 8px square marker + text label. checking (border) / on-device Gemini Nano (accent) / on-device basic filter (warning) / redacting, label turns fg (accent) / cloud (cloud). No pulse.
- Links and disclosure: fg text, border-coloured underline that darkens to fg on hover.
- Buttons: primary = ink fill, paper text, 44px tall; secondary = 1px border, darkens to fg on hover; one primary per view. Busy state swaps the label ("Redacting…", "Reading line items…") and disables.
- Step rail: each step is a 2px top rule + mono number + label. Done = accent rule and ✓, current = ink rule, medium label, `aria-current="step"`; upcoming = border rule, muted.
- Contract sheet: `paper` fill, 1px border, 48px toolbar (title left; "Try an example" · "Upload CSV" while editing, "N details hidden" · "Edit original" once redacted). Focus shows as the frame turning fg, not an inner ring. Working state: dimmed text + 2px accent sweep bar under the toolbar.
- Redacted text: monospace, PII replaced by ink bars sized to the hidden text in `ch` (capped at 32ch), `role="img"` with the PII type as label.
- Step 3 (handoff): serif heading "Ready to check prices", one sentence saying only the table crosses and how many network requests redaction made, then a ruled table (text left, numbers right, `tabular-nums`), then the primary "Check prices in the cloud" (disabled until Phase 3 wires it).
- Fallback notice: warning square + one sentence with the reason (no Nano / still downloading with % / timeout / error), plus Chrome-flag steps in a `<details>` only when the browser can't run Nano.
- Empty / loading / error: the empty sheet offers an example and says what will happen; loading is the button label, status line and sweep bar; errors say that nothing was sent.
- Focus ring: 2px bg gap + 2px accent box-shadow.

## Motion

- Two motions, both only under `prefers-reduced-motion: no-preference`: the 1.1s progress sweep (transform) while working, and a 200ms fade-in of redaction bars. Button hover is a 150ms opacity change.

## Iconography

- No icons in Phase 1. If needed later: Lucide at 1.5px stroke, 16px, never decorative.

## Imagery and illustration

- None. The redaction bar is the only graphic device.

## Accessibility

- Contrast (measured): fg 15.6:1, muted 5.3:1, accent 5.6:1 on bg (AA).
- Redaction bars have `role="img"` + `aria-label="redacted"`.
- Status uses `role="status"`; meaning carried by text, not colour.
- Disclosure is a native `<details>`, keyboard operable.

## Tokens (source of truth)

Implemented as Tailwind v4 `@theme` in `src/index.css`.

## Cards and surfaces

- No cards. Group with whitespace and rules.

## Slop audit

- Date: 2026-11-21 | Result: pass after fixing 3 issues
- Fixed: headline broke mid-phrase; excerpt scrolled sideways on mobile and hid the price; page overflowed 11px on mobile.
- Removed from v0: dark navy theme, pulsing status dots, rounded-2xl panels, Inter, developer diagnostics panel.
- Phase 2 redesign (2026-11-21): pass. Fixed before shipping: stuck "Redacting…" when Nano was still downloading (now falls back at once with progress in the header, 25s timeout per Nano step). Bare-structure check: not hero + cards; the rail + single sheet is specific to this flow.
- Phase 2 (2026-11-21): pass after fixing 1 issue. Line-item table scrolled sideways on mobile and hid qty and price; Specs column now hides below `sm`.

## Changelog

- 2026-11-21: guided 3-step redesign after user feedback ("I don't get the view"). Step rail with device/cloud boundary, single contract sheet, example contract, step 3 handoff. Split view removed. Tokens added: paper, error.

- 2026-11-21: Phase 2 workspace. Split redaction view, ink redaction bars on real output, handoff preview table, busy status. The static specimen line was removed because the live output now shows the signature.
- 2026-11-21: initial system; replaced the developer diagnostics page with a minimal user-facing shell.
