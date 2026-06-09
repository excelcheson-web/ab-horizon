import { useState, useEffect } from 'react'
import TDLogo from './TDLogo'
import { loginUser } from '../services/firebaseAuth'
import {
  isBiometricSupported,
  isBiometricRegistered,
  authenticateWithBiometric,
} from '../services/biometricService'
import { PrivacyPolicyModal, TermsOfServiceModal, CookiePolicyModal, ComplianceModal } from './LegalModals'
import { ContactUsModal, SupportCenterModal } from './ContactModals'

const APP_SESSION_KEY = 'securebank_app_session_verified'

/* ── Icons ───────────────────────────────────────────────── */
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const FaceIdIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3H5a2 2 0 0 0-2 2v2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M17 21h2a2 2 0 0 0 2-2v-2"/>
    <line x1="9" y1="9" x2="9" y2="10.5"/><line x1="15" y1="9" x2="15" y2="10.5"/>
    <path d="M9.5 15a3.5 3.5 0 0 0 5 0"/><line x1="12" y1="9" x2="12" y2="13"/>
  </svg>
)
const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

/* ── Feature icons (SVG) ─────────────────────────────────── */
const IconTransfer = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)
const IconShield = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const IconCard = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
)
const IconGlobe = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)
const IconChart = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IconBell = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

/* ── Page data ───────────────────────────────────────────── */
const FEATURES = [
  { icon: <IconTransfer/>, title: 'Instant Transfers', desc: 'Send money locally or internationally in seconds with full transaction tracking.' },
  { icon: <IconShield/>,   title: 'Bank-Grade Security', desc: 'End-to-end encryption, biometric login, and real-time fraud monitoring on every account.' },
  { icon: <IconCard/>,     title: 'Smart Debit Cards', desc: 'Virtual and physical cards with spend controls, instant freezing, and cashback rewards.' },
  { icon: <IconGlobe/>,    title: 'Multi-Currency', desc: 'Hold, convert, and send 30+ currencies at competitive live rates — no hidden fees.' },
  { icon: <IconChart/>,    title: 'Investment Access', desc: 'Stocks, ETFs, crypto — managed in one unified portfolio dashboard.' },
  { icon: <IconBell/>,     title: 'Live Alerts', desc: 'Instant push and email notifications for every transaction, login, and account change.' },
]

const STATS = [
  { value: '4.8M+', label: 'Accounts Opened',   color: '#c9a23a' },
  { value: '$220B', label: 'Processed Annually', color: '#c9a23a' },
  { value: '99.9%', label: 'Platform Uptime',    color: '#c9a23a' },
  { value: '190+',  label: 'Countries Reached',  color: '#c9a23a' },
]

const HOW_STEPS = [
  { n: '01', title: 'Create Account',    desc: 'Sign up in under 3 minutes. Verify your identity and choose your account type.' },
  { n: '02', title: 'Fund & Activate',   desc: 'Deposit funds via bank transfer or card link. Your account activates instantly.' },
  { n: '03', title: 'Secure Your Access',desc: 'Set up 2FA, biometric login, and your transaction PIN for complete protection.' },
  { n: '04', title: 'Manage Everything', desc: 'Transfers, bills, investments, cards — all controlled from one clean dashboard.' },
]

