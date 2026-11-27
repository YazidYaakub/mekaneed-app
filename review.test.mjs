import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewQuotation } from './review.mjs'

const rm450Quotation = {
  work: { value: 'Front brake pads and labour' },
  total: { value: 'RM450' },
  details: {},
}

test('The owner sees one RM450 total and omitted details are marked Not stated', () => {
  const review = reviewQuotation(rm450Quotation)
  assert.equal(review.outcome, 'review')
  assert.equal(review.total, 'RM450')
  assert.equal(review.work, 'Front brake pads and labour')
  assert.deepEqual(review.details.map(detail => detail.display), [
    'Not stated', 'Not stated', 'Not stated',
  ])
  assert.ok(review.questions.includes('How much of RM450 is for labour?'))
})

test('The owner gets a partial review when the warranty is unreadable and the total is clear', () => {
  const review = reviewQuotation({
    ...rm450Quotation,
    details: { warranty: { unreadable: true } },
  })
  assert.equal(review.outcome, 'partial')
  assert.equal(review.total, 'RM450')
  assert.deepEqual(review.details.map(detail => detail.display), [
    'Not stated', 'Not stated', 'Unreadable',
  ])
  assert.ok(review.questions.includes('What is covered for parts and workmanship, and for how long?'))
})

test('Unreadable work or an unreadable total prompts a clearer copy before a review', () => {
  for (const [field, name] of [['work', 'Proposed work'], ['total', 'Quoted total']]) {
    const result = reviewQuotation({ ...rm450Quotation, [field]: { unreadable: true } })
    assert.deepEqual(result, { outcome: 'clearer-copy', unresolved: [name] })
  }
})
