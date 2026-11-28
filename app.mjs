import {
  advancePilotCase, applyClarification, clearDemoData, createPilotCase, formatReviewReport,
  formatSen, listPilotCases, pilotActivity, pilotTerms, readPilotCase, readSavedReview,
  recordWorkshopCheck, reviewQuotation, sampleWorkshopMatch, savePilotCase, saveReview, summarizePilotCases,
} from './review.mjs'
import { compareQuotations } from './comparison.mjs'
import { enterQuotation, enterReply } from './quotation-input.mjs'

const message = 'Front brake pads and labour RM450'
const work = { value: 'Front brake pads and labour' }
const total = { value: 'RM450' }
const quoteIssuer = { name: 'Sample Quote Workshop', contact: '0184' }
const directoryExamples = {
  matching: { listing: quoteIssuer, source: 'Fictional directory · matching workshop name and contact ending 0184.' },
  different: {
    listing: { ...quoteIssuer, contact: '0421' },
    source: 'Fictional directory · listed contact ends in 0421. Quote A shows 0184.',
  },
  missing: { listing: null, source: 'Fictional directory · searched by workshop name. No usable listing found.' },
}
const unreadable = { unreadable: true }
const readableQuote = { source: message, work, total, combinedPartsAndLabour: true, details: {} }
const samples = {
  legible: readableQuote,
  partial: {
    ...readableQuote,
    source: message + '\nWarranty: [line blurred]',
    details: { warranty: unreadable },
  },
  unclear: {
    source: '[Proposed work blurred]\n[Total blurred]',
    work: unreadable,
    total: unreadable,
    details: {},
  },
}
const secondQuote = {
  source: [
    'Front brake pads (aftermarket, code FP-218) RM370',
    'Labour RM130',
    'Brake cleaning RM50',
    'Total RM550',
    'Parts warranty 6 months',
  ].join('\n'),
  work: { value: 'Front brake pad replacement and brake cleaning' },
  total: { value: 'RM550' },
  statedSen: 55000,
  chargesSen: [37000, 13000, 5000],
  details: {
    pads: { value: 'RM370' },
    brand: { value: 'Aftermarket · code FP-218' },
    labour: { value: 'RM130' },
    cleaning: { value: 'RM50' },
    partsWarranty: { value: '6 months' },
  },
}
const partsWarranty = '3 months'
const workmanshipWarranty = '30 days'
const sampleReply = {
  source: [
    'Front brake pads are aftermarket, code FP-450A.',
    'The RM450 total includes RM100 for labour.',
    `Parts warranty: ${partsWarranty}.`,
    `Workmanship warranty: ${workmanshipWarranty}.`,
  ].join('\n'),
  details: {
    brand: { value: 'Aftermarket · code FP-450A' },
    labour: { value: 'RM100 included in RM450' },
    warranty: { value: `Parts ${partsWarranty} · Workmanship ${workmanshipWarranty}` },
    partsWarranty: { value: partsWarranty },
    workmanshipWarranty: { value: workmanshipWarranty },
  },
}

const sampleForm = document.querySelector('#sample-form')
const ownQuoteForm = document.querySelector('#own-quote-form')
const ownComparisonForm = document.querySelector('#own-comparison-form')
const ownReplyForm = document.querySelector('#own-reply-form')
for (const slot of document.querySelectorAll('[data-quote-input]')) {
  slot.replaceWith(document.querySelector('#quote-input-template').content.cloneNode(true))
}
for (const slot of document.querySelectorAll('[data-detail-inputs]')) {
  slot.replaceWith(document.querySelector('#quote-details-template').content.cloneNode(true))
}
const ownAttachment = connectAttachment(ownQuoteForm)
const secondAttachment = connectAttachment(ownComparisonForm)
const verificationForm = document.querySelector('#verification-form')
const ownerForm = document.querySelector('#owner-form')
const comparisonForm = document.querySelector('#comparison-form')
const clarificationForm = document.querySelector('#clarification-form')
const deliveryForm = document.querySelector('#delivery-form')
const directoryResult = verificationForm.elements.namedItem('directoryResult')
const matchSearchForm = document.querySelector('#match-search-form')
const matchConsentForm = document.querySelector('#match-consent-form')
const referralForm = document.querySelector('#referral-form')
const reportControls = document.querySelector('#report-controls')
const reportStatus = document.querySelector('#report-status')
const steps = ['sample', 'verify', 'owner', 'review']
const branchSteps = {
  'own-quote': 'verify',
  'own-second-quote': 'review',
  'own-reply': 'review',
  replace: 'verify',
  clarification: 'review',
  'second-quote': 'review',
  comparison: 'review',
  'saved-report': 'review',
  'staff-delivery': 'review',
  'pilot-records': 'review',
  services: 'review',
  'demo-data': 'sample',
}
const pilotStages = {
  received: ['Received', 'Start staff check'],
  'in-review': ['Staff check in progress', 'Continue staff check'],
  'awaiting-copy': ['Awaiting clearer copy', 'Open clearer-copy request'],
  'awaiting-owner': ['Awaiting owner confirmation', 'Confirm vehicle details'],
  'review-ready': ['Review ready', 'Open quotation review'],
  delivered: ['Delivered', 'Open delivered case'],
}
const sampleNames = {
  legible: 'Readable quotation',
  partial: 'Warranty is blurred',
  unclear: 'Copy is too blurred',
}
const dateFormat = new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map(section => [section.dataset.screen, section]),
)
let review
let firstQuote
let context
let comparison
let activeScreen = 'sample'
let savedReturnScreen = 'sample'
let openedSavedReport
let lastShownSavedText
let currentPilotCase
let deliveryReturnScreen
let deliveryDraft
let identityCheck
let matchArea
let pilotRecordsReturnScreen

