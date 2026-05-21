import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import TransactionSuccess from './TransactionSuccess'
import OtpModal from './OtpModal'
import AiSupport from './AiSupport'
import FxTicker from './FxTicker'
import AnimatedBalance from './AnimatedBalance'
import InternationalTransfer from './InternationalTransfer'
import LocalTransfer from './LocalTransfer'
import AccountInfo from './AccountInfo'
import DepositOverlay from './DepositOverlay'
import BankCard from './BankCard'
import ScheduledTransfer from './ScheduledTransfer'
import BillPayment from './BillPayment'
import Investment from './Investment'
import TransactionHistory from './TransactionHistory'
import FinancialServices from './FinancialServices'
import CryptoPage from './CryptoPage'
import TDLogo from './TDLogo'
import { updateUserProfile, logoutUser } from '../services/firebaseAuth'
import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  isBiometricRegistered,
  registerBiometric,
  clearBiometric,
} from '../services/biometricService'
import { db } from '../services/firebaseClient'
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { syncBalanceToFirestore } from '../services/adminService'
import { loadTransactions } from '../services/transactionService'
import { useLanguage } from '../i18n/LanguageContext'
import { LANGUAGES } from '../i18n/translations'
import { useFirestoreDoc, useDebouncedDocUpdate } from '../hooks/useDebouncedFirestore'

// Safe upsert — creates the Firestore doc if it doesn't exist yet
// (updateDoc throws NOT_FOUND when the profile was never written to Firestore)
async function safeUpdateBalance(db, uid, fields) {
  try {
    await setDoc(doc(db, 'profiles', uid), fields, { merge: true })
  } catch (err) {
    console.warn('[Dashboard] Firestore balance upsert failed:', err.message)
  }
}

const STORAGE_KEY = 'securebank_admin'
const NOTIF_KEY = 'securebank_notifications'

function getAdminData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

/* ── Inline SVG icons ────────────────────────────────────── */
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const HelpIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const InfoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)
const TransferIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)
const DepositIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12m0 0l4-4m-4 4l-4-4" /><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
  </svg>
)
const RewardsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)
const CardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
)
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
const QuickPayIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)
const WireIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)
const ScheduleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)
const ExchangeIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)
const BillPayIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="13" y2="12" /><line x1="7" y1="16" x2="10" y2="16" />
  </svg>
)
const InvestIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
)

// 2026 exchange rates (USD base)
const FX_RATES = { EUR: 0.8815, GBP: 0.7620 }

