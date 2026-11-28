const reviewFields = [
  ['brand', 'Part brand or code', () => 'Which part brand and code are included?'],
  ['labour', 'Separate labour charge', total => `How much of ${total} is for labour?`],
  ['warranty', 'Parts and workmanship warranty', () => 'What is covered for parts and workmanship, and for how long?'],
]

const enteredReviewFields = [
  ['workshop', 'Workshop name', () => 'What is the name of the workshop issuing this quotation?'],
  ['quantity', 'Quantity', () => 'How many of each part or service are included?'],
  reviewFields[0],
  ['condition', 'Part condition', () => 'Are the parts new, used or reconditioned?'],
  reviewFields[1],
  ['partsWarranty', 'Parts warranty', () => 'What does the parts warranty cover, and for how long?'],
  ['workmanshipWarranty', 'Workmanship warranty', () => 'Is the repair work covered, and for how long?'],
  ['itemised', 'Entered line items', () => 'Can you provide a breakdown of the charges, including any taxes and discounts?'],
]

export function describeField(field) {
  if (field?.unreadable) return { status: 'unreadable', display: 'Unreadable' }
  if (field?.value) return { status: 'stated', display: field.value }
  return { status: 'not-stated', display: 'Not stated' }
}

export function applyClarification(quotation, reply, verified) {
  if (verified !== true || quotation.clarification || !quotation.work?.value || !quotation.total?.value) {
    return quotation
  }
  return { ...quotation, clarification: reply }
}

export function reviewQuotation(quotation) {
  const work = quotation.work?.value
  const total = quotation.total?.value
  const unresolved = []
  if (!work) unresolved.push('Proposed work')
  if (!total) unresolved.push('Quoted total')
  if (unresolved.length) return { outcome: 'clearer-copy', unresolved }

  const questions = [quotation.ownerEntered
    ? `What did you find during the inspection that led to this recommendation: ${work}?`
    : 'What did you find during the brake inspection?']
  const fields = quotation.ownerEntered ? enteredReviewFields : reviewFields
  const details = fields.map(([key, name, question]) => {
    const original = describeField(quotation.details[key])
    const reply = quotation.clarification?.details[key]
    const field = reply ? describeField(reply) : original
    if (field.status !== 'stated') questions.push(question(total))
    if (reply && field.display !== original.display) return { name, ...field, previous: original.display }
    return { name, ...field }
  })
  const outcome = details.some(detail => detail.status === 'unreadable') ? 'partial' : 'review'
  const baseTitle = outcome === 'partial' ? 'Partial quotation review' : 'Quotation review'
  const title = quotation.clarification ? 'Revised ' + baseTitle.toLowerCase() : baseTitle
  const amountCheck = quotation.ownerEntered ? reconcileItemisedTotal(quotation) : null
  if (amountCheck && !amountCheck.matches) questions.splice(1, 0, 'Can you explain the difference between the line items and the quoted total?')
  return { outcome, title, work, total, details, questions, amountCheck }
}

export function recordWorkshopCheck({ issuer, listing, source, at = new Date().toISOString() }) {
  let status = 'Unable to verify'
  if (issuer?.name && issuer.contact && listing?.name && listing.contact) {
    status = issuer.name === listing.name && issuer.contact === listing.contact ? 'Checked' : 'Inconsistent'
  }
  return { status, source, issuer: issuer?.name, checkedAt: at }
}

export function reconcileItemisedTotal({ statedSen, chargesSen }) {
  if (!Number.isSafeInteger(statedSen) || !chargesSen?.length || !chargesSen.every(Number.isSafeInteger)) return null
  const calculatedSen = chargesSen.reduce((total, charge) => total + charge, 0)
  if (!Number.isSafeInteger(calculatedSen)) return null
  return { statedSen, calculatedSen, matches: statedSen === calculatedSen }
}

export function formatSen(sen) {
  return 'RM' + (sen / 100).toFixed(2)
}

