import { useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../services/firebaseClient'
import AdminApp from './App.jsx'

// ── Admin identity ─────────────────────────────────────────
// Change this (or set VITE_ADMIN_EMAIL in .env) to change the
// authorised admin email. Only this address can access the panel.
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'karladelbert83@gmail.com'

// localStorage keys
const SETUP_KEY   = 'admin_setup_complete'
const REVOKED_KEY = 'admin_access_revoked'

// sessionStorage key — cleared when tab/browser closes.
// Firebase auth persists across tabs (main app shares the session),
// so we require a separate explicit admin sign-in per browser session.
const SESSION_KEY = 'admin_session_verified'

/* ── Shared field ──────────────────────────────────────────── */
function Field({ label, type = 'text', value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        color: 'rgba(255,255,255,0.50)', marginBottom: 6,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <input
        type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.07)',
          border: '1.5px solid rgba(255,255,255,0.14)',
          borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none',
        }}
      />
    </div>
  )
}

/* ── Shared card ────────────────────────────────────────────── */
function AuthCard({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg,#060f1c 0%,#0b1f4d 55%,#0d1b4b 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(201,162,58,0.22)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.50)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: '#0d1b4b', border: '1.5px solid #c9a23a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#e5c96e', fontFamily: 'Georgia,serif' }}>O</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>Optima Credit Union</p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>Admin Operations Panel</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function PrimaryBtn({ loading, children, onClick, type = 'submit', danger }) {
  return (
    <button type={type} onClick={onClick} disabled={loading} style={{
      width: '100%', padding: 13, border: 'none', borderRadius: 10, marginTop: 8,
      background: loading
        ? 'rgba(201,162,58,0.35)'
        : danger
          ? 'linear-gradient(135deg,#991b1b,#7f1d1d)'
          : 'linear-gradient(135deg,#0d1b4b,#c9a23a)',
      color: '#fff', fontSize: 15, fontWeight: 700,
      cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s',
    }}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

function ErrorMsg({ msg }) {
  return msg ? <p style={{ color:'#f87171', fontSize:13, margin:'0 0 14px', lineHeight:1.5 }}>{msg}</p> : null
}

/* ══════════════════════════════════════════════════════════
   MAIN AUTH GATE
   ══════════════════════════════════════════════════════════ */
export default function AdminAuth() {
  const [status, setStatus] = useState('loading')
  // status: loading | setup | login | authed | revoked

  useEffect(() => {
    // Revoked takes priority
    if (localStorage.getItem(REVOKED_KEY) === 'true') {
      setStatus('revoked')
      return
    }

    // Always require explicit password entry per browser session.
    // Even if Firebase has a persistent session from the main app,
    // the admin panel needs its own sessionStorage token.
    const sessionVerified = sessionStorage.getItem(SESSION_KEY) === 'true'
    const setupDone       = localStorage.getItem(SETUP_KEY) === 'true'

    if (!sessionVerified) {
      // No admin session this tab — go to setup or login
      setStatus(setupDone ? 'login' : 'setup')
      return
    }

    // Session token present — verify the Firebase user still matches
    const unsub = onAuthStateChanged(auth, user => {
      if (user && user.email === ADMIN_EMAIL) {
        setStatus('authed')
      } else {
        sessionStorage.removeItem(SESSION_KEY)
        setStatus(setupDone ? 'login' : 'setup')
      }
    })
    return () => unsub()
  }, [])

  const handleLogout = async () => {
    sessionStorage.removeItem(SESSION_KEY)
    setStatus('login')
  }

  const handleRevoke = async () => {
    if (!window.confirm('Revoke admin access? You will need your admin credentials to restore it.')) return
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.setItem(REVOKED_KEY, 'true')
    setStatus('revoked')
  }

  if (status === 'loading') return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060f1c', color: 'rgba(255,255,255,0.40)', fontSize: 14,
    }}>
      Authenticating…
    </div>
  )

  if (status === 'setup')   return <SetupScreen   onDone={() => { localStorage.setItem(SETUP_KEY,'true'); sessionStorage.setItem(SESSION_KEY,'true'); setStatus('authed') }} />
  if (status === 'login')   return <LoginScreen   onAuthed={() => { sessionStorage.setItem(SESSION_KEY,'true'); setStatus('authed') }} onNeedSetup={() => setStatus('setup')} />
  if (status === 'revoked') return <RevokedScreen onRestored={() => { localStorage.removeItem(REVOKED_KEY); setStatus('login') }} />
  return <AdminApp onLogout={handleLogout} onRevoke={handleRevoke} />
}

/* ══════════════════════════════════════════════════════════
   SETUP — runs the first time; fails if account already exists
   ══════════════════════════════════════════════════════════ */
