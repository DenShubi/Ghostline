# Ghostline

Whistleblower-safe public budget and procurement auditor, built for #BuildHybridAI 2026. **Gemini Nano (on-device)** redacts PII in the browser, and only anonymised line items go to **Cloud Gemini + Firestore** (via Firebase AI Logic) for price benchmarking.

> Team: Denin (On-Device AI & Frontend) · Kahfi (Firebase & Cloud Audit Engine)

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

Requires Node.js 18+. Design rules live in [DESIGN.md](DESIGN.md).

## Enabling Gemini Nano

1. Use a recent desktop Chrome (Canary/Dev recommended). The model needs ~22 GB of free disk space.
2. `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
3. `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
4. Relaunch Chrome. The header status should read **On-device · Gemini Nano**.

To verify local inference (dev server only), open the DevTools console and run:

```js
await ghostline.testNano()   // → { output, ms, simulated: false }
```

The first call starts the model download. Without Nano, the app uses a local pattern filter (`simulated: true`). Raw text never leaves the device in either case.

## Privacy rule

Raw contract text must only reach `src/services/localNanoService.js`. If redaction is ever routed through Firebase AI Logic's hybrid mode, it **must** use `ONLY_ON_DEVICE`, never `PREFER_ON_DEVICE`. `PREFER_ON_DEVICE` silently falls back to the cloud, which would send PII.

## Project structure

```
src/
├── components/
│   ├── Navbar.jsx
│   └── HybridStatusBadge.jsx      # on-device / fallback / cloud status
├── services/
│   └── localNanoService.js        # Prompt API wrapper + local fallback
├── pages/HomePage.jsx
├── App.jsx · main.jsx · index.css # design tokens in index.css (@theme)
├── data/ · utils/                 # Phase 2+
scripts/                           # seedFirestore.js (Kahfi)
```

Kahfi's Firebase files (`src/services/firebase.js`, `firebase.json`, `firestore.rules`, `.env.example`) slot into this layout.

## Sprint status

| ID | Task | Owner | Status |
|----|------|-------|--------|
| T01 | Repo & React + Vite + Tailwind setup | Denin | ✅ Done |
| T02 | Verify Chrome Gemini Nano local inference | Denin | 🟡 Code done; run `ghostline.testNano()` on a Nano-enabled Chrome |
| T03 | Firebase setup (Firestore, App Check, AI Logic, Hosting) | Kahfi | ⬜ |
| T04 | Seed Firestore with 30–50 USD benchmarks | Kahfi | ⬜ |
