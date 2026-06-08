import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

// ─────────────────────────────────────────────────────────────────────────────
// Firebase config — uses environment variables with fallback to production values
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDt0vYV7xfhoNHsCc6XnUfTFQl6SkBNFyk',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'login-tdpay.net',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || 'td-project-pro',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'td-project-pro.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '750514900015',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || '1:750514900015:web:c49df7bdf3503d2faccada',
}
// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)

// ── Global Circuit Breaker for Firestore Quota Management ────────────────────
// This prevents resource-exhausted errors by tracking failures and stopping
// all Firestore operations when quota is exceeded.
// ─────────────────────────────────────────────────────────────────────────────
export const firestoreCircuitBreaker = {
  failureCount: 0,
  lastFailureTime: 0,
  isOpen: false,
  maxFailures: 2,
  resetTimeout: 600000, // 10 minutes - very long cooldown
  
  recordFailure(errorCode) {
    if (errorCode === 'resource-exhausted') {
      this.failureCount++
      this.lastFailureTime = Date.now()
      if (this.failureCount >= this.maxFailures) {
        this.isOpen = true
        console.error('[FirestoreCircuitBreaker] OPEN - All Firestore writes blocked for 10 minutes')
      }
    }
  },
  
  canOperate() {
    if (!this.isOpen) return true
    const timeSinceLastFailure = Date.now() - this.lastFailureTime
    if (timeSinceLastFailure > this.resetTimeout) {
      this.isOpen = false
      this.failureCount = 0
      console.log('[FirestoreCircuitBreaker] RESET - Firestore operations resumed')
      return true
    }
    return false
  },
  
  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failureCount,
      timeUntilReset: this.isOpen ? this.resetTimeout - (Date.now() - this.lastFailureTime) : 0
    }
  }
}

// ── Offline Persistence DISABLED ──────────────────────────────────────────────
// Persistence is disabled to prevent multi-tab failed-precondition errors.
// The app uses memory cache which works fine for our use case.
// All data is backed up to localStorage as the primary storage mechanism.
// Firestore is only used as a secondary sync when quota allows.
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: enableIndexedDbPersistence is deprecated and causes issues with multi-tab
// scenarios. We intentionally do NOT enable it to avoid console spam and errors.

// ── App Check (reCAPTCHA v3) ──────────────────────────────────────────────────
// Firestore has App Check enforcement enabled, so we MUST initialize App Check
// on every environment — including localhost.
//
// On localhost we use a debug token. The first time you run the app locally,
// Firebase will log a debug token to the browser console like:
//   "App Check debug token: <UUID>"
// Copy that token and register it in:
//   Firebase Console → App Check → Apps → ⋮ → Manage debug tokens → Add debug token
//
// In production the real reCAPTCHA v3 provider is used automatically.
// ──────────────────────────────────────────────────────────────────────────────
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1')

const isProduction =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'optimaunion.com' ||
   window.location.hostname === 'www.optimaunion.com')

if (typeof window !== 'undefined') {
  try {
    if (isLocalhost) {
      // Use a fixed debug token on localhost so it's easy to register once
      // in Firebase Console → App Check → Apps → Manage debug tokens.
      // Token: 'B9C21B4E-3D2A-4F8E-9B6C-7A1D5E0F3C8B'
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = 'B9C21B4E-3D2A-4F8E-9B6C-7A1D5E0F3C8B'
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LekIpIsAAAAANyoVvklRU5sfyjht_NCUp-roZOu'),
        isTokenAutoRefreshEnabled: true,
      })
      console.log('[AppCheck] Initialized for localhost')
    }
    // NOTE: App Check is DISABLED on production until a valid reCAPTCHA v3 key is configured
    // The provided key appears to be reCAPTCHA v2 which is incompatible with Firebase App Check
    // To fix: Create a reCAPTCHA v3 key at https://www.google.com/recaptcha/admin
    // and add login-tdpay.net to the allowed domains
  } catch (e) {
    console.warn('[AppCheck] initialization skipped:', e.message)
  }
}

export { isLocalhost, isProduction }
