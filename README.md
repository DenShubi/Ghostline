# Ghostline

Whistleblower-safe public budget and procurement auditor, built for #BuildHybridAI 2026. **Gemini Nano (on-device)** redacts PII in the browser, and only anonymised line items go to **Cloud Gemini + Firestore** (via Firebase AI Logic) for price benchmarking.

> Team: Denin (On-Device AI & Frontend) · Kahfi (Firebase & Cloud Audit Engine)

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
npm test         # node --test, no extra deps
```

Requires Node.js 18+. Design rules live in [DESIGN.md](DESIGN.md).

## Enabling Gemini Nano

1. Use a recent desktop Chrome (Canary/Dev recommended). The model needs ~22 GB of free disk space.
2. `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
3. `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
4. Relaunch Chrome. The header status should read **On-device · Gemini Nano**.

To verify local inference (dev server only), open the DevTools console and run:

```js
await ghostline.testNano()   // → { output, entities, ms, simulated: false }
```

The first call starts the model download. Without Nano, the app uses a local pattern filter (`simulated: true`). Raw text never leaves the device in either case.

## How local redaction works

```
raw text ─► PII spans: Gemini Nano (JSON schema) + regex safety net ─► redacted text
         ─► line items: CSV columns │ Gemini Nano │ line parser
         ─► final scrub of every string ─► anonymous payload { projectTitle, currency, items[] }
```

- Nano only **reports** which spans are personal data; the replacement is done in code, so prices can't be altered.
- The regex net catches emails, phones, IDs and names after cues like "Mr." or "Approved by" even if Nano misses them.
- The UI shows the observed number of network requests during redaction (PerformanceObserver). It should always be 0.
- Nano is used only when fully downloaded. While it is missing or still downloading, the basic filter runs at once and the header shows download progress; each Nano step also has a 25 s timeout.

## Privacy rule

Raw contract text must only reach `src/services/localPipeline.js` and `localNanoService.js`. Only `result.payload` may be handed to the cloud. If redaction is ever routed through Firebase AI Logic's hybrid mode, it **must** use `ONLY_ON_DEVICE`, never `PREFER_ON_DEVICE`, because that silently falls back to the cloud with PII.

## Project structure

```
src/
├── components/
│   ├── Navbar.jsx · HybridStatusBadge.jsx   # always-visible local / cloud status
│   ├── StepRail.jsx                         # 1 Paste · 2 Redact | 3 Check prices (device/cloud boundary)
│   ├── ContractSheet.jsx                    # one sheet: edit → working → redacted copy
│   ├── RedactedText.jsx                     # ink redaction bars
│   └── HandoffPreview.jsx                   # step 3: the only table that crosses to the cloud
├── hooks/useNanoModel.js                    # Nano status + download progress
├── services/
│   ├── localNanoService.js                  # Prompt API: PII detection, item extraction
│   ├── localPipeline.js                     # raw text → anonymous payload
│   ├── firebase.js · benchmarkService.js    # Kahfi
├── utils/ redaction · itemExtraction · csvParser · currencyFormatter
├── data/ seedBenchmarks.json · sampleContracts.js (1 demo; T12 adds more)
tests/                                       # npm test
scripts/seedFirestore.js
```

## Sprint status

| ID | Task | Owner | Status |
|----|------|-------|--------|
| T01 | Repo & React + Vite + Tailwind setup | Denin | ✅ Done |
| T02 | Verify Chrome Gemini Nano local inference | Denin | 🟡 Code done; run `ghostline.testNano()` on a Nano-enabled Chrome |
| T03 | Firebase setup (Firestore, App Check, AI Logic, Hosting) | Kahfi | ✅ Merged (PR #1) |
| T04 | Seed Firestore with 30–50 USD benchmarks | Kahfi | ✅ 40 benchmarks |
| T05 | Split-screen redaction UI & CSV/text input | Denin | ✅ Done |
| T06 | Gemini Nano PII redaction & JSON extraction | Denin | 🟡 Done; tested with mocked Nano + fallback, needs a run on real Nano |
| T07 | Local vs. cloud & "0 PII sent" indicators | Denin | ✅ Done |
| T08 | Cloud Gemini anomaly detection & benchmark logic | Kahfi | ⬜ |
