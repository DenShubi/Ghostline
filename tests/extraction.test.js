import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanJSON, extractItemsHeuristic, normalizeItems, parseMoney } from '../src/utils/itemExtraction.js'
import { csvToItems, looksLikeCSV, parseCSV } from '../src/utils/csvParser.js'
import { redactText } from '../src/utils/redaction.js'
import { IT_CONTRACT } from './fixtures.js'

test('heuristic extractor reads the three line-item styles', () => {
  const { projectTitle, items } = extractItemsHeuristic(redactText(IT_CONTRACT).redactedText)
  assert.equal(projectTitle, 'Public School IT Infrastructure Procurement')
  assert.deepEqual(items, [
    { itemName: 'Standard Student Laptop 14-inch', specs: 'Intel Core i3, 8GB RAM, 256GB SSD', quantity: 500, unitPrice: 1250 },
    { itemName: '24-inch Monitor', specs: '1080p IPS', quantity: 120, unitPrice: 232 },
    { itemName: 'Ergonomic Office Chair', specs: '', quantity: 40, unitPrice: 180 },
  ])
})

test('cleanJSON recovers fenced, prose-wrapped and trailing-comma output', () => {
  assert.deepEqual(cleanJSON('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(cleanJSON('Sure! Here it is: {"items":[{"x":1},]} hope that helps'), { items: [{ x: 1 }] })
  assert.equal(cleanJSON('no json here'), null)
})

test('normalizeItems coerces money strings and drops broken rows', () => {
  assert.equal(parseMoney('$1,250.50'), 1250.5)
  assert.deepEqual(
    normalizeItems([
      { itemName: ' Mask ', quantity: '1,000', unitPrice: '$0.42' },
      { itemName: '', quantity: 1, unitPrice: 1 },
      { itemName: 'Free thing', quantity: 3, unitPrice: 0 },
    ]),
    [{ itemName: 'Mask', specs: '', quantity: 1000, unitPrice: 0.42 }],
  )
})

test('CSV with quoted fields and recognised headers maps to items', () => {
  const csv = 'Item,Specs,Qty,Unit Price (USD),Requested By\r\n"Infrared Thermometer","Non-contact, 1s read",200,"$74.00",Dr. Ana Ruiz\r\nSurgical Masks (Box of 50),3-ply,1500,$12.60,EMP-55120\r\n'
  assert.ok(looksLikeCSV(csv))
  assert.equal(parseCSV(csv)[1][1], 'Non-contact, 1s read')
  assert.deepEqual(csvToItems(csv), [
    { itemName: 'Infrared Thermometer', specs: 'Non-contact, 1s read', quantity: 200, unitPrice: 74 },
    { itemName: 'Surgical Masks (Box of 50)', specs: '3-ply', quantity: 1500, unitPrice: 12.6 },
  ])
})

test('CSV without usable headers returns null so the model can take over', () => {
  assert.equal(csvToItems('a,b,c\n1,2,3'), null)
  assert.equal(looksLikeCSV('Just a normal sentence, with a comma.'), false)
})
