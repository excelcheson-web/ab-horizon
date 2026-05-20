import { useState } from 'react'
import TDLogo from './TDLogo'

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ContactlessIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 14a2 2 0 0 1 0-4" /><path d="M8.5 16.5a5 5 0 0 1 0-9" /><path d="M5 19a9 9 0 0 1 0-14" />
  </svg>
)

const ChipSVG = () => (
  <svg width="48" height="36" viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="0.5" width="47" height="35" rx="5.5" fill="url(#chipGold)" stroke="#b8860b" strokeWidth="0.8"/>
    <line x1="0" y1="12" x2="48" y2="12" stroke="#b8860b" strokeWidth="0.5" opacity="0.5"/>
    <line x1="0" y1="24" x2="48" y2="24" stroke="#b8860b" strokeWidth="0.5" opacity="0.5"/>
    <line x1="16" y1="0" x2="16" y2="36" stroke="#b8860b" strokeWidth="0.5" opacity="0.5"/>
    <line x1="32" y1="0" x2="32" y2="36" stroke="#b8860b" strokeWidth="0.5" opacity="0.5"/>
    <rect x="16" y="12" width="16" height="12" fill="#c5a028" opacity="0.3" rx="1"/>
    <defs>
      <linearGradient id="chipGold" x1="0" y1="0" x2="48" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e8d478"/>
        <stop offset="30%" stopColor="#d4a843"/>
        <stop offset="60%" stopColor="#f0e090"/>
        <stop offset="100%" stopColor="#c49a2e"/>
      </linearGradient>
    </defs>
  </svg>
)

const VisaLogo = () => (
  <svg width="64" height="21" viewBox="0 0 64 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25.2 1.2L21.7 19.8H17.4L20.9 1.2H25.2Z" fill="white"/>
    <path d="M42.2 1.6C41.3 1.3 39.9 0.9 38.2 0.9C33.9 0.9 30.9 3.1 30.9 6.2C30.8 8.5 33 9.7 34.6 10.5C36.3 11.3 36.8 11.8 36.8 12.5C36.8 13.6 35.4 14.1 34.2 14.1C32.4 14.1 31.5 13.9 30 13.3L29.4 13L28.8 17C29.9 17.5 31.9 17.9 33.9 17.9C38.5 17.9 41.4 15.7 41.5 12.4C41.5 10.7 40.4 9.3 38 8.2C36.5 7.4 35.6 6.9 35.6 6.2C35.6 5.5 36.4 4.8 38.1 4.8C39.5 4.8 40.5 5.1 41.3 5.4L41.7 5.6L42.2 1.6Z" fill="white"/>
    <path d="M48.5 1.2C47.5 1.2 46.7 1.5 46.3 2.6L39.7 19.8H44.3L45.1 17.3H50.7L51.2 19.8H55.3L51.7 1.2H48.5ZM46.3 14C46.3 14 48.2 8.5 48.3 8.1L49.9 14H46.3Z" fill="white"/>
    <path d="M15.2 1.2L10.9 13.6L10.4 11L8.8 2.8C8.5 1.6 7.6 1.2 6.5 1.2H0.1L0 1.5C1.6 1.9 3.4 2.6 4.9 3.4C5.5 3.7 5.7 4 5.9 4.8L9.4 19.8H14L19.8 1.2H15.2Z" fill="white"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const SnowflakeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
  </svg>
)

