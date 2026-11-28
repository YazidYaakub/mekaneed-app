import { describeField, formatSen, reconcileItemisedTotal, reviewQuotation } from './review.mjs'

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

function compareLineItems(first, second) {
  const byLabel = items => {
    const groups = new Map()
    for (const item of items) {
      const key = item.description.toLocaleLowerCase().replace(/\s+/g, ' ')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return groups
  }
  const a = byLabel(first.lineItems)
  const b = byLabel(second.lineItems)
  const describe = items => items?.map(item => formatSen(item.sen)).join('\n') ?? 'Not stated'
  return [...new Set([...a.keys(), ...b.keys()])].map(key => {
    const left = a.get(key)
    const right = b.get(key)
    return {
      label: (left ?? right)[0].description,
      first: describe(left),
      second: describe(right),
      note: !left ? 'Only listed in Quote B' : !right ? 'Only listed in Quote A' : undefined,
    }
  })
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
    const lineItems = compareLineItems(first, second)
    const labour = (quotation, display) => quotation.combinedPartsAndLabour && display === 'Not stated'
      ? `No separate amount in the ${quotation.total.value} lump sum` : display
    const rows = [
      { label: 'Proposed work', first: a.work, second: b.work },
      ...a.details.flatMap(({ name, display }, index) => {
        const other = b.details[index].display
        if (name === 'Entered line items') return lineItems
        if (name === 'Separate labour charge') {
          return [{ label: name, first: labour(first, display), second: labour(second, other) }]
        }
        return [{ label: name, first: display, second: other }]
      }),
    ]
    if (a.work.toLocaleLowerCase() !== b.work.toLocaleLowerCase()) {
      rows[0].note = 'Wording differs. Confirm what each quote includes.'
      questions.unshift('What additional work or parts, if any, does each quotation include?')
    }
    if (lineItems.some(row => row.note)) questions.unshift('Do the line items listed on only one quote apply to both repairs?')
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
