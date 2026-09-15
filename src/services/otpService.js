import emailjs from '@emailjs/browser'
import { getCurrentUserEmail, getCurrentUserUid } from './accountLedger'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_llxvb7m'
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_OTP_TEMPLATE_ID || 'template_pxc66y7'
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'kLiAq79ZBAjG8epzA'
emailjs.init(PUBLIC_KEY)

const OTP_SESSION_KEY = 'securebank_last_otp'
const OTP_TTL_MS = 10 * 60 * 1000
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

// Supports the onboarding promise API and the transfer callback API.
export function sendOtp(firstArg, secondArg, context = '') {
  const asyncStyle = typeof firstArg === 'string'
  const email = asyncStyle ? firstArg : getCurrentUserEmail()
  const code = generateOtp({ email, context: asyncStyle ? secondArg || '' : context })
  const request = email
    ? emailjs.send(SERVICE_ID, TEMPLATE_ID, { to_email: email, otp_code: code, expiry_time: '10' }, PUBLIC_KEY)
    : Promise.reject(new Error('No email address provided.'))
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