function formatCardNumber(num) {
  if (!num) return '•••• •••• •••• ••••'
  const s = String(num).replace(/\D/g, '').padEnd(16, '•')
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)} ${s.slice(12, 16)}`
}

export default function BankCard({ user, onClose }) {
  const [showDetails, setShowDetails] = useState(false)
  const [frozen, setFrozen] = useState(false)

  const name = (user?.name || 'ACCOUNT HOLDER').toUpperCase()
  const accountNumber = user?.accountNumber || ''
  const last4 = accountNumber ? accountNumber.slice(-4) : '0000'
  const fullCard = accountNumber
    ? `4832${accountNumber.padStart(12, '0').slice(-12)}`
    : '4832000000000000'
  const expiry = '03/29'
  const cvv = '847'

  const toggleFreeze = () => setFrozen(!frozen)

  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="bc-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tf-header">
          <div className="tf-header-icon bc-header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <h2 className="tf-title">Virtual Card</h2>
            <p className="tf-subtitle">Visa Debit Card</p>
          </div>
          <button className="tf-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {/* ── Card ──────────────────────────────────────── */}
        <div className={`bc-card ${frozen ? 'bc-card--frozen' : ''}`}>
          <div className="bc-card-shine" />
          <div className="bc-card-texture" />
          {/* Faded background watermark logo */}
          <img src="/favicon.svg" alt="" className="bc-card-watermark" draggable="false" />
          {/* Frozen watermark */}
          {frozen && <div className="bc-frozen-watermark">FROZEN</div>}
          {/* Top row: contactless right only */}
          <div className="bc-card-top">
            <ContactlessIcon />
          </div>
          {/* Chip */}
          <div className="bc-chip-realistic">
            <ChipSVG />
          </div>
          {/* Card number */}
          <p className="bc-card-number font-mono">{formatCardNumber(fullCard)}</p>
          {/* Bottom row */}
          <div className="bc-card-bottom">
            <div className="bc-card-holder-col">
              <span className="bc-card-label">CARD HOLDER</span>
              <span className="bc-card-name">{name}</span>
            </div>
            <div className="bc-card-valid-col">
              <span className="bc-card-label">VALID THRU</span>
              <span className="bc-card-expiry font-mono">
                {showDetails ? expiry : '••/••'}
              </span>
            </div>
            <div className="bc-card-cvv-col">
              <span className="bc-card-label">CVV</span>
              <span className="bc-card-expiry font-mono">
                {showDetails ? cvv : '•••'}
              </span>
            </div>
          </div>
          {/* Visa + bank type at very bottom */}
          <div className="bc-card-footer">
            <span className="bc-card-bank-type">VISA DEBIT</span>
            <div className="bc-visa-logo">
              <VisaLogo />
            </div>
          </div>
        </div>

        {/* ── Card details ──────────────────────────────── */}
        <div className="bc-details">
          <div className="bc-detail-row">
            <span>Card Type</span><strong>Virtual Visa Debit</strong>
          </div>
          <div className="bc-detail-row">
            <span>Card Number</span><strong className="font-mono">•••• •••• •••• {last4}</strong>
          </div>
          <div className="bc-detail-row">
            <span>Expiration</span>
            <strong className={`font-mono bc-detail-blur ${showDetails ? 'bc-detail-blur--visible' : ''}`}>
              {showDetails ? expiry : '••/••'}
            </strong>
          </div>
          <div className="bc-detail-row">
            <span>CVV</span>
            <strong className={`font-mono bc-detail-blur ${showDetails ? 'bc-detail-blur--visible' : ''}`}>
              {showDetails ? cvv : '•••'}
            </strong>
          </div>
          <div className="bc-detail-row">
            <span>Status</span>
            <strong className={frozen ? 'bc-status-frozen' : 'bc-status-active'}>
              {frozen ? '❄ Frozen' : '● Active'}
            </strong>
          </div>
          <div className="bc-detail-row">
            <span>Daily Limit</span><strong className="font-mono">$10,000.00</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="bc-actions">
          <button className={`bc-action-btn ${showDetails ? 'bc-action-btn--active' : ''}`} onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? <EyeOffIcon /> : <EyeIcon />}
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button className={`bc-action-btn ${frozen ? 'bc-action-btn--freeze-active' : ''}`} onClick={toggleFreeze}>
            <SnowflakeIcon />
            {frozen ? 'Unfreeze Card' : 'Freeze Card'}
          </button>
        </div>

        <button className="tf-btn tf-btn--primary" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
