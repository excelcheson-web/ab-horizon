/**
 * adminService.js
 * Admin panel backend functions for email-based user control.
 * All operations target specific users by UID (found via email lookup).
 */
import { db, firestoreCircuitBreaker } from './firebaseClient'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
} from 'firebase/firestore'

// ── Helper: Broadcast changes to localStorage for app sync ────────────────────
function broadcastToApp(uid, data) {
  try {
    // Update securebank_user if this is the current user
    const stored = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    if (stored.uid === uid || stored.id === uid) {
      const updated = { ...stored, ...data }
      localStorage.setItem('securebank_user', JSON.stringify(updated))
      
      // Broadcast specific fields
      if (data.balance !== undefined) {
        localStorage.setItem('bank_balance', String(data.balance))
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'bank_balance',
          newValue: String(data.balance),
        }))
      }
      
      if (data.profilePic !== undefined) {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'user_profile_pic',
          newValue: data.profilePic,
        }))
      }
      
      if (data.accountType !== undefined) {
        localStorage.setItem('user_account_type', data.accountType)
      }
      
      if (data.suspended !== undefined) {
        localStorage.setItem('securebank_admin', JSON.stringify({
          suspended: data.suspended,
          suspendReason: data.suspendReason || '',
        }))
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'securebank_admin',
          newValue: JSON.stringify({
            suspended: data.suspended,
            suspendReason: data.suspendReason || '',
          }),
        }))
      }
      
      // General update event
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'securebank_user',
        newValue: JSON.stringify(updated),
      }))
    }
  } catch (err) {
    console.warn('[adminService] broadcastToApp failed:', err.message)
  }
}

// ── Helper: Debounced Firestore Write Queue ─────────────────────────────────
const writeQueue = new Map()
const writeTimeouts = new Map()
const lastWriteTime = new Map()
const writeFailureCount = new Map()
const MIN_WRITE_INTERVAL = 30000 // 30 seconds between writes to same key
const MAX_FAILURES = 3
const CIRCUIT_BREAKER_TIMEOUT = 300000 // 5 minutes

function debouncedWrite(key, operation, delay = 30000) {
  // Check circuit breaker - if too many failures, skip writing
  const failures = writeFailureCount.get(key) || 0
  if (failures >= MAX_FAILURES) {
    const lastFailure = lastWriteTime.get(key) || 0
    if (Date.now() - lastFailure < CIRCUIT_BREAKER_TIMEOUT) {
      console.warn(`[adminService] Circuit breaker active for ${key}, skipping write`)
      return
    } else {
      // Reset failure count after timeout
      writeFailureCount.set(key, 0)
    }
  }
  
  // Check if we recently wrote to this key
  const now = Date.now()
  const lastWrite = lastWriteTime.get(key) || 0
  const timeSinceLastWrite = now - lastWrite
  
  // If we wrote recently, extend the delay
  const actualDelay = timeSinceLastWrite < MIN_WRITE_INTERVAL ? MIN_WRITE_INTERVAL : delay
  
  // Clear existing timeout for this key
  if (writeTimeouts.has(key)) {
    clearTimeout(writeTimeouts.get(key))
  }
  
  // Store the latest operation
  writeQueue.set(key, operation)
  
  // Set new timeout
  const timeoutId = setTimeout(async () => {
    const op = writeQueue.get(key)
    if (op) {
      try {
        await op()
        lastWriteTime.set(key, Date.now())
        writeFailureCount.set(key, 0) // Reset failures on success
        writeQueue.delete(key)
      } catch (err) {
        console.warn(`[adminService] Debounced write failed for ${key}:`, err.message)
        // Increment failure count
        writeFailureCount.set(key, (writeFailureCount.get(key) || 0) + 1)
        // Don't retry immediately - let the next debounce handle it
      }
    }
    writeTimeouts.delete(key)
  }, actualDelay)
  
  writeTimeouts.set(key, timeoutId)
}

