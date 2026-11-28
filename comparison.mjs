import { describeField, reconcileItemisedTotal, reviewQuotation } from './review.mjs'

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
  const amountChecks = [first, second].map(reconcileItemisedTotal)
  if (first.ownerEntered && second.ownerEntered) {
    const [a, b] = [first, second].map(reviewQuotation)
    const rows = [
      { label: 'Proposed work', first: a.work, second: b.work },
      ...a.details.map(({ name, display }, index) => ({
        label: name, first: display, second: b.details[index].display,
      })),
    ]
    if (a.work.toLocaleLowerCase() !== b.work.toLocaleLowerCase()) {
      rows[0].note = 'Wording differs. Confirm what each quote includes.'
      questions.unshift('What additional work or parts, if any, does each quotation include?')
    }
    return { outcome: 'comparison', quotes, rows, questions, amountChecks }
  }
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
  return { outcome: 'comparison', quotes, rows, questions, amountChecks }
}