/* Bottom nav icons */
const HomeNavIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const CardsNavIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
)
const WealthNavIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
)
const NotifNavIcon = ({ hasUnread }) => (
  <span style={{ position: 'relative', display: 'inline-flex' }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    {hasUnread && <span className="notif-red-dot" />}
  </span>
)
const SupportNavIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

/* ── Crypto data ─────────────────────────────────────────── */
const CRYPTO = [
  { symbol: 'BTC', name: 'Bitcoin',  price: 72300.00,  change: +2.4, color: '#f7931a' },
  { symbol: 'ETH', name: 'Ethereum', price: 2125.50,   change: +1.8, color: '#627eea' },
  { symbol: 'SOL', name: 'Solana',   price: 90.14,     change: -0.6, color: '#00ffa3' },
  { symbol: 'ADA', name: 'Cardano',  price: 0.45,      change: +3.1, color: '#0033ad' },
  { symbol: 'DOT', name: 'Polkadot', price: 7.82,      change: -1.2, color: '#e6007a' },
  { symbol: 'LINK', name: 'Chainlink', price: 14.56,   change: +0.9, color: '#2a5ada' },
]

/* ── Sample transactions ─────────────────────────────────── */
function getTransactions(admin) {
  if (!admin.balance && !admin.lastTxnAmount) return []
  const receiverName = admin.receiverName || 'N/A'
  const lastTxn = admin.lastTxnAmount || '0.00'
  const balance = admin.balance || '0.00'
  return [
    { date: 'Today', items: [
      { desc: `TRANSFER TO ${receiverName.toUpperCase()}`, amount: `-$${lastTxn}`, bal: `$${balance}`, debit: true },
      { desc: 'PAYROLL DEPOSIT – EMPLOYER', amount: '+$4,200.00', bal: '$1,500,000.00', debit: false },
    ]},
    { date: 'Yesterday', items: [
      { desc: 'CAPITAL ONE CRCARDPMT', amount: '-$29.00', bal: '$1,495,800.00', debit: true },
      { desc: 'EB FROM CHECKING # xxxxxx0801', amount: '+$300.00', bal: '$1,495,829.00', debit: false },
    ]},
    { date: 'Mar 11, 2026', items: [
      { desc: 'ALLSTATE INS CO INS PREM', amount: '-$655.16', bal: '$1,495,529.00', debit: true },
      { desc: 'AMAZON MARKETPLACE', amount: '-$42.99', bal: '$1,494,873.84', debit: true },
    ]},
  ]
}

/* ── Crypto chart icon ────────────────────────────────────── */
const CryptoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

/* ── Camera icon for profile picture ─────────────────────── */
const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

export default function Dashboard({ profile, onLogout }) {
  const { t, lang, changeLang } = useLanguage()
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showTransferOtp, setShowTransferOtp] = useState(false)
  const [admin, setAdmin] = useState(getAdminData)
  const [showSuspend, setShowSuspend] = useState(false)
  const [activeTab, setActiveTab] = useState('transactions')
  const [showAiSupport, setShowAiSupport] = useState(false)
  const [activeNav, setActiveNav] = useState('home')
  const [showCrypto, setShowCrypto] = useState(false)
  const [notification, setNotification] = useState(null)
  // Balance: null = not yet fetched, number = loaded, 'error' = fetch failed
  const [bankBalance, setBankBalance] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [balanceError, setBalanceError] = useState(false)
  const [savingsVault, setSavingsVault] = useState(0)
  const [showIntlTransfer, setShowIntlTransfer] = useState(false)
  const [showLocalTransfer, setShowLocalTransfer] = useState(false)
  const [showAccountInfo, setShowAccountInfo] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showBankCard, setShowBankCard] = useState(false)
  const [showScheduled, setShowScheduled] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [showBillPay, setShowBillPay] = useState(false)
  const [showInvestment, setShowInvestment] = useState(false)
  const [showTxnHistory, setShowTxnHistory] = useState(false)
  const [showFinServices, setShowFinServices] = useState(false)
  const [exchangeUsd, setExchangeUsd] = useState('')
  const [intlPrefill, setIntlPrefill] = useState('')
  const [balanceHidden, setBalanceHidden] = useState(() => localStorage.getItem('privacy_state') === 'hidden')
  const [sysAlert, setSysAlert] = useState(null)
  const [showNotifCenter, setShowNotifCenter] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [emailToast, setEmailToast] = useState(null)
  const [otpToast, setOtpToast] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light')
  const [adToast, setAdToast] = useState(null)
  const [showLogoMenu, setShowLogoMenu] = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(() => isBiometricRegistered())
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false)
  const [biometricToast, setBiometricToast] = useState(null)
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [showGreeting, setShowGreeting] = useState(true)
  const [profilePic, setProfilePic] = useState(profile?.profilePic || null)
  const [recentTxns, setRecentTxns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('transfer_history') || '[]') } catch { return [] }
  })
  const logoMenuRef = useRef(null)
  const wealthRef = useRef(null)
  const loadingTimerRef = useRef(null)

  // Update profilePic when profile prop changes
  useEffect(() => {
    if (profile?.profilePic) {
      setProfilePic(profile.profilePic)
    }
  }, [profile?.profilePic])

  // ── Load recent transactions from Firestore on mount ──────
  useEffect(() => {
    const uid = profile?.uid || profile?.id
    if (!uid) return
    loadTransactions(uid).then((txns) => {
      if (txns.length > 0) setRecentTxns(txns)
    }).catch(() => {})
  }, [profile?.uid, profile?.id])

  // ── Fetch real balance from Firestore ─────────────────────
  // PRIORITY: Load from localStorage FIRST, only READ from Firestore (never write)
  const fetchBalance = useCallback(async () => {
    const uid = profile?.uid || profile?.id
    if (!uid) { setBalanceLoading(false); return }
    
    // STEP 1: Always load from localStorage FIRST (immediate)
    const localBal = parseFloat(localStorage.getItem('bank_balance') || '0')
    const localVault = parseFloat(localStorage.getItem('savings_vault') || '0')
    
    // Show local data immediately
    setBankBalance(localBal)
    setSavingsVault(localVault)
    setBalanceLoading(false)
    setBalanceError(false)

    // STEP 2: Read from Firestore in background (non-blocking, NO WRITES)
    setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, 'profiles', uid))
        if (snap.exists()) {
          const data = snap.data()
          const firestoreBal = parseFloat(data.balance ?? 0)
          const firestoreVault = parseFloat(data.savingsVault ?? data.savings_vault ?? 0)

          // Only update UI if Firestore has different data (use Firestore as source of truth)
          if (firestoreBal !== localBal && !isNaN(firestoreBal)) {
            setBankBalance(firestoreBal)
            localStorage.setItem('bank_balance', String(firestoreBal))
          }
          if (firestoreVault !== localVault && !isNaN(firestoreVault)) {
            setSavingsVault(firestoreVault)
            localStorage.setItem('savings_vault', String(firestoreVault))
          }
          // NOTE: We NEVER write to Firestore during fetch to avoid resource exhaustion
        }
      } catch (err) {
        console.warn('[Dashboard] Firestore read failed (using localStorage):', err.message)
        // Keep using localStorage data - no error shown to user
      }
    }, 100) // Small delay to let UI render first
  }, [profile?.uid, profile?.id])

  // ── Sync balance to localStorage immediately, Firestore in background ─────────
  // Called by child components (deposit, transfer, etc.) via onBalanceUpdate.
  // Writes to React state + localStorage immediately, Firestore debounced.
  const handleBalanceUpdate = useCallback((newBalance) => {
    setBankBalance(newBalance)
    localStorage.setItem('bank_balance', String(newBalance))
    // Firestore write is now handled by adminService.js with debouncing
    const uid = profile?.uid || profile?.id
    if (uid) {
      // Sync to Firestore in background (debounced, fire-and-forget)
      syncBalanceToFirestore(uid, newBalance)
    }
  }, [profile?.uid, profile?.id])

  // Call on mount
  useEffect(() => { fetchBalance() }, [fetchBalance])

  // Prompt to set up biometrics after first login (once per device)
  useEffect(() => {
    const hasPrompted = localStorage.getItem('biometric_prompt_shown')
    if (hasPrompted || isBiometricRegistered()) return
    isPlatformAuthenticatorAvailable().then(available => {
      if (available) {
        // Delay so dashboard loads first
        setTimeout(() => setShowBiometricPrompt(true), 3000)
      }
    })
  }, [])

  const handleEnableBiometric = async () => {
    setShowBiometricPrompt(false)
    localStorage.setItem('biometric_prompt_shown', '1')
    try {
      const uid   = profile?.uid || profile?.id
      const email = profile?.email || localStorage.getItem('user_email') || ''
      const name  = profile?.name || profile?.full_name || localStorage.getItem('user_name') || ''
      await registerBiometric({ uid, email, name })
      setBiometricRegistered(true)
      setBiometricToast({ type: 'success', msg: 'Face ID / Biometrics enabled successfully!' })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setBiometricToast({ type: 'info', msg: 'Biometric setup cancelled. You can enable it anytime from your profile menu.' })
      } else {
        setBiometricToast({ type: 'error', msg: 'Could not enable biometrics: ' + (err.message || 'Unknown error') })
      }
    }
    setTimeout(() => setBiometricToast(null), 5000)
  }

  const handleToggleBiometric = async () => {
    setShowLogoMenu(false)
    if (biometricRegistered) {
      clearBiometric()
      setBiometricRegistered(false)
      setBiometricToast({ type: 'info', msg: 'Biometric login disabled.' })
    } else {
      try {
        const uid   = profile?.uid || profile?.id
        const email = profile?.email || localStorage.getItem('user_email') || ''
        const name  = profile?.name || profile?.full_name || localStorage.getItem('user_name') || ''
        await registerBiometric({ uid, email, name })
        setBiometricRegistered(true)
        localStorage.setItem('biometric_prompt_shown', '1')
        setBiometricToast({ type: 'success', msg: 'Face ID / Biometrics enabled! Use it next time you sign in.' })
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          setBiometricToast({ type: 'error', msg: 'Could not enable biometrics on this device.' })
        }
      }
    }
    setTimeout(() => setBiometricToast(null), 5000)
  }

  /** Show a brief loading spinner, then execute the action */
  const openWithLoading = useCallback((action) => {
    if (overlayLoading) return
    setOverlayLoading(true)
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
    loadingTimerRef.current = setTimeout(() => {
      setOverlayLoading(false)
      action()
    }, 350)
  }, [overlayLoading])

  // Auto-dismiss greeting after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowGreeting(false), 4000)
    return () => clearTimeout(t)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('app_theme', next)
  }

  const togglePrivacy = () => {
    const next = !balanceHidden
    setBalanceHidden(next)
    localStorage.setItem('privacy_state', next ? 'hidden' : 'visible')
  }

  /* ── Central Ad Click Handler ───────────────────────────── */
  const handleAdClick = useCallback((type) => {
    switch (type) {
      case 'refer': {
        const refProfile = profile?.email ? encodeURIComponent(profile.email.split('@')[0]) : 'PROFILE'
        const refLink = `${window.location.origin}/signup?ref=${refProfile}`
        navigator.clipboard.writeText(refLink).then(() => {
          setAdToast('Referral Link Copied!')
          setTimeout(() => setAdToast(null), 3000)
        }).catch(() => {
          setAdToast('Referral Link Copied!')
          setTimeout(() => setAdToast(null), 3000)
        })
        break
      }
      case 'receive':
        setShowDeposit(true)
        break
      case 'trust':
        setShowAccountInfo(true)
        break
      default:
        break
    }
  }, [profile])

  // Check for pending notifications
  const checkNotifications = useCallback(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY)
      const notifs = raw ? JSON.parse(raw) : []
      const unreadList = notifs.filter((n) => !n.read)
      setHasUnread(unreadList.length > 0)
      const unread = unreadList[0]
      if (unread) {
        setNotification(unread)
        // Mark as read
        const updated = notifs.map((n) => n.id === unread.id ? { ...n, read: true } : n)
        localStorage.setItem(NOTIF_KEY, JSON.stringify(updated))
        // Re-check remaining unread after marking
        setHasUnread(updated.filter((n) => !n.read).length > 0)
        // Auto-dismiss after 6 seconds
        setTimeout(() => setNotification(null), 6000)
      }
    } catch { /* ignore parse errors */ }
  }, [])

  useEffect(() => { checkNotifications() }, [checkNotifications])

  // System alert detection
  const checkSysAlert = useCallback(() => {
    try {
      const raw = localStorage.getItem('system_notification')
      if (!raw) return
      const parsed = JSON.parse(raw)
      const dismissedId = localStorage.getItem('system_notification_dismissed')
      if (parsed.id && String(parsed.id) !== dismissedId) {
        setSysAlert(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { checkSysAlert() }, [checkSysAlert])

  // Close logo menu on outside click
  useEffect(() => {
    if (!showLogoMenu) return
    const handler = (e) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target)) setShowLogoMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLogoMenu])

  const dismissSysAlert = () => {
    if (sysAlert) localStorage.setItem('system_notification_dismissed', String(sysAlert.id))
    setSysAlert(null)
  }

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setAdmin(getAdminData())
      if (e.key === NOTIF_KEY) checkNotifications()
      if (e.key === 'bank_balance') {
        setBankBalance(parseFloat(e.newValue || '0'))
      }
      if (e.key === 'system_notification') checkSysAlert()
      if (e.key === 'transfer_history') {
        try {
          const txns = JSON.parse(e.newValue || '[]')
          if (txns.length > 0) setRecentTxns(txns)
        } catch { /* silent */ }
      }
      if (e.key === 'admin_profile_pic_update') {
        try {
          const update = JSON.parse(e.newValue || '{}')
          const currentUid = profile?.uid || profile?.id
          if (update.uid === currentUid) setProfilePic(update.url || null)
        } catch { /* silent */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [checkNotifications, checkSysAlert, profile?.uid, profile?.id])

  // Real-time sync and cloud push logic removed

  // Email-sent toast listener
  useEffect(() => {
    const onEmail = (e) => {
      setEmailToast(e.detail)
      setTimeout(() => setEmailToast(null), 4000)
    }
    window.addEventListener('email-sent', onEmail)
    return () => window.removeEventListener('email-sent', onEmail)
  }, [])

  // OTP toast listener
  useEffect(() => {
    const onOtp = (e) => {
      setOtpToast(e.detail)
      setTimeout(() => setOtpToast(null), 8000)
    }
    window.addEventListener('otp-toast', onOtp)
    return () => window.removeEventListener('otp-toast', onOtp)
  }, [])

  useEffect(() => {
    const onFocus = () => {
      setAdmin(getAdminData())
      checkNotifications()
      checkSysAlert()
      // Re-fetch from Firebase on tab focus so balance is always current
      fetchBalance()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [checkNotifications, fetchBalance])

  // Listen for suspension check events from transfer components
  useEffect(() => {
    const handleSuspendModal = (e) => {
      setShowSuspend(true)
    }
    window.addEventListener('show-suspend-modal', handleSuspendModal)
    return () => window.removeEventListener('show-suspend-modal', handleSuspendModal)
  }, [])

  // ── Firestore sync disabled to prevent resource-exhausted errors ────────────
  // Real-time listener removed - using localStorage as primary data source
  // Firestore is now only used for admin operations and initial data seeding
  // All balance updates go through adminService.js with 30s debounce
  
  // Sync FROM Firestore only on initial mount (one-time read, not listener)
  useEffect(() => {
    const uid = profile?.uid || profile?.id
    if (!uid) return
    
    // Only sync from Firestore if we don't have local data
    const localBal = localStorage.getItem('bank_balance')
    if (localBal && localBal !== '0') return // Skip if we have local balance
    
    // One-time fetch from Firestore (not a listener)
    const fetchOnce = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore')
        const { db } = await import('../services/firebaseClient')
        const snap = await getDoc(doc(db, 'profiles', uid))
        if (snap.exists()) {
          const data = snap.data()
          const firestoreBal = parseFloat(data.balance ?? 0)
          if (!isNaN(firestoreBal) && firestoreBal > 0) {
            setBankBalance(firestoreBal)
            localStorage.setItem('bank_balance', String(firestoreBal))
          }
        }
      } catch (err) {
        console.warn('[Dashboard] One-time Firestore fetch failed:', err.message)
      }
    }
    
    fetchOnce()
  }, [profile?.uid, profile?.id])

  const balance = admin.balance || '0.00'
  const lastTxn = admin.lastTxnAmount || '0.00'
  const receiverName = admin.receiverName || 'N/A'
  const accountNumber = profile?.accountNumber || null
  const maskedAcct = accountNumber ? `*${accountNumber.slice(-4)}` : ''
  const txnDate = admin.txnDate
    ? new Date(admin.txnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Mar 14, 2026'

  const handleTransferTap = useCallback(() => {
    setShowTransferOtp(true)
  }, [])

  const transactions = getTransactions(admin)

  return (
    <div className={`db ${theme === 'light' ? 'db--light' : ''}`}>
      {/* Loading overlay */}
      {overlayLoading && (
        <div className="db-loading-overlay">
          <div className="db-loading-content">
            <div className="db-loading-spinner" />
            <span className="db-loading-text">Loading…</span>
          </div>
        </div>
      )}
      {/* ── Biometric setup prompt (shown once after first login) ── */}
      {showBiometricPrompt && (
        <div className="biometric-prompt-overlay" onClick={() => { setShowBiometricPrompt(false); localStorage.setItem('biometric_prompt_shown', '1') }}>
          <div className="biometric-prompt-card" onClick={e => e.stopPropagation()}>
            <div className="biometric-prompt-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 2 0 3.8 1 4.8 2.5"/>
                <path d="M10 12c0 4-1 8-3 11"/><path d="M14 12c0 2.5-.5 5-1.5 7.5"/><path d="M18 11c0 3-1 6.5-3 9.5"/>
                <path d="M22 12c0 2-1 4-2 6"/>
              </svg>
            </div>
            <h3 className="biometric-prompt-title">Enable Face ID / Biometrics?</h3>
            <p className="biometric-prompt-desc">
              Sign in instantly next time using your device's Face ID, fingerprint, or Windows Hello — no password needed.
            </p>
            <button className="biometric-prompt-btn biometric-prompt-btn--primary" onClick={handleEnableBiometric}>
              Enable Biometrics
            </button>
            <button className="biometric-prompt-btn biometric-prompt-btn--ghost" onClick={() => { setShowBiometricPrompt(false); localStorage.setItem('biometric_prompt_shown', '1') }}>
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* ── Biometric toast ─────────────────────────────────────── */}
      {biometricToast && (
        <div className={`biometric-toast biometric-toast--${biometricToast.type}`} onClick={() => setBiometricToast(null)}>
          <span className="biometric-toast-icon">
            {biometricToast.type === 'success' ? '✓' : biometricToast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span>{biometricToast.msg}</span>
        </div>
      )}

      {/* Email sent toast */}
      {emailToast && (
        <div className="email-toast" onClick={() => setEmailToast(null)}>
          <span className="email-toast-icon">✉️</span>
          <div className="email-toast-body">
            <strong>Email Confirmation Sent</strong>
            <span>{emailToast.to}</span>
          </div>
        </div>
      )}
      {/* OTP Toast */}
      {otpToast && (
        <div className={`otp-toast ${otpToast.isError ? 'otp-toast--error' : ''}`} onClick={() => setOtpToast(null)}>
          <span className="otp-toast-icon">{otpToast.isError ? '⚠️' : '✉️'}</span>
          <div className="otp-toast-body">
            <strong>{otpToast.isError ? 'Connection Error' : 'Verification Email Sent'}</strong>
            <span>{otpToast.message}</span>
          </div>
        </div>
      )}
      {/* System Alert Popup */}
      {sysAlert && (
        <div className="sysalert-overlay" onClick={dismissSysAlert}>
          <div className="sysalert-popup" onClick={(e) => e.stopPropagation()}>
            <div className="sysalert-icon">📢</div>
            <h2 className="sysalert-title">System Alert</h2>
            <p className="sysalert-msg">{sysAlert.message}</p>
            {sysAlert.timestamp && <span className="sysalert-time">{sysAlert.timestamp}</span>}
            <button className="sysalert-btn" onClick={dismissSysAlert}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSuspend && (
        <div className="suspend-overlay" onClick={() => setShowSuspend(false)}>
          <div className="suspend-popup" onClick={(e) => e.stopPropagation()}>
            <div className="suspend-icon">🚫</div>
            <h2 className="suspend-title">{t('transfersSuspended')}</h2>
            <p className="suspend-msg">
              {admin.suspendReason || t('accountSuspendedMsg')}
            </p>
            <button className="suspend-close-btn" onClick={() => setShowSuspend(false)}>Got it!</button>
          </div>
        </div>
      )}
      {showTransferOtp && (
        <OtpModal
          email={profile?.email || ''}
          variant="transfer"
          onVerified={() => { setShowTransferOtp(false); setShowReceipt(true) }}
          onCancel={() => setShowTransferOtp(false)}
        />
      )}
      {showAiSupport && <AiSupport onClose={() => setShowAiSupport(false)} />}
      {showIntlTransfer && (
        <InternationalTransfer
          balance={bankBalance}
          onClose={() => { setShowIntlTransfer(false); setIntlPrefill('') }}
          onBalanceUpdate={handleBalanceUpdate}
          initialAmount={intlPrefill}
        />
      )}
      {showLocalTransfer && (
        <LocalTransfer
          balance={bankBalance}
          onClose={() => setShowLocalTransfer(false)}
          onBalanceUpdate={handleBalanceUpdate}
        />
      )}
      {showAccountInfo && (
        <AccountInfo
          profile={profile}
          balance={bankBalance}
          onClose={() => setShowAccountInfo(false)}
        />
      )}
      {showDeposit && (
        <DepositOverlay
          balance={bankBalance}
          onClose={() => setShowDeposit(false)}
          onBalanceUpdate={handleBalanceUpdate}
        />
      )}
      {showBankCard && (
        <BankCard
          user={profile}
          onClose={() => setShowBankCard(false)}
        />
      )}
      {showCrypto && (
        <CryptoPage
          onClose={() => setShowCrypto(false)}
        />
      )}
      {showScheduled && (
        <ScheduledTransfer
          balance={bankBalance}
          onClose={() => setShowScheduled(false)}
          onBalanceUpdate={handleBalanceUpdate}
        />
      )}
      {showBillPay && (
        <BillPayment
          balance={bankBalance}
          onClose={() => setShowBillPay(false)}
          onBalanceUpdate={handleBalanceUpdate}
        />
      )}
      {showInvestment && (
        <Investment
          balance={bankBalance}
          onClose={() => setShowInvestment(false)}
          onBalanceUpdate={handleBalanceUpdate}
        />
      )}
      {showTxnHistory && (
        <TransactionHistory onClose={() => setShowTxnHistory(false)} />
      )}
      {showFinServices && (
        <FinancialServices
          onClose={() => setShowFinServices(false)}
          onBalanceUpdate={handleBalanceUpdate}
        />
      )}

      {/* ── Professional Nav Bar ────────────────────────── */}
      <header className="db-header">
        {/* Left: Logo with context menu */}
        <div className="db-header-logo" ref={logoMenuRef}>
          <button className="db-logo-btn" onClick={() => setShowLogoMenu((p) => !p)} style={{ display:'flex', alignItems:'center', gap:'10px', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <TDLogo size={30} full />
            <span className="db-bank-name">Optima Credit Union</span>
          </button>
          {showLogoMenu && (
            <div className="db-logo-menu">
              <button className="db-logo-menu-item" onClick={() => { setShowLogoMenu(false); openWithLoading(() => setShowAccountInfo(true)) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {t('profileSettings')}
              </button>
              <button className="db-logo-menu-item" onClick={() => { setShowLogoMenu(false); setBalanceHidden((h) => { const next = !h; localStorage.setItem('privacy_state', next ? 'hidden' : 'visible'); return next }) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                {t('privacy')}
              </button>
              <button className="db-logo-menu-item" onClick={() => { setShowLogoMenu(false); openWithLoading(() => setShowBankCard(true)) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t('securityMenu')}
              </button>
              <button className="db-logo-menu-item" onClick={() => { setShowLogoMenu(false); toggleTheme() }}>
                {theme === 'dark' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
                {theme === 'dark' ? t('lightMode') : t('darkMode')}
              </button>
              {/* ── Language Selector ─────────────────────── */}
              <button className="db-logo-menu-item" onClick={(e) => { e.stopPropagation(); setShowLangPicker((p) => !p) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                {t('language')} — {LANGUAGES.find((l) => l.code === lang)?.label || 'English'}
              </button>
              {showLangPicker && (
                <div className="db-lang-picker">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      className={`db-lang-option ${lang === l.code ? 'db-lang-option--active' : ''}`}
                      onClick={() => { changeLang(l.code); setShowLangPicker(false); setShowLogoMenu(false) }}
                    >
                      <span className="db-lang-flag">{l.flag}</span>
                      <span className="db-lang-label">{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* ── Biometric toggle ──────────────────────── */}
              {isBiometricSupported() && (
                <button className="db-logo-menu-item" onClick={handleToggleBiometric}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 2 0 3.8 1 4.8 2.5"/>
                    <path d="M10 12c0 4-1 8-3 11"/><path d="M14 12c0 2.5-.5 5-1.5 7.5"/><path d="M18 11c0 3-1 6.5-3 9.5"/>
                    <path d="M22 12c0 2-1 4-2 6"/>
                  </svg>
                  {biometricRegistered ? 'Disable Face ID / Biometrics' : 'Enable Face ID / Biometrics'}
                </button>
              )}
              <div className="db-logo-menu-divider" />
              <button className="db-logo-menu-item db-logo-menu-item--logout" onClick={async () => { setShowLogoMenu(false); try { await logoutUser() } catch {} localStorage.removeItem('securebank_user'); localStorage.removeItem('user_account_type'); localStorage.removeItem('privacy_state'); onLogout() }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {t('logout')}
              </button>
            </div>
          )}
        </div>

        {/* Right: Profile group */}
        <div className="db-header-right">
          <div className="db-header-profile">
            <div className="db-profile-pic">
              {profilePic ? (
                <img src={profilePic} alt="" className="db-profile-img" />
              ) : (
              <span className="db-profile-initial">{(profile?.name || profile?.full_name || localStorage.getItem('user_name') || 'P').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="db-header-profile-text">
              <span className="db-header-title">{profile?.name || profile?.full_name || localStorage.getItem('user_name') || 'Profile'}</span>
              <span className="db-header-accttype">{localStorage.getItem('user_account_type') || profile?.accountType || 'Savings Account'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Notification banner ──────────────────────────── */}
      {notification && (
        <div className={`db-notif db-notif--${notification.type}`} onClick={() => setNotification(null)}>
          <div className="db-notif-icon">{notification.type === 'credit' ? '↓' : '↑'}</div>
          <div className="db-notif-body">
            <span className="db-notif-title">
              {notification.type === 'credit' ? t('creditAlert') : t('debitAlert')}
            </span>
            <span className="db-notif-msg">
              {notification.type === 'credit' ? '+' : '-'}${notification.amount} &bull; Balance: ${notification.newBalance}
            </span>
          </div>
          <span className="db-notif-close">&times;</span>
        </div>
      )}

      {/* ── Welcome greeting (resets on every refresh) ───── */}
      {showGreeting && (
        <div className="db-greeting-banner">
          <span className="db-greeting-text">
          {t(`good${getTimeOfDay().charAt(0).toUpperCase() + getTimeOfDay().slice(1)}`)}, {(profile?.name || profile?.full_name || localStorage.getItem('user_name'))?.split(' ')[0] || 'there'}! {t('welcomeToTD')}
          </span>
        </div>
      )}

      {/* ── Balance card ─────────────────────────────────── */}
      <section className="db-balance-section">
        <div className="db-balance-card">
          <div className="db-balance-label-row">
            <span className="db-balance-label">{t('availableBalance')}</span>
            <button className="db-privacy-btn" onClick={togglePrivacy} aria-label={balanceHidden ? 'Show balance' : 'Hide balance'}>
              {balanceHidden ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          <div className="db-balance-amount font-mono">
            <div className={`db-balance-reveal ${balanceHidden ? 'db-balance-reveal--hidden' : ''}`}>
              {balanceHidden ? (
                <span className="db-balance-masked">$****.**</span>
              ) : balanceLoading ? (
                /* Skeleton pulse — prevents $0.00 flash while fetching */
                <span className="db-balance-skeleton" style={{
                  display: 'inline-block', width: '160px', height: '2.2rem',
                  borderRadius: '6px', background: 'rgba(255,255,255,0.15)',
                  animation: 'db-pulse 1.4s ease-in-out infinite',
                }} />
              ) : balanceError ? (
                /* Explicit error — never show $0.00 for a connection issue */
                <span style={{
                  color: '#ff6b6b', fontSize: '0.95rem', fontWeight: 600,
                  letterSpacing: '0.01em',
                }}>
                  {t('unableToLoadBalance')}
                </span>
              ) : (
                <span style={{ color: "#ffffff" }}>
                  <AnimatedBalance value={bankBalance ?? 0} />
                </span>
              )}
            </div>
          </div>

          {/* Quick action icons */}
          <div className="db-quick-row">
            {[
              { icon: <InfoIcon />, label: t('info'), action: () => openWithLoading(() => setShowAccountInfo(true)) },
              { icon: <TransferIcon />, label: t('transfer'), action: () => openWithLoading(() => setShowLocalTransfer(true)) },
              { icon: <DepositIcon />, label: t('deposit'), action: () => openWithLoading(() => setShowDeposit(true)) },
              { icon: <CryptoIcon />, label: t('crypto'), action: () => openWithLoading(() => setShowCrypto(true)) },
              { icon: <CardIcon />, label: t('card'), action: () => openWithLoading(() => setShowBankCard(true)) },
            ].map((a) => (
              <button key={a.label} className="db-quick-btn" onClick={a.action}>
                <div className="db-quick-icon">{a.icon}</div>
                <span className="db-quick-label">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accounts ─────────────────────────────────────── */}
      <section className="db-section">
        <h2 className="db-section-title">{t('accounts')}</h2>
        <div className="db-accounts-row">
          <div className="db-account-card db-account-card--green">
            <span className="db-account-type">{localStorage.getItem('user_account_type') || profile?.accountType || t('currentAccount')}</span>
            <p className="db-account-bal font-mono">
              {balanceLoading
                ? <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>Loading…</span>
                : balanceError
                  ? <span style={{ color: '#ff6b6b', fontSize: '0.8rem' }}>Unavailable</span>
                  : <AnimatedBalance value={bankBalance ?? 0} />}
            </p>
            {accountNumber && <span className="db-account-num">●●●● {accountNumber.slice(-4)}</span>}
          </div>
          <div className="db-account-card db-account-card--dark">
            <span className="db-account-type">{t('savingsVault')}</span>
            <p className="db-account-bal font-mono">
              {balanceLoading
                ? <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>Loading…</span>
                : <AnimatedBalance value={savingsVault ?? 0} />}
            </p>
          </div>
        </div>
      </section>

      {/* ── Ad Toast ──────────────────────────────────────── */}
      {adToast && (
        <div className="ad-toast" onClick={() => setAdToast(null)}>
          <span className="ad-toast-icon">✓</span>
          <span className="ad-toast-msg">{adToast}</span>
        </div>
      )}

      {/* ── Ad Slider ────────────────────────────────────── */}
      <section className="db-section ad-slider-section">
        <div className="ad-slider">
          <div className="ad-track">
            {/* Banner 1 – Receive Money */}
            <div className="ad-banner ad-banner--globe" onClick={() => handleAdClick('receive')} role="button" tabIndex={0}>
              <img className="ad-banner-img" src="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=400&fit=crop&q=80" alt="" />
              <div className="ad-banner-overlay" />
              <div className="ad-banner-content">
                <span className="ad-badge">Global</span>
                <h3 className="ad-title">Receive Money<br/>from Anywhere</h3>
                <p className="ad-desc">Instant international transfers at zero fees</p>
              </div>
            </div>
            {/* Banner 2 – Refer & Earn */}
            <div className="ad-banner ad-banner--refer" onClick={() => handleAdClick('refer')} role="button" tabIndex={0}>
              <img className="ad-banner-img" src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=400&fit=crop&q=80" alt="" />
              <div className="ad-banner-overlay" />
              <div className="ad-banner-content">
                <span className="ad-badge ad-badge--gold">Reward</span>
                <h3 className="ad-title">Refer &amp; Earn <span className="ad-highlight">$50</span></h3>
                <p className="ad-desc">Invite friends and earn cash rewards</p>
              </div>
            </div>
            {/* Banner 3 – Trusted by Millions */}
            <div className="ad-banner ad-banner--trust" onClick={() => handleAdClick('trust')} role="button" tabIndex={0}>
              <img className="ad-banner-img" src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=400&fit=crop&q=80" alt="" />
              <div className="ad-banner-overlay" />
              <div className="ad-banner-content">
                <span className="ad-badge ad-badge--blue">Secure Banking</span>
                <h3 className="ad-title">Trusted Digital<br/>Banking</h3>
                <p className="ad-desc">Bank-grade security protecting your finances 24/7</p>
              </div>
            </div>
            {/* Duplicate for seamless loop */}
            <div className="ad-banner ad-banner--globe" onClick={() => handleAdClick('receive')} role="button" tabIndex={0}>
              <img className="ad-banner-img" src="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=400&fit=crop&q=80" alt="" />
              <div className="ad-banner-overlay" />
              <div className="ad-banner-content">
                <span className="ad-badge">Global</span>
                <h3 className="ad-title">Receive Money<br/>from Anywhere</h3>
                <p className="ad-desc">Instant international transfers at zero fees</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Move Money Hub ───────────────────────────────── */}
      <section className="db-section">
        <h2 className="db-section-title">{t('moveMoney')}</h2>
        <div className="db-move-grid">
          {[
            { icon: <QuickPayIcon />, label: t('quickPay'), desc: t('instantTransfer'), action: () => openWithLoading(() => setShowLocalTransfer(true)) },
            { icon: <WireIcon />, label: t('wireTransfer'), desc: t('international'), action: () => openWithLoading(() => setShowIntlTransfer(true)) },
            { icon: <ScheduleIcon />, label: t('scheduled'), desc: t('setAndForget'), action: () => openWithLoading(() => setShowScheduled(true)) },
            { icon: <ExchangeIcon />, label: t('globalExchange'), desc: t('fxConverter'), action: () => openWithLoading(() => { setExchangeUsd(''); setShowExchange(true) }) },
            { icon: <BillPayIcon />, label: t('billPayment'), desc: t('payYourBills'), action: () => openWithLoading(() => setShowBillPay(true)) },
            { icon: <InvestIcon />, label: t('invest'), desc: t('stocksAndEtfs'), action: () => openWithLoading(() => setShowInvestment(true)) },
          ].map((m) => (
            <button key={m.label} className="db-move-tile" onClick={m.action}>
              <div className="db-move-icon">{m.icon}</div>
              <div>
                <span className="db-move-label">{m.label}</span>
                <span className="db-move-desc">{m.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Weekly Spending Chart ──────────────────────────── */}
      {(() => {
        const history = JSON.parse(localStorage.getItem('transfer_history') || '[]')
        const now = new Date()
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const todayIdx = now.getDay()
        // Build array for last 7 days
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now)
          d.setDate(d.getDate() - (6 - i))
          return {
            label: dayNames[d.getDay()],
            dateStr: d.toISOString().slice(0, 10),
            isToday: i === 6,
          }
        })
        // Sum DEBIT amounts per day only (money going out)
        // Credit types: deposit, credit, payroll, refund, incoming
        const creditTypes = ['deposit', 'credit', 'payroll', 'refund', 'incoming']
        days.forEach((day) => {
          day.total = history
            .filter((t) => {
              // Must match date and be a DEBIT (not credit)
              const isCredit = creditTypes.includes(t.type) || t.direction === 'incoming'
              return t.date && t.date.slice(0, 10) === day.dateStr && !isCredit && t.amount > 0
            })
            .reduce((sum, t) => sum + t.amount, 0)
        })
        const maxVal = Math.max(...days.map((d) => d.total), 1)
        const weekTotal = days.reduce((s, d) => s + d.total, 0)
        return (
          <section className="db-section">
            <h2 className="db-section-title">{t('weeklySpending')}</h2>
            <div className="wsc-glass">
              <div className="wsc-header">
                <span className="wsc-label">{t('totalSpentThisWeek')}</span>
                <span className="wsc-total font-mono">${weekTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="wsc-chart">
                {days.map((day, i) => (
                  <div key={i} className={`wsc-bar-col ${day.isToday ? 'wsc-bar-col--today' : ''}`}>
                    <div className="wsc-bar-wrap">
                      <div
                        className="wsc-bar"
                        style={{ height: `${Math.max((day.total / maxVal) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="wsc-day-label">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      })()}

      {/* ── Transactions & Statements ──────────────────── */}
      <section className="db-section">
        <div className="db-txn-header">
          <h3 className="db-txn-title">{t('recentActivity')}</h3>
        </div>
        {(() => {
          const recent = recentTxns.slice(0, 30)
          // Credit types: money coming IN (green +)
          const creditTypes = ['deposit', 'credit', 'payroll', 'refund', 'incoming']
          // Debit types: money going OUT (red -)
          const debitTypes = ['transfer', 'debit', 'bill_payment', 'international', 'local', 'investment']
          return recent.length > 0 ? (
            <div className="db-txn-list">
              {recent.map((t) => {
                // Determine if transaction is credit or debit based on type/direction
                const isCredit = creditTypes.includes(t.type) || t.direction === 'incoming'
                const isDebit = debitTypes.includes(t.type) || t.direction === 'outgoing' || (!isCredit && !creditTypes.includes(t.type))
                // For display: if it's a credit (money coming in), show + in green
                // If it's a debit (money going out), show - in red
                const displayAmount = Math.abs(Number(t.amount))
                return (
                  <div key={t.id} className="db-txn-item">
                    <p className="db-txn-desc">{(t.beneficiary || 'Unknown').toUpperCase()}</p>
                    <div className="db-txn-amounts">
                      <span 
                        className={`db-txn-amount font-mono ${isCredit ? 'db-txn-amount--credit' : 'db-txn-amount--debit'}`}
                        style={{ color: isCredit ? '#22c55e' : '#ef4444' }}
                      >
                        {isCredit ? '+' : '-'}${displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="db-txn-bal font-mono">${Number(t.balanceAfter).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="db-statements-empty"><p>{t('noTransactionsYet')}</p></div>
          )
        })()}
        <button className="db-view-all-btn" onClick={() => openWithLoading(() => setShowTxnHistory(true))}>
          <span>{t('viewAllTransactions')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </section>

      {/* Transaction receipt overlay */}
      <TransactionSuccess
        visible={showReceipt}
        onClose={() => setShowReceipt(false)}
        data={{
          toName: receiverName,
          // Always positive, no negatives
          amount: `$${Math.abs(Number(lastTxn)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          date: txnDate,
          // Do NOT pass fromBalance or any balance info
        }}
      />

      {/* ── Global Exchange Modal ────────────────────────── */}
      {showExchange && (() => {
        const usd = parseFloat(exchangeUsd.replace(/,/g, '')) || 0
        const eur = (usd * FX_RATES.EUR).toFixed(2)
        const gbp = (usd * FX_RATES.GBP).toFixed(2)
        return (
          <div className="gx-overlay" onClick={() => setShowExchange(false)}>
            <div className="gx-modal" onClick={(e) => e.stopPropagation()}>
              <button className="gx-close" onClick={() => setShowExchange(false)}>&times;</button>
              <div className="gx-header-icon">💱</div>
              <h2 className="gx-title">{t('globalExchange')}</h2>
              <p className="gx-subtitle">{t('realTimeFxRates')}</p>

              <div className="gx-input-wrap">
                <span className="gx-input-prefix">$</span>
                <input
                  className="gx-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={exchangeUsd}
                  onChange={(e) => setExchangeUsd(e.target.value)}
                  autoFocus
                />
                <span className="gx-input-tag">USD</span>
              </div>

              <div className="gx-results">
                <div className="gx-rate-card">
                  <div className="gx-flag">🇪🇺</div>
                  <div className="gx-rate-info">
                    <span className="gx-currency">EUR — Euro</span>
                    <span className="gx-rate-label">1 USD = {FX_RATES.EUR} EUR</span>
                  </div>
                  <span className="gx-converted font-mono">€{usd ? Number(eur).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                </div>
                <div className="gx-rate-card">
                  <div className="gx-flag">🇬🇧</div>
                  <div className="gx-rate-info">
                    <span className="gx-currency">GBP — British Pound</span>
                    <span className="gx-rate-label">1 USD = {FX_RATES.GBP} GBP</span>
                  </div>
                  <span className="gx-converted font-mono">£{usd ? Number(gbp).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                </div>
              </div>

              {usd > 0 && (
                <button
                  className="gx-use-btn"
                  onClick={() => {
                    setIntlPrefill(exchangeUsd.replace(/,/g, ''))
                    setShowExchange(false)
                    setShowIntlTransfer(true)
                  }}
                >
                  {t('useThisRate')}
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Notification Center ──────────────────────────── */}
      {showNotifCenter && (() => {
        const allNotifs = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]')
        const sysNotif = localStorage.getItem('system_notification')
        let sysItem = null
        try { if (sysNotif) sysItem = JSON.parse(sysNotif) } catch {}
        const history = JSON.parse(localStorage.getItem('transfer_history') || '[]')
        return (
          <div className="nc-overlay" onClick={() => setShowNotifCenter(false)}>
            <div className="nc-panel" onClick={(e) => e.stopPropagation()}>
              <div className="nc-header">
                <h2 className="nc-title">{t('notifications')}</h2>
                <button className="nc-close" onClick={() => setShowNotifCenter(false)}>&times;</button>
              </div>

              <div className="nc-list">
                {/* System alert if any */}
                {sysItem && (
                  <div className="nc-item nc-item--system">
                    <div className="nc-item-icon nc-item-icon--system">📢</div>
                    <div className="nc-item-body">
                    <span className="nc-item-title">{t('systemAlert')}</span>
                      <span className="nc-item-msg">{sysItem.message}</span>
                      {sysItem.timestamp && <span className="nc-item-time">{sysItem.timestamp}</span>}
                    </div>
                  </div>
                )}

                {/* Transaction notifications */}
                {allNotifs.length > 0 && allNotifs.slice().reverse().map((n, i) => (
                  <div key={i} className={`nc-item nc-item--${n.type || 'info'}`}>
                    <div className={`nc-item-icon nc-item-icon--${n.type || 'info'}`}>
                      {n.type === 'credit' ? '↓' : n.type === 'debit' ? '↑' : 'ℹ'}
                    </div>
                    <div className="nc-item-body">
                      <span className="nc-item-title">
                        {n.type === 'credit' ? 'Credit Alert' : n.type === 'debit' ? 'Debit Alert' : 'Notification'}
                      </span>
                      <span className="nc-item-msg">
                        {n.type === 'credit' ? '+' : '-'}${n.amount} • Balance: ${n.newBalance}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Recent transfer history */}
                {history.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="nc-item nc-item--txn">
                    <div className="nc-item-icon nc-item-icon--txn">💸</div>
                    <div className="nc-item-body">
                      <span className="nc-item-title">{tx.type === 'bill_payment' ? 'Bill Payment' : tx.type === 'international' ? 'Wire Transfer' : 'Transfer'} — {tx.ref}</span>
                      <span className="nc-item-msg">${tx.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} to {tx.beneficiary}</span>
                      <span className="nc-item-time">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}

                {allNotifs.length === 0 && !sysItem && history.length === 0 && (
                  <div className="nc-empty">
                    <span className="nc-empty-icon">🔔</span>
                  <p>{t('noNotifications')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Bottom nav ───────────────────────────────────── */}
      <nav className="db-bottomnav">
        {[
          { id: 'home', icon: <HomeNavIcon />, label: t('home') },
          { id: 'cards', icon: <CardsNavIcon />, label: t('cards') },
          { id: 'services', icon: <WealthNavIcon />, label: t('services') },
          { id: 'notifications', icon: <NotifNavIcon hasUnread={hasUnread} />, label: t('alerts') },
          { id: 'support', icon: <SupportNavIcon />, label: t('support') },
        ].map((n) => (
          <button
            key={n.id}
            className={`db-navbtn ${activeNav === n.id ? 'db-navbtn--active' : ''}`}
            onClick={() => {
              setActiveNav(n.id)
              if (n.id === 'home') {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              } else if (n.id === 'cards') {
                openWithLoading(() => setShowBankCard(true))
              } else if (n.id === 'services') {
                openWithLoading(() => setShowFinServices(true))
              } else if (n.id === 'notifications') {
                openWithLoading(() => {
                  setShowNotifCenter(true)
                  // Mark all notifications as read when opening center
                  try {
                    const raw = localStorage.getItem(NOTIF_KEY)
                    const notifs = raw ? JSON.parse(raw) : []
                    const updated = notifs.map((n) => ({ ...n, read: true }))
                    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated))
                    setHasUnread(false)
                  } catch {}
                })
              } else if (n.id === 'support') {
                openWithLoading(() => setShowAiSupport(true))
              }
            }}
          >
            {n.icon}
            <span className="db-navlabel">{n.label}</span>
          </button>
        ))}
      </nav>

      {/* ── FX Ticker ────────────────────────────────────── */}
      <FxTicker />
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
