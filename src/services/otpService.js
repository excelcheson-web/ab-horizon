/**
 * OTP Service – pure frontend EmailJS setup.
 * No Netlify functions, no Stripe, no server calls.
 */

import emailjs from '@emailjs/browser'

const SERVICE_ID  = 'service_llxvb7m'
const TEMPLATE_ID = 'template_pxc66y7'
const PUBLIC_KEY  = 'kLiAq79ZBAjG8epzA'

emailjs.init(PUBLIC_KEY)

let _lastCode = ''

export function generateOtp() {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  _lastCode = String(array[0] % 1000000).padStart(6, '0')
  return _lastCode
}

export function getLastCode() {
  return _lastCode
}

/**
 * Send an OTP email via EmailJS (frontend-only).
 *
 * Supports two calling patterns:
 *   1. sendOtp(email, variant)        — async, returns { code, fallback }  (used by OtpModal)
 *   2. sendOtp(onSuccess, onError)    — callback style                 (used by transfers)
 */
export function sendOtp(firstArg, secondArg) {
  const code = generateOtp()

  // Detect calling pattern: if firstArg looks like an email string, use async style
  const isAsyncStyle = typeof firstArg === 'string'

  let recipientEmail = isAsyncStyle
    ? firstArg
    : localStorage.getItem('user_email')

  // Fallback: if user_email is not set, try to extract from the stored profile JSON
  if (!recipientEmail) {
    try {
      const stored = JSON.parse(localStorage.getItem('securebank_user') || 'null')
      if (stored && stored.email) {
        recipientEmail = stored.email
        // Persist for future calls so this fallback isn't needed again
        localStorage.setItem('user_email', stored.email)
      }
    } catch { /* silent */ }
  }

  const recipientName = localStorage.getItem('user_name') || ''

  const templateParams = {
    to_email: recipientEmail,
    otp_code: code,
    user_name: recipientName
  }

  console.log('OTP sendOtp called → to_email:', recipientEmail, '| isAsyncStyle:', isAsyncStyle)

  if (isAsyncStyle) {
    // Async pattern for OtpModal: sendOtp(email, variant) → { code, demo }
    return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then(() => ({ code, fallback: false }))
      .catch((err) => {
        console.error('EmailJS Error:', err)
        // Email failed — surface code as fallback so user can still authenticate
        return { code, fallback: true }
      })
  } else {
    // Callback pattern for transfers: sendOtp(onSuccess, onError)
    const onSuccess = firstArg
    const onError = secondArg

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then((response) => {
        console.log('SUCCESS!', response.status, response.text)
        if (onSuccess) onSuccess(code)
      })
      .catch((err) => {
        console.error('EmailJS Error:', err)
        if (onError) onError(err)
      })

    return code
  }
}

export function verifyOtp(input) {
  return input === _lastCode
}