function showScreen(screen) {
  for (const [name, section] of screens) section.hidden = name !== screen
  activeScreen = screen
  document.querySelector('#workspace').classList.toggle('queue-layout', screen === 'staff-queue')
  document.querySelector('#workflow').hidden = screen === 'staff-queue'
  renderPilotCaseBar()
  document.querySelector('#pilot-case-message').textContent = ''
  document.querySelector('#edit-vehicle-action').hidden = currentPilotCase?.status === 'delivered'
  document.querySelector('#try-another-sample').hidden = Boolean(currentPilotCase)
  document.querySelector('#try-another-sample').textContent = firstQuote?.ownerEntered ? 'Start another review' : 'Try another sample'
  document.querySelector('#quote-step-label').textContent = screen === 'own-quote' || firstQuote?.ownerEntered || screen === 'sample'
    ? 'Check details' : 'Staff check'
  if (screen === 'owner') {
    const own = Boolean(firstQuote.ownerEntered)
    document.querySelector('#owner-intro').textContent = own
      ? 'Add the vehicle details and any observations you want included in the review.'
      : 'In the owner role, confirm or correct what you know about the car and the repair.'
    ownerForm.querySelector('[data-action="review-source"]').textContent = own ? 'Back to quotation details' : 'Back to staff check'
  }
  if (screen === 'verify') {
    directoryResult.disabled = Boolean(currentPilotCase && currentPilotCase.status !== 'in-review')
    renderDirectoryEvidence()
  }

  const activeStep = branchSteps[screen] ?? screen
  for (const step of document.querySelectorAll('[data-step]')) {
    if (step.dataset.step === activeStep) step.setAttribute('aria-current', 'step')
    else step.removeAttribute('aria-current')
    step.classList.toggle('complete', steps.indexOf(step.dataset.step) < steps.indexOf(activeStep))
  }

  const section = screens.get(screen)
  const reportSlot = section.querySelector('[data-report-slot]')
  if (reportSlot) {
    reportSlot.append(reportControls)
    reportStatus.textContent = ''
  }
  updateSavedReviewControls(getSavedReview())
  section.querySelector('h1').focus()
}

function renderDetails(id, rows) {
  const details = document.getElementById(id)
  details.replaceChildren(...rows.map(({ name, display, status }) => {
    const row = document.createElement('div')
    const term = document.createElement('dt')
    term.textContent = name
    const value = document.createElement('dd')
    value.textContent = display
    value.className = status
    row.append(term, value)
    return row
  }))
}

function renderList(id, items) {
  document.getElementById(id).replaceChildren(...items.map(item => {
    const entry = document.createElement('li')
    entry.textContent = item
    return entry
  }))
}

function loadSample(sampleId) {
  const quotation = samples[sampleId]
  firstQuote = quotation
  identityCheck = undefined
  document.querySelector('#quote-issuer').textContent = quoteIssuer.name + ' · Contact ending ' + quoteIssuer.contact
  review = reviewQuotation(quotation)
  document.querySelector('#source-quote').textContent = quotation.source
  const fields = [['Proposed work', quotation.work], ['Quoted total', quotation.total]]
  const rows = fields.map(([name, field]) => field.unreadable
    ? { name, display: 'Unreadable', status: 'unreadable' }
    : { name, display: field.value, status: 'stated' },
  )
  renderDetails('verification-details', [...rows, ...(review.details ?? [])])
  verificationForm.reset()
}

function renderDirectoryEvidence() {
  const sample = directoryExamples[directoryResult.value]
  document.querySelector('#directory-evidence').textContent =
    directoryResult.disabled ? (identityCheck?.source ?? '') : (sample?.source ?? '')
}

directoryResult.addEventListener('change', renderDirectoryEvidence)

function clearCopyStatus() {
  document.querySelector('#copy-status').textContent = ''
  const fallback = document.querySelector('#copy-fallback')
  fallback.hidden = true
  fallback.value = ''
}

function renderAttachment(container, attachment) {
  container.replaceChildren()
  if (!attachment) return
  if (attachment.kind !== 'pdf') {
    const image = document.createElement('img')
    image.src = attachment.url
    image.alt = 'Attached quotation photo'
    container.append(image)
  }
  const link = document.createElement('a')
  link.href = attachment.url
  link.download = 'quotation.' + attachment.kind
  link.textContent = attachment.kind === 'pdf' ? 'Download attached PDF to view it' : 'Download original photo'
  container.append(link)
}

