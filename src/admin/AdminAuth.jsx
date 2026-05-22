import { useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebaseClient'
import AdminApp from './App.jsx'

// Firestore path that stores the single admin account config
const CFG_REF = () => doc(db, 'system', 'admin_config')

/* ── Tiny shared field component ──────────────────────────── */
function Field({ label, type = 'text', value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%', padding: '12px 14px', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)',
          borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none',
        }}
      />
    </div>
  )
}

/* ── Shared card wrapper ───────────────────────────────────── */
function AuthCard({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg,#060f1c 0%,#0b1f4d 55%,#0d1b4b 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,162,58,0.20)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}>
        {/* Logo badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#0d1b4b', border: '1.5px solid #c9a23a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#e5c96e', fontFamily: 'Georgia,serif' }}>O</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>Optima Credit Union</p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>Admin Operations Panel</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function SubmitBtn({ loading, children }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%', padding: 13, border: 'none', borderRadius: 10, marginTop: 8,
      background: loading ? 'rgba(201,162,58,0.4)' : 'linear-gradient(135deg,#0d1b4b,#c9a23a)',
      color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
    }}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN AUTH GATE
   ══════════════════════════════════════════════════════════ */
export default function AdminAuth() {
  // status: loading | setup | login | authed | revoked
  const [status, setStatus]       = useState('loading')
  const [adminEmail, setAdminEmail] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    let unsubAuth
    const init = async () => {
      try {
        const snap = await getDoc(CFG_REF())
        if (!snap.exists() || !snap.data().setupComplete) {
          setStatus('setup')
          return
        }
        const cfg = snap.data()
        if (cfg.isActive === false) {
          setStatus('revoked')
          setAdminEmail(cfg.email || '')
          return
        }
        setAdminEmail(cfg.email)
        unsubAuth = onAuthStateChanged(auth, user => {
          if (user && user.email === cfg.email) {
            setCurrentUser(user)
            setStatus('authed')
          } else {
            if (user) signOut(auth)
            setStatus('login')
          }
        })
      } catch {
        setStatus('login')
      }
    }
    init()
    return () => { if (unsubAuth) unsubAuth() }
  }, [])

  const handleLogout = async () => {
    await signOut(auth).catch(() => {})
    setCurrentUser(null)
    setStatus('login')
  }

  const handleRevoke = async () => {
    if (!window.confirm('Revoke admin access? You will need to use the original email to restore it.')) return
    try {
      await updateDoc(CFG_REF(), { isActive: false })
      await signOut(auth)
      setStatus('revoked')
    } catch (e) {
      setError('Failed to revoke: ' + e.message)
    }
  }

  if (status === 'loading') return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#060f1c', color:'rgba(255,255,255,0.5)', fontSize:14 }}>
      Authenticating…
    </div>
  )

  if (status === 'setup')   return <SetupScreen   onDone={(email) => { setAdminEmail(email); setStatus('authed') }} />
  if (status === 'login')   return <LoginScreen   adminEmail={adminEmail} onAuthed={u => { setCurrentUser(u); setStatus('authed') }} />
  if (status === 'revoked') return <RevokedScreen adminEmail={adminEmail} onRestored={() => setStatus('login')} />
  return <AdminApp onLogout={handleLogout} onRevoke={handleRevoke} error={error} />
}

/* ══════════════════════════════════════════════════════════
   FIRST-TIME SETUP (runs once, locked forever after)
   ══════════════════════════════════════════════════════════ */