// ── Helper: Retry Firestore operation ────────────────────────────────────────
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (err) {
      console.warn(`[adminService] Attempt ${attempt} failed:`, err.message)
      if (attempt === maxRetries) throw err
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
}

// ── User Management ───────────────────────────────────────────────────────────

/**
 * Fetch all users from Firestore profiles collection.
 * Returns array of user objects with uid, email, name, balance, etc.
 * @param {Object} options - Options object
 * @param {boolean} options.force - If true, bypass circuit breaker (for admin panel)
 */
export async function fetchAllUsers(options = {}) {
  const { force = false } = options
  
  // Check if user is authenticated
  const { auth } = await import('./firebaseClient')
  const currentUser = auth.currentUser
  console.log('[adminService] Current user:', currentUser ? currentUser.uid : 'NOT LOGGED IN')
  
  if (!currentUser) {
    throw new Error('You must be logged in to view users. Please log in first.')
  }
  
  // Check global circuit breaker first (unless force is true)
  if (!force && !firestoreCircuitBreaker.canOperate()) {
    console.warn('[adminService] Global circuit breaker OPEN - skipping fetchAllUsers')
    throw new Error('Circuit breaker is open - too many Firestore errors. Please wait 10 minutes and try again.')
  }
  
  try {
    console.log('[adminService] Fetching all users from Firestore...', { uid: currentUser.uid })
    const snapshot = await getDocs(collection(db, 'profiles'))
    
    console.log(`[adminService] Fetched ${snapshot.docs.length} users`)
    
    // Reset circuit breaker on success
    firestoreCircuitBreaker.failureCount = 0
    firestoreCircuitBreaker.isOpen = false
    
    const users = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        uid: d.id,
        id: d.id,
        email: data.email || '',
        name: data.full_name || data.name || 'Unknown',
        full_name: data.full_name || data.name || 'Unknown',
        balance: data.balance ?? 0,
        savingsVault: data.savingsVault || 0,
        accountType: data.accountType || 'Savings Account',
        accountNumber: data.accountNumber || '',
        suspended: data.suspended || false,
        suspendReason: data.suspendReason || '',
        featureFlags: data.featureFlags || getDefaultFeatureFlags(),
        profilePic: data.profilePic || '',
        createdAt: data.createdAt || null,
      }
    })
    
    console.log('[adminService] Processed users:', users.length)
    return users
  } catch (err) {
    console.error('[adminService] fetchAllUsers error:', err.code, err.message)
    
    // Record failure in global circuit breaker
    if (err.code === 'resource-exhausted') {
      firestoreCircuitBreaker.recordFailure('resource-exhausted')
      throw new Error('Firestore quota exceeded. Please wait a few minutes and try again.')
    }
    
    if (err.code === 'permission-denied') {
      throw new Error('Permission denied. Please ensure you are logged in and Firestore rules allow reading profiles.')
    }
    
    // Re-throw other errors so they can be shown to the user
    throw new Error('Failed to load users: ' + err.message)
  }
}

/**
 * Find a user by their email address.
 * Returns user object or null if not found.
 */
