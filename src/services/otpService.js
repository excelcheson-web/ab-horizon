import emailjs from '@emailjs/browser'

// Read from .env — fall back to the hardcoded values already working in prod
const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || 'service_llxvb7m'
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_OTP_TEMPLATE_ID || 'template_pxc66y7'
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || 'kLiAq79ZBAjG8epzA'

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
 * Send an OTP email via EmailJS.
 *
 * Two calling patterns:
 *   sendOtp(email, variant)     → Promise<{ code, fallback }>   (OtpModal)
 *   sendOtp(onSuccess, onError) → returns code string           (transfers)
 */
export function sendOtp(firstArg, secondArg) {
  const code = generateOtp()

  const isAsyncStyle = typeof firstArg === 'string'

  let recipientEmail = isAsyncStyle
    ? firstArg
    : localStorage.getItem('user_email')

  if (!recipientEmail) {
    try {
      const stored = JSON.parse(localStorage.getItem('securebank_user') || 'null')
      if (stored?.email) {
        recipientEmail = stored.email
        localStorage.setItem('user_email', stored.email)
      }
    } catch { /* silent */ }
  }

  // Exactly the three params your EmailJS template expects
  const templateParams = {
    to_email:    recipientEmail,
    otp_code:    code,
    expiry_time: '10',
  }

  if (isAsyncStyle) {
    return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then(() => ({ code, fallback: false }))
      .catch((err) => {
        console.error('[otpService] EmailJS error:', err)
        return { code, fallback: true }
      })
  } else {
    const onSuccess = firstArg
    const onError   = secondArg

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then(() => { if (onSuccess) onSuccess(code) })
      .catch((err) => {
        console.error('[otpService] EmailJS error:', err)
        if (onError) onError(err)
      })

    return code
  }
}

export function verifyOtp(input) {
  return input === _lastCode
}
