import { useState, useEffect, useRef } from 'react'
import VaultLoader from './components/VaultLoader'
import LoginScreen from './components/LoginScreen'
import OnboardingFlow from './components/OnboardingFlow'
import Dashboard from './components/Dashboard'
import SecurityLock from './components/SecurityLock'
import { registerUser, getUserProfile, onAuthChange, logoutUser } from './services/firebaseAuth'

const APP_SESSION_KEY = 'securebank_app_session_verified'

export default function App() {
  const [booting, setBooting]         = useState(true)
  const [user, setUser]               = useState(null)
  // authLoading stays true until Firebase's onAuthStateChanged fires once.
  // This prevents the React #310 "flash of unauthenticated content" on refresh.
  const [authLoading, setAuthLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  // Flag to prevent onAuthStateChanged from interfering during registration.
  // When registerUser() calls createUserWithEmailAndPassword, onAuthStateChanged
  // fires immediately — before setDoc writes the profile. Without this guard the
  // callback sees no profile and signs the user out, causing a race condition.
  const isRegisteringRef = useRef(false)
  const initialAuthResolvedRef = useRef(false)

  // ── Firebase auth state listener ─────────────────────────
  // onAuthStateChanged fires immediately with the persisted session (or null).
  // We wait for that first callback before rendering any screen.
  useEffect(() => {
    // Safety net: if onAuthStateChanged never fires (e.g. network issue),
    // force authLoading to false after 8 s so the app never stays white.
    const safetyTimer = setTimeout(() => setAuthLoading(false), 8000)

    const unsub = onAuthChange(async (firebaseUser) => {
      try {
        const isInitialAuth = !initialAuthResolvedRef.current
        initialAuthResolvedRef.current = true

        if (firebaseUser) {
          // Skip profile fetch while registration is in progress — the profile
          // hasn't been written to Firestore yet at this point.
          if (isRegisteringRef.current) {
            clearTimeout(safetyTimer)
            setAuthLoading(false)
            return
          }

          // User is signed in — fetch their Firestore profile
          if (isInitialAuth) {
            try { await logoutUser() } catch { /* silent */ }
            clearAppSession()
            clearLocalStorage()
            setUser(null)
            return
          }

          if (!hasVerifiedAppSession()) {
            try { await logoutUser() } catch { /* silent */ }
            clearLocalStorage()
            setUser(null)
            return
          }

          let profile = await getUserProfile(firebaseUser.uid)

          // Fallback: if Firestore is unavailable, try localStorage
          if (!profile) {
            try {
              const cached = localStorage.getItem('securebank_user')
              if (cached) {
                const parsed = JSON.parse(cached)
                if ((parsed.uid || parsed.id) === firebaseUser.uid) {
                  console.log('[App] Using cached profile from localStorage')
                  profile = parsed
                }
              }
            } catch { /* silent */ }
          }

          if (profile) {
            setUser(profile)
            try {
              // Avoid storing large base64 profilePic in localStorage
              const lsProfile = { ...profile }
              if (lsProfile.profilePic && lsProfile.profilePic.length > 5000) {
                lsProfile.profilePic = ''
                lsProfile.profile_pic = ''
              }
              const profileUid = profile.uid || profile.id || firebaseUser.uid || ''
              let sameCachedUser = false
              try {
                const cachedBefore = JSON.parse(localStorage.getItem('securebank_user') || '{}')
                const cachedUid = cachedBefore.uid || cachedBefore.id || ''
                const balanceOwner = localStorage.getItem('bank_balance_owner') || cachedUid
                sameCachedUser = !!profileUid && cachedUid === profileUid && balanceOwner === profileUid
              } catch { /* silent */ }
              localStorage.setItem('securebank_user',      JSON.stringify(lsProfile))
              localStorage.setItem('user_account_type',    profile.accountType    || '')
              localStorage.setItem('user_email',           profile.email          || firebaseUser.email || '')
              localStorage.setItem('user_name',            profile.full_name      || profile.name || '')
              localStorage.setItem('user_account_number',  profile.accountNumber  || profile.account_number || '')
              // ── CRITICAL: Never overwrite a higher localStorage balance with
              // a lower Firestore value. Admin credits may not have synced to
              // Firestore yet (App Check blocking on localhost), so we keep
              // whichever value is higher to prevent balance loss on refresh.
              const existingBal = parseFloat(localStorage.getItem('bank_balance') || '0')
              const profileBal  = parseFloat(profile.balance ?? 0)
              const bestBal     = sameCachedUser ? Math.max(existingBal, profileBal) : profileBal
              localStorage.setItem('bank_balance', String(bestBal))
              localStorage.setItem('bank_balance_owner', profileUid)
              console.log('[App] balance reconciled — Firestore:', profileBal, '| localStorage:', existingBal, '| using:', bestBal)
            } catch (storageErr) {
              console.warn('[App] localStorage write failed (quota?):', storageErr.message)
            }
          } else {
            // Auth token exists but no profile anywhere — sign out cleanly
            try { await logoutUser() } catch { /* silent */ }
            clearLocalStorage()
            setUser(null)
          }
        } else {
          // No session
          clearAppSession()
          setUser(null)
        }
      } catch (err) {
        console.warn('[App] auth callback error:', err)
        setUser(null)
      } finally {
        // Always resolve authLoading — prevents permanent white screen
        clearTimeout(safetyTimer)
        setAuthLoading(false)
      }
    })

    return () => {
      clearTimeout(safetyTimer)
      unsub()
    }
  }, [])

  // Show vault splash on first load (5 seconds)
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 5000)
    return () => clearTimeout(t)
  }, [])

  // Show loader while vault is booting OR while Firebase auth hasn't resolved yet
  if (booting || authLoading) {
    return <VaultLoader message="Initializing Secure Banking…" />
  }

  if (registering) {
    return (
      <OnboardingFlow
        onComplete={async (data) => {
          try {
            // Set flag BEFORE calling registerUser so onAuthStateChanged
            // knows not to interfere while the profile is being written.
            isRegisteringRef.current = true
            markAppSession()

            const profile = await registerUser({
              email: data.email,
              password: data.password,
              name: data.fullName,
              accountNumber: data.accountNumber,
              accountType: data.accountType,
              pin: data.pin,
              profilePic: data.profilePic || '',
            })
            // Wipe any previous user's data (transfer_history, notifications,
            // balance etc.) before writing the new account's data so a fresh
            // account always starts with an empty transaction history.
            clearLocalStorage()
            try {
              // Avoid storing large base64 profilePic in localStorage
              const lsProfile = { ...profile }
              if (lsProfile.profilePic && lsProfile.profilePic.length > 5000) {
                lsProfile.profilePic = ''
                lsProfile.profile_pic = ''
              }
              localStorage.setItem('securebank_user',     JSON.stringify(lsProfile))
              localStorage.setItem('user_account_type',   profile.accountType   || data.accountType)
              localStorage.setItem('user_email',          profile.email         || data.email)
              localStorage.setItem('user_name',           profile.name          || data.fullName)
              localStorage.setItem('user_account_number', profile.accountNumber || profile.account_number || '')
              localStorage.setItem('bank_balance', '0')
              localStorage.setItem('bank_balance_owner', profile.uid || profile.id || '')
            } catch (storageErr) {
              console.warn('[App] localStorage write failed (quota?):', storageErr.message)
            }
            setUser(profile)
            setRegistering(false)
            isRegisteringRef.current = false
          } catch (err) {
            isRegisteringRef.current = false
            clearAppSession()
            // Show user-friendly error messages for common Firebase Auth errors
            const code = err.code || ''
            if (code === 'auth/email-already-in-use') {
              alert('This email is already registered. Please sign in instead, or use a different email.')
            } else if (code === 'auth/invalid-email') {
              alert('Please enter a valid email address.')
            } else if (code === 'auth/weak-password') {
              alert('Password is too weak. Please use at least 6 characters.')
            } else {
              alert(err.message || 'Registration failed. Please try again.')
            }
          }
        }}
      />
    )
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={(u) => {
          markAppSession()
          setUser(u)
          try {
            const lsUser = { ...u }
            if (lsUser.profilePic && lsUser.profilePic.length > 5000) {
              lsUser.profilePic = ''
              lsUser.profile_pic = ''
            }
            localStorage.setItem('securebank_user',     JSON.stringify(lsUser))
            localStorage.setItem('user_account_type',   u.accountType   || 'Savings Account')
            localStorage.setItem('user_email',          u.email         || '')
            localStorage.setItem('user_name',           u.name          || u.full_name || '')
            localStorage.setItem('user_account_number', u.accountNumber || u.account_number || '')
            localStorage.setItem('bank_balance', String(u.balance ?? 0))
            localStorage.setItem('bank_balance_owner', u.uid || u.id || '')
          } catch (storageErr) {
            console.warn('[App] localStorage write failed (quota?):', storageErr.message)
          }
        }}
        onRegister={() => setRegistering(true)}
      />
    )
  }

  const handleForceLogout = async () => {
    try { await logoutUser() } catch { /* silent */ }
    clearAppSession()
    clearLocalStorage()
    setUser(null)
  }

  return (
    <SecurityLock onForceLogout={handleForceLogout}>
      {/* Pass as `profile` — Dashboard expects `profile` prop, not `user` */}
      <Dashboard profile={user} onLogout={async () => {
        try { await logoutUser() } catch { /* silent */ }
        clearAppSession()
        clearLocalStorage()
        setUser(null)
      }} />
    </SecurityLock>
  )
}

