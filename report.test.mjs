import assert from 'node:assert/strict'
import test from 'node:test'
import { compareQuotations } from './comparison.mjs'
import { formatReviewReport, readSavedReview, reviewQuotation, saveReview } from './review.mjs'

const quotation = {
  source: 'Front brake pads and labour RM450\nWarranty: [line blurred]',
  work: { value: 'Front brake pads and labour' },
  total: { value: 'RM450' },
  details: { warranty: { unreadable: true } },
}
const reportInput = {
  context: { vehicle: '2018 Perodua Myvi', symptoms: 'Front brakes squeal during braking.' },
  quotation,
  review: reviewQuotation(quotation),
}

test('The report retains the verified total, original wording and unresolved details', () => {
  const report = formatReviewReport(reportInput)
  assert.equal(report.title, 'Partial quotation review')
  assert.match(report.text, /^Mekaneed — Partial quotation review/m)
  assert.match(report.text, /Fictional demo/)
  assert.match(report.text, /Vehicle: 2018 Perodua Myvi/)
  assert.match(report.text, /Quoted total: RM450/)
  assert.match(report.text, /Separate labour charge: Not stated/)
  assert.match(report.text, /Parts and workmanship warranty: Unreadable/)
  assert.ok(report.text.includes(quotation.source))
  assert.match(report.text, /How much of RM450 is for labour\?/)
})

test('The comparison report keeps both source quotes, scope differences and clarification questions', () => {
  const second = {
    source: 'Front pads RM370. Labour RM130. Brake cleaning RM50. Total RM550.',
    total: { value: 'RM550' },
    details: { cleaning: { value: 'RM50' } },
  }
  const comparison = compareQuotations(quotation, second, { sameVehicle: true, sameRepair: true })
  const report = formatReviewReport({ ...reportInput, comparison })
  assert.equal(report.title, 'Quotation comparison')
  assert.match(report.text, /Quote A total: RM450\nQuote B total: RM550/)
  assert.match(report.text, /Brake cleaning: Quote A — Not stated; Quote B — RM50 \(Only listed in Quote B\)/)
  assert.match(report.text, /Confirm the scope before comparing prices\./)
  assert.match(report.text, /Does Quote A include brake cleaning\?/)
  assert.ok(report.text.includes(quotation.source))
  assert.ok(report.text.includes(second.source))
})

test('A saved review opens as the same report from a new page', () => {
  const entries = new Map()
  const openStorage = () => ({
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  })
  assert.equal(readSavedReview(openStorage()), null)
  const report = formatReviewReport(reportInput)
  saveReview(openStorage(), report)
  assert.deepEqual(readSavedReview(openStorage()), report)

  const newReport = formatReviewReport({ ...reportInput, context: { vehicle: '2020 Perodua Myvi' } })
  saveReview(openStorage(), newReport)
  assert.deepEqual(readSavedReview(openStorage()), newReport)
})
