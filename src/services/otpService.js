import emailjs from '@emailjs/browser'
import { getCurrentUserEmail, getCurrentUserUid } from './accountLedger'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_llxvb7m'
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_OTP_TEMPLATE_ID || 'template_pxc66y7'
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'kLiAq79ZBAjG8epzA'
emailjs.init(PUBLIC_KEY)

const OTP_SESSION_KEY = 'securebank_last_otp'
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_DELIVERY_TIMEOUT_MS = 15000
const MAX_ATTEMPTS = 5
let challenge = null

export function clearOtp() {
  challenge = null
  try { sessionStorage.removeItem(OTP_SESSION_KEY) } catch { /* Storage may be unavailable. */ }
}

function persistOtp() {
  try { sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify(challenge)) } catch { /* Keep the in-memory challenge. */ }
}

function readChallenge({ context = '', email = getCurrentUserEmail() } = {}) {
  if (!challenge) {
    try { challenge = JSON.parse(sessionStorage.getItem(OTP_SESSION_KEY) || 'null') } catch { return null }
  }
  if (!challenge || !Number.isFinite(challenge.expiresAt) || Date.now() >= challenge.expiresAt) {
    clearOtp()
    return null
  }
  if (challenge.uid !== getCurrentUserUid() || challenge.email !== email || challenge.context !== context) return null
  return challenge
}

export function generateOtp({ context = '', email = getCurrentUserEmail() } = {}) {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  challenge = {
    code: String(array[0] % 1000000).padStart(6, '0'),
    uid: getCurrentUserUid(), email, context, attempts: 0,
    expiresAt: Date.now() + OTP_TTL_MS,
  }
  persistOtp()
  return challenge.code
}

export function getLastCode(options) {
  return readChallenge(options)?.code || ''
}

function isLocalDevHost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

function shouldUseServerOtp() {
  if (typeof window === 'undefined') return false
  if (window.__USE_OTP_API__ === true) return true
  if (window.__DISABLE_OTP_API__ === true) return false
  return !isLocalDevHost()
}

function otpEmailType(context) {
  return String(context || '').startsWith('TXN-') ? 'transfer' : 'signin'
}

function timeoutSignal(ms) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return { controller, timeout }
}

async function sendOtpViaServer(email, code, context) {
  const { controller, timeout } = timeoutSignal(OTP_DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ email, code, type: otpEmailType(context) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || 'Verification email service failed.')
      err.code = data.code || `otp-server-${res.status}`
      throw err
    }
    return data
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error('Verification email service timed out.')
      timeoutErr.code = 'otp-server-timeout'
      throw timeoutErr
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function sendOtpViaEmailJs(email, code) {
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, { to_email: email, otp_code: code, expiry_time: '10' }, PUBLIC_KEY)
}

async function deliverOtp(email, code, context) {
  if (!email) throw new Error('No email address provided.')
  if (!shouldUseServerOtp()) return sendOtpViaEmailJs(email, code)

  try {
    return await sendOtpViaServer(email, code, context)
  } catch (serverErr) {
    console.warn('[otp] server delivery failed; falling back to EmailJS.', serverErr.message)
    return sendOtpViaEmailJs(email, code)
  }
}

// Supports the onboarding promise API and the transfer callback API.
export function sendOtp(firstArg, secondArg, context = '') {
  const asyncStyle = typeof firstArg === 'string'
  const email = asyncStyle ? firstArg : getCurrentUserEmail()
  const otpContext = asyncStyle ? secondArg || '' : context
  const code = generateOtp({ email, context: otpContext })
  const request = deliverOtp(email, code, otpContext)
  const delivery = request.catch(err => {
    if (challenge?.code === code) clearOtp()
    throw err
  })
  if (asyncStyle) return delivery.then(() => ({ fallback: false }))
  delivery.then(() => firstArg?.()).catch(err => secondArg?.(err))
}

export function verifyOtp(input, options) {
  const current = readChallenge(options)
  const entered = String(input || '').trim()
  if (!current || !/^\d{6}$/.test(entered)) return false
  if (entered !== current.code) {
    current.attempts += 1
    if (current.attempts >= MAX_ATTEMPTS) clearOtp()
    else persistOtp()
    return false
  }
  clearOtp()
  return true
}
