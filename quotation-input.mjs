import { formatSen } from './review.mjs'

const detailsKeys = ['workshop', 'quantity', 'brand', 'condition', 'labour', 'partsWarranty', 'workmanshipWarranty']
const fieldValue = (input, key) => String(input[key] ?? '').trim()

function moneyInSen(value, allowDiscount = false) {
  const cleaned = value.replace(/^RM\s*/i, '')
  const match = /^(-?)((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match || (match[1] && !allowDiscount)) return null
  const sen = Number(match[2].replaceAll(',', '')) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(sen) && sen <= 999999999 ? (match[1] ? -sen : sen) : null
}

function readDetails(input) {
  const details = {}
  for (const key of detailsKeys) {
    const value = fieldValue(input, key)
    if (value) details[key] = value === '?' ? { unreadable: true } : { value }
  }
  return details
}

export function enterQuotation(input) {
  const source = fieldValue(input, 'source')
  const work = fieldValue(input, 'work')
  const statedSen = moneyInSen(fieldValue(input, 'total'))
  if (!source) return { field: 'source', error: 'Paste or transcribe the relevant quotation lines.' }
  if (!work || work === '?') return { field: 'work', error: 'Get a clearer quotation so you can enter the proposed work.' }
  if (statedSen === null) return { field: 'total', error: 'Enter the readable quoted total in ringgit, for example 450 or 1,240.50.' }

  const details = readDetails(input)
  const charges = []
  for (const [index, line] of fieldValue(input, 'charges').split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    const [description, amount, extra] = line.split('|')
    const sen = amount === undefined ? null : moneyInSen(amount.trim(), true)
    if (!description.trim() || extra !== undefined || sen === null) {
      return { field: 'charges', error: `Line ${index + 1} needs one description and amount, for example Labour | 120.` }
    }
    charges.push({ description: description.trim(), sen })
  }
  if (charges.length) {
    details.itemised = { value: charges.map(({ description, sen }) => `${description} ${formatSen(sen)}`).join('\n') }
  }
  return {
    quotation: {
      ownerEntered: true,
      source,
      work: { value: work },
      total: { value: formatSen(statedSen) },
      statedSen,
      chargesSen: charges.map(charge => charge.sen),
      lineItems: charges,
      combinedPartsAndLabour: input.combined === 'on',
      details,
    },
  }
}

export function enterReply(input) {
  const source = fieldValue(input, 'source')
  const details = Object.fromEntries(Object.entries(readDetails(input)).filter(([, detail]) => detail.value))
  if (!source || Object.keys(details).length === 0) {
    return { field: 'source', error: 'Enter the workshop’s reply and at least one detail it clarified.' }
  }
  return { reply: { source, details } }
}