export async function getUserByEmail(email) {
  if (!email) return null
  try {
    // Firestore doesn't support direct 'get by email' efficiently,
    // so we query with a filter
    const q = query(
      collection(db, 'profiles'),
      where('email', '==', email.toLowerCase().trim())
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    
    const doc = snapshot.docs[0]
    const data = doc.data()
    return {
      uid: doc.id,
      id: doc.id,
      email: data.email || '',
      name: data.full_name || data.name || 'Unknown',
      full_name: data.full_name || data.name || 'Unknown',
      balance: data.balance ?? 0,
      savingsVault: data.savingsVault || 0,
      accountType: data.accountType || 'Savings Account',
      accountNumber: data.accountNumber || '',
      suspended: data.suspended || false,
      suspendReason: data.suspendReason || '',
      featureFlags: data.featureFlags || getDefaultFeatureFlags(),
      profilePic: data.profilePic || '',
      createdAt: data.createdAt || null,
    }
  } catch (err) {
    console.error('[adminService] getUserByEmail error:', err.message)
    throw new Error('Failed to find user: ' + err.message)
  }
}

/**
 * Get a single user by UID.
 */
export async function getUserById(uid) {
  if (!uid) return null
  try {
    const snap = await getDoc(doc(db, 'profiles', uid))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      uid: snap.id,
      id: snap.id,
      email: data.email || '',
      name: data.full_name || data.name || 'Unknown',
      full_name: data.full_name || data.name || 'Unknown',
      balance: data.balance ?? 0,
      savingsVault: data.savingsVault || 0,
      accountType: data.accountType || 'Savings Account',
      accountNumber: data.accountNumber || '',
      suspended: data.suspended || false,
      suspendReason: data.suspendReason || '',
      featureFlags: data.featureFlags || getDefaultFeatureFlags(),
      profilePic: data.profilePic || '',
      createdAt: data.createdAt || null,
    }
  } catch (err) {
    console.error('[adminService] getUserById error:', err.message)
    throw new Error('Failed to fetch user: ' + err.message)
  }
}

// ── Balance Management ─────────────────────────────────────────────────────────

/**
 * Update a user's balance.
 * operation: 'add' | 'subtract' | 'set'
 * Returns the new balance.
 */
export async function updateUserBalance(uid, amount, operation = 'add') {
  if (!uid) throw new Error('User ID is required')
  const amt = parseFloat(amount)
  if (isNaN(amt) || amt < 0) throw new Error('Invalid amount')

  const userRef = doc(db, 'profiles', uid)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    throw new Error('User not found')
  }

  const currentBalance = userSnap.data().balance ?? 0
  let newBalance

  switch (operation) {
    case 'add':
    case 'credit':
      newBalance = currentBalance + amt
      break
    case 'subtract':
    case 'debit':
      newBalance = Math.max(0, currentBalance - amt)
      break
    case 'set':
      newBalance = amt
      break
    default:
      throw new Error('Invalid operation. Use: add, subtract, or set')
  }

  await withRetry(async () => {
    await updateDoc(userRef, { balance: newBalance })
  })
  broadcastToApp(uid, { balance: newBalance })
  return newBalance
}

// ── Transaction Management ───────────────────────────────────────────────────

/**
 * Generate a unique transaction reference.
 */
