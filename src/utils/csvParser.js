import { normalizeItems } from './itemExtraction.js'

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  return rows
}

const HEADER_MAP = {
  itemName: /^(item|item name|description|item description|product|goods)$/i,
  specs: /^(spec|specs|specification|specifications|details)$/i,
  quantity: /^(qty|quantity|units|volume)$/i,
  unitPrice: /^(unit price|price|unit cost|price per unit|unit price \(usd\)|price \(usd\))$/i,
}

export function looksLikeCSV(text) {
  const rows = parseCSV(text.split('\n').slice(0, 5).join('\n'))
  return rows.length >= 2 && rows[0].length >= 3 && rows.every((r) => r.length === rows[0].length)
}

/**
 * Deterministic line items from a CSV with recognisable headers.
 * Returns null when the columns can't be mapped, so the caller can fall back
 * to model extraction.
 */
export function csvToItems(text) {
  const [header, ...rows] = parseCSV(text)
  if (!header) return null

  const col = {}
  header.forEach((name, i) => {
    for (const [key, re] of Object.entries(HEADER_MAP)) {
      if (col[key] === undefined && re.test(name.trim())) col[key] = i
    }
  })
  if (col.itemName === undefined || col.quantity === undefined || col.unitPrice === undefined) return null

  return normalizeItems(
    rows.map((r) => ({
      itemName: r[col.itemName],
      specs: col.specs !== undefined ? r[col.specs] : '',
      quantity: r[col.quantity],
      unitPrice: r[col.unitPrice],
    })),
  )
}
