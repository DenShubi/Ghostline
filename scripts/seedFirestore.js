/**
 * Standalone Firestore seeding script for AuditZero USD market price benchmarks.
 *
 * Usage:
 *   npm run seed:benchmarks
 *   (runs `node --env-file=.env scripts/seedFirestore.js`)
 *
 * Uses deterministic document IDs derived from category + itemName so
 * re-running updates existing records in place without creating duplicates.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import {
  doc,
  getFirestore,
  serverTimestamp,
  terminate,
  writeBatch,
} from 'firebase/firestore'

const BENCHMARKS_COLLECTION = 'price_benchmarks'
const BATCH_LIMIT = 400

const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(
      `[seedFirestore] Missing required environment variables: ${missing.join(', ')}`,
    )
    console.error(
      '[seedFirestore] Copy .env.example to .env, fill in your Firebase project values, and re-run.',
    )
    process.exit(1)
  }
}

/**
 * Build a deterministic, URL-safe Firestore document ID from category and itemName.
 *
 * @param {string} category
 * @param {string} itemName
 * @returns {string}
 */
function createBenchmarkId(category, itemName) {
  const slugify = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  return `${slugify(category)}__${slugify(itemName)}`
}

async function main() {
  validateEnv()

  const dataPath = fileURLToPath(
    new URL('../src/data/seedBenchmarks.json', import.meta.url),
  )
  const raw = await readFile(dataPath, 'utf-8')
  const benchmarks = JSON.parse(raw)

  if (!Array.isArray(benchmarks) || benchmarks.length === 0) {
    throw new Error('seedBenchmarks.json must contain a non-empty JSON array.')
  }

  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  })

  const db = getFirestore(app)

  try {
    let written = 0

    for (let i = 0; i < benchmarks.length; i += BATCH_LIMIT) {
      const chunk = benchmarks.slice(i, i + BATCH_LIMIT)
      const batch = writeBatch(db)

      for (const item of chunk) {
        const docId = createBenchmarkId(item.category, item.itemName)
        const docRef = doc(db, BENCHMARKS_COLLECTION, docId)
        batch.set(
          docRef,
          {
            category: item.category,
            itemName: item.itemName,
            fairPriceMin: item.fairPriceMin,
            fairPriceMax: item.fairPriceMax,
            fairPriceAvg: item.fairPriceAvg,
            unit: item.unit,
            sourceNote: item.sourceNote,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      }

      await batch.commit()
      written += chunk.length
    }

    console.log(
      `[seedFirestore] Successfully seeded ${written} benchmarks into "${BENCHMARKS_COLLECTION}" (project: ${process.env.VITE_FIREBASE_PROJECT_ID}).`,
    )
  } finally {
    await terminate(db)
  }
}

main().catch((err) => {
  console.error('[seedFirestore] Failed to seed Firestore:', err)
  process.exit(1)
})
