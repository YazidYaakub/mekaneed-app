import assert from 'node:assert/strict'
import test from 'node:test'
import { compareQuotations } from './comparison.mjs'

const quoteA = {
  source: 'Front brake pads and labour RM450',
  work: { value: 'Front brake pads and labour' },
  total: { value: 'RM450' },
  combinedPartsAndLabour: true,
  details: {},
}
const quoteB = {
  source: 'Front brake pads RM370. Labour RM130. Brake cleaning RM50. Total RM550.',
  work: { value: 'Front brake pad replacement and brake cleaning' },
  total: { value: 'RM550' },
  details: {
    pads: { value: 'RM370' },
    brand: { value: 'Aftermarket · code FP-218' },
    labour: { value: 'RM130' },
    cleaning: { value: 'RM50' },
    partsWarranty: { value: '6 months' },
  },
}
const confirmed = { sameVehicle: true, sameRepair: true }

test('Both vehicle and repair must be confirmed before the owner can compare quotes', () => {
  for (const confirmation of [
    {},
    { sameVehicle: true, sameRepair: false },
    { sameVehicle: false, sameRepair: true },
  ]) {
    assert.deepEqual(compareQuotations(quoteA, quoteB, confirmation), {
      outcome: 'confirmation-needed',
    })
  }
})

test('The comparison preserves the original order, totals and quotation sources', () => {
  const comparison = compareQuotations(quoteA, quoteB, confirmed)
  assert.equal(comparison.outcome, 'comparison')
  assert.deepEqual(comparison.quotes, [
    { total: 'RM450', source: 'Front brake pads and labour RM450' },
    { total: 'RM550', source: 'Front brake pads RM370. Labour RM130. Brake cleaning RM50. Total RM550.' },
  ])
})

test('Matched and unmatched work, part specifications, charges and warranties are visible together', () => {
  const comparison = compareQuotations(quoteA, quoteB, confirmed)
  assert.deepEqual(comparison.rows.map(row => [row.label, row.first, row.second, row.note]), [
    ['Front brake pads', 'Included in RM450 lump sum', 'RM370', undefined],
    ['Part brand or code', 'Not stated', 'Aftermarket · code FP-218', undefined],
    ['Labour', 'Included in RM450 lump sum', 'RM130', undefined],
    ['Brake cleaning', 'Not stated', 'RM50', 'Only listed in Quote B'],
    ['Parts warranty', 'Not stated', '6 months', undefined],
    ['Workmanship warranty', 'Not stated', 'Not stated', undefined],
  ])
  assert.ok(comparison.questions.includes('Does Quote A include brake cleaning?'))
})

test('An unreadable warranty on Quote A stays unreadable in the comparison', () => {
  const partial = { ...quoteA, details: { warranty: { unreadable: true } } }
  const comparison = compareQuotations(partial, quoteB, confirmed)
  const warranties = comparison.rows.filter(row => row.label.endsWith('warranty'))
  assert.deepEqual(warranties.map(row => [row.first, row.second]), [
    ['Unreadable', '6 months'],
    ['Unreadable', 'Not stated'],
  ])
})