export function formatReviewReport({ context, quotation, review, comparison, identityCheck }) {
  const reviewTitle = review.title
  const title = comparison ? 'Quotation comparison' : reviewTitle
  const lines = [
    `Mekaneed — ${title}`,
    quotation.ownerEntered ? 'Owner-entered quotation · Review based on entered information' : 'Fictional demo',
    '',
    `Vehicle: ${context.vehicle}`,
  ]
  if (context.symptoms) lines.push(`Owner notes: ${context.symptoms}`)
  lines.push(`Proposed work: ${review.work}`)
  if (comparison) {
    const [first, second] = comparison.quotes
    lines.push(
      `Quote A review status: ${reviewTitle}`,
      `Quote A total: ${first.total}`,
      `Quote B total: ${second.total}`,
      '',
      'Confirm the scope before comparing prices.',
      '',
      'WORK, CHARGES AND WARRANTY',
      ...comparison.rows.map(({ label, first, second, note }) =>
        `${label}: Quote A — ${first}; Quote B — ${second}` + (note ? ` (${note})` : ''),
      ),
    )
    comparison.amountChecks?.forEach((check, index) => {
      if (check) lines.push(`Quote ${index === 0 ? 'A' : 'B'} itemised sum: ${formatSen(check.calculatedSen)} (${check.matches ? 'matches' : 'differs from'} the stated total)`)
    })
  } else {
    lines.push(
      `Quoted total: ${review.total}`,
      '',
      'QUOTATION DETAILS',
      ...review.details.map(detail => `${detail.name}: ${detail.display}`),
    )
    if (review.amountCheck) {
      const { calculatedSen, matches } = review.amountCheck
      lines.push(`Sum of entered line items: ${formatSen(calculatedSen)} (${matches ? 'matches' : 'differs from'} the stated total)`)
    }
  }

  if (quotation.clarification) {
    const changes = review.details.filter(detail => detail.previous !== undefined)
    lines.push(
      '',
      'CHANGES AFTER WORKSHOP REPLY',
      ...changes.map(({ name, previous, display }) => `${name}: ${previous} → ${display}`),
    )
  }
  if (identityCheck) {
    lines.push('', 'WORKSHOP CHECK FOR QUOTE A', `${identityCheck.status} · Identity and contact only`)
    if (identityCheck.issuer) lines.push(`Workshop: ${identityCheck.issuer}`)
    lines.push(`Source: ${identityCheck.source}`, `Checked at: ${identityCheck.checkedAt}`)
  }
  const questions = comparison?.questions ?? review.questions
  lines.push(
    '',
    'QUESTIONS FOR THE WORKSHOP',
    ...questions.map((question, index) => `${index + 1}. ${question}`),
    '',
    'ORIGINAL QUOTE A',
    quotation.source,
  )
  if (quotation.clarification) {
    lines.push('', 'WORKSHOP REPLY FOR QUOTE A', quotation.clarification.source)
  }
  if (comparison) lines.push('', 'ORIGINAL QUOTE B', comparison.quotes[1].source)
  return { title, text: lines.join('\n') + '\n' }
}

const savedReviewKey = 'mekaneed.saved-review.v1'

function readStoredJSON(storage, key) {
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }
  return null
}

export function readSavedReview(storage) {
  const report = readStoredJSON(storage, savedReviewKey)
  return typeof report?.title === 'string' && typeof report.text === 'string' ? report : null
}

export function saveReview(storage, report) {
  storage.setItem(savedReviewKey, JSON.stringify(report))
}

export function createPilotCase({ id, sample, at = new Date().toISOString() }) {
  return {
    id,
    sample,
    status: 'received',
    history: [{ status: 'received', at, sample }],
  }
}

export const pilotTerms = { standardSen: 1490, expertSen: 6990, expertFeeSen: 4000, referralSen: 1500, minimumJobSen: 30000 }

export function sampleWorkshopMatch(area) {
  if (area !== 'kk') return null
  return {
    recipient: 'Sample Panel Workshop A',
    area: 'Kota Kinabalu',
    service: 'Front brake pad replacement',
    purpose: 'Request a quotation for the same repair',
    fields: ['Vehicle model and year', 'Repair description'],
  }
}

const pilotActivityTypes = ['offer', 'pay', 'decline', 'refund', 'consent', 'withdraw', 'referral']

export function pilotActivity(pilotCase) {
  const events = pilotCase.history.filter(event => pilotActivityTypes.includes(event.type))
  const has = type => events.some(event => event.type === type)
  const consent = events.findLast(event => event.type === 'consent' || event.type === 'withdraw')
  return {
    events, offered: has('offer'), paid: has('pay'), declined: has('decline'), refunded: has('refund'),
    activeConsent: consent?.type === 'consent' ? consent : null,
    referral: events.find(event => event.type === 'referral') ?? null,
  }
}

function appendPilotActivity(pilotCase, type, at, fields = {}) {
  return { ...pilotCase, history: [...pilotCase.history, { type, status: pilotCase.status, at, ...fields }] }
}

function recordPilotActivity(pilotCase, { type, at, area, consent, completedPaid, jobRef, amountSen }) {
  const { offered, paid, declined, refunded, activeConsent, referral } = pilotActivity(pilotCase)
  const awaitingDecision = offered && !paid && !declined
  if (type === 'offer' && !offered ||
      type === 'pay' && awaitingDecision ||
      type === 'decline' && awaitingDecision ||
      type === 'refund' && paid && !refunded) {
    return appendPilotActivity(pilotCase, type, at, { amountSen: pilotTerms.standardSen })
  }
  if (type === 'consent' && consent === true && !activeConsent && pilotCase.context) {
    const candidate = sampleWorkshopMatch(area)
    if (candidate) return appendPilotActivity(pilotCase, type, at, candidate)
  }
  if (type === 'withdraw' && activeConsent) {
    return appendPilotActivity(pilotCase, type, at, { recipient: activeConsent.recipient })
  }
  if (type === 'referral' && activeConsent && !referral && completedPaid === true &&
      typeof jobRef === 'string' && jobRef.trim() && Number.isSafeInteger(amountSen) && amountSen >= pilotTerms.minimumJobSen) {
    return appendPilotActivity(pilotCase, type, at, {
      jobRef: jobRef.trim().toUpperCase(), amountSen, feeSen: pilotTerms.referralSen,
      recipient: activeConsent.recipient,
    })
  }
  return pilotCase
}

