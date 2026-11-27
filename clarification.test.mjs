import assert from 'node:assert/strict'
import test from 'node:test'
import { compareQuotations } from './comparison.mjs'
import { applyClarification, formatReviewReport, reviewQuotation } from './review.mjs'

const original = {
  source: 'Front brake pads and labour RM450\nWarranty: [line blurred]',
  work: { value: 'Front brake pads and labour' },
  total: { value: 'RM450' },
  combinedPartsAndLabour: true,
  details: { warranty: { unreadable: true } },
}
const reply = {
  source: 'Aftermarket pads code FP-450A. RM100 labour included in RM450. Parts warranty 3 months. Workmanship warranty 30 days.',
  details: {
    brand: { value: 'Aftermarket · code FP-450A' },
    labour: { value: 'RM100 included in RM450' },
    warranty: { value: 'Parts 3 months · Workmanship 30 days' },
    partsWarranty: { value: '3 months' },
    workmanshipWarranty: { value: '30 days' },
  },
}

test('A checked reply resolves the missing details without changing the original quote or total', () => {
  const revised = applyClarification(original, reply, true)
  const review = reviewQuotation(revised)
  assert.equal(revised.source, original.source)
  assert.deepEqual(revised.details, { warranty: { unreadable: true } })
  assert.equal(review.total, 'RM450')
  assert.equal(review.outcome, 'review')
  assert.deepEqual(review.details.map(({ previous, display }) => [previous, display]), [
    ['Not stated', 'Aftermarket · code FP-450A'],
    ['Not stated', 'RM100 included in RM450'],
    ['Unreadable', 'Parts 3 months · Workmanship 30 days'],
  ])
  assert.deepEqual(review.questions, ['What did you find during the brake inspection?'])
  assert.equal(reviewQuotation(original).outcome, 'partial')
})

test('A revision needs a checked reply and a readable original, and only one reply can be applied', () => {
  const unreadable = { ...original, total: { unreadable: true } }
  assert.equal(applyClarification(original, reply, false), original)
  assert.equal(applyClarification(unreadable, reply, true), unreadable)
  const revised = applyClarification(original, reply, true)
  assert.equal(applyClarification(revised, { ...reply, source: 'Another reply' }, true), revised)
})

test('An exported revision records the changes and keeps the two sources distinct', () => {
  const revised = applyClarification(original, reply, true)
  const report = formatReviewReport({
    context: { vehicle: '2018 Perodua Myvi' },
    quotation: revised,
    review: reviewQuotation(revised),
  })
  assert.equal(report.title, 'Revised quotation review')
  assert.match(report.text, /Part brand or code: Not stated → Aftermarket · code FP-450A/)
  assert.match(report.text, /Parts and workmanship warranty: Unreadable → Parts 3 months · Workmanship 30 days/)
  assert.ok(report.text.includes('ORIGINAL QUOTE A\n' + original.source))
  assert.ok(report.text.includes('WORKSHOP REPLY FOR QUOTE A\n' + reply.source))
})

test('The comparison uses the clarification for Quote A and keeps both original quotes', () => {
  const revised = applyClarification(original, reply, true)
  const second = {
    source: 'Front brake pads RM370. Labour RM130. Brake cleaning RM50. Total RM550.',
    total: { value: 'RM550' },
    details: { partsWarranty: { value: '6 months' } },
  }
  const comparison = compareQuotations(revised, second, { sameVehicle: true, sameRepair: true })
  assert.deepEqual(comparison.rows.slice(-2).map(row => [row.first, row.second]), [
    ['3 months', '6 months'],
    ['30 days', 'Not stated'],
  ])
  assert.equal(comparison.quotes[0].source, original.source)
  const report = formatReviewReport({
    context: { vehicle: '2018 Perodua Myvi' },
    quotation: revised,
    review: reviewQuotation(revised),
    comparison,
  })
  assert.ok(report.text.includes('ORIGINAL QUOTE B\n' + second.source))
  assert.ok(report.text.includes('WORKSHOP REPLY FOR QUOTE A\n' + reply.source))
  assert.match(report.text, /Quote A total: RM450\nQuote B total: RM550/)
})
