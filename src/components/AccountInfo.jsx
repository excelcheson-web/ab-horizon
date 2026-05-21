import { useState } from 'react'

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

function formatCurrency(n) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AccountInfo({ user, profile, balance, onClose }) {
  const [copied, setCopied] = useState(null)

  // Accept either `user` or `profile` prop (Dashboard passes `profile`)
  const p = user || profile

  const name = p?.name || p?.full_name
    || localStorage.getItem('user_name')
    || 'Account Holder'
  const email = p?.email
    || localStorage.getItem('user_email')
    || '—'
  const accountNumber = p?.accountNumber || p?.account_number
    || localStorage.getItem('user_account_number')
    || '—'
  const routingNumber = '031101266'
  const accountType = p?.accountType || p?.account_type
    || localStorage.getItem('user_account_type')
    || 'Savings Account'
  const bankName = 'Optima Credit Union'
  const swiftCode = 'DEMOBNKUS'

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const rows = [
    { label: 'Account Holder', value: name },
    { label: 'Email', value: email },
    { label: 'Account Number', value: accountNumber, copyable: true },
    { label: 'Routing Number', value: routingNumber, copyable: true },
    { label: 'SWIFT / BIC', value: swiftCode, copyable: true },
    { label: 'Account Type', value: accountType },
    { label: 'Bank', value: bankName },
    { label: 'Status', value: 'Active', badge: true },
  ]

  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-sheet ai-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tf-header">
          <div className="tf-header-icon ai-header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <h2 className="tf-title">Account Information</h2>
            <p className="tf-subtitle">Your banking details</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* Balance highlight */}
        <div className="ai-balance-block">
          <span className="ai-balance-label">Current Balance</span>
          <span className="ai-balance-value font-mono">${formatCurrency(balance)}</span>
        </div>

        {/* Info rows */}
        <div className="ai-rows">
          {rows.map((r) => (
            <div key={r.label} className="ai-row">
              <span className="ai-row-label">{r.label}</span>
              <div className="ai-row-value-wrap">
                {r.badge ? (
                  <span className="ai-badge-active">● {r.value}</span>
                ) : (
                  <span className={`ai-row-value ${r.copyable ? 'font-mono' : ''}`}>{r.value}</span>
                )}
                {r.copyable && (
                  <button
                    className={`ai-copy-btn ${copied === r.label ? 'ai-copy-btn--ok' : ''}`}
                    onClick={() => copy(r.value, r.label)}
                  >
                    {copied === r.label ? '✓' : <CopyIcon />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="tf-btn tf-btn--primary" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
