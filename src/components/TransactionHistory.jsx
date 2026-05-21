import { useState, useEffect, useMemo } from 'react'
import { generateTransferPDF } from '../services/pdfReceipt'
import { loadTransactions } from '../services/transactionService'

function fmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('securebank_user') || '{}') } catch { return {} }
}

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const TYPE_LABELS = {
  local: 'Local Transfer',
  international: 'Intl Wire',
  bill_payment: 'Bill Payment',
  investment: 'Investment',
  deposit: 'Deposit',
  credit: 'Credit',
  incoming: 'Incoming Transfer',
}

const PERIOD_OPTIONS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last 6 Months', days: 180 },
  { label: 'Last 12 Months', days: 365 },
  { label: 'All Time', days: 0 },
]

export default function TransactionHistory({ onClose }) {
  const [tab, setTab] = useState('transactions') // 'transactions' | 'statements'
  const [period, setPeriod] = useState(30)
  const [search, setSearch] = useState('')
  const [stmtPeriod, setStmtPeriod] = useState(30)
  const [stmtRequested, setStmtRequested] = useState(false)
  const [stmtSending, setStmtSending] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const [allTxns, setAllTxns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('transfer_history') || '[]') } catch { return [] }
  })

  // Load from Firestore on mount and merge with localStorage
  useEffect(() => {
    const uid = (() => {
      try { return JSON.parse(localStorage.getItem('securebank_user') || '{}').uid || null } catch { return null }
    })()
    loadTransactions(uid).then((txns) => {
      if (txns.length > 0) setAllTxns(txns)
    }).catch(() => { /* keep localStorage data */ })
  }, [])

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff = period > 0 ? now - period * 86400000 : 0
    return allTxns.filter((t) => {
      const ts = new Date(t.date).getTime()
      if (ts < cutoff) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          (t.beneficiary || '').toLowerCase().includes(q) ||
          (t.ref || '').toLowerCase().includes(q) ||
          (t.type || '').toLowerCase().includes(q) ||
          (t.sender || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
        )
      }
      return true
    }).slice(0, 15) // Show up to 15 transactions
  }, [allTxns, period, search])

  // Group by date
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach((t) => {
      const d = new Date(t.date)
      const today = new Date()
      const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
      let label
      if (d.toDateString() === today.toDateString()) label = 'Today'
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
      else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      if (!map[label]) map[label] = []
      map[label].push(t)
    })
    return Object.entries(map)
  }, [filtered])

  // Statement txns for selected period
  const stmtTxns = useMemo(() => {
    const now = Date.now()
    const cutoff = stmtPeriod > 0 ? now - stmtPeriod * 86400000 : 0
    return allTxns.filter((t) => new Date(t.date).getTime() >= cutoff)
  }, [allTxns, stmtPeriod])

  const handleRequestStatement = () => {
    setStmtSending(true)
    const user = getUser()
    const email = user.email || ''
    // Simulate sending
    setTimeout(() => {
      // Log to email notifications
      const log = JSON.parse(localStorage.getItem('email_notifications_log') || '[]')
      const periodLabel = PERIOD_OPTIONS.find((p) => p.days === stmtPeriod)?.label || 'Custom'
      log.unshift({
        id: Date.now(),
        to: email,
        subject: `Optima Credit Union – Account Statement (${periodLabel})`,
        body: `Your account statement for ${periodLabel} containing ${stmtTxns.length} transaction(s) has been generated and sent to ${email}.`,
        sentAt: new Date().toISOString(),
      })
      if (log.length > 50) log.length = 50
      localStorage.setItem('email_notifications_log', JSON.stringify(log))

      window.dispatchEvent(new CustomEvent('email-sent', {
        detail: { to: email, subject: `Account Statement (${periodLabel})` }
      }))

      setStmtSending(false)
      setStmtRequested(true)
      setTimeout(() => setStmtRequested(false), 4000)
    }, 5000)
  }

  // Helper to determine if transaction is credit (green) or debit (red)
  const isCredit = (t) => {
    const creditTypes = ['deposit', 'credit', 'payroll', 'refund', 'incoming']
    return creditTypes.includes(t.type) || t.direction === 'incoming'
  }

  // ── Transactions Tab ──
  const renderTransactions = () => {
    const totalDebited = filtered.reduce((s, t) => s + (isCredit(t) ? 0 : (t.amount || 0)), 0)
    const totalCredited = filtered.reduce((s, t) => s + (isCredit(t) ? (Math.abs(t.amount) || 0) : 0), 0)

    return (
    <div className="th-content">
      {/* Search + Period filter */}
      <div className="th-filters">
        <div className="th-search-wrap">
          <svg className="th-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="th-search"
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="th-period-select" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.days} value={p.days}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="th-summary">
        <div className="th-summary-item">
          <span className="th-summary-label">Total Transactions</span>
          <strong className="th-summary-value">{filtered.length}</strong>
        </div>
        <div className="th-summary-item">
          <span className="th-summary-label">Total Credited</span>
          <strong className="th-summary-value th-credit">+${fmt(totalCredited)}</strong>
        </div>
        <div className="th-summary-item">
          <span className="th-summary-label">Total Debited</span>
          <strong className="th-summary-value th-debit">-${fmt(totalDebited)}</strong>
        </div>
      </div>

      {/* Transaction list */}
      <div className="th-list">
        {grouped.length === 0 ? (
          <div className="th-empty">
            <span className="th-empty-icon">📋</span>
            <p>No transactions found</p>
            <span className="th-empty-hint">Transactions will appear here after you make transfers</span>
          </div>
        ) : grouped.map(([dateLabel, txns]) => (
          <div key={dateLabel} className="th-group">
            <p className="th-group-date">{dateLabel}</p>
              {txns.map((t) => {
                const credit = isCredit(t)
                const displayAmount = Math.abs(t.amount || 0)
                return (
                <div key={t.id} className={`th-txn ${credit ? 'th-txn--incoming' : 'th-txn--outgoing'}`} onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                  <div className="th-txn-row">
                    <div className="th-txn-icon-wrap">
                      <span className={`th-txn-type-dot th-txn-type-dot--${t.type} ${credit ? 'th-txn-type-dot--incoming' : ''}`} />
                    </div>
                    <div className="th-txn-info">
                      <span className="th-txn-name">{t.beneficiary || t.sender || 'Unknown'}</span>
                      <span className="th-txn-meta">{TYPE_LABELS[t.type] || t.type} · {t.ref}</span>
                    </div>
                    <div className="th-txn-amounts">
                      <span className={`th-txn-amount font-mono ${credit ? 'th-txn-amount--credit' : 'th-txn-amount--debit'}`}>
                        {credit ? '+' : '-'}${fmt(displayAmount)}
                      </span>
                    </div>
                  </div>
                {expandedId === t.id && (
                  <div className="th-txn-detail">
                    <div className="th-detail-row"><span>Reference</span><strong>{t.ref}</strong></div>
                    <div className="th-detail-row"><span>Type</span><strong>{TYPE_LABELS[t.type] || t.type}</strong></div>
                    <div className="th-detail-row"><span>Direction</span><strong>{credit ? 'Incoming (Credit)' : 'Outgoing (Debit)'}</strong></div>
                    {t.sender && <div className="th-detail-row"><span>Sender</span><strong>{t.sender}</strong></div>}
                    <div className="th-detail-row"><span>{credit ? 'Sender' : 'Beneficiary'}</span><strong>{credit ? (t.sender || t.beneficiary) : t.beneficiary}</strong></div>
                    {t.accountNumber && <div className="th-detail-row"><span>Account</span><strong>{t.accountNumber}</strong></div>}
                    {t.bankName && <div className="th-detail-row"><span>Bank</span><strong>{t.bankName}</strong></div>}
                    {t.country && <div className="th-detail-row"><span>Country</span><strong>{t.country}</strong></div>}
                    {t.description && <div className="th-detail-row"><span>Description</span><strong>{t.description}</strong></div>}
                    <div className="th-detail-row"><span>Amount</span><strong className={credit ? 'th-credit' : ''}>{credit ? '+' : '-'}${fmt(displayAmount)}</strong></div>
                    <div className="th-detail-row"><span>Date</span><strong>{new Date(t.date).toLocaleString()}</strong></div>
                    <button className="th-download-btn" onClick={(e) => { e.stopPropagation(); generateTransferPDF(t) }}>
                      ↓ Download Receipt
                    </button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
    )
  }

  // ── Statements Tab ──
  const renderStatements = () => {
    const user = getUser()
    const email = user.email || ''
    const periodLabel = PERIOD_OPTIONS.find((p) => p.days === stmtPeriod)?.label || 'Custom'

    return (
      <div className="th-content">
        <div className="th-stmt-card">
          <h3 className="th-stmt-title">Request Account Statement</h3>
          <p className="th-stmt-desc">Select a period and request your statement. It will be sent to your registered email.</p>

          <div className="th-stmt-email-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <span>{email}</span>
          </div>

          <label className="th-stmt-label">Statement Period</label>
          <div className="th-stmt-periods">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.days}
                className={`th-stmt-period-btn ${stmtPeriod === p.days ? 'th-stmt-period-btn--active' : ''}`}
                onClick={() => { setStmtPeriod(p.days); setStmtRequested(false) }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="th-stmt-preview">
            <div className="th-stmt-preview-row"><span>Period</span><strong>{periodLabel}</strong></div>
            <div className="th-stmt-preview-row"><span>Transactions</span><strong>{stmtTxns.length}</strong></div>
            <div className="th-stmt-preview-row"><span>Total Debited</span><strong>-${fmt(stmtTxns.reduce((s, t) => s + (t.amount || 0), 0))}</strong></div>
            <div className="th-stmt-preview-row"><span>Deliver To</span><strong>{email}</strong></div>
          </div>

          {stmtRequested ? (
            <div className="th-stmt-success">
              <span className="th-stmt-success-icon">✓</span>
              Statement sent to {email}
            </div>
          ) : (
            <button className="th-stmt-request-btn" onClick={handleRequestStatement} disabled={stmtSending || stmtTxns.length === 0}>
              {stmtSending ? (
                <span className="th-spinner" />
              ) : (
                <>📧 Request Statement</>
              )}
            </button>
          )}
        </div>

        {/* Recent statement requests */}
        <div className="th-stmt-history">
          <h4 className="th-stmt-history-title">Statement Transactions Preview</h4>
          {stmtTxns.length === 0 ? (
            <div className="th-empty">
              <p>No transactions in this period</p>
            </div>
          ) : stmtTxns.slice(0, 10).map((t) => (
            <div key={t.id} className="th-stmt-txn">
              <div className="th-stmt-txn-left">
                <span className={`th-txn-type-dot th-txn-type-dot--${t.type}`} />
                <div>
                  <span className="th-stmt-txn-name">{t.beneficiary || 'Unknown'}</span>
                  <span className="th-stmt-txn-date">{new Date(t.date).toLocaleDateString()}</span>
                </div>
              </div>
              <span className="th-stmt-txn-amount font-mono">-${fmt(t.amount)}</span>
            </div>
          ))}
          {stmtTxns.length > 10 && (
            <p className="th-stmt-more">+ {stmtTxns.length - 10} more transactions</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="th-overlay" onClick={onClose}>
      <div className="th-page" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="th-header">
          <button className="th-back" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className="th-header-title">Transactions & Statements</h2>
          <button className="th-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* Tabs */}
        <div className="th-tabs">
          <button className={`th-tab ${tab === 'transactions' ? 'th-tab--active' : ''}`} onClick={() => setTab('transactions')}>
            Transactions
          </button>
          <button className={`th-tab ${tab === 'statements' ? 'th-tab--active' : ''}`} onClick={() => setTab('statements')}>
            Statements
          </button>
        </div>

        {tab === 'transactions' ? renderTransactions() : renderStatements()}
      </div>
    </div>
  )
}