function attachmentType(bytes) {
  const has = (signature, offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte)
  if (has([0xff, 0xd8, 0xff])) return ['jpg', 'image/jpeg']
  if (has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ['png', 'image/png']
  if (has([82, 73, 70, 70]) && has([87, 69, 66, 80], 8)) return ['webp', 'image/webp']
  if (has([37, 80, 68, 70, 45])) return ['pdf', 'application/pdf']
  return []
}

function connectAttachment(form) {
  const input = form.elements.namedItem('attachment')
  const preview = form.querySelector('[data-attachment-preview]')
  let attachment
  let version = 0
  const clear = () => {
    version += 1
    if (attachment) URL.revokeObjectURL(attachment.url)
    attachment = undefined
    input.setCustomValidity('')
    renderAttachment(preview)
  }
  input.addEventListener('change', async () => {
    clear()
    const file = input.files[0]
    if (!file) return
    const request = version
    input.setCustomValidity('Wait for the attachment to finish opening.')
    let url
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file under 10 MB.')
      const [kind, mime] = attachmentType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
      if (request !== version) return
      if (!kind) throw new Error('Choose a JPG, PNG, WebP or PDF file.')
      url = URL.createObjectURL(new Blob([file], { type: mime }))
      if (kind !== 'pdf') {
        const image = new Image()
        image.src = url
        await image.decode().catch(() => { throw new Error('This photo could not be opened. Choose another copy.') })
      }
      if (request !== version) return
      attachment = { url, kind }
      input.setCustomValidity('')
      renderAttachment(preview, attachment)
    } catch (error) {
      if (request !== version) return
      input.value = ''
      input.setCustomValidity('')
      preview.textContent = error instanceof Error ? error.message : 'This attachment could not be opened.'
    } finally {
      if (url && attachment?.url !== url) URL.revokeObjectURL(url)
    }
  })
  form.addEventListener('reset', clear)
  return { get current() { return attachment } }
}

function ownFormValues(form) {
  return Object.fromEntries(new FormData(form))
}

function showInputError(form, { field, error }) {
  const input = form.elements.namedItem(field)
  const expandable = input.closest('details')
  if (expandable) expandable.open = true
  input.setCustomValidity(error)
  input.reportValidity()
}

for (const form of [ownQuoteForm, ownComparisonForm, ownReplyForm]) {
  const resetValidity = () => {
    for (const input of form.elements) {
      if (input.name !== 'attachment') input.setCustomValidity('')
    }
  }
  form.addEventListener('input', resetValidity)
  form.addEventListener('reset', resetValidity)
}

function resetOwnCase() {
  ownQuoteForm.reset()
  ownComparisonForm.reset()
  ownReplyForm.reset()
  if (firstQuote?.ownerEntered) {
    firstQuote = undefined
    context = undefined
    review = undefined
    comparison = undefined
    ownerForm.reset()
    for (const id of [
      'review-source-original', 'review-source-reply', 'review-attachment', 'comparison-attachment-a',
      'comparison-attachment-b', 'comparison-source-a', 'comparison-source-b', 'comparison-reply-text',
      'review-details', 'review-questions', 'review-context', 'review-total', 'review-work',
      'review-itemised-check', 'clarification-changes', 'comparison-rows', 'comparison-questions',
      'comparison-context', 'comparison-total-a', 'comparison-total-b', 'itemised-check', 'own-comparison-context',
    ]) document.getElementById(id).replaceChildren()
    clearCopyStatus()
    resetComparisonCopy()
  }
}

ownQuoteForm.addEventListener('submit', event => {
  event.preventDefault()
  const result = enterQuotation(ownFormValues(ownQuoteForm))
  if (result.error) return showInputError(ownQuoteForm, result)
  const { clarification, ...previous } = firstQuote ?? {}
  const changed = JSON.stringify(previous) !== JSON.stringify(result.quotation)
  if (changed) {
    ownComparisonForm.reset()
    ownReplyForm.reset()
    comparison = undefined
  }
  firstQuote = changed || !clarification ? result.quotation : { ...result.quotation, clarification }
  review = reviewQuotation(firstQuote)
  showScreen('owner')
})

sampleForm.addEventListener('submit', event => {
  event.preventDefault()
  loadSample(new FormData(sampleForm).get('sample'))
  showScreen('verify')
})

function showClearerCopyRequest() {
  renderList('replacement-details', review.unresolved)
  showScreen('replace')
}

verificationForm.addEventListener('submit', event => {
  event.preventDefault()
  if (!currentPilotCase || currentPilotCase.status === 'in-review') {
    const example = directoryExamples[directoryResult.value]
    const check = example ? recordWorkshopCheck({ issuer: quoteIssuer, ...example }) : undefined
    if (!changeCurrentPilotCase({ type: 'check', outcome: review.outcome, identityCheck: check })) return
    identityCheck = check
  }
  if (review.outcome === 'clearer-copy') {
    showClearerCopyRequest()
    return
  }
  showScreen('owner')
})

ownerForm.addEventListener('submit', event => {
  event.preventDefault()
  const form = new FormData(ownerForm)
  const model = form.get('model').trim()
  if (!model) {
    const modelInput = ownerForm.elements.namedItem('model')
    modelInput.setCustomValidity('Enter a vehicle model.')
    modelInput.reportValidity()
    return
  }
  const owner = { year: form.get('year'), model, variant: form.get('variant').trim(), symptoms: form.get('symptoms').trim() }
  if (!changeCurrentPilotCase({ type: 'confirm-owner', context: owner })) return
  const previousVehicle = context?.vehicle
  loadOwnerContext(owner)
  if (firstQuote.ownerEntered && context.vehicle !== previousVehicle) {
    ownComparisonForm.elements.namedItem('sameVehicle').checked = false
  }
  showReview()
})

function loadOwnerContext({ year, model, variant, symptoms }) {
  context = { vehicle: [year, model, variant].filter(Boolean).join(' '), symptoms }
}

ownerForm.elements.namedItem('model').addEventListener('input', event => {
  event.target.setCustomValidity('')
})

