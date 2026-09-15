import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebaseClient.mjs'
import { subscribeToAccountProfile } from '../src/services/accountLedger'
import { subscribeToTransactions } from '../src/services/transactionService'
import SecurityLock from '../src/components/SecurityLock'
import LocalTransfer from '../src/components/LocalTransfer'
import InternationalTransfer from '../src/components/InternationalTransfer'
import OtpModal from '../src/components/OtpModal'
import '../src/style.css'

function Harness() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [view, setView] = useState('')
  const [email, setEmail] = useState('')
  const [inbox, setInbox] = useState('')
  const [error, setError] = useState('')
  const logout = useCallback(() => setAccount(null), [])

  useEffect(() => {
    const receive = event => setInbox(event.detail.otp_code)
    window.addEventListener('test-email', receive)
    return () => window.removeEventListener('test-email', receive)
  }, [])
  useEffect(() => {
    if (!account) return
    const stopProfile = subscribeToAccountProfile(account.uid, profile => setBalance(profile.balance))
    const stopHistory = subscribeToTransactions(account.uid, setHistory)
    return () => { stopProfile(); stopHistory() }
  }, [account])

  async function login(event) {
    event.preventDefault()
    setView('')
    setBalance(null)
    setError('')
    try {
      const result = await signInWithEmailAndPassword(auth, email, 'EmulatorOnly-Checks-123!')
      setAccount(result.user)
    } catch (err) { setError(err.message) }
  }

  return <>
    <form onSubmit={login}>
      <input aria-label="Test email" value={email} onChange={e => setEmail(e.target.value)} />
      <button>Test sign in</button>
    </form>
    <output data-testid="test-inbox" hidden>{inbox}</output>
    {error && <p role="alert">{error}</p>}
    {account && balance !== null && <SecurityLock onForceLogout={logout}>
      <p>Server balance: <output data-testid="balance">{balance.toFixed(2)}</output></p>
      <p>History: <output data-testid="history-count">{history.length}</output></p>
      <button onClick={() => setView('local')}>Open local</button>
      <button onClick={() => setView('international')}>Open international</button>
      <button onClick={() => setView('email')}>Open email verification</button>
      {view === 'local' && <LocalTransfer balance={balance} onClose={() => setView('')} onBalanceUpdate={setBalance} />}
      {view === 'international' && <InternationalTransfer balance={balance} onClose={() => setView('')} onBalanceUpdate={setBalance} />}
      {view === 'email' && <OtpModal email={account.email} onCancel={() => setView('')} onVerified={() => setView('verified')} />}
      {view === 'verified' && <p>Email verified</p>}
    </SecurityLock>}
  </>
}

createRoot(document.getElementById('root')).render(<Harness />)
