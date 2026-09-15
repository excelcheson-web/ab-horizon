import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebaseClient.mjs'
import AdminApp from '../src/admin/App'
import '../src/style.css'

export default function AdminHarness() {
  const [email, setEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState('')
  if (signedIn) return <AdminApp onLogout={() => setSignedIn(false)} onRevoke={() => setSignedIn(false)} />
  return <form onSubmit={async event => {
    event.preventDefault()
    try {
      await signInWithEmailAndPassword(auth, email, 'EmulatorOnly-Checks-123!')
      setSignedIn(true)
    } catch (err) { setError(err.message) }
  }}>
    <input aria-label="Test admin email" value={email} onChange={event => setEmail(event.target.value)} />
    <button>Test admin sign in</button>
    {error && <p role="alert">{error}</p>}
  </form>
}

createRoot(document.getElementById('root')).render(<AdminHarness />)
