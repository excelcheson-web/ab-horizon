/**
 * biometricService.js
 * Real WebAuthn (FIDO2) biometric authentication.
 * Uses the device's native Face ID, fingerprint, or Windows Hello.
 * Works on HTTPS (production) and localhost (dev).
 */

const CRED_KEY  = 'biometric_cred_id'
const EMAIL_KEY = 'biometric_email'

/* ── Buffer helpers ─────────────────────────────────────── */
function bufToB64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64ToBuf(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer
}

/* ── Feature detection ──────────────────────────────────── */
export function isBiometricSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials?.create)
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isBiometricSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricRegistered() {
  return !!localStorage.getItem(CRED_KEY)
}

export function getBiometricEmail() {
  return localStorage.getItem(EMAIL_KEY) || ''
}

/* ── Register biometric ─────────────────────────────────── */
export async function registerBiometric({ uid, email, name }) {
  if (!isBiometricSupported()) {
    throw new Error('WebAuthn is not supported on this browser.')
  }

  const challenge  = crypto.getRandomValues(new Uint8Array(32))
  const userIdBuf  = new TextEncoder().encode(uid).buffer
  const rpId       = window.location.hostname === 'localhost'
    ? 'localhost'
    : window.location.hostname

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: '[BANK NAME]',
        id: rpId,
      },
      user: {
        id: userIdBuf,
        name: email,
        displayName: name || email,
      },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',  // device biometrics only
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })

  localStorage.setItem(CRED_KEY, bufToB64(credential.rawId))
  localStorage.setItem(EMAIL_KEY, email)
  return true
}

/* ── Authenticate with biometric ────────────────────────── */
export async function authenticateWithBiometric() {
  if (!isBiometricSupported()) {
    throw new Error('WebAuthn is not supported on this browser.')
  }

  const credId = localStorage.getItem(CRED_KEY)
  if (!credId) {
    throw new Error('NO_CREDENTIAL')
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const rpId = window.location.hostname === 'localhost'
    ? 'localhost'
    : window.location.hostname

  // This call triggers the real Face ID / fingerprint / Windows Hello prompt
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId,
      allowCredentials: [{
        id: b64ToBuf(credId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      timeout: 60000,
    },
  })

  // If we reach here the device biometric succeeded
  return !!assertion
}

/* ── Remove biometric registration ──────────────────────── */
export function clearBiometric() {
  localStorage.removeItem(CRED_KEY)
  localStorage.removeItem(EMAIL_KEY)
}
