import { useRef, useState } from 'react'
import { sendForm, TEMPLATES, isEmailJSConfigured } from '../lib/emailjs'
import optimaLogo from '../assets/optima-logo.png'

const REQUEST_TYPES = [
  'General Inquiry',
  'Account Support',
  'Transaction Question',
  'Security Report',
  'New Account Opening',
  'Technical Issue',
]

const TEMPLATE_MAP = {
  'General Inquiry':      TEMPLATES.contact,
  'Account Support':      TEMPLATES.support,
  'Transaction Question': TEMPLATES.support,
  'Security Report':      TEMPLATES.security,
  'New Account Opening':   TEMPLATES.contact,
  'Technical Issue':      TEMPLATES.support,
}

/* ── icons ─────────────────────────────────────────────────── */
const SendIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)

/**
 * Standalone reusable EmailJS contact form.
 * Matches the app's glassmorphic dark theme.
 *
 * Props:
 *   onClose   — called when user dismisses (optional)
 *   className — extra class on the card (optional)
 */
export default function ContactEmailForm({ onClose, className = '' }) {
  const formRef = useRef(null)
  const [errors,      setErrors]      = useState({})
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [sendError,   setSendError]   = useState('')
  const [requestType, setRequestType] = useState('')

  /* ── validation ─────────────────────────────────────────── */
  const validate = (fd) => {
    const e = {}
    if (!fd.get('from_name')?.trim())    e.from_name    = 'Name is required.'
    const em = fd.get('from_email') || ''
    if (!em.trim())                      e.from_email   = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.from_email = 'Enter a valid email.'
    if (!fd.get('request_type'))         e.request_type = 'Select a request type.'
    if (!fd.get('subject')?.trim())      e.subject      = 'Subject is required.'
    const msg = fd.get('message') || ''
    if (msg.trim().length < 20)          e.message      = 'Please write at least 20 characters.'
    return e
  }

  /* ── submit ─────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSendError('')
    const fd = new FormData(formRef.current)
    const errs = validate(fd)
    if (Object.keys(errs).length) { setErrors(errs); return }

    const rt = fd.get('request_type')
    const templateId = TEMPLATE_MAP[rt] || TEMPLATES.contact

    setSending(true)
    try {
      await sendForm(templateId, formRef)
      setSent(true)
    } catch (err) {
      setSendError(
        isEmailJSConfigured()
          ? 'Failed to send. Please try again or email us directly.'
          : 'Email service not yet configured. Contact the administrator.'
      )
    } finally {
      setSending(false)
    }
  }

  const clearErr = (field) => setErrors(p => { const n = {...p}; delete n[field]; return n })

  /* ── success screen ─────────────────────────────────────── */
  if (sent) {
    return (
      <div className={`cef-card ${className}`}>
        <div className="cef-success">
          <div className="cef-success-icon"><CheckIcon /></div>
          <h3 className="cef-success-title">Message Sent!</h3>
          <p className="cef-success-sub">
            We've received your request and will respond within <strong>1–2 business days</strong>.
          </p>
          <p className="cef-ref">
            Ref: <span className="cef-ref-id">
              {requestType.slice(0,2).toUpperCase()}-{Date.now().toString(36).toUpperCase().slice(-8)}
            </span>
          </p>
          {onClose && (
            <button className="cef-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    )
  }

  /* ── form ───────────────────────────────────────────────── */
  return (
    <div className={`cef-card ${className}`}>
      {/* Header */}
      <div className="cef-header">
        <img src={optimaLogo} alt="Optima Credit Union" className="cef-logo" />
        <p className="cef-tagline">Secure Digital Banking Platform</p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="cef-form">
        {/* Hidden: timestamp */}
        <input type="hidden" name="created_at" value={new Date().toLocaleString('en-US', { timeZone:'America/New_York', dateStyle:'medium', timeStyle:'short' }) + ' ET'} />

        {/* Row: name + email */}
        <div className="cef-row">
          <div className="cef-field">
            <label className="cef-label">Full Name <span className="cef-req">*</span></label>
            <input
              className={`cef-input ${errors.from_name ? 'cef-input--err' : ''}`}
              name="from_name" type="text" placeholder="John Smith" autoComplete="name"
              onChange={() => clearErr('from_name')}
            />
            {errors.from_name && <span className="cef-err">{errors.from_name}</span>}
          </div>
          <div className="cef-field">
            <label className="cef-label">Email Address <span className="cef-req">*</span></label>
            <input
              className={`cef-input ${errors.from_email ? 'cef-input--err' : ''}`}
              name="from_email" type="email" placeholder="you@example.com" autoComplete="email"
              onChange={() => clearErr('from_email')}
            />
            {errors.from_email && <span className="cef-err">{errors.from_email}</span>}
          </div>
        </div>

        {/* Phone */}
        <div className="cef-field">
          <label className="cef-label">Phone Number <span className="cef-optional">(optional)</span></label>
          <input
            className="cef-input"
            name="phone" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel"
          />
        </div>

        {/* Request type */}
        <div className="cef-field">
          <label className="cef-label">Request Type <span className="cef-req">*</span></label>
          <select
            className={`cef-input cef-select ${errors.request_type ? 'cef-input--err' : ''}`}
            name="request_type"
            value={requestType}
            onChange={e => { setRequestType(e.target.value); clearErr('request_type') }}
          >
            <option value="">Select a request type…</option>
            {REQUEST_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.request_type && <span className="cef-err">{errors.request_type}</span>}
        </div>

        {/* Subject */}
        <div className="cef-field">
          <label className="cef-label">Subject <span className="cef-req">*</span></label>
          <input
            className={`cef-input ${errors.subject ? 'cef-input--err' : ''}`}
            name="subject" type="text" placeholder="Brief summary of your request"
            onChange={() => clearErr('subject')}
          />
          {errors.subject && <span className="cef-err">{errors.subject}</span>}
        </div>

        {/* Message */}
        <div className="cef-field">
          <label className="cef-label">Message <span className="cef-req">*</span></label>
          <textarea
            className={`cef-input cef-textarea ${errors.message ? 'cef-input--err' : ''}`}
            name="message" rows={5} placeholder="Describe your request in detail…"
            onChange={() => clearErr('message')}
          />
          {errors.message && <span className="cef-err">{errors.message}</span>}
        </div>

        {/* Send error */}
        {sendError && (
          <div className="cef-send-error">{sendError}</div>
        )}

        {/* Submit */}
        <button className="cef-btn" type="submit" disabled={sending}>
          {sending
            ? <><span className="cef-spinner" /> Sending…</>
            : <><SendIcon /> Send Message</>
          }
        </button>
      </form>

      {/* Footer */}
      <p className="cef-footer-note">
        Optima Credit Union is a federally insured credit union. Your deposits are protected up to 50,000 per depositor by the NCUA.
      </p>
    </div>
  )
}