function SetupScreen({ onDone }) {
  const [pw, setPw]   = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (pw !== pw2)    { setError('Passwords do not match.'); return }
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pw)
      onDone()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        // Account already exists — flag setup as done and go to login
        localStorage.setItem(SETUP_KEY, 'true')
        setError('Account already exists. Please sign in on the login screen.')
      } else {
        setError(err.message || 'Setup failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      <h2 style={{ margin:'0 0 4px', fontSize:19, fontWeight:700, color:'#fff' }}>Create Admin Account</h2>
      <p style={{ margin:'0 0 6px', fontSize:13, color:'rgba(255,255,255,0.45)' }}>
        Admin email: <strong style={{ color:'#e5c96e' }}>{ADMIN_EMAIL}</strong>
      </p>
      <p style={{ margin:'0 0 22px', fontSize:12, color:'rgba(255,255,255,0.30)' }}>
        This setup runs only once. Set a strong password.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Password"        type="password" value={pw}  onChange={setPw}  placeholder="Min 8 characters" autoFocus />
        <Field label="Confirm Password" type="password" value={pw2} onChange={setPw2} placeholder="Repeat password" />
        <ErrorMsg msg={error} />
        <PrimaryBtn loading={loading}>Create Admin Account</PrimaryBtn>
      </form>
    </AuthCard>
  )
}

/* ══════════════════════════════════════════════════════════
   LOGIN
   ══════════════════════════════════════════════════════════ */
function LoginScreen({ onAuthed, onNeedSetup }) {
  const [pw, setPw]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw)
      if (cred.user.email !== ADMIN_EMAIL) {
        await signOut(auth)
        setError('Access denied.')
        return
      }
      onAuthed()
    } catch {
      setError('Incorrect password. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    try {
      await sendPasswordResetEmail(auth, ADMIN_EMAIL)
      setResetSent(true)
    } catch {
      setError('Could not send reset email.')
    }
  }

  return (
    <AuthCard>
      <h2 style={{ margin:'0 0 4px', fontSize:19, fontWeight:700, color:'#fff' }}>Admin Sign In</h2>
      <p style={{ margin:'0 0 6px', fontSize:13, color:'rgba(255,255,255,0.45)' }}>
        Signing in as <strong style={{ color:'#e5c96e' }}>{ADMIN_EMAIL}</strong>
      </p>
      <p style={{ margin:'0 0 22px', fontSize:12, color:'rgba(255,255,255,0.30)' }}>
        Restricted — authorised personnel only.
      </p>
      {resetSent ? (
        <p style={{ color:'#86efac', fontSize:14, textAlign:'center', padding:'16px 0', lineHeight:1.6 }}>
          Password reset email sent to {ADMIN_EMAIL}.<br/>Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" autoFocus />
          <ErrorMsg msg={error} />
          <PrimaryBtn loading={loading}>Sign In</PrimaryBtn>
          <button type="button" onClick={handleReset} style={{
            width:'100%', marginTop:10, background:'none', border:'none',
            color:'rgba(201,162,58,0.75)', fontSize:13, cursor:'pointer',
          }}>
            Forgot password?
          </button>
          <button type="button" onClick={onNeedSetup} style={{
            width:'100%', marginTop:6, background:'none', border:'none',
            color:'rgba(255,255,255,0.25)', fontSize:12, cursor:'pointer',
          }}>
            First time? Set up admin account
          </button>
        </form>
      )}
    </AuthCard>
  )
}

/* ══════════════════════════════════════════════════════════
   REVOKED — restore with correct password
   ══════════════════════════════════════════════════════════ */
function RevokedScreen({ onRestored }) {
  const [pw, setPw]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRestore = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw)
      await signOut(auth) // sign out — onRestored sets status back to login
      onRestored()
    } catch {
      setError('Incorrect password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      <div style={{ textAlign:'center', marginBottom:22 }}>
        <div style={{ fontSize:38, marginBottom:10 }}>🔒</div>
        <h2 style={{ margin:'0 0 8px', fontSize:18, fontWeight:700, color:'#fff' }}>Admin Access Revoked</h2>
        <p style={{ margin:0, fontSize:13, color:'rgba(255,255,255,0.40)', lineHeight:1.6 }}>
          Enter the admin password to restore access.<br/>
          <span style={{ color:'#e5c96e', fontSize:12 }}>{ADMIN_EMAIL}</span>
        </p>
      </div>
      <form onSubmit={handleRestore}>
        <Field label="Admin Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" autoFocus />
        <ErrorMsg msg={error} />
        <PrimaryBtn loading={loading}>Restore Access</PrimaryBtn>
      </form>
    </AuthCard>
  )
}
