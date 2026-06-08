import { useState, useMemo } from 'react'
import { saveTransaction } from '../services/transactionService'

const BALANCE_KEY = 'bank_balance'
const LOANS_KEY = 'securebank_loans'
const INVESTMENTS_KEY = 'securebank_financial_investments'

function dispatchBalanceEvent() {
  window.dispatchEvent(new StorageEvent('storage', {
    key: BALANCE_KEY,
    newValue: localStorage.getItem(BALANCE_KEY),
    storageArea: localStorage,
  }))
}
function getActiveLoans() {
  try { return JSON.parse(localStorage.getItem(LOANS_KEY) || '[]').filter((l) => l.status === 'active') }
  catch { return [] }
}

function getBalance() {
  return parseFloat(localStorage.getItem(BALANCE_KEY) || '0')
}
function setBalance(v) {
  localStorage.setItem(BALANCE_KEY, v.toFixed(2))
}
function fmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function getUser() {
  try { return JSON.parse(localStorage.getItem('securebank_user') || '{}') } catch { return {} }
}

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/* ── Service cards data ──────────────────────────── */
const SERVICES = [
  {
    id: 'loan',
    title: 'Personal Loan',
    desc: 'Quick loans with competitive rates starting at 5.9% APR',
    img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
    color: '#00c853',
  },
  {
    id: 'pension',
    title: 'Pension Managers',
    desc: 'Secure your retirement with top-rated pension fund managers',
    img: 'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800&q=80',
    color: '#2196f3',
  },
  {
    id: 'fund',
    title: 'Fund Managers',
    desc: 'Professional portfolio management by expert fund managers',
    img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
    color: '#ff9800',
  },
  {
    id: 'money_market',
    title: 'Money Market Fund',
    desc: 'Low-risk investments with daily accruing interest',
    img: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800&q=80',
    color: '#9c27b0',
  },
]

