export const INVALID_AMOUNT_MESSAGE = 'Enter a valid amount such as 20224.71 or 20,224.71, with no more than two decimal places.'

export function parseAmountCents(value) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  if (text.length > 30 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) {
    throw new Error(INVALID_AMOUNT_MESSAGE)
  }
  const [whole, fraction = ''] = text.replace(/,/g, '').split('.')
  // Parse decimal digits directly; never truncate a malformed amount with parseFloat.
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(INVALID_AMOUNT_MESSAGE)
  return Number(cents)
}
