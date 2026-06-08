import { useState } from 'react'
import { sendTransferEmail } from '../services/emailNotification'
import { saveTransaction } from '../services/transactionService'

const PORTFOLIO_KEY = 'investment_portfolio'

function genRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'INV-'
  for (let i = 0; i < 10; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

function fmt(n) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const STOCKS = [
  { ticker: 'AAPL',  name: 'Apple Inc.',           price: 198.50,  change: +1.24, sector: 'Technology' },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',      price: 445.80,  change: +0.87, sector: 'Technology' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.',         price: 178.25,  change: -0.35, sector: 'Technology' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',       price: 215.60,  change: +2.10, sector: 'Consumer' },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',          price: 892.40,  change: +3.45, sector: 'Technology' },
  { ticker: 'TSLA',  name: 'Tesla Inc.',            price: 248.90,  change: -1.82, sector: 'Automotive' },
  { ticker: 'META',  name: 'Meta Platforms Inc.',    price: 532.15,  change: +0.65, sector: 'Technology' },
  { ticker: 'JPM',   name: 'JPMorgan Chase',        price: 218.30,  change: +0.42, sector: 'Finance' },
  { ticker: 'V',     name: 'Visa Inc.',             price: 295.70,  change: +0.18, sector: 'Finance' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',     price: 162.45,  change: -0.28, sector: 'Healthcare' },
  { ticker: 'WMT',   name: 'Walmart Inc.',          price: 178.90,  change: +0.95, sector: 'Retail' },
  { ticker: 'XOM',   name: 'Exxon Mobil Corp.',     price: 108.25,  change: -0.72, sector: 'Energy' },
]

const ETFS = [
  { ticker: 'SPY',   name: 'S&P 500 ETF',          price: 528.40,  change: +0.62, sector: 'Index' },
  { ticker: 'QQQ',   name: 'Nasdaq 100 ETF',       price: 462.80,  change: +1.15, sector: 'Index' },
  { ticker: 'VTI',   name: 'Total Stock Market',    price: 268.50,  change: +0.48, sector: 'Index' },
  { ticker: 'ARKK',  name: 'ARK Innovation ETF',    price: 52.30,   change: +2.85, sector: 'Growth' },
  { ticker: 'GLD',   name: 'SPDR Gold Shares',      price: 234.60,  change: +0.32, sector: 'Commodity' },
  { ticker: 'VNQ',   name: 'Real Estate ETF',       price: 86.40,   change: -0.15, sector: 'Real Estate' },
]

function getPortfolio() {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]') } catch { return [] }
}

