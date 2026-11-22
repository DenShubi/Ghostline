# Ghostline

**Audit the prices. Protect the source.**

Ghostline checks a public procurement contract for overpricing without exposing the people in it. Names, ID numbers, emails and phone numbers are blacked out on your own device. Only the anonymous line items (item, quantity, unit price) are sent to the cloud, where they are compared with fair market prices.

**Try it:** https://auditzero-ghostline-2026.web.app

Built for journalists, watchdogs and whistleblowers who want a second opinion on a leaked contract without putting a source at risk.

## How it works

1. **Paste.** Paste contract or tender text, upload a CSV, or pick one of the three sample contracts.
2. **Redact, on your device.** Chrome's built-in Gemini Nano finds the personal details and Ghostline replaces them with black bars. It then reads the line items. Nothing is sent anywhere during this step; the page shows the number of network requests it made (always 0).
3. **Check prices, in the cloud.** Only the line-item table goes to Cloud Gemini (via Firebase AI Logic), which matches each item to a USD market benchmark stored in Firestore. Ghostline then shows the estimated overpayment and every item compared with its fair price.

The header always tells you where work is happening: **On-device** while redacting, **Cloud Gemini** while checking prices.

## Reading the results

| Label | Meaning |
|---|---|
| **Critical** | Above the fair price range and at least 60% over the market average |
| **Moderate** | Above the fair price range, less than 60% over the average |
| **Normal** | Within the fair price range |
| **No benchmark** | No comparable item in the benchmark list, so it isn't scored |

**Estimated overpayment** adds up `(unit price − market average) × quantity` for every Critical and Moderate item. All numbers are calculated by Ghostline from the benchmark data, never by the AI model. The AI only matches items to benchmarks and writes the summary.

Results are an early signal for further checking, not proof of wrongdoing.

## Privacy

- **Stays on your device:** the original text and every personal detail found in it.
- **Sent to the cloud:** the line-item table shown in step 3, nothing else. It is checked again for emails and phone numbers right before sending, and blocked if any are found.
- **Published briefs** (optional, the *Publish & copy share link* button) store the anonymous results in Firestore. Anyone with the link can read them.
- Always read the redacted copy before checking prices. Automatic redaction can miss things, especially without Gemini Nano (see below).

## Full on-device redaction with Gemini Nano

Ghostline works in any modern browser. Without Gemini Nano it uses a simpler built-in filter that catches emails, phone numbers, ID numbers and names that follow a cue such as "Mr." or "Approved by". Names without a cue can slip through, and the page tells you when this filter was used.

To get Gemini Nano in desktop Chrome:

1. Open `chrome://flags/#optimization-guide-on-device-model` and choose **Enabled BypassPerfRequirement**.
2. Open `chrome://flags/#prompt-api-for-gemini-nano` and choose **Enabled**.
3. Relaunch Chrome and open Ghostline. Click **Redact** once to start the model download, then wait until the header reads **On-device · Gemini Nano**.

Chrome downloads the model once (a few GB) and needs about 22 GB of free disk space before it will start. You can follow the download at `chrome://on-device-internals`.

## Limits

- English contracts priced in USD.
- Plain text or CSV. Scanned PDFs and images are not supported.
- 40 market benchmarks across IT hardware, medical equipment, office supplies and classroom equipment.

## Run it yourself

Requires Node.js 18+ and a Firebase project with Firestore and Firebase AI Logic (Gemini Developer API) enabled.

```bash
npm install
cp .env.example .env        # fill in your Firebase web app config
npm run seed:benchmarks     # load the 40 benchmarks into Firestore
npm run dev                 # http://localhost:5173
```

Seed the benchmarks before deploying `firestore.rules`: the rules make `price_benchmarks` read-only, so the seed script is refused afterwards.

Without the Firebase values in `.env`, the app still runs: prices are then checked on your device against the built-in benchmark list, and the page says so.

| Command | What it does |
|---|---|
| `npm test` | Unit and pipeline tests |
| `npm run lint` | ESLint |
| `npm run build` | Production build in `dist/` |
| `firebase deploy --only hosting` | Publish `dist/` to Firebase Hosting |
| `firebase deploy --only firestore:rules` | Publish `firestore.rules` |

CSV uploads are read by column name. Use headers such as `Item`, `Specs`, `Qty` and `Unit Price`; other columns are redacted and ignored.

## Built with

React 18, Vite, Tailwind CSS · Chrome Prompt API (Gemini Nano) · Firebase AI Logic (Cloud Gemini), Firestore, App Check and Hosting.

Design decisions are documented in [DESIGN.md](DESIGN.md).