export function generateTransactionRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'TXN-'
  for (let i = 0; i < 12; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

/**
 * Create a new transaction for a user.
 * txnData should include: type, beneficiary, amount, bankName, description, etc.
 */
export async function createTransaction(uid, txnData) {
  if (!uid) throw new Error('User ID is required')
  
  const txn = {
    id: txnData.id || Date.now() + Math.floor(Math.random() * 999999),
    ref: txnData.ref || generateTransactionRef(),
    type: txnData.type || 'local', // 'local' | 'international' | 'credit' | 'debit'
    direction: txnData.direction || 'incoming', // 'incoming' | 'outgoing'
    beneficiary: txnData.beneficiary || txnData.senderName || 'Unknown',
    senderName: txnData.senderName || txnData.beneficiary || 'Unknown',
    amount: parseFloat(txnData.amount) || 0,
    date: txnData.date || new Date().toISOString(),
    bankName: txnData.bankName || '[BANK NAME]',
    description: txnData.description || txnData.memo || '',
    memo: txnData.memo || txnData.description || '',
    accountNumber: txnData.accountNumber || '',
    iban: txnData.iban || '',
    swift: txnData.swift || '',
    country: txnData.country || '',
    status: txnData.status || 'completed',
    createdAt: new Date().toISOString(),
  }

  // Save transaction immediately (no debounce needed for this)
  await withRetry(async () => {
    await setDoc(
      doc(db, 'profiles', uid, 'transactions', String(txn.id)),
      txn
    )
  })

  // Update user's balance based on transaction direction (debounced)
  const userRef = doc(db, 'profiles', uid)
  const userSnap = await getDoc(userRef)
  let newBalance = null
  
  if (userSnap.exists()) {
    const currentBalance = userSnap.data().balance ?? 0
    newBalance = currentBalance
    
    if (txn.direction === 'incoming' || txn.type === 'credit') {
      newBalance = currentBalance + txn.amount
    } else if (txn.direction === 'outgoing' || txn.type === 'debit') {
      newBalance = Math.max(0, currentBalance - txn.amount)
    }
    
    try {
      await withRetry(async () => {
        await updateDoc(userRef, { balance: newBalance })
      })
    } catch (err) {
      console.error('[adminService] createTransaction balance update failed:', err.message)
    }
    broadcastToApp(uid, { balance: newBalance })
  }

  return txn
}

/**
 * Update an existing transaction.
 */
export async function updateTransaction(uid, txnId, txnData) {
  if (!uid || !txnId) throw new Error('User ID and Transaction ID are required')

  try {
    const txnRef = doc(db, 'profiles', uid, 'transactions', String(txnId))
    const txnSnap = await getDoc(txnRef)
    
    if (!txnSnap.exists()) {
      throw new Error('Transaction not found')
    }

    const oldTxn = txnSnap.data()
    const oldAmount = oldTxn.amount
    const oldDirection = oldTxn.direction || oldTxn.type
    
    // Build updated transaction
    const updatedTxn = {
      ...oldTxn,
      type: txnData.type || oldTxn.type,
      direction: txnData.direction || oldTxn.direction,
      beneficiary: txnData.beneficiary || oldTxn.beneficiary,
      amount: parseFloat(txnData.amount) || oldTxn.amount,
      bankName: txnData.bankName || oldTxn.bankName,
      description: txnData.description || oldTxn.description,
      accountNumber: txnData.accountNumber || oldTxn.accountNumber,
      iban: txnData.iban || oldTxn.iban,
      swift: txnData.swift || oldTxn.swift,
      country: txnData.country || oldTxn.country,
      date: txnData.date || oldTxn.date,
      updatedAt: new Date().toISOString(),
    }

    // Calculate balance adjustment
    const userRef = doc(db, 'profiles', uid)
    const userSnap = await getDoc(userRef)
    let newBalance = null
    
    if (userSnap.exists()) {
      const currentBalance = userSnap.data().balance ?? 0
      newBalance = currentBalance
      
      // Reverse old transaction effect
      if (oldDirection === 'incoming' || oldTxn.type === 'credit') {
        newBalance = Math.max(0, currentBalance - oldAmount)
      } else if (oldDirection === 'outgoing' || oldTxn.type === 'debit') {
        newBalance = currentBalance + oldAmount
      }
      
      // Apply new transaction effect
      if (updatedTxn.direction === 'incoming' || updatedTxn.type === 'credit') {
        newBalance = newBalance + updatedTxn.amount
      } else if (updatedTxn.direction === 'outgoing' || updatedTxn.type === 'debit') {
        newBalance = Math.max(0, newBalance - updatedTxn.amount)
      }
      
      await withRetry(async () => {
        await updateDoc(userRef, { balance: newBalance })
      })
      broadcastToApp(uid, { balance: newBalance })
    }

    await withRetry(async () => {
      await updateDoc(txnRef, updatedTxn)
    })
    
    return { ...updatedTxn, id: txnId }
  } catch (err) {
    console.error('[adminService] updateTransaction error:', err.message)
    throw new Error('Failed to update transaction: ' + err.message)
  }
}

/**
 * Delete a transaction and adjust the user's balance accordingly.
 */
export async function deleteTransaction(uid, txnId) {
  if (!uid || !txnId) throw new Error('User ID and Transaction ID are required')

  try {
    // Get the transaction first to know the amount/direction
    const txnRef = doc(db, 'profiles', uid, 'transactions', String(txnId))
    const txnSnap = await getDoc(txnRef)
    
    if (!txnSnap.exists()) {
      throw new Error('Transaction not found')
    }

    const txn = txnSnap.data()
    
    // Adjust balance (reverse the transaction)
    const userRef = doc(db, 'profiles', uid)
    const userSnap = await getDoc(userRef)
    let newBalance = null
    
    if (userSnap.exists()) {
      const currentBalance = userSnap.data().balance ?? 0
      newBalance = currentBalance
      
      if (txn.direction === 'incoming' || txn.type === 'credit') {
        // Reverse a credit by subtracting
        newBalance = Math.max(0, currentBalance - txn.amount)
      } else if (txn.direction === 'outgoing' || txn.type === 'debit') {
        // Reverse a debit by adding back
        newBalance = currentBalance + txn.amount
      }
      
      await withRetry(async () => {
        await updateDoc(userRef, { balance: newBalance })
      })
      broadcastToApp(uid, { balance: newBalance })
    }

    // Delete the transaction (no debounce needed for this)
    await withRetry(async () => {
      await deleteDoc(txnRef)
    })
    
    return { success: true, message: 'Transaction deleted and balance adjusted' }
  } catch (err) {
    console.error('[adminService] deleteTransaction error:', err.message)
    throw new Error('Failed to delete transaction: ' + err.message)
  }
}

/**
 * Get all transactions for a specific user.
 */
export async function getUserTransactions(uid) {
  if (!uid) return []
  
  try {
    const q = query(
      collection(db, 'profiles', uid, 'transactions'),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error('[adminService] getUserTransactions error:', err.message)
    return []
  }
}

// ── Account Suspension ───────────────────────────────────────────────────────

/**
 * Toggle account suspension status with custom message.
 * suspended: boolean
 * customMessage: the warning message shown to user (optional)
 */
export async function toggleUserSuspension(uid, suspended, customMessage = '') {
  if (!uid) throw new Error('User ID is required')

  const defaultMessage = 'Your account has been temporarily restricted from this account due to suspicious activity detected during routine security monitoring. Please contact customer support or visit the nearest branch to verify your account and restore full access.'

  const updates = {
    suspended: !!suspended,
    suspendReason: suspended ? (customMessage || defaultMessage) : '',
    suspendedAt: suspended ? new Date().toISOString() : null,
  }
  
  const userRef = doc(db, 'profiles', uid)
  await withRetry(async () => {
    await updateDoc(userRef, updates)
  })
  broadcastToApp(uid, { suspended: updates.suspended, suspendReason: updates.suspendReason })
  return { suspended: updates.suspended, message: updates.suspendReason }
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

/**
 * Get default feature flags (all enabled by default).
 */
export function getDefaultFeatureFlags() {
  return {
    enableTransfers: true,
    enableDeposits: true,
    enableInvestments: true,
    enableBillPay: true,
    enableScheduled: true,
    enableCrypto: true,
    enableLocalTransfer: true,
    enableInternationalTransfer: true,
  }
}

/**
 * Update feature flags for a user.
 * flags: object with boolean values for each feature.
 */
export async function updateFeatureFlags(uid, flags) {
  if (!uid) throw new Error('User ID is required')

  const currentFlags = getDefaultFeatureFlags()
  const newFlags = { ...currentFlags, ...flags }
  
  const userRef = doc(db, 'profiles', uid)
  await withRetry(async () => {
    await updateDoc(userRef, { featureFlags: newFlags })
  })
  try {
    const stored = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    if (stored.uid === uid) {
      stored.featureFlags = newFlags
      localStorage.setItem('securebank_user', JSON.stringify(stored))
      localStorage.setItem('user_feature_flags', JSON.stringify(newFlags))
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'user_feature_flags',
        newValue: JSON.stringify(newFlags),
      }))
    }
  } catch { /* silent */ }
  return newFlags
}

