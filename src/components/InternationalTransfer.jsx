import { useState, useRef } from 'react'
import { generateTransferPDF } from '../services/pdfReceipt'
import { sendTransferEmail } from '../services/emailNotification'
import { sendOtp, verifyOtp } from '../services/otpService'
import { saveTransaction } from '../services/transactionService'
import { checkUserSuspensionStatus } from '../services/adminService'

function getUserUid() {
  try { return JSON.parse(localStorage.getItem('securebank_user') || '{}').uid || '' } catch { return '' }
}

// Get last N unique recipients for a given transfer type from localStorage
function getRecentRecipients(type, limit = 6) {
  try {
    const history = JSON.parse(localStorage.getItem('transfer_history') || '[]')
    const seen = new Set()
    const result = []
    for (const t of history) {
      if (t.type !== type) continue
      const key = `${t.beneficiary}|${t.accountNumber || t.iban || ''}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(t)
      }
      if (result.length >= limit) break
    }
    return result
  } catch { return [] }
}

// Get last N transfers for a given type
function getTransferHistory(type, limit = 8) {
  try {
    const history = JSON.parse(localStorage.getItem('transfer_history') || '[]')
    return history.filter(t => t.type === type).slice(0, limit)
  } catch { return [] }
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
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

const GlobeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

export default function InternationalTransfer({ balance, onClose, onBalanceUpdate, initialAmount }) {
  const [form, setForm] = useState({
    beneficiary: '',
    iban: '',
    swift: '',
    bankName: '',
    country: '',
    amount: initialAmount || '',
    description: '',
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
  const [showHistory, setShowHistory] = useState(false)
  const [recentRecipients] = useState(() => getRecentRecipients('international'))
  const [txnHistory] = useState(() => getTransferHistory('international'))

  const update = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setError('')
  }

  const fillFromRecipient = (t) => {
    setForm(p => ({
      ...p,
      beneficiary: t.beneficiary || '',
      iban: t.iban || '',
      swift: t.swift || '',
      bankName: t.bankName || '',
      country: t.country || '',
      description: '',
      amount: '',
    }))
    setError('')
  }

  const repeatTransfer = (t) => {
    setForm(p => ({
      ...p,
      beneficiary: t.beneficiary || '',
      iban: t.iban || '',
      swift: t.swift || '',
      bankName: t.bankName || '',
      country: t.country || '',
      description: t.description || '',
      amount: String(t.amount || ''),
    }))
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

    // Always check Firestore — this also updates localStorage so unsuspend
    // is reflected immediately without requiring a logout/login
    const uid = getUserUid()
    const suspensionStatus = await checkUserSuspensionStatus(uid)
    if (suspensionStatus.suspended) {
      window.dispatchEvent(new CustomEvent('show-suspend-modal', {
        detail: { reason: suspensionStatus.reason }
      }))
      return
    }
    
    const { beneficiary, iban, swift, bankName, country, amount } = form

    if (!beneficiary.trim() || !iban.trim() || !swift.trim() || !bankName.trim() || !country.trim() || !amount.trim()) {
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

    // Build pending transaction
    const newBalance = balance - amt
    const ref = genRef()
    setPendingTxn({
      id: Date.now(),
      ref,
      type: 'international',
      beneficiary: beneficiary.trim(),
      iban: iban.trim(),
      swift: swift.trim(),
      bankName: bankName.trim(),
      country: country.trim(),
      amount: amt,
      description: form.description.trim(),
      balanceAfter: newBalance,
      date: new Date().toISOString(),
    })

    // Step 1: SWIFT network connection
    setIsLoading(true)
    setLoadingMsg('Connecting to SWIFT network…')

    setTimeout(() => {
      // Step 2: Send OTP to registered email
      window.console.clear()
      setLoadingMsg('Sending verification code…')
      setOtpCode(['', '', '', '', '', ''])
      setOtpError('')

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
    }, 3000)
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

    // OTP verified → process transfer
    setOtpStep(false)
    setIsLoading(true)
    setLoadingMsg('Processing international transfer…')
    setTimeout(() => setLoadingMsg('Routing through SWIFT gateway…'), 800)

    setTimeout(() => {
      const txn = pendingTxn
      saveTransaction(txn)

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
      <div className="tf-sheet tf-sheet--scrollable" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tf-header">
          <div className="tf-header-icon tf-header-icon--intl"><GlobeIcon /></div>
          <div>
            <h2 className="tf-title">International Transfer</h2>
            <p className="tf-subtitle">Send money worldwide via SWIFT</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* Balance chip */}
        <div className="tf-bal-chip">
          Available: <strong>${formatCurrency(balance)}</strong>
        </div>

        {/* ── Recent Recipients ── */}
        {recentRecipients.length > 0 && (
          <div className="tf-recent-section">
            <p className="tf-recent-label">Recent Recipients</p>
            <div className="tf-recent-scroll">
              {recentRecipients.map((r, i) => (
                <button key={i} className="tf-recent-card" onClick={() => fillFromRecipient(r)}>
                  <div className="tf-recent-avatar">{initials(r.beneficiary)}</div>
                  <span className="tf-recent-name">{r.beneficiary}</span>
                  <span className="tf-recent-bank">{r.bankName} · {r.country}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="tf-form" onSubmit={handleSubmit}>
          <div className="tf-field">
            <label className="tf-label">Beneficiary Name</label>
            <input className="tf-input" placeholder="Full legal name" value={form.beneficiary} onChange={(e) => update('beneficiary', e.target.value)} />
          </div>

          <div className="tf-row-2">
            <div className="tf-field">
              <label className="tf-label">IBAN / Account No.</label>
              <input className="tf-input" placeholder="e.g. GB29 NWBK 6016..." value={form.iban} onChange={(e) => update('iban', e.target.value)} />
            </div>
            <div className="tf-field">
              <label className="tf-label">SWIFT / BIC Code</label>
              <input className="tf-input" placeholder="e.g. NWBKGB2L" value={form.swift} onChange={(e) => update('swift', e.target.value)} />
            </div>
          </div>

          <div className="tf-row-2">
            <div className="tf-field">
              <label className="tf-label">Bank Name</label>
              <input className="tf-input" placeholder="e.g. Barclays UK" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} />
            </div>
            <div className="tf-field">
              <label className="tf-label">Country</label>
              <input className="tf-input" placeholder="e.g. United Kingdom" value={form.country} onChange={(e) => update('country', e.target.value)} />
            </div>
          </div>

          <div className="tf-field">
            <label className="tf-label">Amount ($)</label>
            <input className="tf-input tf-input--amount" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
          </div>

          <div className="tf-field">
            <label className="tf-label">Description of Payment</label>
            <input className="tf-input" placeholder="e.g. Invoice payment, Family support, etc." value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>

          {error && <div className="tf-error">{error}</div>}

          <button type="submit" className="tf-btn tf-btn--primary">Confirm Transfer</button>
        </form>

        {/* ── Transfer History ── */}
        {txnHistory.length > 0 && (
          <div className="tf-history-section">
            <button className="tf-history-toggle" onClick={() => setShowHistory(p => !p)}>
              <span>Transfer History</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showHistory && (
              <div className="tf-history-list">
                {txnHistory.map((t, i) => (
                  <div key={i} className="tf-history-item">
                    <div className="tf-history-avatar">{initials(t.beneficiary)}</div>
                    <div className="tf-history-info">
                      <span className="tf-history-name">{t.beneficiary}</span>
                      <span className="tf-history-meta">{t.bankName} · {t.country} · {fmtDate(t.date)}</span>
                    </div>
                    <div className="tf-history-right">
                      <span className="tf-history-amt">-${formatCurrency(t.amount)}</span>
                      <button className="tf-repeat-btn" onClick={() => repeatTransfer(t)}>Repeat</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
