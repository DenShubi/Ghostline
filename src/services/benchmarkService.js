/**
 * Firestore read service for USD public procurement market price benchmarks.
 *
 * Consumed by the Cloud Audit Engine (`cloudAuditService.js`) to ground
 * markup calculations (+45% to +130% anomaly detection) against verified
 * market price ranges stored in the `price_benchmarks` collection.
 */

import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase.js'

export const BENCHMARKS_COLLECTION = 'price_benchmarks'

/**
 * @typedef {object} PriceBenchmark
 * @property {string} id - Deterministic Firestore document ID
 * @property {string} category - Procurement category (e.g. "IT Hardware")
 * @property {string} itemName - Standardized procurement item name
 * @property {number} fairPriceMin - Lower bound fair market price in USD
 * @property {number} fairPriceMax - Upper bound fair market price in USD
 * @property {number} fairPriceAvg - Average fair market price in USD
 * @property {string} unit - Pricing unit (e.g. "unit", "box", "set")
 * @property {string} sourceNote - Benchmark source reference
 */

/**
 * Map a Firestore QueryDocumentSnapshot into a typed PriceBenchmark object.
 *
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {PriceBenchmark}
 */
function mapBenchmarkDoc(docSnap) {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    category: data.category,
    itemName: data.itemName,
    fairPriceMin: data.fairPriceMin,
    fairPriceMax: data.fairPriceMax,
    fairPriceAvg: data.fairPriceAvg,
    unit: data.unit,
    sourceNote: data.sourceNote,
  }
}

/**
 * Fetch all market price benchmarks from Firestore `price_benchmarks`.
 *
 * @returns {Promise<PriceBenchmark[]>}
 */
export async function getAllBenchmarks() {
  const snapshot = await getDocs(collection(db, BENCHMARKS_COLLECTION))
  return snapshot.docs
    .map(mapBenchmarkDoc)
    .sort((a, b) => a.category.localeCompare(b.category) || a.itemName.localeCompare(b.itemName))
}

/**
 * Fetch market price benchmarks filtered by category.
 *
 * @param {string} category - Exact category name (e.g. "IT Hardware", "Medical Equipment")
 * @returns {Promise<PriceBenchmark[]>}
 */
export async function getBenchmarksByCategory(category) {
  if (!category || typeof category !== 'string') {
    return []
  }

  const benchmarksQuery = query(
    collection(db, BENCHMARKS_COLLECTION),
    where('category', '==', category.trim()),
  )
  const snapshot = await getDocs(benchmarksQuery)
  return snapshot.docs
    .map(mapBenchmarkDoc)
    .sort((a, b) => a.itemName.localeCompare(b.itemName))
}
