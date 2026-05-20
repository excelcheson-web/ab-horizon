/**
 * Fake email notification service.
 * Shows an in-app "email sent" toast and logs to localStorage.
 * Falls back gracefully — never blocks the transfer flow.
 */

const EMAIL_LOG_KEY = 'email_notifications_log'

function getUser() {
  try { return JSON.parse(localStorage.getItem('securebank_user') || '{}') } catch { return {} }
}

function templateFor(txn) {
  const typeLabels = {
    local: 'Local Transfer',
    international: 'International Wire',
    bill_payment: 'Bill Payment',
    investment: 'Investment Purchase',
  }
  const label = typeLabels[txn.type] || 'Transaction'
  const date = new Date(txn.date).toLocaleString()
  return {
    subject: `[BANK NAME] – ${label} Confirmation`,
    body: [
      `Dear Customer,`,
      ``,
      `Your ${label.toLowerCase()} has been processed successfully.`,
      ``,
      `Reference: ${txn.ref}`,
      `Recipient: ${txn.beneficiary}`,
      `Amount: $${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `Balance After: $${Number(txn.balanceAfter).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `Date: ${date}`,
      ``,
      `If you did not authorize this transaction, please contact us immediately.`,
      ``,
      `— [BANK NAME] Secure Banking`,
    ].join('\n'),
  }
}

/**
 * "Send" a confirmation email for a completed transaction.
 * Returns a promise that resolves with the email record.
 */
export function sendTransferEmail(txn) {
  const user = getUser()
  const email = user.email || ''
  const { subject, body } = templateFor(txn)

  const record = {
    id: Date.now(),
    to: email,
    subject,
    body,
    txnRef: txn.ref,
    sentAt: new Date().toISOString(),
  }

  // Persist to log
  const log = JSON.parse(localStorage.getItem(EMAIL_LOG_KEY) || '[]')
  log.unshift(record)
  if (log.length > 50) log.length = 50
  localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(log))

  // Dispatch a custom event so Dashboard can show a toast
  window.dispatchEvent(new CustomEvent('email-sent', { detail: { to: email, subject } }))

  return Promise.resolve(record)
}
