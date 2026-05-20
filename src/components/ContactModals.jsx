import { useState, useEffect } from 'react'

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)

function ContactBase({ title, subtitle, icon, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handler) }
  }, [onClose])

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div className="contact-modal" onClick={e => e.stopPropagation()}>
        <button className="legal-modal-close" onClick={onClose} aria-label="Close"><CloseIcon/></button>
        <div className="contact-modal-head">
          <div className="contact-modal-icon">{icon}</div>
          <div>
            <h2 className="contact-modal-title">{title}</h2>
            <p className="contact-modal-sub">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   CONTACT US
   ═══════════════════════════════════════════════════════════ */
export function ContactUsModal({ onClose }) {
  const [form, setForm]       = useState({ name:'', email:'', subject:'', message:'' })
  const [errors, setErrors]   = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Please enter your name.'
    if (!form.email.trim())   e.email   = 'Please enter a valid email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address.'
    if (!form.subject)        e.subject = 'Please select a subject.'
    if (form.message.trim().length < 20) e.message = 'Please provide at least 20 characters.'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSending(true)
    setTimeout(() => { setSending(false); setSent(true) }, 1800)
  }

  if (sent) {
    return (
      <ContactBase title="Message Sent" subtitle="We'll get back to you shortly." icon="✉️" onClose={onClose}>
        <div className="contact-success">
          <div className="contact-success-icon"><CheckIcon/></div>
          <h3>We've received your message!</h3>
          <p>
            Thank you for reaching out. A member of our team will respond to{' '}
            <strong style={{color:'#93c5fd'}}>{form.email}</strong> within{' '}
            <strong>1–2 business days</strong>.
          </p>
          <p className="contact-ref">
            Reference ID: <span style={{color:'#60a5fa',fontFamily:'monospace'}}>
              CU-{Date.now().toString(36).toUpperCase().slice(-8)}
            </span>
          </p>
          <button className="contact-submit-btn" onClick={onClose}>Done</button>
        </div>
      </ContactBase>
    )
  }

  return (
    <ContactBase
      title="Contact Us"
      subtitle="Our team typically responds within 1–2 business days."
      icon="💬"
      onClose={onClose}
    >
      <form className="contact-form" onSubmit={handleSubmit} noValidate>

        <div className="contact-form-row">
          <div className="contact-field">
            <label className="contact-label">Full Name <span className="contact-req">*</span></label>
            <input
              className={`contact-input ${errors.name ? 'contact-input--err' : ''}`}
              type="text" placeholder="John Smith"
              value={form.name} onChange={e => set('name', e.target.value)}
            />
            {errors.name && <span className="contact-err-msg">{errors.name}</span>}
          </div>

          <div className="contact-field">
            <label className="contact-label">Email Address <span className="contact-req">*</span></label>
            <input
              className={`contact-input ${errors.email ? 'contact-input--err' : ''}`}
              type="email" placeholder="you@example.com"
              value={form.email} onChange={e => set('email', e.target.value)}
            />
            {errors.email && <span className="contact-err-msg">{errors.email}</span>}
          </div>
        </div>

        <div className="contact-field">
          <label className="contact-label">Subject <span className="contact-req">*</span></label>
          <select
            className={`contact-input contact-select ${errors.subject ? 'contact-input--err' : ''}`}
            value={form.subject} onChange={e => set('subject', e.target.value)}
          >
            <option value="">Select a subject…</option>
            <option value="general">General Inquiry</option>
            <option value="account">Account Question</option>
            <option value="transfer">Transfer or Payment Issue</option>
            <option value="card">Card Management</option>
            <option value="security">Security Concern</option>
            <option value="investment">Investment Services</option>
            <option value="fees">Fees & Billing</option>
            <option value="partnership">Business Partnership</option>
            <option value="other">Other</option>
          </select>
          {errors.subject && <span className="contact-err-msg">{errors.subject}</span>}
        </div>

        <div className="contact-field">
          <label className="contact-label">
            Message <span className="contact-req">*</span>
            <span className="contact-char-count">{form.message.length}/1000</span>
          </label>
          <textarea
            className={`contact-input contact-textarea ${errors.message ? 'contact-input--err' : ''}`}
            placeholder="Tell us how we can help you. Please include as much detail as possible."
            rows={5} maxLength={1000}
            value={form.message} onChange={e => set('message', e.target.value)}
          />
          {errors.message && <span className="contact-err-msg">{errors.message}</span>}
        </div>

        <div className="contact-info-box">
          <span>📞</span>
          <span>Prefer to call? Reach us at <strong style={{color:'#93c5fd'}}>1-800-555-0100</strong> — Mon–Fri, 8am–8pm ET</span>
        </div>

        <button type="submit" className="contact-submit-btn" disabled={sending}>
          {sending ? (
            <><span className="contact-spinner"/>&nbsp;Sending…</>
          ) : (
            'Send Message →'
          )}
        </button>
      </form>
    </ContactBase>
  )
}

