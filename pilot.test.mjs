import assert from 'node:assert/strict'
import test from 'node:test'
import { createPilotCase, advancePilotCase, listPilotCases, readPilotCase, savePilotCase } from './review.mjs'

const receivedAt = '2026-11-27T15:00:00Z'
const checkedAt = '2026-11-27T15:01:00Z'
const sampleCase = sample => createPilotCase({ id: 'case-001', sample, at: receivedAt })
const owner = { model: 'Perodua Myvi', year: '2018', variant: '', symptoms: '' }
const originalReport = { title: 'Quotation review', text: 'Fictional Quote A\nRM450' }

function readyCase() {
  const checking = advancePilotCase(sampleCase('legible'), { type: 'start', at: checkedAt })
  const handoff = advancePilotCase(checking, { type: 'check', outcome: 'review', at: checkedAt })
  return advancePilotCase(handoff, { type: 'confirm-owner', context: owner, at: checkedAt })
}

test('A received case goes to staff check and a readable partial quote can be handed to the owner', () => {
  const received = sampleCase('partial')
  assert.equal(received.status, 'received')
  assert.equal(advancePilotCase(received, { type: 'check', outcome: 'partial', at: checkedAt }), received)
  const inReview = advancePilotCase(received, { type: 'start', at: checkedAt })
  const ready = advancePilotCase(inReview, { type: 'check', outcome: 'partial', at: checkedAt })
  assert.equal(ready.status, 'awaiting-owner')
  assert.deepEqual(ready.history.map(event => event.status), ['received', 'in-review', 'awaiting-owner'])
})

test('An unreadable quote stays blocked until the clearer copy passes a new staff check', () => {
  const original = sampleCase('unclear')
  const checking = advancePilotCase(original, { type: 'start', at: checkedAt })
  const blocked = advancePilotCase(checking, { type: 'check', outcome: 'clearer-copy', at: checkedAt })
  assert.equal(blocked.status, 'awaiting-copy')
  assert.equal(advancePilotCase(blocked, { type: 'check', outcome: 'review', at: checkedAt }), blocked)
  const replaced = advancePilotCase(blocked, { type: 'replace', sample: 'legible', at: checkedAt })
  assert.equal(replaced.status, 'in-review')
  assert.equal(replaced.sample, 'legible')
  assert.equal(replaced.history[0].sample, 'unclear')
  assert.equal(advancePilotCase(replaced, { type: 'check', outcome: 'review', at: checkedAt }).status, 'awaiting-owner')
})

test('The queue reopens a confirmed review with its vehicle context and keeps other cases separate', () => {
  const entries = new Map()
  const openStorage = () => ({
    get length() { return entries.size },
    key: index => [...entries.keys()][index],
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  })
  const context = { model: 'Perodua Myvi', year: '2018', variant: '', symptoms: 'Front brake noise' }
  const received = sampleCase('partial')
  assert.equal(advancePilotCase(received, { type: 'confirm-owner', context, at: checkedAt }), received)
  const checking = advancePilotCase(received, { type: 'start', at: checkedAt })
  const awaitingOwner = advancePilotCase(checking, { type: 'check', outcome: 'partial', at: checkedAt })
  const reviewReady = advancePilotCase(awaitingOwner, { type: 'confirm-owner', context, at: checkedAt })
  const clarified = advancePilotCase(reviewReady, { type: 'clarify', at: checkedAt })
  savePilotCase(openStorage(), clarified)
  savePilotCase(openStorage(), createPilotCase({ id: 'case-002', sample: 'legible', at: receivedAt }))

  const reopened = readPilotCase(openStorage(), received.id)
  assert.equal(reopened.status, 'review-ready')
  assert.deepEqual(reopened.context, context)
  assert.equal(reopened.replyApplied, true)
  assert.equal(listPilotCases(openStorage()).length, 2)
})

test('Staff delivery records the report, turnaround and handling time once the review is ready', () => {
  const delivery = { type: 'deliver', at: '2026-11-27T15:09:00Z', handlingMinutes: 4, report: originalReport }
  const received = sampleCase('legible')
  assert.equal(advancePilotCase(received, delivery), received)

  const ready = readyCase()
  const delivered = advancePilotCase(ready, delivery)
  assert.equal(delivered.status, 'delivered')
  assert.deepEqual(delivered.deliveries, [{
    at: '2026-11-27T15:09:00Z',
    handlingMinutes: 4,
    turnaroundMs: 540_000,
    report: originalReport,
  }])
  assert.equal(delivered.history.at(-1).status, 'delivered')
  assert.equal(advancePilotCase(delivered, delivery), delivered)
})

test('A clarification after delivery produces a second record while preserving the original', () => {
  const delivered = advancePilotCase(readyCase(), {
    type: 'deliver', at: '2026-11-27T15:09:00Z', handlingMinutes: 4, report: originalReport,
  })
  const revised = advancePilotCase(delivered, { type: 'clarify', at: '2026-11-27T15:20:00Z' })
  assert.equal(revised.status, 'review-ready')
  assert.equal(revised.deliveries.length, 1)

  const revisedReport = { title: 'Revised quotation review', text: 'Fictional Quote A\nRM450\nWorkshop reply' }
  const completed = advancePilotCase(revised, {
    type: 'deliver', at: '2026-11-27T15:25:00Z', handlingMinutes: 2, report: revisedReport,
  })
  assert.equal(completed.status, 'delivered')
  assert.deepEqual(completed.deliveries.map(item => [item.report.title, item.turnaroundMs]), [
    ['Quotation review', 540_000],
    ['Revised quotation review', 300_000],
  ])
  assert.equal(completed.deliveries[0].report.text, originalReport.text)
  assert.equal(advancePilotCase(completed, { type: 'clarify', at: checkedAt }), completed)
})

test('Invalid handling time and out-of-order timestamps leave a delivery unrecorded', () => {
  const ready = readyCase()
  const event = { type: 'deliver', at: '2026-11-27T15:02:00Z', handlingMinutes: 1, report: originalReport }
  for (const handlingMinutes of [0, -1, 0.5, NaN]) {
    assert.equal(advancePilotCase(ready, { ...event, handlingMinutes }), ready)
  }
  assert.equal(advancePilotCase(ready, { ...event, at: receivedAt }), ready)
})