export function advancePilotCase(pilotCase, event) {
  const { type, outcome, sample, context, identityCheck, at = new Date().toISOString() } = event
  if (type === 'deliver') return recordDelivery(pilotCase, { ...event, at })
  if (pilotActivityTypes.includes(type)) return recordPilotActivity(pilotCase, { ...event, at })

  let status
  const updates = {}
  if (type === 'start' && pilotCase.status === 'received') status = 'in-review'
  if (type === 'check' && pilotCase.status === 'in-review') {
    if (outcome === 'clearer-copy') status = 'awaiting-copy'
    if (outcome === 'review' || outcome === 'partial') status = 'awaiting-owner'
    if (identityCheck) updates.identityCheck = identityCheck
  }
  if (type === 'replace' && pilotCase.status === 'awaiting-copy' && sample) {
    status = 'in-review'
    updates.sample = sample
    updates.identityCheck = null
  }
  if (type === 'confirm-owner' && context && ['awaiting-owner', 'review-ready'].includes(pilotCase.status)) {
    status = 'review-ready'
    updates.context = { ...context }
  }
  if (type === 'clarify' && ['review-ready', 'delivered'].includes(pilotCase.status) && !pilotCase.replyApplied) {
    status = 'review-ready'
    updates.replyApplied = true
  }
  if (!status) return pilotCase
  return {
    ...pilotCase,
    ...updates,
    status,
    history: [...pilotCase.history, { type, status, at, ...updates }],
  }
}

function recordDelivery(pilotCase, { at, handlingMinutes, report }) {
  if (pilotCase.status !== 'review-ready' || !Number.isSafeInteger(handlingMinutes) || handlingMinutes < 1) {
    return pilotCase
  }
  if (typeof report?.title !== 'string' || !report.title.trim() ||
      typeof report.text !== 'string' || !report.text.trim()) return pilotCase
  const deliveries = pilotCase.deliveries ?? []
  const start = deliveries.length
    ? pilotCase.history.findLast(event => event.type === 'clarify')?.at
    : pilotCase.history[0].at
  const deliveredAt = Date.parse(at)
  const turnaroundMs = deliveredAt - Date.parse(start)
  if (!Number.isFinite(turnaroundMs) || turnaroundMs < 0) return pilotCase
  if (deliveredAt < Date.parse(pilotCase.history.at(-1).at)) return pilotCase

  const record = { at, handlingMinutes, turnaroundMs, report: { title: report.title, text: report.text } }
  return {
    ...pilotCase,
    status: 'delivered',
    deliveries: [...deliveries, record],
    history: [...pilotCase.history, { type: 'deliver', status: 'delivered', at }],
  }
}

const pilotCasePrefix = 'mekaneed.pilot-case.v1.'

export function savePilotCase(storage, pilotCase) {
  storage.setItem(pilotCasePrefix + pilotCase.id, JSON.stringify(pilotCase))
}

export function readPilotCase(storage, id) {
  const pilotCase = readStoredJSON(storage, pilotCasePrefix + id)
  return pilotCase?.id === id && Array.isArray(pilotCase.history) && pilotCase.history.length
    ? pilotCase
    : null
}

export function listPilotCases(storage) {
  const cases = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(pilotCasePrefix)) {
      const pilotCase = readPilotCase(storage, key.slice(pilotCasePrefix.length))
      if (pilotCase) cases.push(pilotCase)
    }
  }
  return cases.sort((a, b) => b.history.at(-1).at.localeCompare(a.history.at(-1).at))
}

export function summarizePilotCases(cases) {
  const totals = { offered: 0, paid: 0, refunded: 0, delivered: 0, paidDelivered: 0, referrals: 0, averageHandling: null }
  const jobRefs = new Set()
  let minutes = 0
  for (const caseRecord of cases) {
    const activity = pilotActivity(caseRecord)
    totals.offered += Number(activity.offered)
    totals.paid += Number(activity.paid)
    totals.refunded += Number(activity.refunded)
    if (activity.referral) jobRefs.add(activity.referral.jobRef)
    if (caseRecord.deliveries?.length) {
      totals.delivered++
      totals.paidDelivered += Number(activity.paid)
      minutes += caseRecord.deliveries.reduce((sum, item) => sum + item.handlingMinutes, 0)
    }
  }
  totals.referrals = jobRefs.size
  if (totals.delivered) totals.averageHandling = minutes / totals.delivered
  return totals
}

export function clearDemoData(storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
  for (const key of keys) {
    if (key === savedReviewKey || key?.startsWith(pilotCasePrefix)) storage.removeItem(key)
  }
}