function showReview() {
  const { vehicle, symptoms } = context
  const clarification = firstQuote.clarification
  document.querySelector('#review-context').textContent = [vehicle, symptoms].filter(Boolean).join(' · ')
  document.querySelector('#review-heading').textContent = review.title
  document.querySelector('#review-total').textContent = review.total
  document.querySelector('#review-work').textContent = review.work
  document.querySelector('#review-amount-note').hidden = !firstQuote.combinedPartsAndLabour
  renderAmountChecks('review-itemised-check', [review.amountCheck])
  document.querySelector('#review-source').open = false
  document.querySelector('#review-source-summary').textContent = clarification
    ? 'View original quotation and reply' : 'View original quotation'
  document.querySelector('#review-source-original').textContent = firstQuote.source
  renderAttachment(document.querySelector('#review-attachment'), firstQuote.ownerEntered ? ownAttachment.current : null)
  document.querySelector('#review-source-clarification').hidden = !clarification
  document.querySelector('#review-source-reply').textContent = clarification?.source ?? ''
  document.querySelector('#partial-notice').hidden = review.outcome !== 'partial'
  document.querySelector('#partial-notice').textContent = firstQuote.ownerEntered
    ? 'You can review the work and total. Ask the workshop to clarify any unreadable details.'
    : 'Staff could verify the work and total. Ask the workshop to clarify the unreadable detail.'
  document.querySelector('#review-identity').hidden = !identityCheck
  if (identityCheck) {
    document.querySelector('#review-identity-result').textContent =
      identityCheck.status + ' · ' + dateFormat.format(new Date(identityCheck.checkedAt))
    document.querySelector('#review-identity-source').textContent = identityCheck.source
  }
  document.querySelector('#review-details-heading').textContent = clarification || firstQuote.ownerEntered ? 'Quotation details' : 'Details to clarify'
  document.querySelector('#clarification-invitation').hidden = Boolean(clarification)
  document.querySelector('#clarification-invitation-text').textContent = firstQuote.ownerEntered
    ? 'Enter what the workshop confirmed and see what changed.' : 'Add a checked sample reply to update the review.'
  document.querySelector('#clarification-record').hidden = !clarification
  document.querySelector('#example-services').hidden = Boolean(firstQuote.ownerEntered)
  if (clarification) {
    const changes = review.details.filter(detail => detail.previous !== undefined)
    renderTableRows('clarification-changes', changes.map(({ name, previous, display }) => ({
      label: name, first: previous, second: display,
    })))
  }
  renderDetails('review-details', review.details)
  renderList('review-questions', review.questions)
  clearCopyStatus()
  showScreen('review')
}

function startComparison() {
  if (firstQuote.ownerEntered) {
    document.querySelector('#own-comparison-context').textContent = context.vehicle + ' · ' + firstQuote.work.value
    showScreen('own-second-quote')
    return
  }
  comparisonForm.reset()
  document.querySelector('#second-source').textContent = secondQuote.source
  document.querySelector('#comparison-vehicle').textContent = context.vehicle
  showScreen('second-quote')
}

function startClarification() {
  if (firstQuote.ownerEntered) {
    showScreen('own-reply')
    return
  }
  clarificationForm.reset()
  document.querySelector('#original-for-clarification').textContent = firstQuote.source
  document.querySelector('#reply-to-check').textContent = sampleReply.source
  showScreen('clarification')
}

clarificationForm.addEventListener('submit', event => {
  event.preventDefault()
  const checked = new FormData(clarificationForm).has('replyVerified')
  const revised = applyClarification(firstQuote, sampleReply, checked)
  if (revised === firstQuote) return
  if (!changeCurrentPilotCase({ type: 'clarify' })) return
  firstQuote = revised
  review = reviewQuotation(revised)
  showReview()
})

ownReplyForm.addEventListener('submit', event => {
  event.preventDefault()
  const input = ownFormValues(ownReplyForm)
  const result = enterReply(input)
  if (result.error) return showInputError(ownReplyForm, result)
  firstQuote = applyClarification(firstQuote, result.reply, input.replyVerified === 'on')
  review = reviewQuotation(firstQuote)
  ownReplyForm.reset()
  showReview()
})

function renderTableRows(id, rows) {
  document.getElementById(id).replaceChildren(...rows.map(({ label, first, second, note }) => {
    const row = document.createElement('tr')
    const heading = document.createElement('th')
    heading.scope = 'row'
    heading.textContent = label
    if (note) {
      const detail = document.createElement('span')
      detail.className = 'comparison-note'
      detail.textContent = note
      heading.append(detail)
    }
    row.append(heading)
    for (const display of [first, second]) {
      const cell = document.createElement('td')
      cell.textContent = display
      row.append(cell)
    }
    return row
  }))
}

comparisonForm.addEventListener('submit', event => {
  event.preventDefault()
  showComparison(secondQuote, new FormData(comparisonForm))
})

ownComparisonForm.addEventListener('submit', event => {
  event.preventDefault()
  const result = enterQuotation(ownFormValues(ownComparisonForm))
  if (result.error) return showInputError(ownComparisonForm, result)
  showComparison(result.quotation, new FormData(ownComparisonForm))
})

function renderAmountChecks(id, checks) {
  const status = document.getElementById(id)
  const lines = checks.flatMap((check, index) => {
    if (!check) return []
    const prefix = checks.length === 1 ? '' : index === 0 ? 'Quote A · ' : 'Quote B · '
    return [prefix + 'Sum of entered line items: ' + formatSen(check.calculatedSen) +
      (check.matches ? ' matches the stated total.' : ' differs from the stated total. Check whether any charges are missing.')]
  })
  status.hidden = lines.length === 0
  status.textContent = lines.join('\n')
}

