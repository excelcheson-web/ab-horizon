import { useState } from 'react'
import { generateTransferPDF } from '../services/pdfReceipt'
import { sendTransferEmail } from '../services/emailNotification'
import { saveTransaction } from '../services/transactionService'

function genRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'BPY-'
  for (let i = 0; i < 12; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function formatCurrency(n) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const BillIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="7" y1="8" x2="17" y2="8" />
    <line x1="7" y1="12" x2="13" y2="12" />
    <line x1="7" y1="16" x2="10" y2="16" />
  </svg>
)

const BILLERS = [
  { name: 'Electric Company', icon: '⚡', category: 'Utilities' },
  { name: 'Water & Sewer', icon: '💧', category: 'Utilities' },
  { name: 'Internet / Cable', icon: '📡', category: 'Utilities' },
  { name: 'Gas Company', icon: '🔥', category: 'Utilities' },
  { name: 'Mobile Phone', icon: '📱', category: 'Telecom' },
  { name: 'Insurance Premium', icon: '🛡️', category: 'Insurance' },
  { name: 'Credit Card Payment', icon: '💳', category: 'Finance' },
  { name: 'Mortgage / Rent', icon: '🏠', category: 'Housing' },
  { name: 'Auto Loan', icon: '🚗', category: 'Loan' },
  { name: 'Student Loan', icon: '🎓', category: 'Loan' },
  { name: 'Subscription Service', icon: '📺', category: 'Entertainment' },
  { name: 'Other', icon: '📝', category: 'Other' },
]

