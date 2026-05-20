import { useState, useEffect, useRef, useCallback } from 'react'
import TDLogo from './TDLogo'
import {
  isBiometricSupported,
  isBiometricRegistered,
  authenticateWithBiometric,
} from '../services/biometricService'

const IDLE_TIMEOUT = 60000          // 60 seconds → PIN lock
const RELOGIN_TIMEOUT = 20 * 60000  // 20 minutes → full re-login

export default function SecurityLock({ children, onForceLogout }) {
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [bioScanning, setBioScanning] = useState(false)
  const timerRef = useRef(null)
  const reloginTimerRef = useRef(null)
  const pinRefs = useRef([])

  const getStoredPin = () => {
    try {
      const u = JSON.parse(localStorage.getItem('securebank_user') || '{}')
      return u.pin || ''
    } catch { return '' }
  }

  const resetTimer = useCallback(() => {
    if (!getStoredPin()) return // no pin set, skip locking
    clearTimeout(timerRef.current)
    clearTimeout(reloginTimerRef.current)
    timerRef.current = setTimeout(() => setLocked(true), IDLE_TIMEOUT)
    reloginTimerRef.current = setTimeout(() => {
      if (onForceLogout) onForceLogout()
    }, RELOGIN_TIMEOUT)
  }, [onForceLogout])

  useEffect(() => {
    if (!getStoredPin()) return
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      clearTimeout(timerRef.current)
      clearTimeout(reloginTimerRef.current)
    }
  }, [resetTimer])

  // Focus first input when locked + auto-trigger biometric if registered
  useEffect(() => {
    if (locked) {
      setPin(['', '', '', '', '', ''])
      setError('')
      // If biometric is registered, try it automatically
      if (isBiometricSupported() && isBiometricRegistered()) {
        setTimeout(() => handleBiometricUnlock(true), 400)
      } else {
        setTimeout(() => pinRefs.current[0]?.focus(), 100)
      }
    }
  }, [locked])

  const handleBiometricUnlock = async (auto = false) => {
    if (bioScanning) return
    setBioScanning(true)
    setError('')
    try {
      const ok = await authenticateWithBiometric()
      if (ok) {
        setLocked(false)
        resetTimer()
      }
    } catch (err) {
      if (!auto) {
        if (err.name === 'NotAllowedError') {
          setError('Biometric cancelled. Enter your PIN instead.')
        } else if (err.message === 'NO_CREDENTIAL') {
          setError('No biometric found. Please enter your PIN.')
        } else {
          setError('Biometric failed. Please enter your PIN.')
        }
      }
      setTimeout(() => pinRefs.current[0]?.focus(), 100)
    } finally {
      setBioScanning(false)
    }
  }

  const handleChange = (idx, value) => {
    if (!/^\d?$/.test(value)) return
    const next = [...pin]
    next[idx] = value
    setPin(next)
    setError('')

    if (value && idx < 5) {
      pinRefs.current[idx + 1]?.focus()
    }

    // Auto-submit when all 6 entered
    if (value && idx === 5) {
      const entered = next.join('')
      const stored = getStoredPin()
      if (entered === stored) {
        setLocked(false)
        resetTimer()
      } else {
        setError('Incorrect PIN')
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setPin(['', '', '', '', '', ''])
          pinRefs.current[0]?.focus()
        }, 500)
      }
    }
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      pinRefs.current[idx - 1]?.focus()
    }
  }

  if (!locked) return children

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('securebank_user') || '{}') } catch { return {} }
  })()

  return (
    <div className="sl-overlay">
      <div className="sl-card">
        <div className="sl-logo">
          <TDLogo size={48} />
        </div>
        <div className="sl-profile">
          {user.profilePic ? (
            <img src={user.profilePic} alt="" className="sl-avatar" />
          ) : (
            <div className="sl-avatar-placeholder">{(user.name || 'U').charAt(0).toUpperCase()}</div>
          )}
        </div>
        <h2 className="sl-title">Welcome back</h2>
        <p className="sl-subtitle">Enter your 6-digit PIN to unlock</p>

        <div className={`sl-pin-row ${shake ? 'sl-shake' : ''}`}>
          {pin.map((d, i) => (
            <input
              key={i}
              ref={(el) => (pinRefs.current[i] = el)}
              type="password"
              inputMode="numeric"
              maxLength={1}
              className={`sl-pin-box ${d ? 'sl-pin-filled' : ''}`}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && <p className="sl-error">{error}</p>}
        <p className="sl-hint">Session locked due to inactivity</p>

        {/* Biometric unlock button */}
        {isBiometricSupported() && isBiometricRegistered() && (
          <button
            className={`sl-biometric-btn ${bioScanning ? 'sl-biometric-btn--scanning' : ''}`}
            onClick={() => handleBiometricUnlock(false)}
            disabled={bioScanning}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
              <path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 2 0 3.8 1 4.8 2.5"/>
              <path d="M10 12c0 4-1 8-3 11"/>
              <path d="M14 12c0 2.5-.5 5-1.5 7.5"/>
              <path d="M18 11c0 3-1 6.5-3 9.5"/>
              <path d="M22 12c0 2-1 4-2 6"/>
            </svg>
            <span>{bioScanning ? 'Scanning…' : 'Use Face ID / Biometrics'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
