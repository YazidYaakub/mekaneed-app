import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advancePilotCase, createPilotCase, pilotActivity, recordWorkshopCheck, reviewQuotation,
  clearDemoData, formatReviewReport, reconcileItemisedTotal, sampleWorkshopMatch,
  summarizePilotCases,
} from './review.mjs'

const issuer = { name: 'Sample Quote Workshop', contact: '0184' }
const at = '2026-11-27T15:00:00Z'

test('Identity outcomes record the sample reference and date and appear in the quotation report', () => {
  const matching = recordWorkshopCheck({ issuer, listing: issuer, source: 'Sample directory', at })
  const different = recordWorkshopCheck({ issuer, listing: { ...issuer, contact: '0421' }, source: 'Sample directory', at })
  const unavailable = recordWorkshopCheck({ issuer, listing: null, source: 'Sample directory', at })
  assert.deepEqual([matching.status, different.status, unavailable.status], ['Checked', 'Inconsistent', 'Unable to verify'])
  assert.equal(matching.checkedAt, at)
  const quotation = {
    source: 'Front brake pads and labour RM450',
    work: { value: 'Front brake pads and labour' }, total: { value: 'RM450' }, details: {},
  }
  const { text } = formatReviewReport({
    context: { vehicle: '2018 Perodua Myvi' }, quotation,
    review: reviewQuotation(quotation), identityCheck: different,
  })
  assert.match(text, /Identity and contact only/)
  assert.match(text, /Inconsistent/)
  assert.match(text, /Sample directory/)
  assert.match(text, /2026-11-27/)
})

test('Itemised amounts can reveal a mismatch while a lump sum is left intact', () => {
  assert.equal(reconcileItemisedTotal({ statedSen: 45000 }), null)
  assert.equal(reconcileItemisedTotal({ statedSen: 55000, chargesSen: [37000, null, 5000] }), null)
  assert.deepEqual(reconcileItemisedTotal({ statedSen: 55000, chargesSen: [37000, 13000, 4000] }), {
    statedSen: 55000, calculatedSen: 54000, matches: false,
  })
})

test('Pilot counts use unique cases and clearing demo data preserves unrelated browser data', () => {
  const base = createPilotCase({ id: 'demo-3', sample: 'legible', at })
  const paid = advancePilotCase(advancePilotCase(base, { type: 'offer', at }), { type: 'pay', at })
  const refunded = advancePilotCase(paid, { type: 'refund', at })
  const summary = summarizePilotCases([{ ...refunded, deliveries: [{ handlingMinutes: 4 }, { handlingMinutes: 2 }] }])
  assert.deepEqual(summary, { offered: 1, paid: 1, refunded: 1, delivered: 1, paidDelivered: 1, referrals: 0, averageHandling: 6 })
  const entries = new Map([
    ['other-app', 'keep'], ['mekaneed.saved-review.v1', 'fixture'], ['mekaneed.pilot-case.v1.demo-3', 'fixture'],
  ])
  clearDemoData({
    get length() { return entries.size },
    key: index => [...entries.keys()][index],
    removeItem: key => entries.delete(key),
  })
  assert.deepEqual([...entries.keys()], ['other-app'])
})

test('Sample standard payments, refunds and declines require an offer and stay distinct', () => {
  const base = createPilotCase({ id: 'demo-1', sample: 'legible', at })
  assert.equal(advancePilotCase(base, { type: 'pay', at }), base)
  const offered = advancePilotCase(base, { type: 'offer', at })
  const paid = advancePilotCase(offered, { type: 'pay', at })
  const refunded = advancePilotCase(paid, { type: 'refund', at })
  assert.deepEqual(pilotActivity(refunded).events.map(event => [event.type, event.amountSen]), [
    ['offer', 1490], ['pay', 1490], ['refund', 1490],
  ])
  assert.equal(advancePilotCase(refunded, { type: 'pay', at }), refunded)
  assert.equal(advancePilotCase(refunded, { type: 'refund', at }), refunded)
  const declined = advancePilotCase(offered, { type: 'decline', at })
  assert.equal(pilotActivity(declined).paid, false)
  assert.equal(pilotActivity(declined).declined, true)
})

test('A sample referral needs an eligible match, active consent and an attributable paid job', () => {
  const caseRecord = createPilotCase({ id: 'demo-2', sample: 'legible', at })
  const checking = advancePilotCase(caseRecord, { type: 'start', at })
  const handoff = advancePilotCase(checking, { type: 'check', outcome: 'review', at })
  const ready = advancePilotCase(handoff, { type: 'confirm-owner', context: { model: 'Perodua Myvi' }, at })
  const job = { type: 'referral', completedPaid: true, jobRef: 'DEMO-JOB-001', amountSen: 45000, at }
  assert.equal(sampleWorkshopMatch('other'), null)
  assert.equal(advancePilotCase(ready, job), ready)
  assert.equal(advancePilotCase(ready, { type: 'consent', area: 'kk', consent: false, at }), ready)
  assert.equal(advancePilotCase(ready, { type: 'consent', area: 'other', consent: true, at }), ready)
  const consented = advancePilotCase(ready, { type: 'consent', area: 'kk', consent: true, at })
  assert.deepEqual(pilotActivity(consented).activeConsent.fields, ['Vehicle model and year', 'Repair description'])
  assert.equal(advancePilotCase(consented, { ...job, amountSen: 29999 }), consented)
  assert.equal(advancePilotCase(consented, { ...job, completedPaid: false }), consented)
  const withdrawn = advancePilotCase(consented, { type: 'withdraw', at })
  assert.equal(advancePilotCase(withdrawn, job), withdrawn)
  const referred = advancePilotCase(consented, job)
  assert.equal(pilotActivity(referred).referral.feeSen, 1500)
  assert.equal(advancePilotCase(referred, job), referred)
})
