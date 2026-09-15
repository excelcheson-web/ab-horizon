import { useState, useRef, useEffect } from 'react'
import { sendOtp, verifyOtp } from '../services/otpService'

const MailIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 7L2 7" />
  </svg>
)

export default function OtpModal({ email, onVerified, onCancel, variant = 'onboarding' }) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [sending, setSending] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [delivered, setDelivered] = useState(false)
  const refs = useRef([])
  const sentTo = useRef('')

  // Send OTP on mount (use email as dependency so it fires once email is available)
  useEffect(() => {
    if (email && sentTo.current !== email) {
      sentTo.current = email
      doSend(email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setInterval(() => setResendTimer((p) => p - 1), 1000)
    return () => clearInterval(t)
  }, [resendTimer])

  async function doSend(recipientEmail) {
    const target = recipientEmail || email
    if (!target) {
      setError('No email address provided.')
      setSending(false)
      return
    }
    setSending(true)
    setDelivered(false)
    setError('')
    setOtp(['', '', '', '', '', ''])
    try {
      await sendOtp(target, variant)
      setDelivered(true)
      setResendTimer(30)
    } catch {
      setError('Could not send the verification email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function handleChange(idx, value) {
    if (!/^\d?$/.test(value)) return
    setOtp((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
    setError('')
    if (value && idx < 5) {
      refs.current[idx + 1]?.focus()
    }
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
  }

  // Auto-verify when all 6 digits entered
  useEffect(() => {
    if (otp.join('').length === 6 && !verifying) {
      handleVerify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

  async function handleVerify() {
    const code = otp.join('')
    if (code.length < 6) {
      setError('Please enter all 6 digits')
      return
    }
    setVerifying(true)
    // Small delay for UX
    await new Promise((r) => setTimeout(r, 400))
    if (verifyOtp(code, { email, context: variant })) {
      onVerified()
    } else {
      setError('Invalid code. Please try again.')
      setVerifying(false)
    }
  }

  const masked = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, '•') + c)
    : ''

  const isTransfer = variant === 'transfer'

  return (
    <div className="otp-overlay">
      <div className={`otp-modal ${isTransfer ? 'otp-modal--transfer' : ''}`}>
        {/* Close button */}
        <button className="otp-close" onClick={onCancel} aria-label="Close">×</button>

        <div className="otp-icon-wrap">
          <MailIcon />
        </div>

        <h2 className="otp-title">
          {isTransfer ? 'Verify Transfer' : 'Verify Your Email'}
        </h2>
        <p className="otp-subtitle">
          {sending
            ? 'Sending verification code…'
            : delivered ? <>We sent a 6-digit code to <strong>{masked}</strong></> : 'Verification email was not sent.'
          }
        </p>

        {/* OTP boxes */}
        <div className="otp-row">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              className={`otp-box ${error ? 'otp-box--error' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={sending || verifying || !delivered}
              autoComplete="one-time-code"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && <p className="otp-error">{error}</p>}

        {/* Verify button */}
        <button
          className="otp-verify-btn"
          onClick={handleVerify}
          disabled={otp.join('').length < 6 || sending || verifying || !delivered}
        >
          {verifying ? (
            <span className="otp-spinner" />
          ) : (
            isTransfer ? 'Confirm Transfer' : 'Verify Email'
          )}
        </button>

        {/* Resend */}
        <p className="otp-resend">
          {resendTimer > 0 ? (
            <>Resend code in <strong>{resendTimer}s</strong></>
          ) : (
            <button className="otp-resend-btn" onClick={() => doSend(email)} disabled={sending}>
              Resend Code
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
