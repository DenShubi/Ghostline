import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { runLocalPipeline } from '../src/services/localPipeline.js'
import { IT_CONTRACT } from './fixtures.js'

const RAW_PII = ['John Miller', 'Miller', 'EMP-48213', 'Sarah Lee', '198203142010', 'j.miller@district.gov', '013-2244', 'Budi Santoso']
const CONTRACT = `${IT_CONTRACT}\nSupplier contact: Budi Santoso, PT Sinar Komputer.`

/** Fake Prompt API that records every prompt it receives. */
function installFakeNano({ failExtraction = false } = {}) {
  const prompts = []
  const makeSession = (system) => ({
    async prompt(input, opts) {
      prompts.push({ system, input, constrained: Boolean(opts?.responseConstraint) })
      if (system.startsWith('You find personal data')) {
        return JSON.stringify({ entities: [{ text: 'John Miller', type: 'NAME' }, { text: 'Budi Santoso', type: 'NAME' }] })
      }
      if (failExtraction) throw new Error('model crashed')
      return '```json\n' + JSON.stringify({
        projectTitle: 'School IT Procurement',
        items: [{ itemName: 'Student Laptop 14-inch', specs: 'i3, 8GB, 256GB', quantity: 500, unitPrice: 1250 }],
      }) + '\n```'
    },
    clone() { return makeSession(system) },
    destroy() {},
  })
  globalThis.LanguageModel = {
    availability: async () => 'available',
    create: async ({ initialPrompts }) => makeSession(initialPrompts[0].content),
  }
  return prompts
}

afterEach(() => { delete globalThis.LanguageModel })

test('nano path: model entities + regex net, payload carries no PII', async () => {
  const prompts = installFakeNano()
  const stages = []
  const res = await runLocalPipeline(CONTRACT, { onStage: (s) => stages.push(s) })

  assert.equal(res.engine, 'nano')
  assert.deepEqual(stages, ['redacting', 'extracting'])
  assert.ok(prompts.every((p) => p.constrained), 'uses JSON schema constraint')

  const extractionInputs = prompts.filter((p) => p.system.startsWith('You convert')).map((p) => p.input).join('\n')
  for (const pii of RAW_PII) {
    assert.ok(!extractionInputs.includes(pii), `extraction prompt saw ${pii}`)
    assert.ok(!JSON.stringify(res.payload).includes(pii), `payload leaked ${pii}`)
  }
  assert.deepEqual(res.payload, {
    projectTitle: 'School IT Procurement',
    currency: 'USD',
    items: [{ itemName: 'Student Laptop 14-inch', specs: 'i3, 8GB, 256GB', quantity: 500, unitPrice: 1250 }],
  })
  assert.ok(res.segments.some((s) => s.kind === 'redacted'))
})

test('nano extraction failure falls back to the line parser', async () => {
  installFakeNano({ failExtraction: true })
  const res = await runLocalPipeline(CONTRACT)
  assert.equal(res.engine, 'nano')
  assert.equal(res.payload.items.length, 3)
})

test('no Prompt API: basic filter still redacts structured PII and extracts items', async () => {
  const res = await runLocalPipeline(IT_CONTRACT)
  assert.equal(res.engine, 'fallback')
  assert.equal(res.payload.items.length, 3)
  for (const pii of RAW_PII.slice(0, 7)) assert.ok(!JSON.stringify(res).includes(pii), `leaked ${pii}`)
})

test('CSV input uses column mapping, not the model', async () => {
  const prompts = installFakeNano()
  const csv = 'Item,Qty,Unit Price,Requested By\nInfrared Thermometer,200,$74.00,Dr. Ana Ruiz\n'
  const res = await runLocalPipeline(csv)
  assert.deepEqual(res.payload.items, [{ itemName: 'Infrared Thermometer', specs: '', quantity: 200, unitPrice: 74 }])
  assert.ok(!prompts.some((p) => p.system.startsWith('You convert')))
  assert.ok(!JSON.stringify(res).includes('Ana Ruiz'))
})

test('model still downloading: basic filter runs at once and never waits on create()', async () => {
  let created = 0
  globalThis.LanguageModel = {
    availability: async () => 'downloading',
    create: async () => { created++; return new Promise(() => {}) },
  }
  const res = await runLocalPipeline(IT_CONTRACT)
  assert.equal(created, 0)
  assert.equal(res.engine, 'fallback')
  assert.equal(res.engineReason, 'downloading')
  assert.equal(res.payload.items.length, 3)
})

test('a hanging model times out and falls back instead of spinning forever', async () => {
  globalThis.LanguageModel = {
    availability: async () => 'available',
    create: async () => ({ prompt: () => new Promise(() => {}), destroy() {} }),
  }
  const res = await runLocalPipeline(IT_CONTRACT, { nanoTimeoutMs: 50 })
  assert.equal(res.engine, 'fallback')
  assert.equal(res.engineReason, 'timeout')
  assert.ok(!JSON.stringify(res.payload).includes('John Miller'))
})
