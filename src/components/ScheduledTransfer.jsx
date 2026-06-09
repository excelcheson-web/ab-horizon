import { useState, useEffect } from 'react'
import { saveTransaction } from '../services/transactionService'

const SCHEDULED_KEY = 'scheduled_transfers'

function genRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'SCH-'
  for (let i = 0; i < 10; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function formatCurrency(n) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getScheduled() {
  try { return JSON.parse(localStorage.getItem(SCHEDULED_KEY) || '[]') }
  catch { return [] }
}

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const FREQ_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
]

export default function ScheduledTransfer({ balance, onClose, onBalanceUpdate }) {
  const [view, setView] = useState('list') // 'list' | 'create'
  const [scheduled, setScheduled] = useState(getScheduled)
  const [form, setForm] = useState({
    beneficiary: '',
    accountNumber: '',
    bankName: '',
    amount: '',
    date: '',
    frequency: 'once',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  // Process any due transfers on mount
  useEffect(() => {
    const items = getScheduled()
    const today = new Date().toISOString().slice(0, 10)
    let changed = false
    let bal = balance

    const updated = items.map((item) => {
      if (item.status === 'pending' && item.date <= today) {
        const amt = item.amount
        if (amt <= bal) {
          bal -= amt
          changed = true
          saveTransaction({
            id: Date.now(),
            ref: item.ref,
            type: 'scheduled',
            beneficiary: item.beneficiary,
            accountNumber: item.accountNumber,
            bankName: item.bankName,
            amount: amt,
            balanceAfter: bal,
            date: new Date().toISOString(),
            direction: 'outgoing',
          })

          // For recurring, compute next date
          if (item.frequency !== 'once') {
            const next = new Date(item.date)
            if (item.frequency === 'weekly') next.setDate(next.getDate() + 7)
            else if (item.frequency === 'biweekly') next.setDate(next.getDate() + 14)
            else if (item.frequency === 'monthly') next.setMonth(next.getMonth() + 1)
            return { ...item, date: next.toISOString().slice(0, 10), lastExecuted: today }
          }
          return { ...item, status: 'completed', lastExecuted: today }
        }
        return { ...item, status: 'failed', failReason: 'Insufficient balance' }
      }
      return item
    })

    if (changed) {
      localStorage.setItem(SCHEDULED_KEY, JSON.stringify(updated))
      localStorage.setItem('bank_balance', String(bal))
      window.dispatchEvent(new StorageEvent('storage', { key: 'bank_balance', newValue: String(bal) }))
      onBalanceUpdate(bal)
      setScheduled(updated)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setError('')
  }

  const handleCreate = (e) => {
    e.preventDefault()
    const { beneficiary, accountNumber, bankName, amount, date, frequency } = form

    if (!beneficiary.trim() || !accountNumber.trim() || !bankName.trim() || !amount.trim() || !date) {
      setError('All fields are required.')
      return
    }

    const amt = parseFloat(amount.replace(/,/g, ''))
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount.')
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    if (date < today) {
      setError('Scheduled date cannot be in the past.')
      return
    }

    const ref = genRef()
    const item = {
      id: Date.now(),
      ref,
      beneficiary: beneficiary.trim(),
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      amount: amt,
      date,
      frequency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    setIsLoading(true)
    setLoadingMsg('Scheduling transfer…')
    setTimeout(() => setLoadingMsg('Registering with server…'), 2000)
    setTimeout(() => setLoadingMsg('Confirming schedule…'), 3800)

    setTimeout(() => {
      const updated = [item, ...scheduled]
      localStorage.setItem(SCHEDULED_KEY, JSON.stringify(updated))
      setScheduled(updated)
      setIsLoading(false)
      setSuccess(ref)
      setForm({ beneficiary: '', accountNumber: '', bankName: '', amount: '', date: '', frequency: 'once' })
    }, 5000)
  }

  const handleCancel = (id) => {
    const updated = scheduled.map((s) => s.id === id ? { ...s, status: 'cancelled' } : s)
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify(updated))
    setScheduled(updated)
  }

  const pendingItems = scheduled.filter((s) => s.status === 'pending')
  const pastItems = scheduled.filter((s) => s.status !== 'pending')

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

  // ── Success confirmation ──
  if (success) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet tf-receipt" onClick={(e) => e.stopPropagation()}>
          <div className="tf-receipt-check">✓</div>
          <h2 className="tf-receipt-title">Transfer Scheduled</h2>
          <p className="sch-success-sub">Your transfer has been queued and will execute on the scheduled date.</p>
          <div className="tf-receipt-rows">
            <div className="tf-receipt-row"><span>Reference</span><strong>{success}</strong></div>
          </div>
          <button className="tf-btn tf-btn--primary" onClick={() => { setSuccess(null); setView('list') }}>View All Scheduled</button>
          <button className="tf-btn sch-btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  // ── Create form ──
  if (view === 'create') {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="tf-header">
            <div className="tf-header-icon sch-header-icon"><ClockIcon /></div>
            <div>
              <h2 className="tf-title">Schedule Transfer</h2>
              <p className="tf-subtitle">Set it and forget it</p>
            </div>
            <button className="tf-close" onClick={onClose}><CloseIcon /></button>
          </div>

          <div className="tf-bal-chip">
            Available: <strong>${formatCurrency(balance)}</strong>
          </div>

          <form className="tf-form" onSubmit={handleCreate}>
            <div className="tf-field">
              <label className="tf-label">Beneficiary Name</label>
              <input className="tf-input" placeholder="Recipient's full name" value={form.beneficiary} onChange={(e) => update('beneficiary', e.target.value)} />
            </div>
            <div className="tf-row-2">
              <div className="tf-field">
                <label className="tf-label">Account Number</label>
                <input className="tf-input" placeholder="e.g. 0123456789" value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} />
              </div>
              <div className="tf-field">
                <label className="tf-label">Bank Name</label>
                <input className="tf-input" placeholder="e.g. Optima Credit Union" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} />
              </div>
            </div>
            <div className="tf-field">
              <label className="tf-label">Amount ($)</label>
              <input className="tf-input tf-input--amount" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
            </div>
            <div className="tf-row-2">
              <div className="tf-field">
                <label className="tf-label">Scheduled Date</label>
                <input className="tf-input" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
              </div>
              <div className="tf-field">
                <label className="tf-label">Frequency</label>
                <select className="tf-input sch-select" value={form.frequency} onChange={(e) => update('frequency', e.target.value)}>
                  {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {error && <div className="tf-error">{error}</div>}
            <button type="submit" className="tf-btn tf-btn--primary">Schedule Transfer</button>
            <button type="button" className="tf-btn sch-btn-ghost" onClick={() => setView('list')}>← Back to List</button>
          </form>
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tf-header">
          <div className="tf-header-icon sch-header-icon"><ClockIcon /></div>
          <div>
            <h2 className="tf-title">Scheduled Transfers</h2>
            <p className="tf-subtitle">{pendingItems.length} upcoming</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* Upcoming */}
        {pendingItems.length === 0 ? (
          <div className="sch-empty">
            <span className="sch-empty-icon">📅</span>
            <p>No scheduled transfers yet.</p>
          </div>
        ) : (
          <div className="sch-list">
            {pendingItems.map((s) => (
              <div key={s.id} className="sch-item">
                <div className="sch-item-left">
                  <span className="sch-item-name">{s.beneficiary}</span>
                  <span className="sch-item-meta">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {s.frequency !== 'once' && <span className="sch-item-freq"> · {FREQ_OPTIONS.find((o) => o.value === s.frequency)?.label}</span>}
                  </span>
                </div>
                <div className="sch-item-right">
                  <span className="sch-item-amount font-mono">-${formatCurrency(s.amount)}</span>
                  <button className="sch-cancel-btn" onClick={() => handleCancel(s.id)} title="Cancel"><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past items */}
        {pastItems.length > 0 && (
          <>
            <p className="sch-past-title">History</p>
            <div className="sch-list sch-list--past">
              {pastItems.slice(0, 5).map((s) => (
                <div key={s.id} className="sch-item sch-item--past">
                  <div className="sch-item-left">
                    <span className="sch-item-name">{s.beneficiary}</span>
                    <span className="sch-item-meta">
                      {s.lastExecuted
                        ? new Date(s.lastExecuted + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="sch-item-right">
                    <span className="sch-item-amount font-mono">-${formatCurrency(s.amount)}</span>
                    <span className={`sch-badge sch-badge--${s.status}`}>
                      {s.status === 'completed' ? '✓' : s.status === 'cancelled' ? '✕' : '!'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button className="tf-btn tf-btn--primary" onClick={() => setView('create')}>+ New Scheduled Transfer</button>
        <button className="tf-btn sch-btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
