import { useEffect, useRef, useState } from 'react'
import VaultLoader from './components/VaultLoader'
import LoginScreen from './components/LoginScreen'
import OnboardingFlow from './components/OnboardingFlow'
import Dashboard from './components/Dashboard'
import SecurityLock from './components/SecurityLock'
import { registerUser, getUserProfile, onAuthChange, logoutUser } from './services/firebaseAuth'

const APP_SESSION_KEY = 'securebank_app_session_verified'

export default function App() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const isRegisteringRef = useRef(false)
  const initialAuthResolvedRef = useRef(false)

  useEffect(() => {
    const safetyTimer = setTimeout(() => setAuthLoading(false), 8000)

    const unsub = onAuthChange(async (firebaseUser) => {
      try {
        const isInitialAuth = !initialAuthResolvedRef.current
        initialAuthResolvedRef.current = true

        if (!firebaseUser) {
          clearAppSession()
          setUser(null)
          return
        }

        if (isRegisteringRef.current) {
          return
        }

        if (isInitialAuth || !hasVerifiedAppSession()) {
          await safeLogout()
          clearAppSession()
          clearLocalStorage()
          setUser(null)
          return
        }

        const profile = await getUserProfile(firebaseUser.uid)
        if (!profile) {
          await safeLogout()
          clearAppSession()
          clearLocalStorage()
          setUser(null)
          return
        }

        cacheProfile(profile, firebaseUser.email)
        setUser(profile)
      } catch (err) {
        console.warn('[App] auth callback error:', err.message || err)
        await safeLogout()
        clearAppSession()
        clearLocalStorage()
        setUser(null)
      } finally {
        clearTimeout(safetyTimer)
        setAuthLoading(false)
      }
    })

    return () => {
      clearTimeout(safetyTimer)
      unsub()
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (booting || authLoading) {
    return <VaultLoader message="Initializing Secure Banking..." />
  }

  if (registering) {
    return (
      <OnboardingFlow
        onComplete={async (data) => {
          try {
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

            clearLocalStorage()
            cacheProfile(profile, data.email)
            setUser(profile)
            setRegistering(false)
          } catch (err) {
            clearAppSession()
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
          } finally {
            isRegisteringRef.current = false
          }
        }}
      />
    )
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={(profile) => {
          markAppSession()
          cacheProfile(profile)
          setUser(profile)
        }}
        onRegister={() => setRegistering(true)}
      />
    )
  }

  const handleLogout = async () => {
    await safeLogout()
    clearAppSession()
    clearLocalStorage()
    setUser(null)
  }

  return (
    <SecurityLock onForceLogout={handleLogout}>
      <Dashboard profile={user} onLogout={handleLogout} />
    </SecurityLock>
  )
}

function cacheProfile(profile, fallbackEmail = '') {
  try {
    const lsProfile = { ...profile }
    if (lsProfile.profilePic && lsProfile.profilePic.length > 5000) {
      lsProfile.profilePic = ''
      lsProfile.profile_pic = ''
    }

    const uid = profile.uid || profile.id || ''
    localStorage.setItem('securebank_user', JSON.stringify(lsProfile))
    localStorage.setItem('user_account_type', profile.accountType || '')
    localStorage.setItem('user_email', profile.email || fallbackEmail || '')
    localStorage.setItem('user_name', profile.full_name || profile.name || '')
    localStorage.setItem('user_account_number', profile.accountNumber || profile.account_number || '')
    localStorage.setItem('bank_balance', String(profile.balance ?? 0))
    localStorage.setItem('bank_balance_owner', uid)
    localStorage.setItem('balance_local_update_ts', String(Date.now()))
    localStorage.setItem('savings_vault', String(profile.savingsVault ?? profile.savings_vault ?? 0))
  } catch (err) {
    console.warn('[App] localStorage write failed:', err.message)
  }
}

async function safeLogout() {
  try { await logoutUser() } catch { /* silent */ }
}

function clearLocalStorage() {
  localStorage.removeItem('securebank_user')
  localStorage.removeItem('user_account_type')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_account_number')
  localStorage.removeItem('bank_balance')
  localStorage.removeItem('bank_balance_owner')
  localStorage.removeItem('balance_local_update_ts')
  localStorage.removeItem('savings_vault')
  localStorage.removeItem('transfer_history')
  localStorage.removeItem('deleted_transactions')
  localStorage.removeItem('scheduled_transfers')
  localStorage.removeItem('crypto_holdings')
  localStorage.removeItem('investment_portfolio')
  localStorage.removeItem('securebank_loans')
  localStorage.removeItem('securebank_financial_investments')
  localStorage.removeItem('securebank_notifications')
  localStorage.removeItem('email_notifications_log')
  localStorage.removeItem('securebank_admin')
  localStorage.removeItem('user_feature_flags')
  localStorage.removeItem('biometric_cred_id')
  localStorage.removeItem('biometric_email')
  localStorage.removeItem('biometric_prompt_shown')
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