export default function BillPayment({ balance, onClose, onBalanceUpdate }) {
  const [step, setStep] = useState('select') // 'select' | 'form' | 'confirm' | 'receipt'
  const [selectedBiller, setSelectedBiller] = useState(null)
  const [form, setForm] = useState({ accountNo: '', amount: '', memo: '' })
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  const update = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setError('')
  }

  const handleSelectBiller = (biller) => {
    setSelectedBiller(biller)
    setStep('form')
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!form.accountNo.trim()) { setError('Account / reference number is required.'); return }
    if (!form.amount.trim()) { setError('Enter an amount.'); return }
    const amt = parseFloat(form.amount.replace(/,/g, ''))
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount.'); return }
    if (amt > balance) { setError('Insufficient balance.'); return }
    setStep('confirm')
  }

  const handleConfirm = () => {
    const amt = parseFloat(form.amount.replace(/,/g, ''))
    const newBalance = balance - amt
    const ref = genRef()

    setIsLoading(true)
    setLoadingMsg('Processing bill payment…')
    setTimeout(() => setLoadingMsg('Verifying with biller…'), 2000)
    setTimeout(() => setLoadingMsg('Finalizing payment…'), 3800)

    setTimeout(() => {
    const txn = {
      id: Date.now(),
      ref,
      type: 'bill_payment',
      category: 'Bill Pay',
      beneficiary: selectedBiller.name,
      accountNumber: form.accountNo.trim(),
      bankName: selectedBiller.category,
      amount: amt,
      balanceAfter: newBalance,
      memo: form.memo.trim(),
      direction: 'outgoing',
      date: new Date().toISOString(),
    }

    saveTransaction(txn)

    localStorage.setItem('bank_balance', String(newBalance))
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'bank_balance',
      newValue: String(newBalance),
    }))
    onBalanceUpdate(newBalance)

    // Send notification
    const notifs = JSON.parse(localStorage.getItem('securebank_notifications') || '[]')
    notifs.push({ type: 'debit', amount: formatCurrency(amt), newBalance: formatCurrency(newBalance), read: false })
    localStorage.setItem('securebank_notifications', JSON.stringify(notifs))
    window.dispatchEvent(new StorageEvent('storage', { key: 'securebank_notifications', newValue: JSON.stringify(notifs) }))

    sendTransferEmail(txn)
    setIsLoading(false)
    setReceipt(txn)
    setStep('receipt')
    }, 5000)
  }

  const amt = parseFloat((form.amount || '0').replace(/,/g, '')) || 0

  // ── Loading view ──
  if (isLoading) {
    return (
      <div className="tf-overlay">
        <div className="tf-sheet">
          <div className="tf-loading-sheet">
            <div className="server-spinner" />
            <div className="server-progress">
              <div className="server-progress-bar"><div className="server-progress-fill" /></div>
              <p className="server-progress-msg">{loadingMsg}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Receipt view ──
  if (step === 'receipt' && receipt) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet tf-receipt" onClick={(e) => e.stopPropagation()}>
          <div className="tf-receipt-check">✓</div>
          <h2 className="tf-receipt-title">Bill Payment Successful</h2>
          <div className="tf-receipt-rows">
            <div className="tf-receipt-row"><span>Reference</span><strong>{receipt.ref}</strong></div>
            <div className="tf-receipt-row"><span>Biller</span><strong>{receipt.beneficiary}</strong></div>
            <div className="tf-receipt-row"><span>Category</span><strong>{selectedBiller.category}</strong></div>
            <div className="tf-receipt-row"><span>Account #</span><strong>{receipt.accountNumber}</strong></div>
            <div className="tf-receipt-row"><span>Amount</span><strong className="tf-receipt-amt">-${formatCurrency(receipt.amount)}</strong></div>
            <div className="tf-receipt-row"><span>Balance After</span><strong>${formatCurrency(receipt.balanceAfter)}</strong></div>
          </div>
          <button className="tf-btn tf-btn--download" onClick={() => generateTransferPDF(receipt)}>
            ↓ Download PDF Receipt
          </button>
          <button className="tf-btn tf-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  // ── Confirmation view ──
  if (step === 'confirm') {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="tf-header">
            <div className="tf-header-icon tf-header-icon--bill"><BillIcon /></div>
            <div>
              <h2 className="tf-title">Confirm Payment</h2>
              <p className="tf-subtitle">Review the details below</p>
            </div>
            <button className="tf-close" onClick={onClose}><CloseIcon /></button>
          </div>

          <div className="bp-confirm-card">
            <div className="bp-confirm-biller">
              <span className="bp-confirm-icon">{selectedBiller.icon}</span>
              <div>
                <strong>{selectedBiller.name}</strong>
                <span className="bp-confirm-cat">{selectedBiller.category}</span>
              </div>
            </div>
            <div className="bp-confirm-rows">
              <div className="bp-confirm-row"><span>Account / Ref #</span><strong>{form.accountNo}</strong></div>
              <div className="bp-confirm-row"><span>Amount</span><strong className="tf-receipt-amt">-${formatCurrency(amt)}</strong></div>
              <div className="bp-confirm-row"><span>Balance After</span><strong>${formatCurrency(balance - amt)}</strong></div>
              {form.memo && <div className="bp-confirm-row"><span>Memo</span><strong>{form.memo}</strong></div>}
            </div>
          </div>

          <div className="bp-confirm-btns">
            <button className="tf-btn tf-btn--ghost" onClick={() => setStep('form')}>← Back</button>
            <button className="tf-btn tf-btn--primary" onClick={handleConfirm}>Pay Now</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form view ──
  if (step === 'form' && selectedBiller) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="tf-header">
            <div className="tf-header-icon tf-header-icon--bill"><BillIcon /></div>
            <div>
              <h2 className="tf-title">Pay {selectedBiller.name}</h2>
              <p className="tf-subtitle">{selectedBiller.category}</p>
            </div>
            <button className="tf-close" onClick={onClose}><CloseIcon /></button>
          </div>

          <div className="tf-bal-chip">
            Available: <strong>${formatCurrency(balance)}</strong>
          </div>

          <div className="bp-selected-biller">
            <span className="bp-selected-icon">{selectedBiller.icon}</span>
            <span className="bp-selected-name">{selectedBiller.name}</span>
            <button className="bp-change-btn" onClick={() => { setStep('select'); setError('') }}>Change</button>
          </div>

          <form className="tf-form" onSubmit={handleFormSubmit}>
            <div className="tf-field">
              <label className="tf-label">Account / Reference Number</label>
              <input className="tf-input" placeholder="e.g. 123456789" value={form.accountNo} onChange={(e) => update('accountNo', e.target.value)} />
            </div>

            <div className="tf-field">
              <label className="tf-label">Amount ($)</label>
              <input className="tf-input tf-input--amount" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
            </div>

            <div className="tf-field">
              <label className="tf-label">Memo (optional)</label>
              <input className="tf-input" placeholder="e.g. March 2026 payment" value={form.memo} onChange={(e) => update('memo', e.target.value)} />
            </div>

            {error && <div className="tf-error">{error}</div>}

            <button type="submit" className="tf-btn tf-btn--primary">Review Payment</button>
          </form>
        </div>
      </div>
    )
  }

  // ── Biller selection view (default) ──
  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tf-header">
          <div className="tf-header-icon tf-header-icon--bill"><BillIcon /></div>
          <div>
            <h2 className="tf-title">Bill Payment</h2>
            <p className="tf-subtitle">Select a biller to pay</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="tf-bal-chip">
          Available: <strong>${formatCurrency(balance)}</strong>
        </div>

        <div className="bp-biller-grid">
          {BILLERS.map((b) => (
            <button key={b.name} className="bp-biller-card" onClick={() => handleSelectBiller(b)}>
              <span className="bp-biller-icon">{b.icon}</span>
              <span className="bp-biller-name">{b.name}</span>
              <span className="bp-biller-cat">{b.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
