import { useEffect, useState } from 'react'
import { generateTransferPDF } from '../services/pdfReceipt'

/* ── SVG icons ───────────────────────────────────────────── */
const CheckCircle = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const RepeatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

const ScheduleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

export default function TransactionSuccess({
  visible,
  onClose,
  data = {},
}) {
  const [animClass, setAnimClass] = useState('')

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => setAnimClass('txn-success--open'))
    } else {
      setAnimClass('')
    }
  }, [visible])

  if (!visible && !animClass) return null

  const {
    fromName = 'TD CONVENIENCE CHECKING',
    toName = 'TD Cash',
    amount = '$700.00',
    type = 'Immediate',
    date = 'Jun 2, 2023',
    confirmation = '856976674',
    transferType = 'local', // 'local' or 'international'
  } = data

  const isIntl = transferType === 'international'
  const txnDate = date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Solid black for all receipt text
  const BLACK = '#000000'
  const LABEL_STYLE = { color: BLACK, fontWeight: 500 }
  const VALUE_STYLE = { color: BLACK }

  return (
    <div className={`txn-success-overlay ${animClass}`} onClick={onClose}>
      <div className={`txn-success ${animClass}`} onClick={(e) => e.stopPropagation()}>

        {/* ── Header: colour-coded by transfer type ─────── */}
        <div className={`txn-success-header ${isIntl ? 'txn-success-header--intl' : 'txn-success-header--local'}`}>
          {/* PDF download button */}
          <button
            className="txn-download-btn"
            title="Download PDF"
            onClick={() => generateTransferPDF({
              type: transferType,
              ref: confirmation,
              beneficiary: toName,
              amount: parseFloat(String(amount).replace(/[^0-9.]/g, '')) || 0,
              date: date || new Date().toISOString(),
              senderName: fromName,
            })}
          >
            <DownloadIcon />
            <span>PDF</span>
          </button>

          {/* Transfer type badge */}
          <div className="txn-type-badge">
            {isIntl ? '🌐 International Wire' : '⚡ Local Transfer'}
          </div>

          <div className="txn-success-check"><CheckCircle /></div>
          <h2 className="txn-success-title">Thank you!</h2>
          <p className="txn-success-subtitle">Your transfer was successful.</p>
          <p className="txn-success-conf">Confirmation: {confirmation}</p>
        </div>

        {/* ── Receipt body — all text forced solid black ── */}
        <div className="txn-success-body" style={{ color: BLACK, position: 'relative' }}>
          {/* TD Global logo watermark — 0.05 opacity */}
          <img
            src="/favicon.svg"
            alt=""
            className="txn-receipt-watermark"
            draggable="false"
            style={{ opacity: 0.05, pointerEvents: 'none', userSelect: 'none' }}
          />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Date</span>
            <span className="txn-value" style={VALUE_STYLE}>{txnDate}</span>
          </div>
          <div className="txn-divider" />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Transaction ID</span>
            <span className="txn-value" style={VALUE_STYLE}>
              <strong className="font-mono" style={{ color: BLACK }}>{confirmation}</strong>
            </span>
          </div>
          <div className="txn-divider" />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Transfer Type</span>
            <span className="txn-value" style={VALUE_STYLE}>
              {isIntl ? 'International Wire Transfer' : 'Local Transfer'}
            </span>
          </div>
          <div className="txn-divider" />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Recipient</span>
            <span className="txn-value" style={VALUE_STYLE}>
              <strong style={{ color: BLACK }}>{toName}</strong>
            </span>
          </div>
          <div className="txn-divider" />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Sent Amount</span>
            <span className="txn-value">
              <strong
                className="font-mono txn-amount-highlight"
                style={{ color: BLACK }}
              >
                {typeof amount === 'string'
                  ? amount.replace(/^-/, '')
                  : Math.abs(Number(amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>
          <div className="txn-divider" />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Type</span>
            <span className="txn-value" style={VALUE_STYLE}>{type}</span>
          </div>
          <div className="txn-divider" />

          <div className="txn-row">
            <span className="txn-label" style={LABEL_STYLE}>Status</span>
            <span className="txn-value">
              <span className="txn-status-badge" style={{ color: '#008a00' }}>● Completed</span>
            </span>
          </div>
          <div className="txn-divider" />

          {/* Type-specific note */}
          {isIntl ? (
            <div className="txn-row">
              <span className="txn-label" style={{ color: '#008a00', fontWeight: 600 }}>Note</span>
              <span className="txn-value" style={{ color: BLACK, fontSize: '0.82rem' }}>
                International wire transfers may take 1–3 business days to arrive and may incur additional fees.
              </span>
            </div>
          ) : (
            <div className="txn-row">
              <span className="txn-label" style={{ color: '#008a00', fontWeight: 600 }}>Note</span>
              <span className="txn-value" style={{ color: BLACK, fontSize: '0.82rem' }}>
                Local transfers are processed instantly and available in the recipient's account right away.
              </span>
            </div>
          )}
        </div>

        {/* ── Circular action buttons ───────────────────── */}
        <div className="txn-success-actions">
          <button className="txn-action-btn" onClick={onClose}>
            <div className="txn-action-circle"><HomeIcon /></div>
            <span>RETURN<br />TO HOME</span>
          </button>
          <button className="txn-action-btn">
            <div className="txn-action-circle"><RepeatIcon /></div>
            <span>MAKE<br />ANOTHER<br />TRANSFER</span>
          </button>
          <button className="txn-action-btn">
            <div className="txn-action-circle"><ScheduleIcon /></div>
            <span>VIEW<br />SCHEDULED</span>
          </button>
        </div>
      </div>
    </div>
  )
}