function showComparison(otherQuote, confirmed) {
  const result = compareQuotations(firstQuote, otherQuote, {
    sameVehicle: confirmed.has('sameVehicle'), sameRepair: confirmed.has('sameRepair'),
  })
  if (result.outcome !== 'comparison') return
  comparison = result

  document.querySelector('#comparison-context').textContent =
    context.vehicle + ' · ' + (firstQuote.ownerEntered ? firstQuote.work.value : 'Front brake pad replacement')
  const [a, b] = result.quotes
  document.querySelector('#comparison-total-a').textContent = a.total
  document.querySelector('#comparison-total-b').textContent = b.total
  renderAmountChecks('itemised-check', result.amountChecks)
  document.querySelector('#comparison-source-a').textContent = a.source
  document.querySelector('#comparison-source-b').textContent = b.source
  renderAttachment(document.querySelector('#comparison-attachment-a'), firstQuote.ownerEntered ? ownAttachment.current : null)
  renderAttachment(document.querySelector('#comparison-attachment-b'), firstQuote.ownerEntered ? secondAttachment.current : null)
  document.querySelector('#comparison-reply').hidden = !firstQuote.clarification
  document.querySelector('#comparison-reply-text').textContent = firstQuote.clarification?.source ?? ''
  renderTableRows('comparison-rows', result.rows)
  renderList('comparison-questions', result.questions)
  resetComparisonCopy()
  showScreen('comparison')
}

function resetComparisonCopy() {
  const fallback = document.querySelector('#comparison-copy-fallback')
  fallback.value = ''
  fallback.hidden = true
  document.querySelector('#comparison-copy-status').textContent = ''
}

function activeReport() {
  return formatReviewReport({
    context,
    quotation: firstQuote,
    review,
    identityCheck,
    comparison: activeScreen === 'comparison' ? comparison : undefined,
  })
}

function getSavedReview() {
  try {
    return readSavedReview(window.localStorage)
  } catch {
    return null
  }
}

function updateSavedReviewControls(saved) {
  lastShownSavedText = saved?.text
  for (const button of document.querySelectorAll('[data-action="open-saved"]')) {
    button.hidden = !saved
  }
  if (activeScreen === 'review' || activeScreen === 'comparison') {
    const isDifferent = saved && saved.text !== activeReport().text
    document.querySelector('#save-report').textContent = isDifferent ? 'Replace saved review' : 'Save review'
  }
}

function saveActiveReport() {
  const report = activeReport()
  try {
    const storage = window.localStorage
    const existing = readSavedReview(storage)
    if (existing && existing.text !== report.text && existing.text !== lastShownSavedText) {
      updateSavedReviewControls(existing)
      reportStatus.textContent = 'A different review is saved. Select Replace saved review to update it.'
      return
    }
    saveReview(storage, report)
    updateSavedReviewControls(report)
    reportStatus.textContent = 'Review saved in this browser.'
  } catch {
    reportStatus.textContent = 'This browser couldn’t save the review. You can still export a copy.'
  }
}

function openSavedReport() {
  const saved = getSavedReview()
  if (!saved) {
    updateSavedReviewControls(null)
    return
  }
  savedReturnScreen = activeScreen
  openedSavedReport = saved
  document.querySelector('#saved-report-title').textContent = saved.title
  document.querySelector('#saved-report-text').textContent = saved.text
  showScreen('saved-report')
}

