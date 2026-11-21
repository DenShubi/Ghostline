/**
 * Helpers that turn (already redacted) contract text into the anonymous
 * handoff payload: { projectTitle, currency, items[] }.
 */

/** "$1,250.00" | "1250" | 1250 → 1250. Returns NaN when unparseable. */
export function parseMoney(value) {
  if (typeof value === 'number') return value
  const cleaned = String(value ?? '').replace(/[^\d.-]/g, '')
  return cleaned ? Number(cleaned) : NaN
}

/**
 * Pull a JSON object out of model output that may be wrapped in code fences
 * or prose. Returns null when nothing parses.
 */
export function cleanJSON(raw) {
  if (raw && typeof raw === 'object') return raw
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    try {
      // Common small-model slip: trailing commas.
      return JSON.parse(text.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'))
    } catch {
      return null
    }
  }
}

/** Keep only well-formed line items with positive numbers. */
export function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      itemName: String(item?.itemName ?? '').trim(),
      specs: String(item?.specs ?? '').trim(),
      quantity: Math.round(parseMoney(item?.quantity)),
      unitPrice: Math.round(parseMoney(item?.unitPrice) * 100) / 100,
    }))
    .filter((i) => i.itemName && i.quantity > 0 && i.unitPrice > 0)
}

export function buildPayload({ projectTitle, items }) {
  return {
    projectTitle: String(projectTitle ?? '').trim() || 'Untitled procurement',
    currency: 'USD',
    items: normalizeItems(items),
  }
}

const PRICE = /\$\s?(\d[\d,]*(?:\.\d+)?)/
const UNIT_PRICE = /(?:unit price|unit cost|price per unit|per unit|@|each)\s*:?\s*\$\s?(\d[\d,]*(?:\.\d+)?)/i
const QTY_LABEL = /(?:\bqty\.?|\bquantity|×|\bx)\s*:?\s*(\d[\d,]*)/i
const QTY_UNIT = /\b(\d[\d,]*)\s*(?:units?|pcs|pieces|boxes|sets|packs|reams|cases|kits|pairs)\b/i

/**
 * Line-based fallback extractor for when Gemini Nano is unavailable.
 * Handles lines like "Laptop 14-inch (i3, 8GB) - Qty: 500 - Unit price: $1,250.00".
 */
export function extractItemsHeuristic(text) {
  const items = []
  let projectTitle = ''

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const qty = line.match(QTY_LABEL) ?? line.match(QTY_UNIT)
    const price = line.match(UNIT_PRICE) ?? line.match(PRICE)

    if (!qty || !price) {
      if (!projectTitle && line.length <= 120 && !PRICE.test(line) && !line.includes('[REDACTED_')) {
        projectTitle = line.replace(/^(?:project|title|subject|re)\s*:\s*/i, '')
      }
      continue
    }

    const body = line.replace(/^(?:[-•*]|\d+[.)])\s*/, '')
    const nameEnd = body.search(/\s[-–—|]\s|[:,(]|\bqty\b|\bquantity\b|\$|\b\d[\d,]*\s*(?:units?|pcs)\b/i)
    const itemName = (nameEnd > 0 ? body.slice(0, nameEnd) : body).trim()
    const specs = body.match(/\(([^)]+)\)/)?.[1] ?? ''

    items.push({ itemName, specs, quantity: qty[1], unitPrice: price[1] })
  }

  return { projectTitle, items: normalizeItems(items) }
}