/**
 * Get feature flags for a user.
 */
export async function getUserFeatureFlags(uid) {
  if (!uid) return getDefaultFeatureFlags()
  
  try {
    const snap = await getDoc(doc(db, 'profiles', uid))
    if (!snap.exists()) return getDefaultFeatureFlags()
    return { ...getDefaultFeatureFlags(), ...(snap.data().featureFlags || {}) }
  } catch (err) {
    console.error('[adminService] getUserFeatureFlags error:', err.message)
    return getDefaultFeatureFlags()
  }
}

// ── Account Type & Profile Updates ───────────────────────────────────────────

/**
 * Update user's account type.
 */
export async function updateUserAccountType(uid, accountType) {
  if (!uid) throw new Error('User ID is required')

  const userRef = doc(db, 'profiles', uid)
  await withRetry(async () => {
    await updateDoc(userRef, { accountType })
  })
  broadcastToApp(uid, { accountType })
  return { success: true, accountType }
}

/**
 * Update user's profile picture.
 */
export async function updateUserProfilePicture(uid, profilePicUrl) {
  if (!uid) throw new Error('User ID is required')

  const userRef = doc(db, 'profiles', uid)
  await withRetry(async () => {
    await updateDoc(userRef, { profilePic: profilePicUrl })
  })
  broadcastToApp(uid, { profilePic: profilePicUrl })
  return { success: true, profilePic: profilePicUrl }
}

