import test from 'node:test'
import assert from 'node:assert/strict'
import { enterQuotation, enterReply } from './quotation-input.mjs'
import { applyClarification, formatReviewReport, reviewQuotation } from './review.mjs'
import { compareQuotations } from './comparison.mjs'

const input = {
  source: 'Overhaul air-conditioning circuit. Labour listed separately.',
  work: 'Air-conditioning overhaul',
  total: 'RM 1,240.50',
}

test('an owner-entered quotation retains its source and distinguishes unknowns and itemised charges', () => {
  const { quotation } = enterQuotation({
    ...input, labour: 'RM250', brand: '?', partsWarranty: '3 months',
    charges: 'Parts and refrigerant | 1,000.50\nLabour | 250\nDiscount | -10',
  })
  const review = reviewQuotation(quotation)
  assert.equal(quotation.source, input.source)
  assert.equal(review.total, 'RM1240.50')
  assert.equal(review.outcome, 'partial')
  assert.equal(review.amountCheck.matches, true)
  assert.ok(review.details.some(detail => detail.name === 'Part brand or code' && detail.display === 'Unreadable'))
  assert.ok(review.details.some(detail => detail.name === 'Workmanship warranty' && detail.display === 'Not stated'))
  assert.ok(review.questions.some(question => question.includes('Air-conditioning overhaul')))
})

test('a review requires a readable work description and a valid total and rejects malformed charges', () => {
  assert.equal(enterQuotation({ ...input, work: '?' }).field, 'work')
  assert.equal(enterQuotation({ ...input, total: '12,40.50' }).field, 'total')
  assert.equal(enterQuotation({ ...input, total: '12.505' }).field, 'total')
  assert.equal(enterQuotation({ ...input, charges: 'Labour | unknown' }).field, 'charges')
  assert.match(enterQuotation({ ...input, charges: 'Labour | 20\nTax' }).error, /Line 2/)
})

test('a confirmed comparison keeps both sources, shows work and separate warranties and reports differences', () => {
  const { quotation: first } = enterQuotation({ ...input, charges: 'Parts | 980\nLabour | 250' })
  const { quotation: second } = enterQuotation({
    ...input, source: 'Parts and labour with an extra filter, RM1320.',
    work: 'Air-conditioning overhaul and filter', total: '1320', partsWarranty: '6 months',
  })
  assert.equal(compareQuotations(first, second, { sameVehicle: true }).outcome, 'confirmation-needed')
  const result = compareQuotations(first, second, { sameVehicle: true, sameRepair: true })
  assert.ok(result.rows.some(row => row.first === 'Air-conditioning overhaul' && row.second.endsWith('and filter')))
  assert.ok(result.rows.some(row => row.label === 'Parts warranty' && row.second === '6 months'))
  assert.ok(result.rows.some(row => row.first.includes('Parts') && row.second === 'Not stated'))
  assert.equal(result.amountChecks[0].calculatedSen, 123000)
  assert.equal(result.amountChecks[0].matches, false)
  assert.deepEqual(result.quotes.map(quote => quote.source), [first.source, second.source])
})

test('a workshop reply updates entered details while the exported review retains the original', () => {
  const { quotation } = enterQuotation({ ...input, partsWarranty: '?' })
  const { reply } = enterReply({ source: 'Parts carry a six-month warranty.', partsWarranty: '6 months' })
  const revised = applyClarification(quotation, reply, true)
  const review = reviewQuotation(revised)
  assert.ok(review.details.some(detail => detail.display === '6 months' && detail.previous === 'Unreadable'))
  assert.equal(reviewQuotation(quotation).outcome, 'partial')
  const report = formatReviewReport({ context: { vehicle: '2018 Perodua Myvi' }, quotation: revised, review })
  assert.match(report.text, /Owner-entered quotation/)
  assert.doesNotMatch(report.text, /Fictional demo/)
  assert.ok(report.text.includes(input.source) && report.text.includes(reply.source))
  assert.equal(enterReply({ source: 'Only a message' }).field, 'source')
})