/* ═══════════════════════════════════════════════════════════
   SUPPORT CENTER
   ═══════════════════════════════════════════════════════════ */
export function SupportCenterModal({ onClose }) {
  const [form, setForm]       = useState({ name:'', email:'', accountNumber:'', category:'', priority:'medium', description:'', screenshot:'' })
  const [errors, setErrors]   = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [ticketId]            = useState('TKT-' + Math.random().toString(36).slice(2,8).toUpperCase())

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name     = 'Please enter your name.'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email.'
    if (!form.category)       e.category = 'Please select an issue category.'
    if (form.description.trim().length < 30) e.description = 'Please describe the issue in at least 30 characters.'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSending(true)
    setTimeout(() => { setSending(false); setSent(true) }, 2000)
  }

  const priorityColors = { low:'#34d399', medium:'#f59e0b', high:'#f97316', urgent:'#ef4444' }

  if (sent) {
    return (
      <ContactBase title="Ticket Submitted" subtitle="Your support request has been received." icon="🎫" onClose={onClose}>
        <div className="contact-success">
          <div className="contact-success-icon"><CheckIcon/></div>
          <h3>Support Ticket Created</h3>
          <p>
            Your ticket has been assigned to our support team. You'll receive updates at{' '}
            <strong style={{color:'#93c5fd'}}>{form.email}</strong>.
          </p>
          <div className="support-ticket-box">
            <div className="support-ticket-row">
              <span>Ticket ID</span>
              <span style={{color:'#60a5fa',fontFamily:'monospace',fontWeight:700}}>{ticketId}</span>
            </div>
            <div className="support-ticket-row">
              <span>Priority</span>
              <span style={{color: priorityColors[form.priority], fontWeight:600, textTransform:'capitalize'}}>{form.priority}</span>
            </div>
            <div className="support-ticket-row">
              <span>Expected Response</span>
              <span style={{color:'rgba(255,255,255,0.7)'}}>
                {form.priority === 'urgent' ? 'Within 2 hours' : form.priority === 'high' ? 'Within 4 hours' : form.priority === 'medium' ? 'Within 24 hours' : '1–3 business days'}
              </span>
            </div>
          </div>
          <p style={{fontSize:'0.8rem', color:'rgba(255,255,255,0.45)', marginTop:8}}>
            Save your ticket ID for future reference. You can also track status in your account dashboard.
          </p>
          <button className="contact-submit-btn" onClick={onClose}>Done</button>
        </div>
      </ContactBase>
    )
  }

  return (
    <ContactBase
      title="Support Center"
      subtitle="Submit a ticket and we'll resolve your issue as fast as possible."
      icon="🛠️"
      onClose={onClose}
    >
      <form className="contact-form" onSubmit={handleSubmit} noValidate>

        <div className="contact-form-row">
          <div className="contact-field">
            <label className="contact-label">Full Name <span className="contact-req">*</span></label>
            <input className={`contact-input ${errors.name ? 'contact-input--err' : ''}`}
              type="text" placeholder="John Smith"
              value={form.name} onChange={e => set('name', e.target.value)}/>
            {errors.name && <span className="contact-err-msg">{errors.name}</span>}
          </div>
          <div className="contact-field">
            <label className="contact-label">Email Address <span className="contact-req">*</span></label>
            <input className={`contact-input ${errors.email ? 'contact-input--err' : ''}`}
              type="email" placeholder="you@example.com"
              value={form.email} onChange={e => set('email', e.target.value)}/>
            {errors.email && <span className="contact-err-msg">{errors.email}</span>}
          </div>
        </div>

        <div className="contact-field">
          <label className="contact-label">Account Number <span className="contact-optional">(optional)</span></label>
          <input className="contact-input"
            type="text" placeholder="Enter your account number for faster assistance"
            value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)}/>
        </div>

        <div className="contact-form-row">
          <div className="contact-field">
            <label className="contact-label">Issue Category <span className="contact-req">*</span></label>
            <select className={`contact-input contact-select ${errors.category ? 'contact-input--err' : ''}`}
              value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Select category…</option>
              <optgroup label="Account">
                <option value="login">Cannot Log In / Access Issue</option>
                <option value="locked">Account Locked or Suspended</option>
                <option value="verification">Identity Verification Failed</option>
                <option value="profile">Profile Update Issue</option>
              </optgroup>
              <optgroup label="Transactions">
                <option value="transfer-failed">Transfer Failed or Pending</option>
                <option value="wrong-amount">Incorrect Amount Charged</option>
                <option value="missing-funds">Funds Not Received</option>
                <option value="unauthorized">Unauthorized Transaction</option>
              </optgroup>
              <optgroup label="Cards">
                <option value="card-blocked">Card Blocked or Declined</option>
                <option value="card-lost">Lost or Stolen Card</option>
                <option value="card-limit">Card Limit Increase Request</option>
              </optgroup>
              <optgroup label="Technical">
                <option value="app-error">App Error or Crash</option>
                <option value="2fa">2FA / OTP Not Working</option>
                <option value="notification">Missing Notifications</option>
              </optgroup>
              <optgroup label="Other">
                <option value="fee-dispute">Fee Dispute</option>
                <option value="close-account">Account Closure Request</option>
                <option value="other">Other</option>
              </optgroup>
            </select>
            {errors.category && <span className="contact-err-msg">{errors.category}</span>}
          </div>

          <div className="contact-field">
            <label className="contact-label">Priority Level</label>
            <select className="contact-input contact-select"
              value={form.priority} onChange={e => set('priority', e.target.value)}
              style={{borderColor: priorityColors[form.priority], color: priorityColors[form.priority]}}>
              <option value="low">🟢 Low — General inquiry</option>
              <option value="medium">🟡 Medium — Issue affecting use</option>
              <option value="high">🟠 High — Cannot use key features</option>
              <option value="urgent">🔴 Urgent — Funds at risk / fraud</option>
            </select>
          </div>
        </div>

        <div className="contact-field">
          <label className="contact-label">
            Describe Your Issue <span className="contact-req">*</span>
            <span className="contact-char-count">{form.description.length}/2000</span>
          </label>
          <textarea
            className={`contact-input contact-textarea ${errors.description ? 'contact-input--err' : ''}`}
            placeholder="Please describe the issue in detail. Include what you were trying to do, what happened, any error messages you saw, and the steps you took. More detail = faster resolution."
            rows={6} maxLength={2000}
            value={form.description} onChange={e => set('description', e.target.value)}
          />
          {errors.description && <span className="contact-err-msg">{errors.description}</span>}
        </div>

        <div className="contact-field">
          <label className="contact-label">Screenshot URL <span className="contact-optional">(optional)</span></label>
          <input className="contact-input"
            type="text" placeholder="Paste a link to a screenshot (e.g. via Imgur, Google Drive)"
            value={form.screenshot} onChange={e => set('screenshot', e.target.value)}/>
          <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)',marginTop:4,display:'block'}}>
            Screenshots help us resolve your issue faster
          </span>
        </div>

        {form.priority === 'urgent' && (
          <div className="contact-urgent-box">
            <span>🚨</span>
            <span>
              For urgent security issues or suspected fraud, also call our 24/7 fraud line immediately:{' '}
              <strong style={{color:'#fca5a5'}}>1-800-555-0199</strong>
            </span>
          </div>
        )}

        <button type="submit" className="contact-submit-btn" disabled={sending}>
          {sending ? (
            <><span className="contact-spinner"/>&nbsp;Submitting ticket…</>
          ) : (
            'Submit Support Ticket →'
          )}
        </button>

        <p className="contact-ticket-note">
          You'll receive a confirmation email with your ticket ID within minutes.
          Track your ticket status from your account dashboard under "Support."
        </p>
      </form>
    </ContactBase>
  )
}
