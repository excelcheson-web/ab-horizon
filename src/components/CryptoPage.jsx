import { useState, useEffect, useCallback } from 'react'
import { saveTransaction } from '../services/transactionService'

const BALANCE_KEY = 'bank_balance'
const HOLDINGS_KEY = 'crypto_holdings'

const CRYPTO_BASE = [
  { symbol: 'BTC',  name: 'Bitcoin',   price: 72300.00, change: +2.4, color: '#f7931a' },
  { symbol: 'ETH',  name: 'Ethereum',  price: 2125.50,  change: +1.8, color: '#627eea' },
  { symbol: 'SOL',  name: 'Solana',    price: 90.14,    change: -0.6, color: '#00c48c' },
  { symbol: 'ADA',  name: 'Cardano',   price: 0.45,     change: +3.1, color: '#0033ad' },
  { symbol: 'DOT',  name: 'Polkadot',  price: 7.82,     change: -1.2, color: '#e6007a' },
  { symbol: 'LINK', name: 'Chainlink', price: 14.56,    change: +0.9, color: '#2a5ada' },
]

function getBalance() {
  return parseFloat(localStorage.getItem(BALANCE_KEY) || '0')
}
function setBalance(v) {
  localStorage.setItem(BALANCE_KEY, v.toFixed(2))
}
function getHoldings() {
  try {
    const h = JSON.parse(localStorage.getItem(HOLDINGS_KEY) || '{}')
    const result = {}
    CRYPTO_BASE.forEach((c) => { result[c.symbol] = parseFloat(h[c.symbol]) || 0 })
    return result
  } catch {
    const result = {}
    CRYPTO_BASE.forEach((c) => { result[c.symbol] = 0 })
    return result
  }
}
function saveHoldings(h) {
  localStorage.setItem(HOLDINGS_KEY, JSON.stringify(h))
}
function dispatchBalanceEvent() {
  window.dispatchEvent(new StorageEvent('storage', {
    key: BALANCE_KEY,
    newValue: localStorage.getItem(BALANCE_KEY),
    storageArea: localStorage,
  }))
}

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)
const TrendDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
)
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function CryptoPage({ onClose }) {
  const [prices, setPrices] = useState(() => CRYPTO_BASE.map((c) => ({ ...c })))
  const [holdings, setHoldings] = useState(getHoldings)
  const [modalCoin, setModalCoin] = useState(null)   // coin object from prices
  const [modalTab, setModalTab] = useState('buy')    // 'buy' | 'sell'
  const [modalAmt, setModalAmt] = useState('')
  const [toast, setToast] = useState(null)

  // Live price ticks every 4 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      setPrices((prev) =>
        prev.map((c) => {
          const delta = (Math.random() - 0.48) * c.price * 0.004
          const newPrice = Math.max(0.01, c.price + delta)
          const newChange = +(c.change + (Math.random() - 0.48) * 0.15).toFixed(2)
          return { ...c, price: newPrice, change: newChange }
        })
      )
    }, 4000)
    return () => clearInterval(iv)
  }, [])

  const totalPortfolio = prices.reduce(
    (sum, c) => sum + c.price * (holdings[c.symbol] || 0),
    0
  )

  function openModal(coin, tab) {
    setModalCoin(coin)
    setModalTab(tab)
    setModalAmt('')
  }
  function closeModal() {
    setModalCoin(null)
    setModalAmt('')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Derived modal values
  const usdAmount = parseFloat(modalAmt) || 0
  const bankBalance = getBalance()
  const coinHoldingsQty = modalCoin ? (holdings[modalCoin.symbol] || 0) : 0
  const coinHoldingsUsd = modalCoin ? coinHoldingsQty * (modalCoin.price || 0) : 0
  const coinQty = modalCoin && usdAmount > 0 ? usdAmount / modalCoin.price : 0
  const sellReceive = modalCoin && usdAmount > 0 ? usdAmount : 0
  const sellCoinQty = modalCoin && usdAmount > 0 ? usdAmount / modalCoin.price : 0

  const canConfirm = useCallback(() => {
    if (!modalCoin || usdAmount <= 0) return false
    if (modalTab === 'buy') return usdAmount <= bankBalance
    if (modalTab === 'sell') return sellCoinQty <= coinHoldingsQty && usdAmount > 0
    return false
  }, [modalCoin, usdAmount, modalTab, bankBalance, sellCoinQty, coinHoldingsQty])

  function handleConfirm() {
    if (!modalCoin || !canConfirm()) return
    const coin = modalCoin
    const amt = usdAmount
    const bal = getBalance()
    let newBal
    const h = { ...holdings }

    if (modalTab === 'buy') {
      newBal = bal - amt
      const receivedCoins = amt / coin.price
      h[coin.symbol] = (h[coin.symbol] || 0) + receivedCoins
      setBalance(newBal)
      saveHoldings(h)
      setHoldings({ ...h })
      saveTransaction({
        id: Date.now(),
        ref: 'CRY-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        type: 'crypto',
        beneficiary: `${coin.name} (Purchase)`,
        amount: amt,
        balanceAfter: newBal,
        date: new Date().toISOString(),
        direction: 'outgoing',
        memo: `Bought ${receivedCoins.toFixed(6)} ${coin.symbol} @ $${coin.price.toFixed(2)}`,
      })
      dispatchBalanceEvent()
      showToast(`Bought ${receivedCoins.toFixed(6)} ${coin.symbol}`)
    } else {
      // sell: usdAmount is USD value to sell
      const sellQty = amt / coin.price
      newBal = bal + amt
      h[coin.symbol] = Math.max(0, (h[coin.symbol] || 0) - sellQty)
      setBalance(newBal)
      saveHoldings(h)
      setHoldings({ ...h })
      saveTransaction({
        id: Date.now(),
        ref: 'CRY-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        type: 'crypto',
        beneficiary: `${coin.name} (Sale)`,
        amount: amt,
        balanceAfter: newBal,
        date: new Date().toISOString(),
        direction: 'incoming',
        memo: `Sold ${sellQty.toFixed(6)} ${coin.symbol} @ $${coin.price.toFixed(2)}`,
      })
      dispatchBalanceEvent()
      showToast(`Sold ${sellQty.toFixed(6)} ${coin.symbol} · +$${amt.toFixed(2)}`)
    }
    closeModal()
  }

  return (
    <div className="crypto-page">
      {/* Header */}
      <header className="crypto-page-header">
        <button className="crypto-page-back" onClick={onClose}>
          <BackIcon />
        </button>
        <h1 className="crypto-page-title">Digital Assets</h1>
        <div style={{ width: 22 }} />
      </header>

      {/* Portfolio summary */}
      <section className="crypto-page-portfolio">
        <span className="crypto-page-portfolio-label">Portfolio Value</span>
        <span className="crypto-page-portfolio-value">
          ${totalPortfolio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </section>

      {/* Asset list */}
      <section className="crypto-page-list">
        {prices.map((c) => {
          const held = holdings[c.symbol] || 0
          return (
            <div key={c.symbol} className="crypto-page-row" style={{ cursor: 'pointer' }} onClick={() => openModal(c, 'buy')}>
              <div className="crypto-page-icon" style={{ background: c.color }}>
                {c.symbol.charAt(0)}
              </div>
              <div className="crypto-page-info">
                <span className="crypto-page-name">{c.name}</span>
                <span className="crypto-page-symbol">{c.symbol}</span>
                {held > 0 && (
                  <span className="crypto-page-holdings">
                    {held < 0.001 ? held.toFixed(8) : held < 1 ? held.toFixed(6) : held.toLocaleString('en-US', { maximumFractionDigits: 4 })} {c.symbol}
                  </span>
                )}
              </div>
              <div className="crypto-page-price-col">
                <span className="crypto-page-price">
                  ${c.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`crypto-page-change ${c.change >= 0 ? 'crypto-page-change--up' : 'crypto-page-change--down'}`}>
                  {c.change >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                  {c.change >= 0 ? '+' : ''}{c.change}%
                </span>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button className="crypto-page-buy-btn" onClick={() => openModal(c, 'buy')}>Buy</button>
                  <button className="crypto-page-sell-btn" onClick={() => openModal(c, 'sell')}>Sell</button>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* Disclaimer */}
      <p className="crypto-page-disclaimer">
        Prices update in real-time. Trading crypto involves risk. Past performance is not indicative of future results.
      </p>

      {/* Buy/Sell Modal */}
      {modalCoin && (
        <div className="crypto-modal-overlay" onClick={closeModal}>
          <div className="crypto-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crypto-modal-handle" />
            {/* Head */}
            <div className="crypto-modal-head">
              <div className="crypto-modal-icon" style={{ background: modalCoin.color }}>
                {modalCoin.symbol.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <p className="crypto-modal-coin-name">{modalCoin.name}</p>
                <p className="crypto-modal-price">
                  ${modalCoin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {modalCoin.symbol}
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(11,31,77,0.4)', padding: 4 }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Tabs */}
            <div className="crypto-modal-tabs">
              <button
                className={`crypto-modal-tab ${modalTab === 'buy' ? 'crypto-modal-tab--active' : ''}`}
                onClick={() => { setModalTab('buy'); setModalAmt('') }}
              >BUY</button>
              <button
                className={`crypto-modal-tab ${modalTab === 'sell' ? 'crypto-modal-tab--active' : ''}`}
                onClick={() => { setModalTab('sell'); setModalAmt('') }}
              >SELL</button>
            </div>

            {/* Available balance */}
            <p className="crypto-modal-avail">
              {modalTab === 'buy'
                ? `Available: $${bankBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                : `Holdings: ${coinHoldingsQty.toFixed(6)} ${modalCoin.symbol} ($${coinHoldingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
              }
            </p>

            {/* Amount input */}
            <div className="crypto-modal-input-wrap">
              <span className="crypto-modal-input-prefix">$</span>
              <input
                className="crypto-modal-input"
                type="number"
                placeholder="0.00"
                value={modalAmt}
                onChange={(e) => setModalAmt(e.target.value)}
                min="0"
                step="any"
                autoFocus
              />
            </div>

            {/* Live calculation */}
            <p className="crypto-modal-calc">
              {usdAmount > 0 ? (
                modalTab === 'buy' ? (
                  <>You will receive <strong>{coinQty.toFixed(6)} {modalCoin.symbol}</strong></>
                ) : (
                  <>You will receive <strong>${sellReceive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({sellCoinQty.toFixed(6)} {modalCoin.symbol} sold)</>
                )
              ) : (
                modalTab === 'buy' ? 'Enter USD amount to buy' : 'Enter USD value to sell'
              )}
            </p>

            {/* Confirm button */}
            <button
              className="crypto-modal-confirm"
              disabled={!canConfirm()}
              onClick={handleConfirm}
            >
              {modalTab === 'buy' ? `Buy ${modalCoin.symbol}` : `Sell ${modalCoin.symbol}`}
            </button>
            {modalTab === 'buy' && usdAmount > bankBalance && usdAmount > 0 && (
              <p style={{ color: '#ef4444', fontSize: '0.76rem', textAlign: 'center', marginTop: 8, margin: '8px 0 0' }}>
                Insufficient balance
              </p>
            )}
            {modalTab === 'sell' && usdAmount > 0 && sellCoinQty > coinHoldingsQty && (
              <p style={{ color: '#ef4444', fontSize: '0.76rem', textAlign: 'center', marginTop: 8, margin: '8px 0 0' }}>
                Insufficient {modalCoin.symbol} holdings
              </p>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="crypto-toast">{toast}</div>}
    </div>
  )
}