export default function Investment({ balance, onClose, onBalanceUpdate }) {
  const [view, setView] = useState('market') // 'market' | 'buy' | 'portfolio' | 'receipt'
  const [tab, setTab] = useState('stocks') // 'stocks' | 'etfs'
  const [selected, setSelected] = useState(null)
  const [shares, setShares] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [portfolio, setPortfolio] = useState(getPortfolio)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  const allAssets = tab === 'stocks' ? STOCKS : ETFS

  const handleBuy = (asset) => {
    setSelected(asset)
    setShares('')
    setError('')
    setView('buy')
  }

  const handleConfirmBuy = () => {
    const qty = parseFloat(shares)
    if (!qty || qty <= 0 || !Number.isFinite(qty)) {
      setError('Enter a valid number of shares.')
      return
    }
    const total = qty * selected.price
    if (total > balance) {
      setError(`Insufficient balance. Total: $${fmt(total)}`)
      return
    }

    const newBalance = balance - total
    const ref = genRef()
    const txn = {
      id: Date.now(),
      ref,
      type: 'investment',
      category: 'Investment',
      beneficiary: `${selected.ticker} - ${selected.name}`,
      amount: total,
      balanceAfter: newBalance,
      date: new Date().toISOString(),
      direction: 'outgoing',
    }

    setIsLoading(true)
    setLoadingMsg('Placing order on market…')
    setTimeout(() => setLoadingMsg('Executing trade…'), 2000)
    setTimeout(() => setLoadingMsg('Confirming with exchange…'), 3800)

    setTimeout(() => {
    saveTransaction(txn)

    // Save to portfolio
    const port = getPortfolio()
    const existing = port.find((p) => p.ticker === selected.ticker)
    if (existing) {
      existing.shares += qty
      existing.avgCost = ((existing.avgCost * (existing.shares - qty)) + total) / existing.shares
    } else {
      port.push({ ticker: selected.ticker, name: selected.name, shares: qty, avgCost: selected.price, sector: selected.sector })
    }
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(port))
    setPortfolio(port)

    // Update balance
    localStorage.setItem('bank_balance', String(newBalance))
    window.dispatchEvent(new StorageEvent('storage', { key: 'bank_balance', newValue: String(newBalance) }))
    onBalanceUpdate(newBalance)

    // Notification
    const notifs = JSON.parse(localStorage.getItem('securebank_notifications') || '[]')
    notifs.push({ type: 'debit', amount: fmt(total), newBalance: fmt(newBalance), read: false })
    localStorage.setItem('securebank_notifications', JSON.stringify(notifs))
    window.dispatchEvent(new StorageEvent('storage', { key: 'securebank_notifications', newValue: JSON.stringify(notifs) }))

    sendTransferEmail(txn)
    setIsLoading(false)
    setReceipt({ ...txn, ticker: selected.ticker, shares: qty, pricePerShare: selected.price })
    setView('receipt')
    }, 5000)
  }

  const totalPortValue = portfolio.reduce((sum, p) => {
    const current = [...STOCKS, ...ETFS].find((s) => s.ticker === p.ticker)
    return sum + (current ? current.price * p.shares : p.avgCost * p.shares)
  }, 0)

  // ── Loading ──
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

  // ── Receipt ──
  if (view === 'receipt' && receipt) {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet tf-receipt" onClick={(e) => e.stopPropagation()}>
          <div className="tf-receipt-check">✓</div>
          <h2 className="tf-receipt-title">Investment Confirmed</h2>
          <div className="tf-receipt-rows">
            <div className="tf-receipt-row"><span>Reference</span><strong>{receipt.ref}</strong></div>
            <div className="tf-receipt-row"><span>Asset</span><strong>{receipt.ticker}</strong></div>
            <div className="tf-receipt-row"><span>Shares</span><strong>{receipt.shares}</strong></div>
            <div className="tf-receipt-row"><span>Price/Share</span><strong>${fmt(receipt.pricePerShare)}</strong></div>
            <div className="tf-receipt-row"><span>Total</span><strong className="tf-receipt-amt">-${fmt(receipt.amount)}</strong></div>
            <div className="tf-receipt-row"><span>Balance After</span><strong>${fmt(receipt.balanceAfter)}</strong></div>
          </div>
          <button className="tf-btn tf-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  // ── Buy form ──
  if (view === 'buy' && selected) {
    const qty = parseFloat(shares) || 0
    const total = qty * selected.price
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="tf-header">
            <div className="tf-header-icon inv-header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <div>
              <h2 className="tf-title">Buy {selected.ticker}</h2>
              <p className="tf-subtitle">{selected.name}</p>
            </div>
            <button className="tf-close" onClick={() => setView('market')}><CloseIcon /></button>
          </div>

          <div className="tf-bal-chip">
            Available: <strong>${fmt(balance)}</strong>
          </div>

          <div className="inv-price-badge">
            <span className="inv-price-label">Market Price</span>
            <span className="inv-price-value font-mono">${fmt(selected.price)}</span>
            <span className={`inv-price-change ${selected.change >= 0 ? 'inv-up' : 'inv-down'}`}>
              {selected.change >= 0 ? '▲' : '▼'} {Math.abs(selected.change)}%
            </span>
          </div>

          <form className="tf-form" onSubmit={(e) => { e.preventDefault(); handleConfirmBuy() }}>
            <div className="tf-field">
              <label className="tf-label">Number of Shares</label>
              <input
                className="tf-input tf-input--amount"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 10"
                value={shares}
                onChange={(e) => { setShares(e.target.value); setError('') }}
                autoFocus
              />
            </div>

            {qty > 0 && (
              <div className="inv-summary">
                <div className="inv-summary-row"><span>Shares</span><strong>{qty}</strong></div>
                <div className="inv-summary-row"><span>Price per share</span><strong>${fmt(selected.price)}</strong></div>
                <div className="inv-summary-row inv-summary-total"><span>Total Cost</span><strong>${fmt(total)}</strong></div>
                <div className="inv-summary-row"><span>Balance After</span><strong>${fmt(Math.max(balance - total, 0))}</strong></div>
              </div>
            )}

            {error && <div className="tf-error">{error}</div>}

            <button type="submit" className="tf-btn tf-btn--primary" disabled={!qty || qty <= 0}>
              Confirm Purchase
            </button>
            <button type="button" className="tf-btn tf-btn--ghost" onClick={() => setView('market')}>
              ← Back to Market
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Portfolio view ──
  if (view === 'portfolio') {
    return (
      <div className="tf-overlay" onClick={onClose}>
        <div className="tf-sheet inv-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="tf-header">
            <div className="tf-header-icon inv-header-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <div>
              <h2 className="tf-title">My Portfolio</h2>
              <p className="tf-subtitle">Total: ${fmt(totalPortValue)}</p>
            </div>
            <button className="tf-close" onClick={onClose}><CloseIcon /></button>
          </div>

          <div className="inv-port-tabs">
            <button className="inv-port-tab inv-port-tab--active" onClick={() => setView('portfolio')}>Holdings</button>
            <button className="inv-port-tab" onClick={() => setView('market')}>Market</button>
          </div>

          <div className="inv-port-list">
            {portfolio.length === 0 ? (
              <div className="inv-empty">
                <span className="inv-empty-icon">📊</span>
                <p>No investments yet</p>
                <button className="tf-btn tf-btn--primary" onClick={() => setView('market')}>Browse Market</button>
              </div>
            ) : portfolio.map((p) => {
              const current = [...STOCKS, ...ETFS].find((s) => s.ticker === p.ticker)
              const currentPrice = current ? current.price : p.avgCost
              const mktValue = currentPrice * p.shares
              const gain = (currentPrice - p.avgCost) * p.shares
              const gainPct = ((currentPrice - p.avgCost) / p.avgCost) * 100
              return (
                <div key={p.ticker} className="inv-port-card">
                  <div className="inv-port-top">
                    <div className="inv-port-ticker-wrap">
                      <span className="inv-port-ticker">{p.ticker}</span>
                      <span className="inv-port-name">{p.name}</span>
                    </div>
                    <div className="inv-port-value">
                      <span className="font-mono">${fmt(mktValue)}</span>
                      <span className={`inv-port-gain ${gain >= 0 ? 'inv-up' : 'inv-down'}`}>
                        {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div className="inv-port-meta">
                    <span>{p.shares} shares @ ${fmt(p.avgCost)} avg</span>
                    <span>Current: ${fmt(currentPrice)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Market view (default) ──
  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-sheet inv-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tf-header">
          <div className="tf-header-icon inv-header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <h2 className="tf-title">Optima Investments</h2>
            <p className="tf-subtitle">Buy stocks & ETFs</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="tf-bal-chip">
          Available: <strong>${fmt(balance)}</strong>
        </div>

        {/* Tabs */}
        <div className="inv-tabs">
          <button className={`inv-tab ${tab === 'stocks' ? 'inv-tab--active' : ''}`} onClick={() => setTab('stocks')}>
            Stocks ({STOCKS.length})
          </button>
          <button className={`inv-tab ${tab === 'etfs' ? 'inv-tab--active' : ''}`} onClick={() => setTab('etfs')}>
            ETFs ({ETFS.length})
          </button>
          <button className="inv-tab inv-tab--port" onClick={() => { setView('portfolio'); setPortfolio(getPortfolio()) }}>
            📁 Portfolio
          </button>
        </div>

        {/* Asset list */}
        <div className="inv-list">
          {allAssets.map((a) => (
            <div key={a.ticker} className="inv-row">
              <div className="inv-row-left">
                <div className="inv-ticker-badge">{a.ticker.slice(0, 2)}</div>
                <div className="inv-row-info">
                  <span className="inv-row-ticker">{a.ticker}</span>
                  <span className="inv-row-name">{a.name}</span>
                </div>
              </div>
              <div className="inv-row-right">
                <span className="inv-row-price font-mono">${fmt(a.price)}</span>
                <span className={`inv-row-change ${a.change >= 0 ? 'inv-up' : 'inv-down'}`}>
                  {a.change >= 0 ? '+' : ''}{a.change}%
                </span>
              </div>
              <button className="inv-buy-btn" onClick={() => handleBuy(a)}>Buy</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
