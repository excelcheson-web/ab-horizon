import { useState } from 'react'
import { saveTransaction } from '../services/transactionService'

function genRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'DEP-'
  for (let i = 0; i < 10; i++) ref += chars[Math.floor(Math.random() * chars.length)]
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

const METHODS = [
  { id: 'check', icon: '🏦', label: 'Check Deposit', desc: 'Snap a photo of your check' },
  { id: 'ach', icon: '🔗', label: 'ACH / Direct', desc: 'From external bank account' },
  { id: 'cash', icon: '💵', label: 'Cash Deposit', desc: 'At any partnered ATM or branch' },
]

export default function DepositOverlay({ balance, onClose, onBalanceUpdate }) {
  const [method, setMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  const handleDeposit = (e) => {
    e.preventDefault()
    const amt = parseFloat(amount.replace(/,/g, ''))
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid deposit amount.')
      return
    }

    setIsLoading(true)
    setLoadingMsg('Verifying deposit…')

    setTimeout(() => {
      setLoadingMsg('Processing funds…')
    }, 2000)

    setTimeout(() => {
      setLoadingMsg('Crediting your account…')
    }, 3800)

    setTimeout(() => {
      const newBalance = balance + amt
      const ref = genRef()
      const txn = {
        id: Date.now(),
        ref,
        type: 'deposit',
        method: method,
        amount: amt,
        balanceAfter: newBalance,
        date: new Date().toISOString(),
      }

      saveTransaction(txn)

      localStorage.setItem('bank_balance', String(newBalance))
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'bank_balance',
        newValue: String(newBalance),
      }))
      onBalanceUpdate(newBalance)

      setIsLoading(false)
      setReceipt({ ref, amount: amt, newBalance })
    }, 5000)
  }

  // Loading
  if (isLoading) {
    return (
      <div className="tf-overlay">
        <div className="tf-sheet tf-loading-sheet">
          <div className="server-spinner" />
          <div className="server-progress">
            <div className="server-progress-bar"><div className="server-progress-fill" /></div>
            <p className="server-progress-msg">{loadingMsg}</p>
          </div>
        </div>
      </div>
    )
  }

  // Receipt
  if (receipt) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet tf-receipt" onClick={(e) => e.stopPropagation()}>
          <div className="tf-receipt-check">✓</div>
          <h2 className="tf-receipt-title">Deposit Received</h2>
          <div className="tf-receipt-rows">
            <div className="tf-receipt-row"><span>Reference</span><strong>{receipt.ref}</strong></div>
            <div className="tf-receipt-row"><span>Amount</span><strong style={{ color: '#c9a23a' }}>+${formatCurrency(receipt.amount)}</strong></div>
            <div className="tf-receipt-row"><span>New Balance</span><strong>${formatCurrency(receipt.newBalance)}</strong></div>
          </div>
          <button className="tf-btn tf-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  // Method picker
  if (!method) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="tf-header">
            <div className="tf-header-icon dep-header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0l4-4m-4 4l-4-4" /><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div>
              <h2 className="tf-title">Deposit Funds</h2>
              <p className="tf-subtitle">Choose a deposit method</p>
            </div>
            <button className="tf-close" onClick={onClose}><CloseIcon /></button>
          </div>

          <div className="tf-bal-chip">
            Current balance: <strong>${formatCurrency(balance)}</strong>
          </div>

          <div className="dep-methods">
            {METHODS.map((m) => (
              <button key={m.id} className="dep-method-btn" onClick={() => setMethod(m.id)}>
                <span className="dep-method-icon">{m.icon}</span>
                <div className="dep-method-text">
                  <span className="dep-method-label">{m.label}</span>
                  <span className="dep-method-desc">{m.desc}</span>
                </div>
                <span className="dep-method-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Amount form
  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tf-header">
          <div className="tf-header-icon dep-header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l4-4m-4 4l-4-4" /><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
            </svg>
          </div>
          <div>
            <h2 className="tf-title">Deposit Amount</h2>
            <p className="tf-subtitle">{METHODS.find((m) => m.id === method)?.label}</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        <form className="tf-form" onSubmit={handleDeposit}>
          <div className="tf-field">
            <label className="tf-label">Amount ($)</label>
            <input
              className="tf-input tf-input--amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              autoFocus
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError('') }}
            />
          </div>
          {error && <div className="tf-error">{error}</div>}
          <button type="submit" className="tf-btn tf-btn--primary">Confirm Deposit</button>
          <button type="button" className="tf-btn dep-back-btn" onClick={() => setMethod(null)}>← Back</button>
        </form>
      </div>
    </div>
  )
}
