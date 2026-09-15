import { useId, useRef, useState } from 'react'
import { fetchAllUsers } from '../services/adminService'

export default function UserPicker({ selectedUser, onSelect }) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const triggerRef = useRef(null)
  const panelId = useId()
  const searchId = useId()

  async function loadUsers() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const result = await fetchAllUsers({ force: true })
      setUsers(result.filter(user => user.email).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)))
      setLoaded(true)
    } catch (err) {
      setError(err.message || 'Could not load users. Please try again.')
    } finally { setLoading(false) }
  }

  function toggleOpen() {
    setOpen(!open)
    if (!open && !loaded && !loading) loadUsers()
  }

  async function chooseUser(email) {
    if (busyRef.current) return
    busyRef.current = true
    setSelecting(true)
    setError('')
    try {
      if (await onSelect(email)) {
        setOpen(false)
        setSearch('')
        triggerRef.current?.focus()
      } else {
        setError('Could not select this user. Please check the email and try again.')
      }
    } catch (err) {
      setError(err.message || 'Could not select this user. Please try again.')
    } finally {
      busyRef.current = false
      setSelecting(false)
    }
  }

  const query = search.trim().toLowerCase()
  const matches = users.filter(user => [user.name, user.email, user.accountNumber].some(value => String(value || '').toLowerCase().includes(query)))
  const canLookUpEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)

  return <div className="admin-user-selector">
    <button ref={triggerRef} type="button" className="admin-user-trigger"
      aria-expanded={open} aria-controls={panelId} onClick={toggleOpen} disabled={selecting}>
      <span className="admin-user-trigger-copy">
        <span className="admin-user-trigger-label">{selectedUser ? 'Change user' : 'Choose user'}</span>
        {selectedUser && <>
          <strong>{selectedUser.name || selectedUser.email}</strong>
          <span className="admin-user-option-email">{selectedUser.email}</span>
        </>}
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
        style={{ transform: open ? 'rotate(180deg)' : undefined }}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    {open && <div id={panelId} className="admin-user-picker" onKeyDown={event => {
      if (event.key === 'Escape' && !selecting) { setOpen(false); triggerRef.current?.focus() }
    }}>
      <form onSubmit={event => {
        event.preventDefault()
        if (canLookUpEmail) chooseUser(query)
        else if (matches.length === 1) chooseUser(matches[0].email)
      }}>
        <label className="admin-label" htmlFor={searchId}>Find user</label>
        <input id={searchId} type="search" className="admin-input" placeholder="Name, email or account"
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          value={search} onChange={event => setSearch(event.target.value)} disabled={selecting} />
        {canLookUpEmail && matches.length === 0 && <button type="submit" className="admin-btn admin-user-lookup" disabled={selecting}>
          Find by email
        </button>}
      </form>
      <div className="admin-user-picker-toolbar">
        <span role="status">{loading ? 'Loading users...' : selecting ? 'Selecting user...' : `${matches.length} ${matches.length === 1 ? 'user' : 'users'}`}</span>
        <button type="button" className="admin-user-refresh" onClick={loadUsers} disabled={loading || selecting}>Refresh</button>
      </div>
      {error && <p className="admin-user-picker-error" role="alert">{error}</p>}
      {loaded && !loading && matches.length === 0 && <p className="admin-user-picker-empty">
        {query ? 'No matching users.' : 'No users found.'}
      </p>}
      <ul className="admin-user-list" aria-label="Users" aria-busy={loading || selecting}>
        {matches.map(user => <li key={user.uid}>
          <button type="button" className="admin-user-option" aria-pressed={selectedUser?.uid === user.uid}
            onClick={() => chooseUser(user.email)} disabled={selecting || loading}>
            <strong>{user.name || user.email}</strong>
            <span className="admin-user-option-email">{user.email}</span>
            {user.accountNumber && <span className="admin-user-option-account">Account {user.accountNumber}</span>}
          </button>
        </li>)}
      </ul>
    </div>}
  </div>
}