/* ── Pension / Fund managers data ───────────────── */
const PENSION_MANAGERS = [
  { name: 'Optima Retirement Shield', aum: '42.5B', rating: 4.8, returnRate: '8.2%', minInvest: 500, img: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&q=80' },
  { name: 'GreenTree Pensions', aum: '28.1B', rating: 4.6, returnRate: '7.8%', minInvest: 1000, img: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&q=80' },
  { name: 'SafeHarbor Retirement', aum: '35.7B', rating: 4.7, returnRate: '8.5%', minInvest: 250, img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80' },
]
const FUND_MANAGERS = [
  { name: 'Optima Growth Fund', aum: '68.3B', rating: 4.9, returnRate: '12.4%', minInvest: 1000, img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80', strategy: 'Growth Equity' },
  { name: 'EverGreen Capital', aum: '31.2B', rating: 4.5, returnRate: '9.7%', minInvest: 500, img: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&q=80', strategy: 'Balanced' },
  { name: 'Summit Wealth Advisors', aum: '22.8B', rating: 4.7, returnRate: '11.1%', minInvest: 2000, img: 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?w=400&q=80', strategy: 'Value Investing' },
]
const MONEY_MARKET = {
  name: 'Optima Money Market Fund',
  apy: '5.25',
  minDeposit: 100,
  totalAum: '124.6B',
  rating: 4.9,
  features: ['Daily interest accrual', 'Same-day withdrawals', 'CDIC insured up to $100K', 'No lock-in period', 'Auto-reinvest option'],
  img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
}

/* ── Loan terms data ────────────────────────────── */
const LOAN_TERMS = [
  { months: 12, apr: 5.9 },
  { months: 24, apr: 6.4 },
  { months: 36, apr: 6.9 },
  { months: 48, apr: 7.4 },
  { months: 60, apr: 7.9 },
]

export default function FinancialServices({ onClose, onBalanceUpdate }) {
  const [activeView, setActiveView] = useState('menu') // menu | loan | pension | fund | money_market
  const [loanAmount, setLoanAmount] = useState('')
  const [loanTerm, setLoanTerm] = useState(LOAN_TERMS[0])
  const [loanProcessing, setLoanProcessing] = useState(false)
  const [loanSuccess, setLoanSuccess] = useState(null)
  const [loanSubTab, setLoanSubTab] = useState('apply') // 'active' | 'apply'
  const [activeLoans, setActiveLoans] = useState(getActiveLoans)
  const [investAmount, setInvestAmount] = useState('')
  const [selectedManager, setSelectedManager] = useState(null)
  const [investProcessing, setInvestProcessing] = useState(false)
  const [investSuccess, setInvestSuccess] = useState(null)
  const [mmAmount, setMmAmount] = useState('')
  const [mmProcessing, setMmProcessing] = useState(false)
  const [mmSuccess, setMmSuccess] = useState(null)

  /* Loan calculator */
  const loanCalc = useMemo(() => {
    const p = parseFloat(loanAmount) || 0
    const r = loanTerm.apr / 100 / 12
    const n = loanTerm.months
    if (p <= 0 || r <= 0) return { monthly: 0, total: 0, interest: 0 }
    const monthly = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const total = monthly * n
    return { monthly, total, interest: total - p }
  }, [loanAmount, loanTerm])

  function handleLoanApply() {
    const amt = parseFloat(loanAmount)
    if (!amt || amt < 500 || amt > 50000) return
    setLoanProcessing(true)
    setTimeout(() => {
      const bal = getBalance()
      const newBal = bal + amt
      setBalance(newBal)
      // Save loan record
      const loans = JSON.parse(localStorage.getItem(LOANS_KEY) || '[]')
      const loan = {
        id: `LN-${Date.now()}`,
        amount: amt,
        term: loanTerm.months,
        remainingMonths: loanTerm.months,
        apr: loanTerm.apr,
        monthlyPayment: loanCalc.monthly,
        totalRepayment: loanCalc.total,
        date: new Date().toISOString(),
        status: 'active',
      }
      loans.push(loan)
      localStorage.setItem(LOANS_KEY, JSON.stringify(loans))
      saveTransaction({
        id: loan.id,
        ref: loan.id,
        type: 'loan_disbursement',
        beneficiary: 'Optima Personal Loan',
        amount: amt,
        balanceAfter: newBal,
        date: loan.date,
        direction: 'incoming',
        memo: `${loanTerm.months}-month loan at ${loanTerm.apr}% APR`,
      })
      if (onBalanceUpdate) onBalanceUpdate(newBal)
      dispatchBalanceEvent()
      setLoanProcessing(false)
      setLoanSuccess(loan)
      setActiveLoans(getActiveLoans())
    }, 5000)
  }

  function handleLoanPayment(loanId) {
    const allLoans = JSON.parse(localStorage.getItem(LOANS_KEY) || '[]')
    const idx = allLoans.findIndex((l) => l.id === loanId)
    if (idx === -1) return
    const loan = allLoans[idx]
    const payment = loan.monthlyPayment
    const bal = getBalance()
    if (payment > bal) return
    const newBal = bal - payment
    setBalance(newBal)
    const newRemaining = (loan.remainingMonths || loan.term) - 1
    allLoans[idx] = {
      ...loan,
      remainingMonths: newRemaining,
      status: newRemaining <= 0 ? 'paid' : 'active',
    }
    localStorage.setItem(LOANS_KEY, JSON.stringify(allLoans))
    saveTransaction({
      id: Date.now(),
      ref: `PMT-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
      type: 'loan_payment',
      beneficiary: 'Loan Repayment',
      amount: payment,
      balanceAfter: newBal,
      date: new Date().toISOString(),
      direction: 'outgoing',
      memo: `Monthly payment for ${loan.id}${newRemaining <= 0 ? ' – FULLY PAID' : ` – ${newRemaining} months remaining`}`,
    })
    if (onBalanceUpdate) onBalanceUpdate(newBal)
    dispatchBalanceEvent()
    setActiveLoans(getActiveLoans())
  }

  function handleInvest(manager, type) {
    const amt = parseFloat(investAmount)
    if (!amt || amt < manager.minInvest) return
    const bal = getBalance()
    if (amt > bal) return
    setInvestProcessing(true)
    setTimeout(() => {
      const newBal = bal - amt
      setBalance(newBal)
      const investments = JSON.parse(localStorage.getItem(INVESTMENTS_KEY) || '[]')
      const inv = {
        id: `FI-${Date.now()}`,
        type,
        manager: manager.name,
        amount: amt,
        expectedReturn: manager.returnRate,
        date: new Date().toISOString(),
        status: 'active',
      }
      investments.push(inv)
      localStorage.setItem(INVESTMENTS_KEY, JSON.stringify(investments))
      saveTransaction({
        id: inv.id,
        ref: inv.id,
        type: 'investment',
        beneficiary: manager.name,
        amount: amt,
        balanceAfter: newBal,
        date: inv.date,
        direction: 'outgoing',
        memo: `${type === 'pension' ? 'Pension' : 'Fund'} investment – ${manager.returnRate} expected return`,
      })
      if (onBalanceUpdate) onBalanceUpdate(newBal)
      dispatchBalanceEvent()
      setInvestProcessing(false)
      setInvestSuccess(inv)
    }, 5000)
  }

  function handleMmInvest() {
    const amt = parseFloat(mmAmount)
    if (!amt || amt < MONEY_MARKET.minDeposit) return
    const bal = getBalance()
    if (amt > bal) return
    setMmProcessing(true)
    setTimeout(() => {
      const newBal = bal - amt
      setBalance(newBal)
      const investments = JSON.parse(localStorage.getItem(INVESTMENTS_KEY) || '[]')
      const inv = {
        id: `MM-${Date.now()}`,
        type: 'money_market',
        manager: MONEY_MARKET.name,
        amount: amt,
        expectedReturn: MONEY_MARKET.apy + '% APY',
        date: new Date().toISOString(),
        status: 'active',
      }
      investments.push(inv)
      localStorage.setItem(INVESTMENTS_KEY, JSON.stringify(investments))
      saveTransaction({
        id: inv.id,
        ref: inv.id,
        type: 'investment',
        beneficiary: MONEY_MARKET.name,
        amount: amt,
        balanceAfter: newBal,
        date: inv.date,
        direction: 'outgoing',
        memo: `Money market fund – ${MONEY_MARKET.apy}% APY`,
      })
      if (onBalanceUpdate) onBalanceUpdate(newBal)
      dispatchBalanceEvent()
      setMmProcessing(false)
      setMmSuccess(inv)
    }, 5000)
  }

  function resetState() {
    setLoanAmount(''); setLoanSuccess(null); setLoanProcessing(false); setLoanSubTab('apply')
    setInvestAmount(''); setSelectedManager(null); setInvestSuccess(null); setInvestProcessing(false)
    setMmAmount(''); setMmSuccess(null); setMmProcessing(false)
  }

  function goBack() {
    resetState()
    setActiveView('menu')
  }

  /* ── Render helpers ────────────────────────────── */
  function renderHeader(title) {
    return (
      <div className="fs-header">
        <button className="fs-back-btn" onClick={goBack}><BackIcon /></button>
        <h2 className="fs-header-title">{title}</h2>
        <button className="fs-close-btn" onClick={onClose}><CloseIcon /></button>
      </div>
    )
  }

  /* ── MENU view ─────────────────────────────────── */
  function renderMenu() {
    const activeLoanCount = activeLoans.length
    return (
      <div className="fs-overlay">
        <div className="fs-page">
          <div className="fs-header">
            <div style={{ width: 30 }} />
            <h2 className="fs-header-title">Financial Services</h2>
            <button className="fs-close-btn" onClick={onClose}><CloseIcon /></button>
          </div>
          <div className="fs-menu-scroll">
            <p className="fs-menu-subtitle">Explore our products and services</p>
            <div className="fs-cards">
              {SERVICES.map((s) => (
                <button key={s.id} className="fs-card" onClick={() => { resetState(); setActiveView(s.id); if (s.id === 'loan' && activeLoanCount > 0) setLoanSubTab('active') }}>
                  <div className="fs-card-img-wrap">
                    <img src={s.img} alt={s.title} className="fs-card-img" loading="lazy" />
                    <div className="fs-card-img-overlay" style={{ background: `linear-gradient(transparent 30%, ${s.color}cc 100%)` }} />
                  </div>
                  <div className="fs-card-body" style={{ position: 'relative' }}>
                    <h3 className="fs-card-title">{s.title}</h3>
                    {s.id === 'loan' && activeLoanCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 0, right: 0,
                        background: '#c9a23a', color: '#fff',
                        fontSize: '0.7rem', fontWeight: 700,
                        borderRadius: '99px', padding: '2px 8px',
                        lineHeight: 1.4,
                      }}>{activeLoanCount} active</span>
                    )}
                    <p className="fs-card-desc">{s.desc}</p>
                    <span className="fs-card-arrow">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── LOAN view ─────────────────────────────────── */
  function renderLoan() {
    if (loanSuccess) {
      return (
        <div className="fs-overlay">
          <div className="fs-page">
            {renderHeader('Loan Approved')}
            <div className="fs-scroll fs-success-container">
              <div className="fs-success-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
              </div>
              <h3 className="fs-success-title">Loan Disbursed!</h3>
              <p className="fs-success-sub">${fmt(loanSuccess.amount)} has been credited to your account</p>
              <div className="fs-detail-card">
                <div className="fs-detail-row"><span>Loan ID</span><span>{loanSuccess.id}</span></div>
                <div className="fs-detail-row"><span>Amount</span><span>${fmt(loanSuccess.amount)}</span></div>
                <div className="fs-detail-row"><span>Term</span><span>{loanSuccess.term} months</span></div>
                <div className="fs-detail-row"><span>APR</span><span>{loanSuccess.apr}%</span></div>
                <div className="fs-detail-row"><span>Monthly Payment</span><span>${fmt(loanSuccess.monthlyPayment)}</span></div>
                <div className="fs-detail-row"><span>Total Repayment</span><span>${fmt(loanSuccess.totalRepayment)}</span></div>
              </div>
              <button className="fs-primary-btn" onClick={goBack}>Back to Services</button>
            </div>
          </div>
        </div>
      )
    }

    const loanAmtParsed = parseFloat(loanAmount)

    return (
      <div className="fs-overlay">
        <div className="fs-page">
          {renderHeader('Personal Loan')}
          <div className="fs-scroll">
            {/* Sub-tabs: Active Loans | Apply */}
            <div style={{ display: 'flex', gap: 0, background: 'rgba(13,27,75,0.06)', borderRadius: 10, padding: 3, margin: '0 0 18px' }}>
              {activeLoans.length > 0 && (
                <button
                  style={{
                    flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
                    fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    background: loanSubTab === 'active' ? '#0d1b4b' : 'transparent',
                    color: loanSubTab === 'active' ? '#fff' : 'rgba(13,27,75,0.5)',
                  }}
                  onClick={() => setLoanSubTab('active')}
                >
                  Active Loans {activeLoans.length > 0 && `(${activeLoans.length})`}
                </button>
              )}
              <button
                style={{
                  flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
                  fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  background: loanSubTab === 'apply' ? '#0d1b4b' : 'transparent',
                  color: loanSubTab === 'apply' ? '#fff' : 'rgba(13,27,75,0.5)',
                }}
                onClick={() => setLoanSubTab('apply')}
              >
                Apply for Loan
              </button>
            </div>

            {/* Active Loans sub-tab */}
            {loanSubTab === 'active' && (
              <div className="loan-active-list">
                {activeLoans.length === 0 ? (
                  <p style={{ color: 'rgba(13,27,75,0.45)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>No active loans</p>
                ) : activeLoans.map((loan) => {
                  const total = loan.term || 1
                  const remaining = loan.remainingMonths != null ? loan.remainingMonths : total
                  const paid = total - remaining
                  const pct = Math.min(100, Math.round((paid / total) * 100))
                  const canPay = getBalance() >= loan.monthlyPayment
                  return (
                    <div key={loan.id} className="loan-active-card">
                      <div className="loan-active-head">
                        <div>
                          <div className="loan-active-id">{loan.id}</div>
                          <div className="loan-active-amt">${fmt(loan.amount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.78rem', color: '#c9a23a', fontWeight: 700 }}>{loan.apr}% APR</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,77,0.45)' }}>{remaining} mo left</div>
                        </div>
                      </div>
                      <div className="loan-active-meta">
                        Monthly: <strong>${fmt(loan.monthlyPayment)}</strong> &nbsp;·&nbsp; Paid: {paid}/{total} months
                      </div>
                      <div className="loan-progress">
                        <div className="loan-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <button
                        className="loan-pay-btn"
                        disabled={!canPay}
                        onClick={() => handleLoanPayment(loan.id)}
                        style={!canPay ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
                      >
                        {canPay ? `Make Payment · $${fmt(loan.monthlyPayment)}` : 'Insufficient Balance'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Apply sub-tab */}
            {loanSubTab === 'apply' && (
              <>
                <div className="fs-hero-img-wrap">
                  <img src={SERVICES[0].img} alt="Loan" className="fs-hero-img" loading="lazy" />
                  <div className="fs-hero-overlay" />
                  <div className="fs-hero-text">
                    <p className="fs-hero-label">Rates from</p>
                    <p className="fs-hero-value">5.9% APR</p>
                  </div>
                </div>
                <div className="fs-form-section">
                  <label className="fs-label">Loan Amount ($500 – $50,000)</label>
                  <input
                    className="fs-input"
                    type="number"
                    placeholder="Enter amount"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    min="500"
                    max="50000"
                  />
                  {loanAmtParsed > 50000 && (
                    <p style={{ color: '#ef4444', fontSize: '0.76rem', margin: '4px 0 0' }}>Maximum loan amount is $50,000</p>
                  )}
                  {loanAmtParsed > 0 && loanAmtParsed < 500 && (
                    <p style={{ color: '#ef4444', fontSize: '0.76rem', margin: '4px 0 0' }}>Minimum loan amount is $500</p>
                  )}
                  <label className="fs-label" style={{ marginTop: 14 }}>Select Term</label>
                  <div className="fs-term-options">
                    {LOAN_TERMS.map((t) => (
                      <button
                        key={t.months}
                        className={`fs-term-btn ${loanTerm.months === t.months ? 'fs-term-btn--active' : ''}`}
                        onClick={() => setLoanTerm(t)}
                      >
                        <span className="fs-term-months">{t.months}mo</span>
                        <span className="fs-term-apr">{t.apr}%</span>
                      </button>
                    ))}
                  </div>
                  {loanAmtParsed >= 500 && loanAmtParsed <= 50000 && (
                    <div className="fs-calc-card">
                      <h4 className="fs-calc-title">Loan Summary</h4>
                      <div className="fs-detail-row"><span>Principal</span><span>${fmt(loanAmtParsed)}</span></div>
                      <div className="fs-detail-row"><span>Monthly Payment</span><span className="fs-highlight">${fmt(loanCalc.monthly)}</span></div>
                      <div className="fs-detail-row"><span>Total Interest</span><span>${fmt(loanCalc.interest)}</span></div>
                      <div className="fs-detail-row"><span>Total Repayment</span><span>${fmt(loanCalc.total)}</span></div>
                    </div>
                  )}
                  <button
                    className="fs-primary-btn"
                    disabled={!loanAmtParsed || loanAmtParsed < 500 || loanAmtParsed > 50000 || loanProcessing}
                    onClick={handleLoanApply}
                  >
                    {loanProcessing ? <span className="fs-spinner" /> : 'Apply for Loan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── PENSION / FUND MANAGERS view ──────────────── */
  function renderManagers(type) {
    const managers = type === 'pension' ? PENSION_MANAGERS : FUND_MANAGERS
    const title = type === 'pension' ? 'Pension Managers' : 'Fund Managers'

    if (investSuccess) {
      return (
        <div className="fs-overlay">
          <div className="fs-page">
            {renderHeader('Investment Confirmed')}
            <div className="fs-scroll fs-success-container">
              <div className="fs-success-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
              </div>
              <h3 className="fs-success-title">Investment Placed!</h3>
              <p className="fs-success-sub">${fmt(investSuccess.amount)} invested with {investSuccess.manager}</p>
              <div className="fs-detail-card">
                <div className="fs-detail-row"><span>Reference</span><span>{investSuccess.id}</span></div>
                <div className="fs-detail-row"><span>Manager</span><span>{investSuccess.manager}</span></div>
                <div className="fs-detail-row"><span>Amount</span><span>${fmt(investSuccess.amount)}</span></div>
                <div className="fs-detail-row"><span>Expected Return</span><span>{investSuccess.expectedReturn}</span></div>
              </div>
              <button className="fs-primary-btn" onClick={goBack}>Back to Services</button>
            </div>
          </div>
        </div>
      )
    }

    if (selectedManager) {
      const bal = getBalance()
      const minAmt = selectedManager.minInvest
      return (
        <div className="fs-overlay">
          <div className="fs-page">
            {renderHeader(selectedManager.name)}
            <div className="fs-scroll">
              <div className="fs-manager-hero">
                <img src={selectedManager.img} alt={selectedManager.name} className="fs-manager-hero-img" loading="lazy" />
                <div className="fs-hero-overlay" />
                <div className="fs-manager-hero-info">
                  <p className="fs-manager-hero-name">{selectedManager.name}</p>
                  <p className="fs-manager-hero-return">{selectedManager.returnRate} avg return</p>
                </div>
              </div>
              <div className="fs-form-section">
                <div className="fs-manager-stats">
                  <div className="fs-stat"><span className="fs-stat-label">AUM</span><span className="fs-stat-value">${selectedManager.aum}</span></div>
                  <div className="fs-stat"><span className="fs-stat-label">Rating</span><span className="fs-stat-value">★ {selectedManager.rating}</span></div>
                  <div className="fs-stat"><span className="fs-stat-label">Min</span><span className="fs-stat-value">${fmt(minAmt)}</span></div>
                </div>
                <label className="fs-label">Investment Amount (min ${fmt(minAmt)})</label>
                <input
                  className="fs-input"
                  type="number"
                  placeholder="Enter amount"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  min={minAmt}
                />
                <p className="fs-balance-hint">Available: ${fmt(bal)}</p>
                <button
                  className="fs-primary-btn"
                  disabled={!parseFloat(investAmount) || parseFloat(investAmount) < minAmt || parseFloat(investAmount) > bal || investProcessing}
                  onClick={() => handleInvest(selectedManager, type)}
                >
                  {investProcessing ? <span className="fs-spinner" /> : 'Invest Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="fs-overlay">
        <div className="fs-page">
          {renderHeader(title)}
          <div className="fs-scroll">
            <p className="fs-section-desc">{type === 'pension' ? 'Choose a pension manager to grow your retirement funds' : 'Professional fund managers to grow your wealth'}</p>
            <div className="fs-manager-list">
              {managers.map((m) => (
                <button
                  key={m.name}
                  className="fs-manager-card"
                  onClick={() => { setInvestAmount(''); setSelectedManager(m) }}
                >
                  <img src={m.img} alt={m.name} className="fs-manager-img" loading="lazy" />
                  <div className="fs-manager-info">
                    <h4 className="fs-manager-name">{m.name}</h4>
                    {m.strategy && <p className="fs-manager-strategy">{m.strategy}</p>}
                    <div className="fs-manager-meta">
                      <span>★ {m.rating}</span>
                      <span className="fs-manager-return">{m.returnRate}</span>
                      <span>AUM ${m.aum}</span>
                    </div>
                  </div>
                  <span className="fs-manager-arrow">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── MONEY MARKET view ─────────────────────────── */
  function renderMoneyMarket() {
    if (mmSuccess) {
      return (
        <div className="fs-overlay">
          <div className="fs-page">
            {renderHeader('Investment Confirmed')}
            <div className="fs-scroll fs-success-container">
              <div className="fs-success-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
              </div>
              <h3 className="fs-success-title">Deposit Confirmed!</h3>
              <p className="fs-success-sub">${fmt(mmSuccess.amount)} invested in Money Market Fund</p>
              <div className="fs-detail-card">
                <div className="fs-detail-row"><span>Reference</span><span>{mmSuccess.id}</span></div>
                <div className="fs-detail-row"><span>Fund</span><span>{MONEY_MARKET.name}</span></div>
                <div className="fs-detail-row"><span>Amount</span><span>${fmt(mmSuccess.amount)}</span></div>
                <div className="fs-detail-row"><span>APY</span><span>{MONEY_MARKET.apy}%</span></div>
              </div>
              <button className="fs-primary-btn" onClick={goBack}>Back to Services</button>
            </div>
          </div>
        </div>
      )
    }
    const bal = getBalance()
    return (
      <div className="fs-overlay">
        <div className="fs-page">
          {renderHeader('Money Market Fund')}
          <div className="fs-scroll">
            <div className="fs-hero-img-wrap">
              <img src={MONEY_MARKET.img} alt="Money Market" className="fs-hero-img" loading="lazy" />
              <div className="fs-hero-overlay" />
              <div className="fs-hero-text">
                <p className="fs-hero-label">Current APY</p>
                <p className="fs-hero-value">{MONEY_MARKET.apy}%</p>
              </div>
            </div>
            <div className="fs-form-section">
              <div className="fs-mm-stats">
                <div className="fs-stat"><span className="fs-stat-label">Total AUM</span><span className="fs-stat-value">${MONEY_MARKET.totalAum}</span></div>
                <div className="fs-stat"><span className="fs-stat-label">Rating</span><span className="fs-stat-value">★ {MONEY_MARKET.rating}</span></div>
                <div className="fs-stat"><span className="fs-stat-label">Min Deposit</span><span className="fs-stat-value">${MONEY_MARKET.minDeposit}</span></div>
              </div>
              <div className="fs-features">
                {MONEY_MARKET.features.map((f) => (
                  <div key={f} className="fs-feature-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <label className="fs-label">Deposit Amount (min ${MONEY_MARKET.minDeposit})</label>
              <input
                className="fs-input"
                type="number"
                placeholder="Enter amount"
                value={mmAmount}
                onChange={(e) => setMmAmount(e.target.value)}
                min={MONEY_MARKET.minDeposit}
              />
              <p className="fs-balance-hint">Available: ${fmt(bal)}</p>
              <button
                className="fs-primary-btn"
                disabled={!parseFloat(mmAmount) || parseFloat(mmAmount) < MONEY_MARKET.minDeposit || parseFloat(mmAmount) > bal || mmProcessing}
                onClick={handleMmInvest}
              >
                {mmProcessing ? <span className="fs-spinner" /> : 'Invest in Money Market'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main render ───────────────────────────────── */
  if (activeView === 'menu') return renderMenu()
  if (activeView === 'loan') return renderLoan()
  if (activeView === 'pension') return renderManagers('pension')
  if (activeView === 'fund') return renderManagers('fund')
  if (activeView === 'money_market') return renderMoneyMarket()
  return null
}
