import { describeField, reconcileItemisedTotal } from './review.mjs'

const repairDetails = [
  ['pads', 'Front brake pads'],
  ['brand', 'Part brand or code'],
  ['labour', 'Labour'],
  ['cleaning', 'Brake cleaning'],
  ['partsWarranty', 'Parts warranty'],
  ['workmanshipWarranty', 'Workmanship warranty'],
]

function describeDetail(quotation, key) {
  const details = { ...quotation.details, ...quotation.clarification?.details }
  const field = describeField(details[key])
  if (!details[key] && key.endsWith('Warranty') && details.warranty?.unreadable) {
    return describeField(details.warranty)
  }
  if (field.status === 'not-stated' && quotation.combinedPartsAndLabour && (key === 'pads' || key === 'labour')) {
    return { status: 'stated', display: `Included in ${quotation.total.value} lump sum` }
  }
  return field
}

// Compare the front brake pad sample only. These rows represent known details
// of this job and use a common key for each detail on both quotations.
export function compareQuotations(first, second, confirmation) {
  if (confirmation.sameVehicle !== true || confirmation.sameRepair !== true) {
    return { outcome: 'confirmation-needed' }
  }
  const quotes = [first, second].map(quotation => ({
    total: quotation.total.value,
    source: quotation.source,
  }))
  const questions = [
    'Which parts and labour are included in each quoted total?',
    'What warranty applies to the parts and workmanship for each quote?',
  ]
  const rows = repairDetails.map(([key, label]) => {
    const a = describeDetail(first, key)
    const b = describeDetail(second, key)
    const row = { label, first: a.display, second: b.display }
    if (key === 'cleaning' && a.status === 'not-stated' && b.status === 'stated') {
      row.note = 'Only listed in Quote B'
      questions.unshift('Does Quote A include brake cleaning?')
    }
    return row
  })
  return { outcome: 'comparison', quotes, rows, questions, amountChecks: [first, second].map(reconcileItemisedTotal) }
}
