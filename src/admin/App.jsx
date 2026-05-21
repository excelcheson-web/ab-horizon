import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchAllUsers,
  getUserByEmail,
  updateUserBalance,
  createTransaction,
  deleteTransaction,
  updateTransaction,
  getUserTransactions,
  toggleUserSuspension,
  updateFeatureFlags,
  getUserFeatureFlags,
  updateUserAccountType,
  updateUserProfilePicture,
  generateTransactionRef,
} from '../services/adminService'

const STORAGE_KEY = 'securebank_admin'
const NOTIF_KEY = 'securebank_notifications'

function formatBalance(num) {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBalance(str) {
  if (!str) return 0
  return parseFloat(String(str).replace(/,/g, '')) || 0
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AdminApp() {
  // ── User Selection State ───────────────────────────────────
  const [allUsers, setAllUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [emailSearch, setEmailSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [userTransactions, setUserTransactions] = useState([])

  // ── UI State ────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState('account-mgmt')
  const [loadingBtn, setLoadingBtn] = useState(null)
  const [toast, setToast] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  // ── Account Management State ───────────────────────────────
  const [creditAmount, setCreditAmount] = useState('')
  const [debitAmount, setDebitAmount] = useState('')

  // ── Transaction Creation State ─────────────────────────────
  const [txnForm, setTxnForm] = useState({
    type: 'local',
    direction: 'incoming',
    beneficiary: '',
    amount: '',
    bankName: 'Optima Credit Union',
    description: '',
    accountNumber: '',
    iban: '',
    swift: '',
    country: '',
    date: new Date().toISOString().slice(0, 16),
  })

  // ── Suspension State ───────────────────────────────────────
  const [suspendForm, setSuspendForm] = useState({
    suspended: false,
    customMessage: '',
  })

  // ── Feature Flags State ──────────────────────────────────
  const [featureFlags, setFeatureFlags] = useState({
    enableTransfers: true,
    enableDeposits: true,
    enableInvestments: true,
    enableBillPay: true,
    enableScheduled: true,
    enableCrypto: true,
    enableLocalTransfer: true,
    enableInternationalTransfer: true,
  })

  // ── Transaction Editing State ────────────────────────────
  const [editingTxn, setEditingTxn] = useState(null)
  const [editTxnForm, setEditTxnForm] = useState({
    type: 'local',
    direction: 'incoming',
    beneficiary: '',
    amount: '',
    bankName: 'Optima Credit Union',
    description: '',
    accountNumber: '',
    iban: '',
    swift: '',
    country: '',
    date: '',
  })

  // ── Auto Generate Transactions State ───────────────────
  const [autoGenForm, setAutoGenForm] = useState({
    count: 5,
    minAmount: 100,
    maxAmount: 5000,
    types: ['local', 'international', 'credit'],
    dateRange: 'last30days',
  })

  // ── Profile Picture State ────────────────────────────────
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [profilePicFile, setProfilePicFile] = useState(null)
  const fileInputRef = useRef(null)

  // ── Toast Helper ───────────────────────────────────────────
  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const withLoading = useCallback(async (btnId, fn) => {
    setLoadingBtn(btnId)
    try {
      await fn()
    } finally {
      setLoadingBtn(null)
    }
  }, [])

  // ── Load All Users ─────────────────────────────────────────
  const loadAllUsers = async () => {
    setUsersLoading(true)
    try {
      // Use force: true to bypass circuit breaker for admin panel
      const users = await fetchAllUsers({ force: true })
      setAllUsers(users)
      showToast('success', `Loaded ${users.length} users`)
    } catch (err) {
      showToast('error', 'Failed to load users: ' + err.message)
    } finally {
      setUsersLoading(false)
    }
  }

  // ── Select User by Email ─────────────────────────────────
  const handleUserSelect = async (email) => {
    if (!email) {
      setSelectedUser(null)
      setUserTransactions([])
      return
    }

    // Reset state before loading new user
    setSelectedUser(null)
    setUserTransactions([])
    setSuspendForm({
      suspended: false,
      customMessage: '',
    })
    setLoadingBtn('select-user')

    try {
      const user = await getUserByEmail(email)
      if (user) {
        setSelectedUser(user)
        setSuspendForm({
          suspended: user.suspended || false,
          customMessage: user.suspendReason || '',
        })
        setFeatureFlags({ ...featureFlags, ...user.featureFlags })
        
        // Load user's transactions
        const txns = await getUserTransactions(user.uid)
        setUserTransactions(txns)
        
        showToast('success', `Selected: ${user.name}`)
      } else {
        showToast('error', 'User not found')
        setSelectedUser(null)
      }
    } catch (err) {
      showToast('error', err.message)
      setSelectedUser(null)
    } finally {
      setLoadingBtn(null)
    }
  }

  // ── Credit Account ─────────────────────────────────────────
  const handleCredit = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }
    const amount = parseFloat(creditAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Enter a valid amount')
      return
    }

    await withLoading('credit', async () => {
      const newBalance = await updateUserBalance(selectedUser.uid, amount, 'add')
      
      // Create a credit transaction record
      await createTransaction(selectedUser.uid, {
        type: 'credit',
        direction: 'incoming',
        beneficiary: 'Account Credit',
        amount: amount,
        description: 'Admin credit',
        bankName: 'Optima Credit Union',
      })

      setSelectedUser({ ...selectedUser, balance: newBalance })
      setCreditAmount('')
      showToast('success', `Credited $${formatBalance(amount)}. New balance: $${formatBalance(newBalance)}`)
      
      // Refresh transactions
      const txns = await getUserTransactions(selectedUser.uid)
      setUserTransactions(txns)
    })
  }

  // ── Debit Account ─────────────────────────────────────────
  const handleDebit = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }
    const amount = parseFloat(debitAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Enter a valid amount')
      return
    }

    await withLoading('debit', async () => {
      const newBalance = await updateUserBalance(selectedUser.uid, amount, 'subtract')
      
      // Create a debit transaction record
      await createTransaction(selectedUser.uid, {
        type: 'debit',
        direction: 'outgoing',
        beneficiary: 'Account Debit',
        amount: amount,
        description: 'Admin debit',
        bankName: 'Optima Credit Union',
      })

      setSelectedUser({ ...selectedUser, balance: newBalance })
      setDebitAmount('')
      showToast('success', `Debited $${formatBalance(amount)}. New balance: $${formatBalance(newBalance)}`)
      
      // Refresh transactions
      const txns = await getUserTransactions(selectedUser.uid)
      setUserTransactions(txns)
    })
  }

  // ── Create Transaction ─────────────────────────────────────
  const handleCreateTransaction = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }
    const amount = parseFloat(txnForm.amount)
    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Enter a valid amount')
      return
    }
    if (!txnForm.beneficiary.trim()) {
      showToast('error', 'Enter beneficiary name')
      return
    }

    await withLoading('create-txn', async () => {
      const txn = await createTransaction(selectedUser.uid, {
        ...txnForm,
        amount: amount,
      })

      // Refresh user data and transactions
      const updatedUser = await getUserByEmail(selectedUser.email)
      setSelectedUser(updatedUser)
      const txns = await getUserTransactions(selectedUser.uid)
      setUserTransactions(txns)

      showToast('success', `Transaction ${txn.ref} created successfully`)
      
      // Reset form
      setTxnForm({
        type: 'local',
        direction: 'incoming',
        beneficiary: '',
        amount: '',
        bankName: 'Optima Credit Union',
        description: '',
        accountNumber: '',
        iban: '',
        swift: '',
        country: '',
        date: new Date().toISOString().slice(0, 16),
      })
    })
  }

  // ── Delete Transaction ───────────────────────────────────
  const handleDeleteTransaction = async (txnId) => {
    if (!selectedUser) return
    if (!window.confirm('Delete this transaction? This will also adjust the user\'s balance.')) return

    await withLoading(`delete-${txnId}`, async () => {
      await deleteTransaction(selectedUser.uid, txnId)
      
      // Refresh user data and transactions
      const updatedUser = await getUserByEmail(selectedUser.email)
      setSelectedUser(updatedUser)
      const txns = await getUserTransactions(selectedUser.uid)
      setUserTransactions(txns)
      
      showToast('success', 'Transaction deleted')
    })
  }

  // ── Toggle Suspension ─────────────────────────────────────
  const handleToggleSuspension = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }

    await withLoading('suspend', async () => {
      const result = await toggleUserSuspension(
        selectedUser.uid,
        !selectedUser.suspended,
        suspendForm.customMessage
      )
      
      setSelectedUser({
        ...selectedUser,
        suspended: result.suspended,
        suspendReason: result.message,
      })
      setSuspendForm({
        ...suspendForm,
        suspended: result.suspended,
      })
      
      showToast('success', result.suspended ? 'Account suspended' : 'Account unsuspended')
    })
  }

  // ── Update Feature Flags ─────────────────────────────────
  const handleUpdateFeatureFlags = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }

    await withLoading('features', async () => {
      await updateFeatureFlags(selectedUser.uid, featureFlags)
      showToast('success', 'Feature flags updated')
    })
  }

  // ── Update Account Type ───────────────────────────────────
  const handleUpdateAccountType = async (accountType) => {
    if (!selectedUser) return
    
    await withLoading('account-type', async () => {
      await updateUserAccountType(selectedUser.uid, accountType)
      setSelectedUser({ ...selectedUser, accountType })
      showToast('success', `Account type updated to ${accountType}`)
    })
  }

  // ── Start Editing Transaction ────────────────────────────
  const startEditTransaction = (txn) => {
    setEditingTxn(txn)
    setEditTxnForm({
      type: txn.type || 'local',
      direction: txn.direction || 'incoming',
      beneficiary: txn.beneficiary || '',
      amount: String(txn.amount || ''),
      bankName: txn.bankName || 'Optima Credit Union',
      description: txn.description || '',
      accountNumber: txn.accountNumber || '',
      iban: txn.iban || '',
      swift: txn.swift || '',
      country: txn.country || '',
      date: txn.date ? new Date(txn.date).toISOString().slice(0, 16) : '',
    })
  }

  // ── Cancel Editing Transaction ─────────────────────────
  const cancelEditTransaction = () => {
    setEditingTxn(null)
    setEditTxnForm({
      type: 'local',
      direction: 'incoming',
      beneficiary: '',
      amount: '',
      bankName: 'Optima Credit Union',
      description: '',
      accountNumber: '',
      iban: '',
      swift: '',
      country: '',
      date: '',
    })
  }

  // ── Save Edited Transaction ──────────────────────────────
  const handleSaveEditTransaction = async () => {
    if (!selectedUser || !editingTxn) return
    
    const amount = parseFloat(editTxnForm.amount)
    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Enter a valid amount')
      return
    }
    if (!editTxnForm.beneficiary.trim()) {
      showToast('error', 'Enter beneficiary name')
      return
    }

    await withLoading('save-edit-txn', async () => {
      await updateTransaction(selectedUser.uid, editingTxn.id, {
        ...editTxnForm,
        amount: amount,
      })

      // Refresh transactions
      const txns = await getUserTransactions(selectedUser.uid)
      setUserTransactions(txns)
      
      // Also refresh user data to get updated balance
      const updatedUser = await getUserByEmail(selectedUser.email)
      setSelectedUser(updatedUser)

      showToast('success', `Transaction ${editingTxn.ref} updated successfully`)
      cancelEditTransaction()
    })
  }

  // ── Auto Generate Transactions ───────────────────────────
  const handleAutoGenerateTransactions = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }

    const count = parseInt(autoGenForm.count) || 5
    const minAmount = parseFloat(autoGenForm.minAmount) || 100
    const maxAmount = parseFloat(autoGenForm.maxAmount) || 5000

    if (count < 1 || count > 50) {
      showToast('error', 'Please generate between 1 and 50 transactions')
      return
    }

    await withLoading('auto-gen', async () => {
      const beneficiaries = [
        'John Smith', 'Sarah Johnson', 'Michael Brown', 'Emily Davis', 
        'Robert Wilson', 'Lisa Anderson', 'David Martinez', 'Jennifer Taylor',
        'James Thomas', 'Maria Garcia', 'William Lee', 'Patricia White'
      ]
      const banks = ['Optima Credit Union', 'First National Bank', 'Pacific Union Bank', 'Citywide Financial', 'Global Commerce Bank', 'Metro Savings Bank']
      
      let generated = 0
      
      for (let i = 0; i < count; i++) {
        const type = autoGenForm.types[Math.floor(Math.random() * autoGenForm.types.length)]
        const direction = Math.random() > 0.5 ? 'incoming' : 'outgoing'
        const amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount
        
        // Generate random date within range
        let date = new Date()
        if (autoGenForm.dateRange === 'last7days') {
          date.setDate(date.getDate() - Math.floor(Math.random() * 7))
        } else if (autoGenForm.dateRange === 'last30days') {
          date.setDate(date.getDate() - Math.floor(Math.random() * 30))
        } else if (autoGenForm.dateRange === 'last90days') {
          date.setDate(date.getDate() - Math.floor(Math.random() * 90))
        } else if (autoGenForm.dateRange === 'last6months') {
          date.setMonth(date.getMonth() - Math.floor(Math.random() * 6))
        }
        
        const txnData = {
          type,
          direction,
          beneficiary: beneficiaries[Math.floor(Math.random() * beneficiaries.length)],
          amount: amount,
          bankName: banks[Math.floor(Math.random() * banks.length)],
          description: `Auto-generated ${type} transaction`,
          date: date.toISOString(),
        }
        
        // Add international fields if applicable
        if (type === 'international') {
          txnData.iban = 'GB82WEST12345698765432'
          txnData.swift = 'WESTGB2L'
          txnData.country = 'United Kingdom'
        }
        
        await createTransaction(selectedUser.uid, txnData)
        generated++
      }

      // Refresh user data and transactions
      const updatedUser = await getUserByEmail(selectedUser.email)
      setSelectedUser(updatedUser)
      const txns = await getUserTransactions(selectedUser.uid)
      setUserTransactions(txns)

      showToast('success', `${generated} transactions auto-generated successfully`)
    })
  }

  // ── Update Profile Picture ───────────────────────────────
  const handleUpdateProfilePicture = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }
    if (!profilePicUrl.trim()) {
      showToast('error', 'Please enter a profile picture URL')
      return
    }

    await withLoading('update-pic', async () => {
      await updateUserProfilePicture(selectedUser.uid, profilePicUrl.trim())
      setSelectedUser({ ...selectedUser, profilePic: profilePicUrl.trim() })
      setProfilePicUrl('')
      showToast('success', 'Profile picture updated successfully')
    })
  }

  // ── Delete Profile Picture ───────────────────────────────
  const handleDeleteProfilePicture = async () => {
    if (!selectedUser) {
      showToast('error', 'Please select a user first')
      return
    }
    if (!window.confirm('Remove this user\'s profile picture?')) return

    await withLoading('delete-pic', async () => {
      await updateUserProfilePicture(selectedUser.uid, '')
      setSelectedUser({ ...selectedUser, profilePic: '' })
      setProfilePicUrl('')
      showToast('success', 'Profile picture removed successfully')
    })
  }

  // ── Load users on mount ───────────────────────────────────
  // NOTE: Disabled auto-load to prevent Firestore resource-exhausted errors.
  // Users must click "Refresh Users" button to load the list.
  // useEffect(() => {
  //   loadAllUsers()
  // }, [])

  return (
    <div className="admin-shell admin-shell--sidebar">
      {/* ── Toast notification ──────────────────────────── */}
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`} onClick={() => setToast(null)}>
          <span className="admin-toast-icon">{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="admin-toast-msg">{toast.message}</span>
        </div>
      )}

      {/* ── Sidebar Navigation ─────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #1a56db, #0a2540)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polygon points="12,3 22,8 2,8" fill="rgba(255,255,255,0.9)" />
              <rect x="4"  y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.85)" />
              <rect x="9"  y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.85)" />
              <rect x="14" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.85)" />
              <rect x="19" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.85)" />
              <rect x="2" y="18" width="20" height="2.5" rx="0.5" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>
          <span className="admin-sidebar-logo-text">Admin Portal</span>
        </div>
        
        {/* User Selector */}
        <div className="admin-user-selector">
          <label className="admin-label">Select User by Email</label>
          <div className="admin-user-search">
            <input
              type="email"
              className="admin-input"
              placeholder="Search email..."
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              list="user-emails"
            />
            <datalist id="user-emails">
              {allUsers.map((u) => (
                <option key={u.uid} value={u.email}>
                  {u.name} - {u.email}
                </option>
              ))}
            </datalist>
            <button
              className="admin-btn admin-btn--small"
              onClick={() => handleUserSelect(emailSearch)}
              disabled={loadingBtn === 'select-user'}
            >
              {loadingBtn === 'select-user' ? '...' : 'Select'}
            </button>
          </div>
          <button
            className="admin-btn admin-btn--secondary admin-btn--small"
            onClick={loadAllUsers}
            disabled={usersLoading}
          >
            {usersLoading ? 'Loading...' : '🔄 Refresh Users'}
          </button>
          {allUsers.length === 0 && !usersLoading && (
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
              💡 Click "Refresh Users" to load the user list
            </p>
          )}
        </div>

        <nav className="admin-sidebar-nav">
          {[
            { id: 'account-mgmt', icon: '👤', label: 'Account Management' },
            { id: 'transactions', icon: '💸', label: 'Transaction Mgmt' },
            { id: 'txn-history', icon: '📋', label: 'Transaction History' },
            { id: 'suspension', icon: '🛡️', label: 'Account Controls & KYC' },
            { id: 'features', icon: '⚙️', label: 'Feature Controls' },
            { id: 'auto-gen', icon: '🤖', label: 'Data Generator' },
          ].map((item) => (
            <button
              key={item.id}
              className={`admin-sidebar-btn ${activeSection === item.id ? 'admin-sidebar-btn--active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="admin-sidebar-btn-icon">{item.icon}</span>
              <span className="admin-sidebar-btn-label">{item.label}</span>
            </button>
          ))}
        </nav>
        
        {lastSync && (
          <div className="admin-sidebar-sync">
            Synced: {lastSync}
          </div>
        )}
      </aside>

      {/* ── Main Content ──────────────────────────────── */}
      <div className="admin-content">
        <header className="admin-header bg-admin">
          <div className="admin-header-inner">
            <div>
              <h1 className="admin-title">
                {activeSection === 'account-mgmt' && 'Account Management'}
                {activeSection === 'transactions' && 'Transaction Management'}
                {activeSection === 'txn-history' && 'Transaction History'}
                {activeSection === 'suspension' && 'Account Controls & KYC'}
                {activeSection === 'features' && 'Feature Controls'}
                {activeSection === 'auto-gen' && 'Auto-Generate Transactions'}
              </h1>
              <p className="admin-subtitle">Optima Credit Union — Internal Operations Panel</p>
            </div>
            <div className="admin-badge">🔒</div>
          </div>
        </header>

        <main className="admin-main">
          {/* Selected User Info Banner */}
          {selectedUser ? (
            <div className="admin-user-banner">
              <div className="admin-user-info">
                <span className="admin-user-name">{selectedUser.name}</span>
                <span className="admin-user-email">{selectedUser.email}</span>
                <span className="admin-user-account">{selectedUser.accountType}</span>
              </div>
              <div className="admin-user-stats">
                <div className="admin-stat">
                  <span className="admin-stat-label">Balance</span>
                  <span className="admin-stat-value">${formatBalance(selectedUser.balance)}</span>
                </div>
                <div className="admin-stat">
                  <span className="admin-stat-label">Status</span>
                  <span className={`admin-stat-value ${selectedUser.suspended ? 'admin-stat--suspended' : 'admin-stat--active'}`}>
                    {selectedUser.suspended ? '🔴 Suspended' : '🟢 Active'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-user-banner admin-user-banner--empty">
              <p>⚠️ No user selected. Please select a user from the sidebar to begin.</p>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              ACCOUNT MANAGEMENT
              ════════════════════════════════════════════════ */}
          {activeSection === 'account-mgmt' && selectedUser && (
            <>
              <section className="admin-section">
                <h2 className="admin-section-title">
                  <span className="admin-section-icon">👤</span>
                  User Profile
                </h2>
                <div className="admin-card">
                  <div className="admin-profile-section">
                    <div className="admin-profile-pic-container">
                      {selectedUser.profilePic ? (
                        <img 
                          src={selectedUser.profilePic} 
                          alt="Profile" 
                          className="admin-profile-pic"
                        />
                      ) : (
                        <div className="admin-profile-pic-placeholder">
                          <span>{selectedUser.name?.charAt(0).toUpperCase() || '?'}</span>
                        </div>
                      )}
                    </div>
                  <div className="admin-profile-actions">
                    <div className="admin-profile-upload">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (event) => {
                              setProfilePicUrl(event.target.result)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                      <button
                        className="admin-btn admin-btn--secondary admin-btn--small"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        📁 Choose File
                      </button>
                      <span className="admin-profile-file-hint">or enter URL below</span>
                    </div>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Enter image URL..."
                      value={profilePicUrl}
                      onChange={(e) => setProfilePicUrl(e.target.value)}
                    />
                    <div className="admin-profile-btns">
                      <button
                        className="admin-btn admin-btn--small"
                        onClick={handleUpdateProfilePicture}
                        disabled={loadingBtn === 'update-pic' || !profilePicUrl.trim()}
                      >
                        {loadingBtn === 'update-pic' ? '...' : '📷 Update Picture'}
                      </button>
                      {selectedUser.profilePic && (
                        <button
                          className="admin-btn admin-btn--small admin-btn--danger"
                          onClick={handleDeleteProfilePicture}
                          disabled={loadingBtn === 'delete-pic'}
                        >
                          {loadingBtn === 'delete-pic' ? '...' : '🗑️ Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </section>

              <section className="admin-section">
                <h2 className="admin-section-title">
                  <span className="admin-section-icon">💰</span>
                  Account Details
                </h2>
                <div className="admin-card">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Account Number</span>
                    <span className="admin-detail-value">{selectedUser.accountNumber || 'N/A'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Current Balance</span>
                    <span className="admin-detail-value admin-detail-value--large">
                      ${formatBalance(selectedUser.balance)}
                    </span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">Savings Vault</span>
                    <span className="admin-detail-value">${formatBalance(selectedUser.savingsVault || 0)}</span>
                  </div>
                  
                  <label className="admin-label" style={{ marginTop: 16 }}>Account Type</label>
                  <select 
                    className="admin-input"
                    value={selectedUser.accountType}
                    onChange={(e) => handleUpdateAccountType(e.target.value)}
                  >
                    <option>Savings Account</option>
                    <option>Checking Account</option>
                    <option>Current Account</option>
                    <option>Fixed Deposit</option>
                  </select>
                </div>
              </section>

              <section className="admin-section">
                <h2 className="admin-section-title">
                  <span className="admin-section-icon">➕</span>
                  Add Credit (Load Money)
                </h2>
                <div className="admin-card">
                  <div className="adm-credit-row">
                    <input 
                      className="admin-input" 
                      type="text" 
                      inputMode="decimal"
                      placeholder="Amount to credit ($)" 
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)} 
                    />
                    <button
                      className="admin-action-btn admin-action-btn--credit adm-credit-btn"
                      disabled={loadingBtn === 'credit'}
                      onClick={handleCredit}
                    >
                      {loadingBtn === 'credit' ? <span className="admin-btn-spinner" /> : <><span className="admin-action-icon">↓</span> Credit Account</>}
                    </button>
                  </div>
                </div>
              </section>

              <section className="admin-section">
                <h2 className="admin-section-title">
                  <span className="admin-section-icon">➖</span>
                  Debit Account (Subtract)
                </h2>
                <div className="admin-card">
                  <div className="adm-credit-row">
                    <input 
                      className="admin-input" 
                      type="text" 
                      inputMode="decimal"
                      placeholder="Amount to debit ($)" 
                      value={debitAmount}
                      onChange={(e) => setDebitAmount(e.target.value)} 
                    />
                    <button
                      className="admin-action-btn admin-action-btn--debit adm-credit-btn"
                      disabled={loadingBtn === 'debit'}
                      onClick={handleDebit}
                    >
                      {loadingBtn === 'debit' ? <span className="admin-btn-spinner" /> : <><span className="admin-action-icon">↑</span> Debit Account</>}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ════════════════════════════════════════════════
              CREATE TRANSACTION
              ════════════════════════════════════════════════ */}
          {activeSection === 'transactions' && selectedUser && (
            <section className="admin-section">
              <h2 className="admin-section-title">
                <span className="admin-section-icon">💸</span>
                Create New Transaction
              </h2>
              <div className="admin-card">
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label className="admin-label">Transaction Type</label>
                    <select 
                      className="admin-input"
                      value={txnForm.type}
                      onChange={(e) => setTxnForm({...txnForm, type: e.target.value})}
                    >
                      <option value="local">Local Transfer</option>
                      <option value="international">International Transfer</option>
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                    </select>
                  </div>

                  <div className="admin-form-field">
                    <label className="admin-label">Direction</label>
                    <select 
                      className="admin-input"
                      value={txnForm.direction}
                      onChange={(e) => setTxnForm({...txnForm, direction: e.target.value})}
                    >
                      <option value="incoming">Incoming (Received)</option>
                      <option value="outgoing">Outgoing (Sent)</option>
                    </select>
                  </div>

                  <div className="admin-form-field admin-form-field--full">
                    <label className="admin-label">Sender/Beneficiary Name</label>
                    <input 
                      className="admin-input"
                      type="text"
                      placeholder="e.g. John Smith, ABC Corp"
                      value={txnForm.beneficiary}
                      onChange={(e) => setTxnForm({...txnForm, beneficiary: e.target.value})}
                    />
                  </div>

                  <div className="admin-form-field">
                    <label className="admin-label">Amount ($)</label>
                    <input 
                      className="admin-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={txnForm.amount}
                      onChange={(e) => setTxnForm({...txnForm, amount: e.target.value})}
                    />
                  </div>

                  <div className="admin-form-field">
                    <label className="admin-label">Bank Name</label>
                    <input 
                      className="admin-input"
                      type="text"
                      placeholder="e.g. Optima Credit Union, First National Bank"
                      value={txnForm.bankName}
                      onChange={(e) => setTxnForm({...txnForm, bankName: e.target.value})}
                    />
                  </div>

                  <div className="admin-form-field">
                    <label className="admin-label">Date & Time</label>
                    <input 
                      className="admin-input"
                      type="datetime-local"
                      value={txnForm.date}
                      onChange={(e) => setTxnForm({...txnForm, date: e.target.value})}
                    />
                  </div>

                  <div className="admin-form-field">
                    <label className="admin-label">Account Number</label>
                    <input 
                      className="admin-input"
                      type="text"
                      placeholder="10-digit account number"
                      value={txnForm.accountNumber}
                      onChange={(e) => setTxnForm({...txnForm, accountNumber: e.target.value})}
                    />
                  </div>

                  {txnForm.type === 'international' && (
                    <>
                      <div className="admin-form-field">
                        <label className="admin-label">IBAN</label>
                        <input 
                          className="admin-input"
                          type="text"
                          placeholder="GB82 WEST 1234 5698 7654 32"
                          value={txnForm.iban}
                          onChange={(e) => setTxnForm({...txnForm, iban: e.target.value})}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label className="admin-label">SWIFT/BIC</label>
                        <input 
                          className="admin-input"
                          type="text"
                          placeholder="e.g. CHASUS33"
                          value={txnForm.swift}
                          onChange={(e) => setTxnForm({...txnForm, swift: e.target.value})}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label className="admin-label">Country</label>
                        <input 
                          className="admin-input"
                          type="text"
                          placeholder="e.g. United States"
                          value={txnForm.country}
                          onChange={(e) => setTxnForm({...txnForm, country: e.target.value})}
                        />
                      </div>
                    </>
                  )}

                  <div className="admin-form-field admin-form-field--full">
                    <label className="admin-label">Description / Memo</label>
                    <textarea 
                      className="admin-input admin-textarea"
                      rows={3}
                      placeholder="Payment description, reference, or notes..."
                      value={txnForm.description}
                      onChange={(e) => setTxnForm({...txnForm, description: e.target.value})}
                    />
                  </div>
                </div>

                <button
                  className="admin-action-btn admin-action-btn--credit"
                  style={{ marginTop: 20, width: '100%' }}
                  disabled={loadingBtn === 'create-txn'}
                  onClick={handleCreateTransaction}
                >
                  {loadingBtn === 'create-txn' ? <span className="admin-btn-spinner" /> : '💸 Create Transaction'}
                </button>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════
              TRANSACTION HISTORY
              ════════════════════════════════════════════════ */}
          {activeSection === 'txn-history' && selectedUser && (
            <section className="admin-section">
              <h2 className="admin-section-title">
                <span className="admin-section-icon">📋</span>
                User Transaction History
                <span className="admin-count-badge">{userTransactions.length}</span>
              </h2>
              <div className="admin-card">
                {userTransactions.length === 0 ? (
                  <p className="adm-txlog-empty">No transactions found for this user.</p>
                ) : (
                  <div className="adm-txlog-table-wrap">
                    <table className="adm-txlog-table">
                      <thead>
                        <tr>
                          <th>Ref</th>
                          <th>Type</th>
                          <th>Beneficiary</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Bank</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTransactions.map((txn) => (
                          <tr key={txn.id}>
                            <td className="font-mono">{txn.ref}</td>
                            <td>
                              <span className={`adm-txlog-badge adm-txlog-badge--${txn.type}`}>
                                {txn.type === 'international' ? '🌐 Intl' : 
                                 txn.type === 'local' ? '⚡ Local' : 
                                 txn.type === 'credit' ? '💰 Credit' : '💸 Debit'}
                              </span>
                            </td>
                            <td>{txn.beneficiary}</td>
                            <td className={`adm-txlog-amt ${txn.direction === 'outgoing' || txn.type === 'debit' ? 'adm-txlog-amt--negative' : ''}`}>
                              {txn.direction === 'outgoing' || txn.type === 'debit' ? '-' : '+'}
                              ${formatBalance(txn.amount)}
                            </td>
                            <td>{new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{txn.bankName}</td>
                            <td className="adm-txlog-actions">
                              <button 
                                className="adm-txlog-btn adm-txlog-btn--edit" 
                                onClick={() => startEditTransaction(txn)}
                                disabled={loadingBtn === `edit-${txn.id}`}
                                title="Edit transaction"
                              >
                                ✏️
                              </button>
                              <button 
                                className="adm-txlog-btn adm-txlog-btn--del" 
                                onClick={() => handleDeleteTransaction(txn.id)}
                                disabled={loadingBtn === `delete-${txn.id}`}
                                title="Delete transaction"
                              >
                                {loadingBtn === `delete-${txn.id}` ? '...' : '🗑'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Auto-Generate Transactions */}
              <div className="admin-card" style={{ marginTop: 20 }}>
                <h3 className="admin-card-subtitle">🤖 Auto-Generate Transactions</h3>
                <p className="admin-hint">
                  Generate random transactions for testing purposes. This will create realistic-looking transaction data.
                </p>
                
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label className="admin-label">Number of Transactions</label>
                    <input 
                      className="admin-input"
                      type="number"
                      min="1"
                      max="50"
                      value={autoGenForm.count}
                      onChange={(e) => setAutoGenForm({...autoGenForm, count: parseInt(e.target.value) || 5})}
                    />
                  </div>
                  
                  <div className="admin-form-field">
                    <label className="admin-label">Min Amount ($)</label>
                    <input 
                      className="admin-input"
                      type="number"
                      value={autoGenForm.minAmount}
                      onChange={(e) => setAutoGenForm({...autoGenForm, minAmount: parseFloat(e.target.value) || 100})}
                    />
                  </div>
                  
                  <div className="admin-form-field">
                    <label className="admin-label">Max Amount ($)</label>
                    <input 
                      className="admin-input"
                      type="number"
                      value={autoGenForm.maxAmount}
                      onChange={(e) => setAutoGenForm({...autoGenForm, maxAmount: parseFloat(e.target.value) || 5000})}
                    />
                  </div>
                  
                  <div className="admin-form-field">
                    <label className="admin-label">Date Range</label>
                    <select 
                      className="admin-input"
                      value={autoGenForm.dateRange}
                      onChange={(e) => setAutoGenForm({...autoGenForm, dateRange: e.target.value})}
                    >
                      <option value="last7days">Last 7 Days</option>
                      <option value="last30days">Last 30 Days</option>
                      <option value="last90days">Last 90 Days</option>
                      <option value="last6months">Last 6 Months</option>
                    </select>
                  </div>
                </div>

                <button
                  className="admin-action-btn admin-action-btn--secondary"
                  style={{ marginTop: 16 }}
                  disabled={loadingBtn === 'auto-gen'}
                  onClick={handleAutoGenerateTransactions}
                >
                  {loadingBtn === 'auto-gen' ? <span className="admin-btn-spinner" /> : '🤖 Generate Transactions'}
                </button>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════
              ACCOUNT CONTROLS (SUSPENSION)
              ════════════════════════════════════════════════ */}
          {activeSection === 'suspension' && selectedUser && (
            <section className="admin-section">
              <h2 className="admin-section-title">
                <span className="admin-section-icon">🛡️</span>
                Account Suspension Controls
              </h2>
              
              <div className="admin-card">
                <div className="admin-toggle-row">
                  <span className="admin-toggle-label">Account Status</span>
                  <button 
                    type="button"
                    className={`admin-toggle ${!selectedUser.suspended ? 'admin-toggle--on' : ''}`}
                    onClick={handleToggleSuspension}
                    role="switch" 
                    aria-checked={!selectedUser.suspended}
                  >
                    <span className="admin-toggle-knob" />
                  </button>
                </div>
                
                <div className="admin-status-display">
                  {selectedUser.suspended ? (
                    <div className="admin-status admin-status--suspended">
                      🔴 Account is SUSPENDED - All transfers are blocked
                    </div>
                  ) : (
                    <div className="admin-status admin-status--active">
                      🟢 Account is ACTIVE - All features enabled
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-card" style={{ marginTop: 20 }}>
                <h3 className="admin-card-subtitle">Custom Suspension Message</h3>
                <p className="admin-hint">
                  This message will be displayed to the user when they attempt to make a transfer while suspended.
                </p>
                
                <textarea 
                  className="admin-input admin-textarea"
                  rows={4}
                  placeholder="Enter custom suspension warning message..."
                  value={suspendForm.customMessage}
                  onChange={(e) => setSuspendForm({...suspendForm, customMessage: e.target.value})}
                />
                
                <div className="admin-message-preview">
                  <strong>Preview:</strong>
                  <p>{suspendForm.customMessage || 'Your account has been temporarily restricted due to suspicious activity detected during routine security monitoring. Please contact customer support to verify your identity and restore full access.'}</p>
                </div>
                
                <button
                  className="admin-action-btn admin-action-btn--secondary"
                  onClick={handleToggleSuspension}
                  disabled={loadingBtn === 'suspend'}
                >
                  {loadingBtn === 'suspend' ? <span className="admin-btn-spinner" /> : 
                    selectedUser.suspended ? '✓ Unblock Account' : '🛑 Block Account'}
                </button>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════
              FEATURE CONTROLS
              ════════════════════════════════════════════════ */}
          {activeSection === 'features' && selectedUser && (
            <section className="admin-section">
              <h2 className="admin-section-title">
                <span className="admin-section-icon">⚙️</span>
                App Feature Controls
              </h2>
              <p className="admin-section-desc">
                Toggle which features are available to this user in the banking app.
              </p>

              <div className="admin-card">
                <h3 className="admin-card-subtitle">Transfer Features</h3>
                
                {[
                  { key: 'enableTransfers', label: 'All Transfers', icon: '💸' },
                  { key: 'enableLocalTransfer', label: 'Local Transfers', icon: '🏦' },
                  { key: 'enableInternationalTransfer', label: 'International Transfers', icon: '🌐' },
                  { key: 'enableScheduled', label: 'Scheduled Transfers', icon: '📅' },
                ].map((feature) => (
                  <div key={feature.key} className="admin-feature-row">
                    <span className="admin-feature-label">
                      <span className="admin-feature-icon">{feature.icon}</span>
                      {feature.label}
                    </span>
                    <button 
                      type="button"
                      className={`admin-toggle ${featureFlags[feature.key] ? 'admin-toggle--on' : ''}`}
                      onClick={() => setFeatureFlags({...featureFlags, [feature.key]: !featureFlags[feature.key]})}
                      role="switch" 
                      aria-checked={featureFlags[feature.key]}
                    >
                      <span className="admin-toggle-knob" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="admin-card" style={{ marginTop: 20 }}>
                <h3 className="admin-card-subtitle">Other Features</h3>
                
                {[
                  { key: 'enableDeposits', label: 'Deposits', icon: '💰' },
                  { key: 'enableInvestments', label: 'Investments', icon: '📈' },
                  { key: 'enableBillPay', label: 'Bill Payments', icon: '📄' },
                  { key: 'enableCrypto', label: 'Cryptocurrency', icon: '₿' },
                ].map((feature) => (
                  <div key={feature.key} className="admin-feature-row">
                    <span className="admin-feature-label">
                      <span className="admin-feature-icon">{feature.icon}</span>
                      {feature.label}
                    </span>
                    <button 
                      type="button"
                      className={`admin-toggle ${featureFlags[feature.key] ? 'admin-toggle--on' : ''}`}
                      onClick={() => setFeatureFlags({...featureFlags, [feature.key]: !featureFlags[feature.key]})}
                      role="switch" 
                      aria-checked={featureFlags[feature.key]}
                    >
                      <span className="admin-toggle-knob" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="admin-sync-btn"
                style={{ marginTop: 20 }}
                disabled={loadingBtn === 'features'}
                onClick={handleUpdateFeatureFlags}
              >
                {loadingBtn === 'features' ? <span className="admin-btn-spinner" /> : '💾 Save Feature Settings'}
              </button>
            </section>
          )}

          {/* ── Data Generator section ──────────────────── */}
          {activeSection === 'auto-gen' && selectedUser && (
            <section className="admin-section">
              <div className="admin-card">
                <h3 className="admin-card-subtitle">🤖 Auto-Generate Test Transactions</h3>
                <p className="admin-hint">
                  Generate randomized transactions for selected users.
                </p>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label className="admin-label">Number of Transactions</label>
                    <input className="admin-input" type="number" min="1" max="50"
                      value={autoGenForm.count}
                      onChange={(e) => setAutoGenForm({...autoGenForm, count: parseInt(e.target.value) || 5})} />
                  </div>
                  <div className="admin-form-field">
                    <label className="admin-label">Min Amount ($)</label>
                    <input className="admin-input" type="number"
                      value={autoGenForm.minAmount}
                      onChange={(e) => setAutoGenForm({...autoGenForm, minAmount: parseFloat(e.target.value) || 100})} />
                  </div>
                  <div className="admin-form-field">
                    <label className="admin-label">Max Amount ($)</label>
                    <input className="admin-input" type="number"
                      value={autoGenForm.maxAmount}
                      onChange={(e) => setAutoGenForm({...autoGenForm, maxAmount: parseFloat(e.target.value) || 5000})} />
                  </div>
                  <div className="admin-form-field">
                    <label className="admin-label">Date Range</label>
                    <select className="admin-input admin-select"
                      value={autoGenForm.dateRange}
                      onChange={(e) => setAutoGenForm({...autoGenForm, dateRange: e.target.value})}>
                      <option value="last7days">Last 7 Days</option>
                      <option value="last30days">Last 30 Days</option>
                      <option value="last90days">Last 90 Days</option>
                      <option value="last6months">Last 6 Months</option>
                    </select>
                  </div>
                </div>
                <button
                  className="admin-sync-btn"
                  style={{ marginTop: 16 }}
                  disabled={loadingBtn === 'auto-gen'}
                  onClick={handleAutoGenerateTransactions}
                >
                  {loadingBtn === 'auto-gen' ? <span className="admin-btn-spinner" /> : '🤖 Generate Transactions'}
                </button>
              </div>
            </section>
          )}

          {/* No user selected message */}
          {!selectedUser && (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">👤</div>
              <h3>No User Selected</h3>
              <p>Please select a user from the sidebar to manage their account.</p>
            </div>
          )}
        </main>
      </div>

      {/* ════════════════════════════════════════════════
          EDIT TRANSACTION MODAL
          ════════════════════════════════════════════════ */}
      {editingTxn && (
        <div className="admin-modal-overlay" onClick={cancelEditTransaction}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">✏️ Edit Transaction</h3>
              <button className="admin-modal-close" onClick={cancelEditTransaction}>×</button>
            </div>
            
            <div className="admin-modal-body">
              <div className="admin-form-grid">
                <div className="admin-form-field">
                  <label className="admin-label">Transaction Type</label>
                  <select 
                    className="admin-input"
                    value={editTxnForm.type}
                    onChange={(e) => setEditTxnForm({...editTxnForm, type: e.target.value})}
                  >
                    <option value="local">Local Transfer</option>
                    <option value="international">International Transfer</option>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </select>
                </div>

                <div className="admin-form-field">
                  <label className="admin-label">Direction</label>
                  <select 
                    className="admin-input"
                    value={editTxnForm.direction}
                    onChange={(e) => setEditTxnForm({...editTxnForm, direction: e.target.value})}
                  >
                    <option value="incoming">Incoming (Received)</option>
                    <option value="outgoing">Outgoing (Sent)</option>
                  </select>
                </div>

                <div className="admin-form-field admin-form-field--full">
                  <label className="admin-label">Sender/Beneficiary Name</label>
                  <input 
                    className="admin-input"
                    type="text"
                    placeholder="e.g. John Smith, ABC Corp"
                    value={editTxnForm.beneficiary}
                    onChange={(e) => setEditTxnForm({...editTxnForm, beneficiary: e.target.value})}
                  />
                </div>

                <div className="admin-form-field">
                  <label className="admin-label">Amount ($)</label>
                  <input 
                    className="admin-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editTxnForm.amount}
                    onChange={(e) => setEditTxnForm({...editTxnForm, amount: e.target.value})}
                  />
                </div>

                <div className="admin-form-field">
                  <label className="admin-label">Bank Name</label>
                  <input 
                    className="admin-input"
                    type="text"
                    placeholder="e.g. Optima Credit Union, First National Bank"
                    value={editTxnForm.bankName}
                    onChange={(e) => setEditTxnForm({...editTxnForm, bankName: e.target.value})}
                  />
                </div>

                <div className="admin-form-field">
                  <label className="admin-label">Date & Time</label>
                  <input 
                    className="admin-input"
                    type="datetime-local"
                    value={editTxnForm.date}
                    onChange={(e) => setEditTxnForm({...editTxnForm, date: e.target.value})}
                  />
                </div>

                <div className="admin-form-field">
                  <label className="admin-label">Account Number</label>
                  <input 
                    className="admin-input"
                    type="text"
                    placeholder="10-digit account number"
                    value={editTxnForm.accountNumber}
                    onChange={(e) => setEditTxnForm({...editTxnForm, accountNumber: e.target.value})}
                  />
                </div>

                {editTxnForm.type === 'international' && (
                  <>
                    <div className="admin-form-field">
                      <label className="admin-label">IBAN</label>
                      <input 
                        className="admin-input"
                        type="text"
                        placeholder="GB82 WEST 1234 5698 7654 32"
                        value={editTxnForm.iban}
                        onChange={(e) => setEditTxnForm({...editTxnForm, iban: e.target.value})}
                      />
                    </div>

                    <div className="admin-form-field">
                      <label className="admin-label">SWIFT/BIC</label>
                      <input 
                        className="admin-input"
                        type="text"
                        placeholder="e.g. CHASUS33"
                        value={editTxnForm.swift}
                        onChange={(e) => setEditTxnForm({...editTxnForm, swift: e.target.value})}
                      />
                    </div>

                    <div className="admin-form-field">
                      <label className="admin-label">Country</label>
                      <input 
                        className="admin-input"
                        type="text"
                        placeholder="e.g. United States"
                        value={editTxnForm.country}
                        onChange={(e) => setEditTxnForm({...editTxnForm, country: e.target.value})}
                      />
                    </div>
                  </>
                )}

                <div className="admin-form-field admin-form-field--full">
                  <label className="admin-label">Description / Memo</label>
                  <textarea 
                    className="admin-input admin-textarea"
                    rows={3}
                    placeholder="Payment description, reference, or notes..."
                    value={editTxnForm.description}
                    onChange={(e) => setEditTxnForm({...editTxnForm, description: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                className="admin-btn admin-btn--secondary"
                onClick={cancelEditTransaction}
              >
                Cancel
              </button>
              <button
                className="admin-action-btn admin-action-btn--credit"
                disabled={loadingBtn === 'save-edit-txn'}
                onClick={handleSaveEditTransaction}
              >
                {loadingBtn === 'save-edit-txn' ? <span className="admin-btn-spinner" /> : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