// ── App-Side Balance Sync (for deposits, transfers, etc.) ───────────────────

/**
 * Sync balance update from Firestore to localStorage only.
 * Firestore writes are DISABLED to prevent resource-exhausted errors.
 * All data persistence is now handled through localStorage.
 */
export function syncBalanceToFirestore(uid, newBalance) {
  if (!uid) {
    console.warn('[adminService] Cannot sync balance without UID')
    return
  }
  
  // ONLY update localStorage - Firestore writes are disabled to prevent quota exhaustion
  broadcastToApp(uid, { balance: newBalance })
  
  // Log that we're skipping Firestore to help with debugging
  console.log(`[adminService] Balance ${newBalance} saved to localStorage only (Firestore writes disabled)`)
  
  // NOTE: Firestore writes are intentionally disabled to prevent resource-exhausted errors.
  // The app now uses localStorage as the primary data store.
  // If you need to sync to Firestore, use the admin panel which has proper rate limiting.
}

/**
 * Check if a user's account is suspended from Firestore.
 * This is used by transfer components to enforce suspension across all devices.
 * @param {string} uid - User ID
 * @returns {Promise<{suspended: boolean, reason: string}>}
 */
export async function checkUserSuspensionStatus(uid) {
  if (!uid) {
    return { suspended: false, reason: '' }
  }
  
  // First check localStorage (fast path)
  try {
    const admin = JSON.parse(localStorage.getItem('securebank_admin') || '{}')
    if (admin.suspended) {
      return { suspended: true, reason: admin.suspendReason || 'Your account has been temporarily restricted.' }
    }
  } catch { /* ignore */ }
  
  // Check global circuit breaker
  if (!firestoreCircuitBreaker.canOperate()) {
    console.warn('[adminService] Circuit breaker open - using localStorage for suspension check')
    return { suspended: false, reason: '' }
  }
  
  try {
    const userRef = doc(db, 'profiles', uid)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return { suspended: false, reason: '' }
    }
    
    const data = userSnap.data()
    const isSuspended = data.suspended === true
    
    // Update localStorage with latest status for offline use
    if (isSuspended) {
      localStorage.setItem('securebank_admin', JSON.stringify({
        suspended: true,
        suspendReason: data.suspendReason || 'Your account has been temporarily restricted.'
      }))
    }
    
    return { 
      suspended: isSuspended, 
      reason: data.suspendReason || 'Your account has been temporarily restricted.' 
    }
  } catch (err) {
    console.error('[adminService] checkUserSuspensionStatus failed:', err.message)
    // On error, fall back to localStorage
    try {
      const admin = JSON.parse(localStorage.getItem('securebank_admin') || '{}')
      return { 
        suspended: admin.suspended || false, 
        reason: admin.suspendReason || 'Your account has been temporarily restricted.' 
      }
    } catch {
      return { suspended: false, reason: '' }
    }
  }
}