function clearLocalStorage() {
  // Auth & profile
  localStorage.removeItem('securebank_user')
  localStorage.removeItem('user_account_type')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_account_number')
  // Balance — must reset so new user starts at 0
  localStorage.removeItem('bank_balance')
  localStorage.removeItem('bank_balance_owner')
  localStorage.removeItem('balance_local_update_ts')
  localStorage.removeItem('savings_vault')
  // Transaction history — the source of the "ghost transactions" bug
  localStorage.removeItem('transfer_history')
  localStorage.removeItem('deleted_transactions')
  localStorage.removeItem('scheduled_transfers')
  localStorage.removeItem('crypto_holdings')
  localStorage.removeItem('investment_portfolio')
  localStorage.removeItem('securebank_loans')
  localStorage.removeItem('securebank_financial_investments')
  // Notifications
  localStorage.removeItem('securebank_notifications')
  localStorage.removeItem('email_notifications_log')
  localStorage.removeItem('securebank_admin')
  localStorage.removeItem('user_feature_flags')
  localStorage.removeItem('biometric_cred_id')
  localStorage.removeItem('biometric_email')
  localStorage.removeItem('biometric_prompt_shown')
  // UI state
  localStorage.removeItem('privacy_state')
  localStorage.removeItem('system_notification_dismissed')
}

function hasVerifiedAppSession() {
  try { return sessionStorage.getItem(APP_SESSION_KEY) === 'true' } catch { return false }
}

function markAppSession() {
  try { sessionStorage.setItem(APP_SESSION_KEY, 'true') } catch { /* silent */ }
}

function clearAppSession() {
  try { sessionStorage.removeItem(APP_SESSION_KEY) } catch { /* silent */ }
}
