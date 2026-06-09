import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebaseClient'

// ── Safe upsert: creates the doc if missing, merges if it exists ──────────────
// updateDoc throws NOT_FOUND when the profile doc was never written to Firestore
// (e.g. App Check blocked the initial setDoc during registration).
// setDoc with { merge: true } is safe in both cases.
async function safeUpdate(docRef, fields) {
  try {
    await setDoc(docRef, fields, { merge: true })
  } catch (err) {
    console.warn('[firebaseAuth] safeUpdate failed:', err.message)
    throw err
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateAccountNumber() {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  return digits.join('')
}

function normalizeProfile(uid, raw) {
  return {
    uid,
    id:             uid,
    email:          raw.email          || '',
    full_name:      raw.full_name      || raw.name          || 'User',
    name:           raw.full_name      || raw.name          || 'User',
    accountNumber:  raw.accountNumber  || raw.account_number || '',
    account_number: raw.accountNumber  || raw.account_number || '',
    accountType:    raw.accountType    || raw.account_type   || 'Savings Account',
    account_type:   raw.accountType    || raw.account_type   || 'Savings Account',
    pin:            raw.pin            || '',
    profilePic:     raw.profilePic     || raw.profile_pic    || '',
    profile_pic:    raw.profilePic     || raw.profile_pic    || '',
    balance:        raw.balance        ?? 0,
    savingsVault:   raw.savingsVault   || raw.savings_vault  || 0,
  }
}

export async function registerUser(userData) {
  const email         = userData.email
  const password      = userData.password
  const fullName      = userData.name || userData.full_name || 'New User'
  const accountNumber = userData.accountNumber || userData.account_number || generateAccountNumber()

  if (!email || !password) {
    throw new Error('Email and password are required to register.')
  }

  // Create a real email/password user in Firebase Auth
  console.log('[registerUser] Creating auth user…')
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  console.log('[registerUser] Auth user created:', user.uid)

  const profileData = {
    full_name:    fullName,
    email,
    accountNumber,
    accountType:  userData.accountType  || 'Savings Account',
    pin:          userData.pin          || '',
    profilePic:   userData.profilePic   || '',
    balance:      0,
    savingsVault: 0,
    createdAt:    new Date().toISOString(),
  }

  // Build the normalized profile immediately so we can cache it in localStorage
  // BEFORE attempting the Firestore write. This ensures the app works even if
  // App Check / Firestore is temporarily unavailable (e.g. reCAPTCHA domain
  // not yet registered for the production URL).
  const profile = normalizeProfile(user.uid, profileData)

  // Save to localStorage immediately as fallback
  try {
    localStorage.setItem('securebank_user', JSON.stringify(profile))
    console.log('[registerUser] Profile cached in localStorage ✅')
  } catch { /* silent */ }

  // Write to Firestore (non-blocking / fire-and-forget on ALL environments).
  // If App Check blocks the write, the localStorage fallback keeps the app working.
  // The profile will sync to Firestore once App Check is properly configured.
  console.log('[registerUser] Writing Firestore profile (non-blocking)…')
  setDoc(doc(db, 'profiles', user.uid), profileData)
    .then(() => console.log('[registerUser] Firestore profile synced ✅'))
    .catch((err) => console.warn('[registerUser] Firestore write failed (localStorage fallback active):', err.message))

  console.log('[registerUser] Registration complete ✅', profile)
  return profile
}

// Helper: race a promise against a timeout (ms). Rejects with 'timeout' on expiry.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function getCachedProfileForUid(uid) {
  try {
    const cached = localStorage.getItem('securebank_user')
    if (!cached) return null
    const parsed = JSON.parse(cached)
    const cachedUid = parsed.uid || parsed.id || ''
    return cachedUid === uid ? parsed : null
  } catch {
    return null
  }
}

function getCachedNameForUid(uid) {
  const cached = getCachedProfileForUid(uid)
  return cached?.full_name || cached?.name || ''
}

export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required to log in.')
  }

  // Sign in with email/password instead of anonymous
  const { user } = await signInWithEmailAndPassword(auth, email, password)

  // Try to fetch profile from Firestore (with 5s timeout to avoid hanging on localhost)
  let snap = null
  try {
    snap = await withTimeout(getDoc(doc(db, 'profiles', user.uid)), 5000)
  } catch (err) {
    console.warn('[loginUser] Firestore read failed, falling back to localStorage:', err.message)
  }

  if (snap && snap.exists()) {
    const data = snap.data()
    // If the Firestore doc was created by safeUpdateBalance (only has { balance }),
    // it will be missing full_name / email / accountNumber. Supplement from auth user.
    if (!data.full_name && !data.name) {
      const storedName = getCachedNameForUid(user.uid)
      data.full_name = user.displayName || storedName || (user.email ? user.email.split('@')[0] : '') || 'Account Holder'
      data.email = data.email || user.email || email
      data.accountNumber = data.accountNumber || generateAccountNumber()
      data.accountType = data.accountType || 'Savings Account'
      // Persist the supplemented fields back to Firestore (fire-and-forget)
      setDoc(doc(db, 'profiles', user.uid), {
        full_name:     data.full_name,
        email:         data.email,
        accountNumber: data.accountNumber,
        accountType:   data.accountType,
      }, { merge: true }).catch(() => {})
    }
    return normalizeProfile(user.uid, data)
  }

  // Fallback: try localStorage profile (written during registration)
  const cachedProfile = getCachedProfileForUid(user.uid)
  if (cachedProfile) {
    console.log('[loginUser] Using cached profile from localStorage')
    return cachedProfile
  }

  // Last resort: construct a basic profile from the Firebase Auth user object.
  // This handles the case where Firestore is unavailable (App Check / timeout)
  // AND localStorage has no cached profile (different browser, cleared storage).
  console.warn('[loginUser] No Firestore or localStorage profile — constructing from auth user')
  // Prefer the stored user_name (set during registration) over the email prefix
  const storedName = getCachedNameForUid(user.uid)
  const fallbackProfile = normalizeProfile(user.uid, {
    email:         user.email || email,
    full_name:     user.displayName || storedName || email.split('@')[0] || 'User',
    accountNumber: generateAccountNumber(),
    accountType:   'Savings Account',
    balance:       0,
    savingsVault:  0,
  })

  // Cache it so subsequent logins / Face ID work
  try {
    localStorage.setItem('securebank_user', JSON.stringify(fallbackProfile))
    console.log('[loginUser] Fallback profile cached in localStorage ✅')
  } catch { /* silent */ }

  // Also attempt to write to Firestore (fire-and-forget) so it's there next time
  setDoc(doc(db, 'profiles', user.uid), {
    full_name:    fallbackProfile.full_name,
    email:        fallbackProfile.email,
    accountNumber: fallbackProfile.accountNumber,
    accountType:  fallbackProfile.accountType,
    balance:      fallbackProfile.balance,
    savingsVault: fallbackProfile.savingsVault,
    createdAt:    new Date().toISOString(),
  }).then(() => console.log('[loginUser] Fallback profile synced to Firestore ✅'))
    .catch((err) => console.warn('[loginUser] Firestore write failed:', err.message))

  return fallbackProfile
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function logoutUser() {
  await signOut(auth)
}

// ── Fetch profile by UID ──────────────────────────────────────────────────────

export async function getUserProfile(uid) {
  try {
    const snap = await withTimeout(getDoc(doc(db, 'profiles', uid)), 5000)
    if (!snap.exists()) return null
    return normalizeProfile(uid, snap.data())
  } catch (err) {
    console.error('[firebaseAuth] getUserProfile error:', err.message)
    return null
  }
}

// ── Update profile fields ─────────────────────────────────────────────────────

export async function updateUserProfile(uid, fields) {
  await safeUpdate(doc(db, 'profiles', uid), fields)
}

// ── Auth state listener ───────────────────────────────────────────────────────
// Returns the unsubscribe function — call it in useEffect cleanup.

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