function SetupScreen({ onDone }) {
  const [email, setEmail]   = useState('')
  const [pw, setPw]         = useState('')
  const [pw2, setPw2]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (pw !== pw2)        { setError('Passwords do not match.'); return }
    if (pw.length < 8)     { setError('Password must be at least 8 characters.'); return }
    if (!email.includes('@')) { setError('Enter a valid email address.'); return }
    setLoading(true)
    try {
      await createUserWithEmailAndPassword(auth, email, pw)
      await setDoc(CFG_REF(), {
        email,
        setupComplete: true,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      onDone(email)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('That email already has a Firebase account. Use the login screen.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:700, color:'#fff' }}>Create Admin Account</h2>
      <p style={{ margin:'0 0 24px', fontSize:13, color:'rgba(255,255,255,0.45)' }}>
        This can only be done once. The email you choose becomes the permanent admin identity.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Admin Email" type="email" value={email} onChange={setEmail} placeholder="hello@optimaunion.com" autoFocus />
        <Field label="Password"    type="password" value={pw}  onChange={setPw}  placeholder="Min 8 characters" />
        <Field label="Confirm Password" type="password" value={pw2} onChange={setPw2} placeholder="Repeat password" />
        {error && <p style={{ color:'#f87171', fontSize:13, margin:'0 0 12px' }}>{error}</p>}
        <SubmitBtn loading={loading}>Create Admin Account</SubmitBtn>
      </form>
    </AuthCard>
  )
}

/* ══════════════════════════════════════════════════════════
   LOGIN SCREEN
   ══════════════════════════════════════════════════════════ */
function LoginScreen({ adminEmail, onAuthed }) {
  const [email, setEmail]     = useState(adminEmail || '')
  const [pw, setPw]           = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw)
      // Double-check the signed-in email matches the configured admin email
      if (adminEmail && cred.user.email !== adminEmail) {
        await signOut(auth)
        setError('Access denied — this email is not the admin account.')
        return
      }
      onAuthed(cred.user)
    } catch {
      setError('Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email) { setError('Enter your email first, then click Forgot Password.'); return }
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSent(true)
    } catch {
      setError('Could not send reset email. Check the address and try again.')
    }
  }

  return (
    <AuthCard>
      <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:700, color:'#fff' }}>Admin Sign In</h2>
      <p style={{ margin:'0 0 24px', fontSize:13, color:'rgba(255,255,255,0.45)' }}>
        Restricted access — authorised personnel only.
      </p>
      {resetSent ? (
        <p style={{ color:'#86efac', fontSize:14, textAlign:'center', padding:'16px 0' }}>
          Password reset email sent. Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="admin@optimaunion.com" autoFocus />
          <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" />
          {error && <p style={{ color:'#f87171', fontSize:13, margin:'0 0 12px' }}>{error}</p>}
          <SubmitBtn loading={loading}>Sign In</SubmitBtn>
          <button type="button" onClick={handleReset} style={{
            width:'100%', marginTop:12, background:'none', border:'none',
            color:'rgba(201,162,58,0.80)', fontSize:13, cursor:'pointer', textAlign:'center',
          }}>
            Forgot password?
          </button>
        </form>
      )}
    </AuthCard>
  )
}

/* ══════════════════════════════════════════════════════════
   REVOKED SCREEN — restore access using original email
   ══════════════════════════════════════════════════════════ */
function RevokedScreen({ adminEmail, onRestored }) {
  const [email, setEmail]   = useState('')
  const [pw, setPw]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleRestore = async e => {
    e.preventDefault()
    setError('')
    if (email !== adminEmail) {
      setError('That email does not match the original admin account.')
      return
    }
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, pw)
      await updateDoc(CFG_REF(), { isActive: true })
      await signOut(auth)
      onRestored()
    } catch {
      setError('Incorrect credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ fontSize:36, marginBottom:8 }}>🔒</div>
        <h2 style={{ margin:'0 0 6px', fontSize:18, fontWeight:700, color:'#fff' }}>Admin Access Revoked</h2>
        <p style={{ margin:0, fontSize:13, color:'rgba(255,255,255,0.45)' }}>
          Restore access using the original admin email and password.
        </p>
      </div>
      <form onSubmit={handleRestore}>
        <Field label="Original Admin Email" type="email" value={email} onChange={setEmail} placeholder="admin@optimaunion.com" autoFocus />
        <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" />
        {error && <p style={{ color:'#f87171', fontSize:13, margin:'0 0 12px' }}>{error}</p>}
        <SubmitBtn loading={loading}>Restore Access</SubmitBtn>
      </form>
    </AuthCard>
  )
}
