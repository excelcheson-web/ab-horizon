import { useState, useRef, useEffect } from 'react'
import { generateTransferPDF } from '../services/pdfReceipt'
import { sendTransferEmail } from '../services/emailNotification'
import { sendOtp, verifyOtp } from '../services/otpService'
import { saveTransaction } from '../services/transactionService'
import { checkUserSuspensionStatus } from '../services/adminService'

function getUserUid() {
  try { return JSON.parse(localStorage.getItem('securebank_user') || '{}').uid || '' } catch { return '' }
}

function genRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'TXN-'
  for (let i = 0; i < 12; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function formatCurrency(n) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getUserEmail() {
  try { return JSON.parse(localStorage.getItem('securebank_user') || '{}').email || '' } catch { return '' }
}

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const BoltIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

export default function LocalTransfer({ balance, onClose, onBalanceUpdate }) {
  const [form, setForm] = useState({
    beneficiary: '',
    accountNumber: '',
    bankName: '',
    amount: '',
  })
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [otpRef, setOtpRef] = useState('')
  const [otpConfirmMsg, setOtpConfirmMsg] = useState('')
  const [pendingTxn, setPendingTxn] = useState(null)
  const otpRefs = useRef([])

  // Check suspension immediately when the sheet opens (localStorage is instant)
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem('securebank_admin') || '{}')
      if (a.suspended) {
        window.dispatchEvent(new CustomEvent('show-suspend-modal', {
          detail: { reason: a.suspendReason || '' }
        }))
      }
    } catch { /* silent */ }
  }, [])

  const update = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setError('')
  }

  const handleOtpChange = (idx, value) => {
    if (!/^\d?$/.test(value)) return
    setOtpCode((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
    setOtpError('')
    if (value && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check for account suspension from Firestore (enforced across all devices)
    const uid = getUserUid()
    const suspensionStatus = await checkUserSuspensionStatus(uid)
    if (suspensionStatus.suspended) {
      window.dispatchEvent(new CustomEvent('show-suspend-modal', { 
        detail: { reason: suspensionStatus.reason }
      }))
      return
    }
    
    const { beneficiary, accountNumber, bankName, amount } = form

    if (!beneficiary.trim() || !accountNumber.trim() || !bankName.trim() || !amount.trim()) {
      setError('All fields are required.')
      return
    }

    const amt = parseFloat(amount.replace(/,/g, ''))
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount.')
      return
    }

    if (amt > balance) {
      setError('Insufficient balance for this transfer.')
      return
    }

    // Build pending txn
    const newBalance = balance - amt
    const ref = genRef()
    setPendingTxn({
      id: Date.now(),
      ref,
      type: 'local',
      beneficiary: beneficiary.trim(),
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      amount: amt,
      balanceAfter: newBalance,
      date: new Date().toISOString(),
    })

    // Send OTP to registered email → then show OTP modal
    window.console.clear()
    setOtpCode(['', '', '', '', '', ''])
    setOtpError('')
    setIsLoading(true)
    setLoadingMsg('Sending verification code…')

    const email = getUserEmail()
    const code = sendOtp(
      () => {
        // Success
        setOtpRef(code)
        setOtpConfirmMsg(`A secure code has been sent to ${email}. Please check your inbox to confirm the transfer.`)
        setIsLoading(false)
        setOtpStep(true)
      },
      (err) => {
        // Failure
        alert('EmailJS Error: ' + JSON.stringify(err))
        setIsLoading(false)
        setPendingTxn(null)
      }
    )
  }

  const handleOtpVerify = () => {
    const entered = otpCode.join('')
    if (entered.length < 6) {
      setOtpError('Please enter all 6 digits.')
      return
    }

    // Verify against service (or demo ref)
    const valid = otpRef ? entered === otpRef : verifyOtp(entered)
    if (!valid) {
      setOtpError('Invalid code. Please try again.')
      setOtpCode(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
      return
    }

    // OTP correct → process transfer with loading
    setOtpStep(false)
    setIsLoading(true)
    setLoadingMsg('Processing transfer…')
    setTimeout(() => setLoadingMsg('Confirming with bank server…'), 800)

    setTimeout(() => {
      const txn = pendingTxn
      // Save to history (localStorage + Firestore)
      saveTransaction(txn)

      // Update balance
      localStorage.setItem('bank_balance', String(txn.balanceAfter))
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'bank_balance',
        newValue: String(txn.balanceAfter),
      }))
      onBalanceUpdate(txn.balanceAfter)
      sendTransferEmail(txn)

      setIsLoading(false)
      setReceipt(txn)
    }, 1800)
  }

  // ── Loading view ──
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

  // ── OTP Security Modal ──
  if (otpStep) {
    return (
      <div className="tf-overlay">
        <div className="tf-sheet otp-security-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="otp-security-icon"><ShieldIcon /></div>
          <h2 className="otp-security-title">Security Verification</h2>
          <p className="otp-security-desc">
            {otpConfirmMsg || 'A 6-digit confirmation code has been sent to your registered email.'}
          </p>
          <div className="otp-security-row">
            {otpCode.map((d, i) => (
              <input
                key={i}
                ref={(el) => (otpRefs.current[i] = el)}
                className={`otp-security-box ${otpError ? 'otp-security-box--error' : ''}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>
          {otpError && <p className="otp-security-error">{otpError}</p>}
          <button className="tf-btn tf-btn--primary" onClick={handleOtpVerify} disabled={otpCode.join('').length < 6}>
            Confirm Transfer
          </button>
          <button className="tf-btn tf-btn--ghost" onClick={() => { setOtpStep(false); setPendingTxn(null) }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Receipt view ──
  if (receipt) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet tf-receipt" onClick={(e) => e.stopPropagation()}>
          <div className="tf-receipt-check">✓</div>
          <h2 className="tf-receipt-title">Transfer Successful</h2>
          <div className="tf-receipt-rows">
            <div className="tf-receipt-row"><span>Reference</span><strong>{receipt.ref}</strong></div>
            <div className="tf-receipt-row"><span>To</span><strong>{receipt.beneficiary}</strong></div>
            <div className="tf-receipt-row"><span>Amount</span><strong className="tf-receipt-amt">-${formatCurrency(receipt.amount)}</strong></div>
            <div className="tf-receipt-row"><span>New Balance</span><strong>${formatCurrency(receipt.balanceAfter)}</strong></div>
          </div>
          <button className="tf-btn tf-btn--download" onClick={() => generateTransferPDF(receipt)}>
            ↓ Download PDF Receipt
          </button>
          <button className="tf-btn tf-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  // ── Form view ──
  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tf-header">
          <div className="tf-header-icon tf-header-icon--local"><BoltIcon /></div>
          <div>
            <h2 className="tf-title">Local Transfer</h2>
            <p className="tf-subtitle">Instant domestic bank transfer</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* Balance chip */}
        <div className="tf-bal-chip">
          Available: <strong>${formatCurrency(balance)}</strong>
        </div>

        <form className="tf-form" onSubmit={handleSubmit}>
          <div className="tf-field">
            <label className="tf-label">Beneficiary Name</label>
            <input className="tf-input" placeholder="Recipient's full name" value={form.beneficiary} onChange={(e) => update('beneficiary', e.target.value)} />
          </div>

          <div className="tf-field">
            <label className="tf-label">Account Number</label>
            <input className="tf-input" placeholder="e.g. 0123456789" value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} />
          </div>

          <div className="tf-field">
            <label className="tf-label">Bank Name</label>
            <input className="tf-input" placeholder="e.g. Optima Credit Union" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} />
          </div>

          <div className="tf-field">
            <label className="tf-label">Amount ($)</label>
            <input className="tf-input tf-input--amount" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
          </div>

          {error && <div className="tf-error">{error}</div>}

          <button type="submit" className="tf-btn tf-btn--primary">Confirm Transfer</button>
        </form>
      </div>
    </div>
  )
}