const TESTIMONIALS = [
  {
    quote: '"Switching was the best decision I made. The dashboard is clean, transfers clear in seconds, and I sleep better knowing my account is this secure."',
    name: 'David Mensah', role: 'Business Owner, Accra',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&q=80',
  },
  {
    quote: '"I handle cross-border payments weekly. The multi-currency feature alone saves me hours and the exchange rates are far better than my old bank."',
    name: 'Priya Nair', role: 'Freelance Consultant, Dubai',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&q=80',
  },
  {
    quote: '"The mobile experience is as good as any global neobank. Real-time alerts, instant card freeze, zero monthly fee. This is what banking should be."',
    name: 'Luca Fernandez', role: 'Software Engineer, Berlin',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&q=80',
  },
]

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function LoginScreen({ onLogin, onRegister }) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [showLogin,   setShowLogin]   = useState(false)
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [loadingMsg,  setLoadingMsg]  = useState('')
  const [error,       setError]       = useState('')
  const [faceIdState, setFaceIdState] = useState('idle')
  const [showForgot,  setShowForgot]  = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStep,  setForgotStep]  = useState('email')
  const [newPin,      setNewPin]      = useState('')
  const [forgotError, setForgotError] = useState('')
  const [scrolled,    setScrolled]    = useState(false)
  const [showPrivacy,    setShowPrivacy]    = useState(false)
  const [showTerms,      setShowTerms]      = useState(false)
  const [showCookies,    setShowCookies]    = useState(false)
  const [showCompliance, setShowCompliance] = useState(false)
  const [showContact,    setShowContact]    = useState(false)
  const [showSupport,    setShowSupport]    = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const getStoredUser = () => {
    try { return JSON.parse(localStorage.getItem('securebank_user') || 'null') } catch { return null }
  }

  const getProfileUid = (profile) => profile?.uid || profile?.id || ''

  const clearCachedUserData = () => {
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
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    setLoading(true); setLoadingMsg('Verifying credentials…')
    try {
      setTimeout(() => setLoadingMsg('Authenticating with server…'), 2000)
      setTimeout(() => setLoadingMsg('Establishing secure session…'), 3800)
      const previousUser = getStoredUser()
      const previousUid = getProfileUid(previousUser)
      const previousBalanceOwner = localStorage.getItem('bank_balance_owner') || previousUid
      try { sessionStorage.setItem(APP_SESSION_KEY, 'true') } catch { /* silent */ }
      const profile = await loginUser(email.trim(), password)
      const profileUid = getProfileUid(profile)
      const sameCachedUser = !!profileUid && previousUid === profileUid && (!previousBalanceOwner || previousBalanceOwner === profileUid)
      if (profileUid && previousBalanceOwner && previousBalanceOwner !== profileUid) {
        clearCachedUserData()
      }
      localStorage.setItem('securebank_user',   JSON.stringify(profile))
      localStorage.setItem('user_account_type', profile.accountType)
      localStorage.setItem('user_email',        profile.email)
      localStorage.setItem('user_name',         profile.name)
      const eb = sameCachedUser ? parseFloat(localStorage.getItem('bank_balance') || '0') : 0
      const pb = parseFloat(profile.balance || 0)
      localStorage.setItem('bank_balance', String(Math.max(eb, pb)))
      localStorage.setItem('bank_balance_owner', profileUid)
      setTimeout(() => { setLoading(false); setLoadingMsg(''); onLogin(profile) }, 5000)
    } catch (err) {
      try { sessionStorage.removeItem(APP_SESSION_KEY) } catch { /* silent */ }
      setLoading(false); setLoadingMsg('')
      const c = err.code || ''
      if (c === 'auth/user-not-found' || c === 'auth/invalid-credential' || c === 'auth/wrong-password') setError('Invalid email or password.')
      else if (c === 'auth/too-many-requests') setError('Too many attempts. Please try again later.')
      else setError(err.message || 'Login failed. Please try again.')
    }
  }

  const handleFaceId = async () => {
    if (faceIdState === 'scanning') return
    setError('')

    // Check browser support
    if (!isBiometricSupported()) {
      setError('Biometric authentication is not supported on this device or browser.')
      return
    }

    // Check if registered
    if (!isBiometricRegistered()) {
      setError('No biometric registered. Sign in with your password first, then enable Face ID from your account settings.')
      return
    }

    setFaceIdState('scanning')
    try {
      // Triggers the real device Face ID / fingerprint / Windows Hello prompt
      const verified = await authenticateWithBiometric()

      if (verified) {
        const stored = getStoredUser()
        if (stored) {
          setFaceIdState('success')
          setTimeout(() => onLogin(stored), 600)
        } else {
          // Biometric passed but session expired
          setFaceIdState('denied')
          setError('Session expired. Please sign in with your password to continue.')
          setTimeout(() => setFaceIdState('idle'), 3000)
        }
      }
    } catch (err) {
      setFaceIdState('denied')
      if (err.message === 'NO_CREDENTIAL') {
        setError('No biometric registered. Please sign in with your password first.')
      } else if (err.name === 'NotAllowedError') {
        setError('Biometric authentication was cancelled. Try again or use your password.')
      } else if (err.name === 'SecurityError') {
        setError('Biometrics require a secure connection (HTTPS).')
      } else if (err.name === 'InvalidStateError') {
        setError('Biometric credential not found on this device. Please sign in with your password.')
      } else {
        setError('Biometric authentication failed. Please use your password.')
      }
      setTimeout(() => setFaceIdState('idle'), 4000)
    }
  }

  const handleForgotSubmit = (e) => {
    e.preventDefault(); setForgotError('')
    const s = getStoredUser()
    if (!s) { setForgotError('No account found.'); return }
    if (s.email?.toLowerCase() !== forgotEmail.trim().toLowerCase()) { setForgotError('Email does not match our records.'); return }
    setForgotStep('reset')
  }

  const handleResetPin = (e) => {
    e.preventDefault(); setForgotError('')
    if (newPin.length < 4) { setForgotError('PIN must be at least 4 digits.'); return }
    const s = getStoredUser()
    if (s) { s.pin = newPin; localStorage.setItem('securebank_user', JSON.stringify(s)) }
    setForgotStep('done')
    setTimeout(() => { setShowForgot(false); setForgotStep('email'); setForgotEmail(''); setNewPin('') }, 5000)
  }

  /* ── Loading screen ─────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ position:'fixed', inset:0, background:'linear-gradient(135deg,#080f2a,#0d1b4b)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.5rem' }}>
        <TDLogo size={56} full />
        <div style={{ width:220, height:3, background:'rgba(255,255,255,0.12)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', background:'linear-gradient(90deg,#c9a23a,#e5c96e)', borderRadius:99, animation:'lp-bar 5s linear forwards' }}/>
        </div>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.8rem', margin:0 }}>{loadingMsg}</p>
        <style>{`@keyframes lp-bar{from{width:5%}to{width:100%}}`}</style>
      </div>
    )
  }

  /* ── Main page ──────────────────────────────────────── */
  return (
    <div className="hp-root">

      {/* ══ NAV ══════════════════════════════════════════ */}
      <header className={`hp-nav ${scrolled ? 'hp-nav--solid' : ''}`}>
        <div className="hp-nav-inner">
          <div className="hp-nav-brand">
            <TDLogo size={40} full />
          </div>

          <nav className="hp-nav-links">
            {['Services','Security','How It Works','About'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} className="hp-nav-link">{l}</a>
            ))}
          </nav>

          <div className="hp-nav-right">
            <button className="hp-nav-signin" onClick={() => setShowLogin(true)}>Sign In</button>
            <button className="hp-nav-open"   onClick={() => onRegister?.()}>Open Account</button>
            <button className="hp-hamburger"  onClick={() => setMenuOpen(p => !p)} aria-label="Menu">
              {menuOpen ? <CloseIcon/> : <MenuIcon/>}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="hp-mobile-nav">
            {['Services','Security','How It Works','About'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} className="hp-mobile-link" onClick={() => setMenuOpen(false)}>{l}</a>
            ))}
            <div className="hp-mobile-sep"/>
            <button className="hp-mobile-signin" onClick={() => { setMenuOpen(false); setShowLogin(true) }}>Sign In</button>
            <button className="hp-mobile-open"   onClick={() => { setMenuOpen(false); onRegister?.() }}>Open Account</button>
          </div>
        )}
      </header>

      {/* ══ HERO ═════════════════════════════════════════ */}
      <section className="hp-hero">
        <div className="hp-hero-bg">
          <img
            src="https://images.unsplash.com/photo-1639762681057-408e52192e55?w=1600&h=900&fit=crop&q=80"
            alt="" className="hp-hero-img" loading="eager"
          />
          <div className="hp-hero-overlay"/>
        </div>

        <div className="hp-hero-content">
          <div className="hp-hero-pill">Next-Generation Digital Banking</div>
          <h1 className="hp-hero-h1">
            Your money,<br/>
            <span className="hp-hero-gradient">smarter & faster.</span>
          </h1>
          <p className="hp-hero-sub">
            One account for everything — transfers, investments, cards, and savings.
            Built for speed, secured at every layer.
          </p>
          <div className="hp-hero-actions">
            <button className="hp-btn-glow" onClick={() => onRegister?.()}>
              Open Free Account <ArrowRight/>
            </button>
            <button className="hp-btn-ghost" onClick={() => setShowLogin(true)}>
              Sign In
            </button>
          </div>

          {/* Floating glass stats card */}
          <div className="hp-hero-card">
            {STATS.slice(0,2).map(s => (
              <div key={s.label} className="hp-hero-stat">
                <span className="hp-hero-stat-val" style={{ color: s.color }}>{s.value}</span>
                <span className="hp-hero-stat-lbl">{s.label}</span>
              </div>
            ))}
            <div className="hp-hero-card-divider"/>
            <div className="hp-hero-secure">
              <span className="hp-hero-dot"/>
              All connections encrypted
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════ */}
      <section className="hp-section" id="services">
        <div className="hp-container">
          <p className="hp-eyebrow">PLATFORM FEATURES</p>
          <h2 className="hp-section-h2">
            Built for the way<br/>people actually bank
          </h2>
          <div className="hp-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="hp-feature-card glass">
                <div className="hp-feature-icon">{f.icon}</div>
                <h3 className="hp-feature-title">{f.title}</h3>
                <p className="hp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS BAND ══════════════════════════════════ */}
      <div className="hp-stats-band">
        {STATS.map(s => (
          <div key={s.label} className="hp-stat-item">
            <span className="hp-stat-val" style={{ color: s.color }}>{s.value}</span>
            <span className="hp-stat-lbl">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ══ SECURITY IMAGE SECTION ══════════════════════ */}
      <section className="hp-section hp-section--alt" id="security">
        <div className="hp-container hp-security-layout">
          <div className="hp-security-text">
            <p className="hp-eyebrow">ZERO-COMPROMISE SECURITY</p>
            <h2 className="hp-section-h2">Your account is protected at every single layer</h2>
            <p className="hp-section-sub">
              From the moment you log in to the second a transfer clears — every action is verified, encrypted, and monitored.
            </p>
            <ul className="hp-security-list">
              {['256-bit SSL on all connections','2FA required for every transaction','Real-time fraud detection & blocking','Biometric login — Face ID & fingerprint','Instant account freeze from your phone','Full activity log, always accessible'].map(item => (
                <li key={item} className="hp-security-li">
                  <span className="hp-security-dot"/>
                  {item}
                </li>
              ))}
            </ul>
            <button className="hp-btn-outline" onClick={() => onRegister?.()}>
              Start Secure Banking <ArrowRight/>
            </button>
          </div>
          <div className="hp-security-visual">
            <img
              src="https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=700&h=700&fit=crop&q=80"
              alt="Security"
              className="hp-security-img"
              loading="lazy"
            />
            <div className="hp-security-badge glass">
              <span style={{ fontSize:'1.5rem' }}>🔒</span>
              <div>
                <p style={{ margin:0, fontWeight:700, fontSize:'0.875rem', color:'#fff' }}>Bank-Grade Encryption</p>
                <p style={{ margin:0, fontSize:'0.75rem', color:'rgba(255,255,255,0.55)' }}>Active on your account</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════ */}
      <section className="hp-section" id="how-it-works">
        <div className="hp-container">
          <p className="hp-eyebrow">GET STARTED IN MINUTES</p>
          <h2 className="hp-section-h2">From signup to first transaction<br/>in four steps</h2>
          <div className="hp-steps">
            {HOW_STEPS.map((s, i) => (
              <div key={s.n} className="hp-step glass">
                <div className="hp-step-num">{s.n}</div>
                {i < HOW_STEPS.length - 1 && <div className="hp-step-connector"/>}
                <h4 className="hp-step-title">{s.title}</h4>
                <p className="hp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ APP PREVIEW IMAGE ═══════════════════════════ */}
      <section className="hp-preview-section" id="about">
        <div className="hp-preview-inner">
          <div className="hp-preview-text">
            <p className="hp-eyebrow">ALWAYS IN YOUR POCKET</p>
            <h2 className="hp-section-h2">A full banking platform that fits on your screen</h2>
            <p className="hp-section-sub">
              Whether you're on a phone, tablet, or desktop — your full financial dashboard is always one tap away. No limitations, no compromises.
            </p>
            <div className="hp-preview-pills">
              {['iOS & Android','Web Dashboard','Instant Sync','Offline Mode'].map(p => (
                <span key={p} className="hp-pill">{p}</span>
              ))}
            </div>
          </div>
          <div className="hp-preview-img-wrap">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&h=600&fit=crop&q=80"
              alt="App preview"
              className="hp-preview-img"
              loading="lazy"
            />
            <div className="hp-preview-glow"/>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════ */}
      <section className="hp-section">
        <div className="hp-container">
          <p className="hp-eyebrow">CLIENT VOICES</p>
          <h2 className="hp-section-h2">Real people. Real results.</h2>
          <div className="hp-testimonials">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="hp-testi glass">
                <div className="hp-testi-stars">★★★★★</div>
                <p className="hp-testi-quote">{t.quote}</p>
                <div className="hp-testi-person">
                  <img src={t.avatar} alt={t.name} className="hp-testi-avatar" loading="lazy"/>
                  <div>
                    <p className="hp-testi-name">{t.name}</p>
                    <p className="hp-testi-role">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════ */}
      <section className="hp-cta">
        <div className="hp-cta-inner">
          <p className="hp-eyebrow hp-eyebrow--light">READY TO START?</p>
          <h2 className="hp-cta-h2">Take control of your finances today.</h2>
          <p className="hp-cta-sub">Join millions managing their wealth on one secure, modern platform.</p>
          <div className="hp-cta-btns">
            <button className="hp-btn-glow" onClick={() => onRegister?.()}>
              Open Free Account <ArrowRight/>
            </button>
            <button className="hp-btn-ghost" onClick={() => setShowLogin(true)}>
              Sign In Instead
            </button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════ */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-top">
            <div className="hp-footer-brand">
              <TDLogo size={48} full />
            </div>
            <p className="hp-footer-tagline">Secure digital banking for everyone, everywhere.</p>
          </div>

          <div className="hp-footer-grid">
            <div className="hp-footer-col">
              <p className="hp-footer-col-head">Platform</p>
              <a href="#services"     className="hp-footer-link">Services</a>
              <a href="#security"     className="hp-footer-link">Security</a>
              <a href="#how-it-works" className="hp-footer-link">How It Works</a>
              <a href="#about"        className="hp-footer-link">About</a>
            </div>
            <div className="hp-footer-col">
              <p className="hp-footer-col-head">Legal</p>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowTerms(true)}>Terms of Service</button>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowCookies(true)}>Cookie Policy</button>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowCompliance(true)}>Compliance</button>
            </div>
            <div className="hp-footer-col">
              <p className="hp-footer-col-head">Access</p>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowLogin(true)}>Sign In</button>
              <button className="hp-footer-link hp-footer-btn" onClick={() => onRegister?.()}>Open Account</button>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowSupport(true)}>Support Centre</button>
              <button className="hp-footer-link hp-footer-btn" onClick={() => setShowContact(true)}>Contact Us</button>
            </div>
          </div>

          <div className="hp-footer-bottom">
            <p>© {new Date().getFullYear()} Optima Credit Union. All rights reserved. Member FDIC. Equal Housing Lender.</p>
          </div>
        </div>
      </footer>

      {/* ══ LOGIN MODAL ══════════════════════════════════ */}
      {showLogin && (
        <div className="hp-modal-bg" onClick={() => setShowLogin(false)}>
          <div className="hp-modal glass" onClick={e => e.stopPropagation()}>
            <button className="hp-modal-close" onClick={() => setShowLogin(false)} aria-label="Close">
              <CloseIcon/>
            </button>

            <div className="hp-modal-head">
              <TDLogo size={44} full />
              <div>
                <h2 className="hp-modal-title">Sign In</h2>
                <p className="hp-modal-sub">Access your account securely</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="hp-modal-field">
                <label className="hp-modal-label" htmlFor="hp-email">Email address</label>
                <input id="hp-email" className="hp-modal-input" type="email"
                  placeholder="you@example.com" autoComplete="username"
                  value={email} onChange={e => setEmail(e.target.value)} required/>
              </div>

              <div className="hp-modal-field">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <label className="hp-modal-label" htmlFor="hp-pw">Password</label>
                  <button type="button" className="hp-modal-forgot" onClick={() => setShowForgot(true)}>Forgot password?</button>
                </div>
                <div style={{ position:'relative' }}>
                  <input id="hp-pw" className="hp-modal-input" style={{ paddingRight:44 }}
                    type={showPw ? 'text' : 'password'} placeholder="••••••••"
                    autoComplete="current-password" autoCorrect="off" autoCapitalize="off"
                    value={password} onChange={e => setPassword(e.target.value)} required/>
                  <button type="button" className="hp-modal-eye" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOffIcon/> : <EyeIcon/>}
                  </button>
                </div>
              </div>

              {error && <div className="hp-modal-err">⚠ {error}</div>}

              <button type="submit" className="hp-modal-submit" disabled={loading}>
                Sign In to Your Account
              </button>
            </form>

            <div className="hp-modal-or"><span>or</span></div>

            <button
              type="button"
              className={`hp-modal-biometric ${faceIdState === 'scanning' ? 'scanning' : ''} ${faceIdState === 'denied' ? 'denied' : ''} ${faceIdState === 'success' ? 'success' : ''}`}
              onClick={handleFaceId} disabled={faceIdState === 'scanning'}
            >
              <FaceIdIcon/>
              <span>{faceIdState === 'scanning' ? 'Scanning…' : faceIdState === 'denied' ? 'Access Denied' : faceIdState === 'success' ? 'Verified ✓' : 'Face ID / Biometrics'}</span>
            </button>

            <p className="hp-modal-register">
              New here?{' '}
              <a href="#register" onClick={e => { e.preventDefault(); setShowLogin(false); onRegister?.() }}>
                Open a free account
              </a>
            </p>
          </div>
        </div>
      )}

      {/* ══ LEGAL MODALS ═════════════════════════════════ */}
      {showPrivacy    && <PrivacyPolicyModal    onClose={() => setShowPrivacy(false)}    />}
      {showTerms      && <TermsOfServiceModal   onClose={() => setShowTerms(false)}      />}
      {showCookies    && <CookiePolicyModal     onClose={() => setShowCookies(false)}    />}
      {showCompliance && <ComplianceModal       onClose={() => setShowCompliance(false)} />}

      {/* ══ CONTACT MODALS ═══════════════════════════════ */}
      {showContact && <ContactUsModal     onClose={() => setShowContact(false)}  />}
      {showSupport && <SupportCenterModal onClose={() => setShowSupport(false)}  />}

      {/* ══ FORGOT PASSWORD MODAL ════════════════════════ */}
      {showForgot && (
        <div className="forgot-overlay" onClick={() => setShowForgot(false)}>
          <div className="forgot-modal" onClick={e => e.stopPropagation()}>
            <button className="forgot-close" onClick={() => setShowForgot(false)}>&times;</button>
            {forgotStep === 'email' && (
              <form onSubmit={handleForgotSubmit}>
                <div className="forgot-icon">🔑</div>
                <h2 className="forgot-title">Reset Password</h2>
                <p className="forgot-desc">Enter your registered email to verify your identity.</p>
                <input className="forgot-input" type="email" placeholder="you@example.com"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus/>
                {forgotError && <p className="forgot-error">{forgotError}</p>}
                <button type="submit" className="forgot-btn">Verify Email</button>
              </form>
            )}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPin}>
                <div className="forgot-icon">🔒</div>
                <h2 className="forgot-title">Set New PIN</h2>
                <p className="forgot-desc">Create a new 4-digit security PIN.</p>
                <input className="forgot-input" type="password" inputMode="numeric" maxLength={6}
                  placeholder="Enter new PIN" value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} required autoFocus/>
                {forgotError && <p className="forgot-error">{forgotError}</p>}
                <button type="submit" className="forgot-btn">Reset PIN</button>
              </form>
            )}
            {forgotStep === 'done' && (
              <div className="forgot-done">
                <div className="forgot-icon forgot-icon--success">✓</div>
                <h2 className="forgot-title">PIN Reset Successful</h2>
                <p className="forgot-desc">Your PIN has been updated. You can now sign in.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