function downloadReport(report) {
  const file = new Blob([report.text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = 'mekaneed-' + report.title.toLowerCase().replaceAll(' ', '-') + '.txt'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copyQuestions({ questions, statusId, fallbackId }) {
  const text = questions.map((question, i) => `${i + 1}. ${question}`).join('\n')
  const status = document.getElementById(statusId)
  try {
    await navigator.clipboard.writeText(text)
    status.textContent = 'Questions copied.'
  } catch {
    const fallback = document.getElementById(fallbackId)
    fallback.value = text
    fallback.hidden = false
    fallback.focus()
    fallback.select()
    status.textContent = 'Select and copy the questions below.'
  }
}

function caseNumber(id) {
  return 'Case ' + id.slice(0, 8).toUpperCase()
}

function caseEventLabel(event) {
  if (event.type === 'replace') return 'Clearer sample attached'
  if (event.type === 'clarify') return 'Workshop reply checked'
  if (event.type === 'offer') return 'Standard offer shown · ' + formatSen(event.amountSen)
  if (event.type === 'pay') return 'Sample payment recorded · ' + formatSen(event.amountSen)
  if (event.type === 'refund') return 'Sample refund recorded · ' + formatSen(event.amountSen)
  if (event.type === 'decline') return 'Standard offer declined'
  if (event.type === 'consent') return 'Sample permission for ' + event.recipient + ' · ' + event.purpose +
    ' · ' + event.fields.join(', ')
  if (event.type === 'withdraw') return 'Sample permission withdrawn for ' + event.recipient
  if (event.type === 'referral') return 'Sample referral ' + event.jobRef + ' · job ' +
    formatSen(event.amountSen) + ' · workshop fee ' + formatSen(event.feeSen)
  return pilotStages[event.status][0] + (event.sample ? ' · ' + sampleNames[event.sample] : '')
}

function renderWorkshopMatch() {
  const match = sampleWorkshopMatch(matchArea)
  const active = currentPilotCase ? pilotActivity(currentPilotCase).activeConsent : null
  const result = document.querySelector('#match-result')
  result.textContent = ''
  if (match) {
    result.textContent = match.recipient + ' · ' + match.area + ' · ' + match.service +
      '. Example referral fee of ' + formatSen(pilotTerms.referralSen) +
      ' is paid by the workshop after an eligible completed job. You can choose any workshop.'
    if (!currentPilotCase) result.textContent += ' Open a queued case to log sample permission.'
    document.querySelector('#match-consent-text').textContent =
      'I agree to share ' + match.fields.join(' and ').toLowerCase() + ' with ' + match.recipient +
      ' to request a quotation for this repair.'
  } else if (matchArea) {
    result.textContent = 'There’s no eligible sample workshop in this area.'
  }
  matchConsentForm.hidden = !match || !currentPilotCase || Boolean(active)
  document.querySelector('#withdraw-match-actions').hidden = !active
  document.querySelector('#match-status').textContent = active
    ? 'Sample permission recorded for ' + active.recipient + '.' : ''
}

function openServices() {
  matchArea = undefined
  matchSearchForm.reset()
  matchConsentForm.reset()
  document.querySelector('#expert-price').textContent = formatSen(pilotTerms.expertSen) + ' per case · example offer'
  document.querySelector('#expert-fee').textContent =
    'Example fixed mechanic fee ' + formatSen(pilotTerms.expertFeeSen) + ' per case, regardless of the quotation total.'
  renderWorkshopMatch()
  showScreen('services')
}

matchSearchForm.addEventListener('submit', event => {
  event.preventDefault()
  matchArea = new FormData(matchSearchForm).get('area')
  matchConsentForm.reset()
  renderWorkshopMatch()
})

matchConsentForm.addEventListener('submit', event => {
  event.preventDefault()
  const consent = new FormData(matchConsentForm).has('consent')
  if (!currentPilotCase || !changeCurrentPilotCase({ type: 'consent', area: matchArea, consent })) return
  renderWorkshopMatch()
  renderPilotCaseBar()
})

function withdrawMatch() {
  if (!currentPilotCase || !changeCurrentPilotCase({ type: 'withdraw' })) return
  matchConsentForm.reset()
  renderWorkshopMatch()
  renderPilotCaseBar()
  document.querySelector('#match-status').textContent = 'Sample permission withdrawn.'
}

function renderPilotRecords() {
  const activity = pilotActivity(currentPilotCase)
  const awaitingDecision = activity.offered && !activity.paid && !activity.declined
  document.querySelector('#offer-action').hidden = activity.offered
  document.querySelector('#pay-action').hidden = !awaitingDecision
  document.querySelector('#decline-action').hidden = !awaitingDecision
  document.querySelector('#refund-action').hidden = !activity.paid || activity.refunded
  document.querySelector('#standard-price').textContent =
    formatSen(pilotTerms.standardSen) + ' per case · example offer with one clarification revision.'
  referralForm.hidden = !activity.activeConsent || Boolean(activity.referral)
  document.querySelector('#referral-eligibility').textContent = activity.referral
    ? 'Recorded for ' + activity.referral.jobRef + '.'
    : activity.activeConsent
      ? 'Sample terms require an attributable, completed paid job of ' + formatSen(pilotTerms.minimumJobSen) + ' or more.'
      : 'Record permission for an eligible workshop match before logging a referral.'
  renderList('pilot-activity', currentPilotCase.history.map(event =>
    caseEventLabel(event) + ' · ' + dateFormat.format(new Date(event.at)),
  ))
}

function openPilotRecords() {
  pilotRecordsReturnScreen = activeScreen
  referralForm.reset()
  renderPilotRecords()
  showScreen('pilot-records')
}

function recordPilotAction(type) {
  if (!changeCurrentPilotCase({ type })) return
  renderPilotRecords()
  renderPilotCaseBar()
}

referralForm.addEventListener('submit', event => {
  event.preventDefault()
  const form = new FormData(referralForm)
  const jobRef = form.get('jobRef').trim().toUpperCase()
  const amountSen = Math.round(Number(form.get('amount')) * 100)
  try {
    if (listPilotCases(window.localStorage).some(caseRecord => pilotActivity(caseRecord).referral?.jobRef === jobRef)) {
      document.querySelector('#pilot-case-message').textContent = 'That sample job reference is already recorded.'
      return
    }
  } catch {
    document.querySelector('#pilot-case-message').textContent = 'This browser couldn’t check the sample job reference.'
    return
  }
  if (!changeCurrentPilotCase({ type: 'referral', jobRef, amountSen, completedPaid: form.has('completedPaid') })) return
  renderPilotRecords()
  renderPilotCaseBar()
})

const clearDataForm = document.querySelector('#clear-data-form')
clearDataForm.addEventListener('submit', event => {
  event.preventDefault()
  if (!new FormData(clearDataForm).has('confirmClear')) return
  const status = document.querySelector('#clear-data-status')
  try {
    clearDemoData(window.localStorage)
    resetOwnCase()
    openedSavedReport = undefined
    document.querySelector('#saved-report-text').textContent = ''
    document.querySelector('#saved-report-title').textContent = ''
    updateSavedReviewControls(null)
    clearDataForm.reset()
    status.textContent = 'Mekaneed data cleared from this browser.'
  } catch {
    status.textContent = 'This browser couldn’t clear the local data.'
  }
})

function turnaroundLabel(milliseconds) {
  const minutes = Math.floor(milliseconds / 60_000)
  if (minutes === 0) return 'Under 1 min'
  if (minutes < 60) return minutes + ' min'
  return Math.floor(minutes / 60) + ' hr ' + (minutes % 60) + ' min'
}

function renderDeliveries() {
  const draft = document.querySelector('#delivery-draft')
  draft.hidden = currentPilotCase.status !== 'review-ready'
  if (!draft.hidden) document.querySelector('#delivery-draft-title').textContent = deliveryDraft.title
  const deliveries = currentPilotCase.deliveries ?? []
  document.querySelector('#delivery-records').replaceChildren(...deliveries.map((delivery, index) => {
    const card = document.createElement('article')
    card.className = 'card saved-report'
    const heading = document.createElement('h2')
    heading.textContent = index === 0 ? 'First delivery' : 'Revised delivery'
    const when = document.createElement('p')
    when.className = 'delivery-time'
    when.textContent = dateFormat.format(new Date(delivery.at))
    const summary = document.createElement('p')
    summary.className = 'delivery-time'
    summary.textContent = delivery.handlingMinutes + ' min staff handling · ' + turnaroundLabel(delivery.turnaroundMs) + ' turnaround'
    const details = document.createElement('details')
    details.className = 'clarification-sources'
    const title = document.createElement('summary')
    title.textContent = 'View delivered report'
    const report = document.createElement('pre')
    report.textContent = delivery.report.text
    const exportButton = document.createElement('button')
    exportButton.className = 'secondary delivered-report-export'
    exportButton.type = 'button'
    exportButton.textContent = 'Export delivered report'
    exportButton.addEventListener('click', () => downloadReport(delivery.report))
    details.append(title, report, exportButton)
    card.append(heading, when, summary, details)
    return card
  }))
}

function openDelivery() {
  deliveryReturnScreen = activeScreen
  deliveryDraft = currentPilotCase.status === 'review-ready' ? activeReport() : undefined
  deliveryForm.reset()
  document.querySelector('#delivery-status').textContent = ''
  renderDeliveries()
  showScreen('staff-delivery')
}

deliveryForm.addEventListener('submit', event => {
  event.preventDefault()
  const handlingMinutes = Number(new FormData(deliveryForm).get('handlingMinutes'))
  if (!changeCurrentPilotCase({ type: 'deliver', handlingMinutes, report: deliveryDraft })) return
  renderDeliveries()
  showScreen('staff-delivery')
  const status = document.querySelector('#delivery-status')
  status.textContent = 'Sample delivery recorded.'
  status.focus()
})

function renderPilotCaseBar() {
  const bar = document.querySelector('#pilot-case-bar')
  bar.hidden = !currentPilotCase || activeScreen === 'staff-queue'
  if (bar.hidden) return
  document.querySelector('#pilot-case-number').textContent = caseNumber(currentPilotCase.id)
  document.querySelector('#pilot-case-stage').textContent = pilotStages[currentPilotCase.status][0]
  document.querySelector('#pilot-records-action').hidden = activeScreen === 'pilot-records'
  const deliveryAction = document.querySelector('#pilot-delivery-action')
  const canOpenDelivery = ['review-ready', 'delivered'].includes(currentPilotCase.status)
  deliveryAction.hidden = !(canOpenDelivery && ['review', 'comparison'].includes(activeScreen))
  deliveryAction.textContent = currentPilotCase.status === 'delivered' ? 'Delivery records' : 'Record delivery'
  renderList('pilot-case-history', currentPilotCase.history.map(event =>
    caseEventLabel(event) + ' · ' + dateFormat.format(new Date(event.at)),
  ))
}

function renderStaffQueue() {
  const queue = document.querySelector('#pilot-queue')
  const message = document.querySelector('#pilot-queue-message')
  try {
    const cases = listPilotCases(window.localStorage)
    const totals = summarizePilotCases(cases)
    renderDetails('pilot-stats', [
      ['Offers shown', totals.offered], ['Payments recorded', totals.paid], ['Refunds recorded', totals.refunded],
      ['Cases delivered', totals.delivered], ['Paid cases delivered', totals.paidDelivered], ['Completed referrals', totals.referrals],
      ['Avg staff min / delivered case', totals.averageHandling?.toFixed(1) ?? '—'],
    ].map(([name, display]) => ({ name, display, status: 'stated' })))
    document.querySelector('#pilot-stats').hidden = cases.length === 0
    queue.replaceChildren(...cases.map(record => {
      const card = document.createElement('article')
      card.className = 'card pilot-queue-case'
      const description = document.createElement('div')
      const heading = document.createElement('h2')
      heading.textContent = caseNumber(record.id) + ' · ' + sampleNames[record.sample]
      const state = document.createElement('p')
      const [label, action] = pilotStages[record.status]
      state.textContent = label + ' · ' + dateFormat.format(new Date(record.history.at(-1).at))
      description.append(heading, state)
      const button = document.createElement('button')
      button.className = 'secondary'
      button.type = 'button'
      button.textContent = action
      button.setAttribute('aria-label', action + ' for ' + caseNumber(record.id))
      button.addEventListener('click', () => openPilotCase(record.id))
      card.append(description, button)
      return card
    }))
    message.textContent = cases.length ? '' : 'No cases yet. Send a quotation from the sample screen.'
  } catch {
    queue.replaceChildren()
    document.querySelector('#pilot-stats').hidden = true
    message.textContent = 'The staff queue couldn’t be opened in this browser.'
  }
}

function leavePilotCase() {
  if (currentPilotCase) ownerForm.reset()
  currentPilotCase = undefined
}

function showStaffQueue() {
  leavePilotCase()
  renderStaffQueue()
  showScreen('staff-queue')
}

function queueSample() {
  try {
    const sample = new FormData(sampleForm).get('sample')
    savePilotCase(window.localStorage, createPilotCase({ id: crypto.randomUUID(), sample }))
    showStaffQueue()
  } catch {
    showStaffQueue()
    document.querySelector('#pilot-queue-message').textContent = 'This browser couldn’t save the case in the staff queue.'
  }
}

function changeCurrentPilotCase(event) {
  if (!currentPilotCase) return true
  const message = activeScreen === 'staff-queue' ? '#pilot-queue-message' : '#pilot-case-message'
  try {
    const storage = window.localStorage
    const stored = readPilotCase(storage, currentPilotCase.id)
    if (!stored || JSON.stringify(stored.history) !== JSON.stringify(currentPilotCase.history)) {
      document.querySelector(message).textContent = 'This case changed. Open it again from the staff queue.'
      return false
    }
    const updated = advancePilotCase(stored, event)
    if (updated === stored) {
      document.querySelector(message).textContent = 'This case couldn’t be updated. Check the details or reopen it from the staff queue.'
      return false
    }
    savePilotCase(storage, updated)
    currentPilotCase = updated
    return true
  } catch {
    document.querySelector(message).textContent = 'This browser couldn’t save the case update.'
    return false
  }
}

function openPilotCase(id) {
  try {
    currentPilotCase = readPilotCase(window.localStorage, id)
  } catch {
    document.querySelector('#pilot-queue-message').textContent = 'This browser couldn’t reopen the case.'
    return
  }
  if (!currentPilotCase) {
    renderStaffQueue()
    return
  }
  if (currentPilotCase.status === 'received' && !changeCurrentPilotCase({ type: 'start' })) return
  loadSample(currentPilotCase.sample)
  identityCheck = currentPilotCase.identityCheck
  ownerForm.reset()
  if (['review-ready', 'delivered'].includes(currentPilotCase.status)) {
    const owner = currentPilotCase.context
    for (const [key, value] of Object.entries(owner)) ownerForm.elements.namedItem(key).value = value
    loadOwnerContext(owner)
    if (currentPilotCase.replyApplied) {
      firstQuote = applyClarification(firstQuote, sampleReply, true)
      review = reviewQuotation(firstQuote)
    }
    showReview()
  } else if (currentPilotCase.status === 'awaiting-owner') {
    showScreen('owner')
  } else if (currentPilotCase.status === 'awaiting-copy') {
    showClearerCopyRequest()
  } else {
    showScreen('verify')
  }
}

const actions = {
  'start-own': () => {
    leavePilotCase()
    resetOwnCase()
    ownerForm.reset()
    for (const name of ['model', 'year', 'symptoms']) ownerForm.elements.namedItem(name).value = ''
    identityCheck = undefined
    document.querySelector('#own-quote-edit-note').hidden = true
    showScreen('own-quote')
  },
  'choose-sample': () => {
    leavePilotCase()
    resetOwnCase()
    showScreen('sample')
  },
  'try-another-sample': () => {
    const own = firstQuote.ownerEntered
    if (own) return actions['start-own']()
    sampleForm.reset()
    ownerForm.reset()
    showScreen('sample')
  },
  'queue-sample': queueSample,
  'open-staff-queue': showStaffQueue,
  'open-services': openServices,
  'withdraw-match': withdrawMatch,
  'open-pilot-records': openPilotRecords,
  'back-from-pilot-records': () => showScreen(pilotRecordsReturnScreen),
  'record-offer': () => recordPilotAction('offer'),
  'record-payment': () => recordPilotAction('pay'),
  'record-decline': () => recordPilotAction('decline'),
  'record-refund': () => recordPilotAction('refund'),
  'open-demo-data': () => {
    clearDataForm.reset()
    document.querySelector('#clear-data-status').textContent = ''
    showScreen('demo-data')
  },
  'open-delivery': openDelivery,
  'back-from-delivery': () => showScreen(deliveryReturnScreen),
  'review-source': () => {
    if (!firstQuote.ownerEntered) return showScreen('verify')
    document.querySelector('#own-quote-edit-note').hidden = !firstQuote.clarification && !comparison
    showScreen('own-quote')
  },
  'edit-vehicle': () => showScreen('owner'),
  'start-clarification': startClarification,
  'start-comparison': startComparison,
  'return-review': showReview,
  'edit-comparison': () => showScreen(firstQuote.ownerEntered ? 'own-second-quote' : 'second-quote'),
  'save-report': saveActiveReport,
  'open-saved': openSavedReport,
  'export-report': () => downloadReport(activeReport()),
  'export-saved': () => downloadReport(openedSavedReport),
  'back-from-saved': () => showScreen(savedReturnScreen),
  replace: () => {
    if (!changeCurrentPilotCase({ type: 'replace', sample: 'legible' })) return
    sampleForm.elements.namedItem('sample').value = 'legible'
    loadSample('legible')
    showScreen('verify')
  },
  copy: () => copyQuestions({ questions: review.questions, statusId: 'copy-status', fallbackId: 'copy-fallback' }),
  'copy-comparison': () => copyQuestions({
    questions: comparison.questions, statusId: 'comparison-copy-status', fallbackId: 'comparison-copy-fallback',
  }),
}

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', actions[button.dataset.action])
}
updateSavedReviewControls(getSavedReview())
window.addEventListener('storage', () => {
  updateSavedReviewControls(getSavedReview())
  if (activeScreen === 'staff-queue') renderStaffQueue()
})
