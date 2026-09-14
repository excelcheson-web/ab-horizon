/**
 * adminService.js
 * Admin panel backend functions for email-based user control.
 * All operations target specific users by UID (found via email lookup).
 */
import { db, adminDb, adminAuth, firestoreCircuitBreaker } from './firebaseClient'
import { rememberDeletedTransaction } from './transactionService'
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

export const DEFAULT_SUSPENSION_MESSAGE = 'Your account has been temporarily restricted due to suspicious activity detected during routine security monitoring. Please contact customer support or visit the nearest branch to verify your account and restore full access.'

function centsFromAmount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}

function dollarsFromCents(cents) {
  return centsFromAmount(cents / 100) / 100
}

function readBalanceCents(data = {}) {
  return Number.isFinite(data.balanceCents)
    ? Math.round(data.balanceCents)
    : centsFromAmount(data.balance ?? 0)
}

function readBalance(data = {}) {
  return dollarsFromCents(readBalanceCents(data))
}

function transactionSign(direction, type) {
  if (direction === 'incoming') return 1
  if (direction === 'outgoing') return -1
  if (['deposit', 'credit', 'incoming', 'loan_disbursement', 'refund', 'payroll'].includes(type)) return 1
  return -1
}

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
  const currentUser = adminAuth.currentUser
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
    const snapshot = await getDocs(collection(adminDb, 'profiles'))
    
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
        balance: readBalance(data),
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
      collection(adminDb, 'profiles'),
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
      balance: readBalance(data),
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
    const snap = await getDoc(doc(adminDb, 'profiles', uid))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      uid: snap.id,
      id: snap.id,
      email: data.email || '',
      name: data.full_name || data.name || 'Unknown',
      full_name: data.full_name || data.name || 'Unknown',
      balance: readBalance(data),
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
  const amountCents = centsFromAmount(amount)
  if (!Number.isFinite(amountCents) || amountCents < 0) throw new Error('Invalid amount')

  const newBalance = await withRetry(async () => runTransaction(adminDb, async (tx) => {
    const userRef = doc(adminDb, 'profiles', uid)
    const userSnap = await tx.get(userRef)

    if (!userSnap.exists()) {
      throw new Error('User not found')
    }

    const currentCents = readBalanceCents(userSnap.data())
    let nextCents

    switch (operation) {
      case 'add':
      case 'credit':
        nextCents = currentCents + amountCents
        break
      case 'subtract':
      case 'debit':
        nextCents = currentCents - amountCents
        break
      case 'set':
        nextCents = amountCents
        break
      default:
        throw new Error('Invalid operation. Use: add, subtract, or set')
    }

    if (nextCents < 0) throw new Error('Insufficient balance')

    const balance = dollarsFromCents(nextCents)
    tx.update(userRef, {
      balance,
      balanceCents: nextCents,
      updatedAt: serverTimestamp(),
    })
    return balance
  }))

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

  const amountCents = centsFromAmount(txnData.amount)
  if (amountCents <= 0) throw new Error('Invalid amount')

  const generatedRef = String(txnData.ref || txnData.id || generateTransactionRef())
  const txnId = String(txnData.id || generatedRef)
  const idempotencyKey = String(txnData.idempotencyKey || generatedRef)

  const txn = {
    id: txnId,
    userId: uid,
    ref: generatedRef,
    type: txnData.type || 'local', // 'local' | 'international' | 'credit' | 'debit'
    direction: txnData.direction || 'incoming', // 'incoming' | 'outgoing'
    beneficiary: txnData.beneficiary || txnData.senderName || 'Unknown',
    senderName: txnData.senderName || txnData.beneficiary || 'Unknown',
    amount: dollarsFromCents(amountCents),
    amountCents,
    date: txnData.date || new Date().toISOString(),
    bankName: txnData.bankName || 'Optima Credit Union',
    description: txnData.description || txnData.memo || '',
    memo: txnData.memo || txnData.description || '',
    accountNumber: txnData.accountNumber || '',
    iban: txnData.iban || '',
    swift: txnData.swift || '',
    country: txnData.country || '',
    status: txnData.status || 'completed',
    createdAt: new Date().toISOString(),
    idempotencyKey,
  }

  const committed = await withRetry(async () => runTransaction(adminDb, async (tx) => {
    const userRef = doc(adminDb, 'profiles', uid)
    const txnRef = doc(adminDb, 'profiles', uid, 'transactions', String(txn.id))
    const requestRef = doc(adminDb, 'profiles', uid, 'ledgerRequests', txn.idempotencyKey)
    const [userSnap, requestSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(requestRef),
    ])

    if (!userSnap.exists()) throw new Error('User not found')

    if (requestSnap.exists()) {
      const existing = requestSnap.data()
      return { ...txn, id: existing.transactionId || txn.id, balanceAfter: dollarsFromCents(existing.balanceAfterCents) }
    }

    const currentCents = readBalanceCents(userSnap.data())
    const nextCents = currentCents + (transactionSign(txn.direction, txn.type) * amountCents)
    if (nextCents < 0) throw new Error('Insufficient balance')

    const balanceAfter = dollarsFromCents(nextCents)
    const balanceBefore = dollarsFromCents(currentCents)
    const committedTxn = {
      ...txn,
      balanceBefore,
      balanceBeforeCents: currentCents,
      balanceAfter,
      balanceAfterCents: nextCents,
      committedAt: serverTimestamp(),
    }

    tx.set(txnRef, committedTxn)
    tx.set(requestRef, {
      id: txn.idempotencyKey,
      userId: uid,
      transactionId: String(txn.id),
      amountCents,
      direction: txn.direction,
      type: txn.type,
      balanceAfterCents: nextCents,
      createdAt: serverTimestamp(),
    })
    tx.update(userRef, {
      balance: balanceAfter,
      balanceCents: nextCents,
      lastTransactionId: String(txn.id),
      updatedAt: serverTimestamp(),
    })

    return committedTxn
  }))

  broadcastToApp(uid, { balance: committed.balanceAfter })
  return committed
}

/**
 * Update an existing transaction.
 */
export async function updateTransaction(uid, txnId, txnData) {
  if (!uid || !txnId) throw new Error('User ID and Transaction ID are required')

  try {
    const updatedTxn = await withRetry(async () => runTransaction(adminDb, async (tx) => {
      const userRef = doc(adminDb, 'profiles', uid)
      const txnRef = doc(adminDb, 'profiles', uid, 'transactions', String(txnId))
      const [userSnap, txnSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(txnRef),
      ])

      if (!userSnap.exists()) throw new Error('User not found')
      if (!txnSnap.exists()) throw new Error('Transaction not found')

      const oldTxn = txnSnap.data()
      const oldAmountCents = Number.isFinite(oldTxn.amountCents)
        ? Math.round(oldTxn.amountCents)
        : centsFromAmount(oldTxn.amount ?? 0)
      const newAmountCents = centsFromAmount(txnData.amount ?? oldTxn.amount ?? 0)
      if (newAmountCents <= 0) throw new Error('Invalid amount')

      const nextTxn = {
        ...oldTxn,
        type: txnData.type || oldTxn.type,
        direction: txnData.direction || oldTxn.direction,
        beneficiary: txnData.beneficiary || oldTxn.beneficiary,
        amount: dollarsFromCents(newAmountCents),
        amountCents: newAmountCents,
        bankName: txnData.bankName || oldTxn.bankName,
        description: txnData.description || oldTxn.description,
        accountNumber: txnData.accountNumber || oldTxn.accountNumber,
        iban: txnData.iban || oldTxn.iban,
        swift: txnData.swift || oldTxn.swift,
        country: txnData.country || oldTxn.country,
        date: txnData.date || oldTxn.date,
        updatedAt: new Date().toISOString(),
      }

      const currentCents = readBalanceCents(userSnap.data())
      const oldEffect = transactionSign(oldTxn.direction, oldTxn.type) * oldAmountCents
      const newEffect = transactionSign(nextTxn.direction, nextTxn.type) * newAmountCents
      const nextBalanceCents = currentCents - oldEffect + newEffect
      if (nextBalanceCents < 0) throw new Error('Insufficient balance after transaction update')

      const balanceAfter = dollarsFromCents(nextBalanceCents)
      tx.update(userRef, {
        balance: balanceAfter,
        balanceCents: nextBalanceCents,
        lastTransactionId: String(txnId),
        updatedAt: serverTimestamp(),
      })
      tx.update(txnRef, {
        ...nextTxn,
        balanceAfter,
        balanceAfterCents: nextBalanceCents,
      })

      return { ...nextTxn, id: txnId, balanceAfter, balanceAfterCents: nextBalanceCents }
    }))

    broadcastToApp(uid, { balance: updatedTxn.balanceAfter })
    return updatedTxn
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
    const newBalance = await withRetry(async () => runTransaction(adminDb, async (tx) => {
      const userRef = doc(adminDb, 'profiles', uid)
      const txnRef = doc(adminDb, 'profiles', uid, 'transactions', String(txnId))
      const tombstoneRef = doc(adminDb, 'profiles', uid, 'deletedTransactions', String(txnId))
      const [userSnap, txnSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(txnRef),
      ])

      if (!userSnap.exists()) throw new Error('User not found')
      if (!txnSnap.exists()) throw new Error('Transaction not found')

      const txn = txnSnap.data()
      const amountCents = Number.isFinite(txn.amountCents)
        ? Math.round(txn.amountCents)
        : centsFromAmount(txn.amount ?? 0)
      const currentCents = readBalanceCents(userSnap.data())
      const nextCents = currentCents - (transactionSign(txn.direction, txn.type) * amountCents)
      if (nextCents < 0) throw new Error('Cannot delete this transaction because it would make the balance negative')

      const balance = dollarsFromCents(nextCents)
      tx.update(userRef, {
        balance,
        balanceCents: nextCents,
        updatedAt: serverTimestamp(),
      })
      tx.delete(txnRef)
      tx.set(tombstoneRef, {
        id: String(txnId),
        deletedAt: new Date().toISOString(),
      })
      return balance
    }))

    rememberDeletedTransaction(txnId, uid)
    broadcastToApp(uid, { balance: newBalance })
    
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
      collection(adminDb, 'profiles', uid, 'transactions'),
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

  const updates = {
    suspended: !!suspended,
    suspendReason: suspended ? (customMessage || DEFAULT_SUSPENSION_MESSAGE) : '',
    suspendedAt: suspended ? new Date().toISOString() : null,
  }
  
  const userRef = doc(adminDb, 'profiles', uid)
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
  
  const userRef = doc(adminDb, 'profiles', uid)
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
    const snap = await getDoc(doc(adminDb, 'profiles', uid))
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

  const userRef = doc(adminDb, 'profiles', uid)
  await withRetry(async () => {
    await updateDoc(userRef, { accountType })
  })
  broadcastToApp(uid, { accountType })
  // Cross-tab: native storage event updates the header label on the user's open tab
  localStorage.setItem('admin_account_type_update', JSON.stringify({ uid, accountType, ts: Date.now() }))
  return { success: true, accountType }
}

/**
 * Update user's profile picture.
 */
export async function updateUserProfilePicture(uid, profilePicUrl) {
  if (!uid) throw new Error('User ID is required')

  const userRef = doc(adminDb, 'profiles', uid)
  await withRetry(async () => {
    await updateDoc(userRef, { profilePic: profilePicUrl })
  })
  broadcastToApp(uid, { profilePic: profilePicUrl })
  // Cross-tab real-time sync: native storage event fires in the user's open tab
  localStorage.setItem('admin_profile_pic_update', JSON.stringify({ uid, url: profilePicUrl, ts: Date.now() }))
  return { success: true, profilePic: profilePicUrl }
}

// ── App-Side Balance Sync (for deposits, transfers, etc.) ───────────────────

/**
 * Sync an exact balance adjustment for legacy callers.
 * New money movement should use createTransaction so the transaction record and
 * profile balance are committed together.
 */
export async function syncBalanceToFirestore(uid, newBalance) {
  if (!uid) return null

  const balanceCents = centsFromAmount(newBalance)
  const balance = dollarsFromCents(balanceCents)

  await withRetry(async () => {
    await updateDoc(doc(db, 'profiles', uid), {
      balance,
      balanceCents,
      updatedAt: serverTimestamp(),
    })
  })

  broadcastToApp(uid, { balance })
  return balance
}

/**
 * Check if a user's account is suspended from Firestore.
 * This is used by transfer components to enforce suspension across all devices.
 * @param {string} uid - User ID
 * @returns {Promise<{suspended: boolean, reason: string}>}
 */
export async function checkUserSuspensionStatus(uid) {
  if (!uid) return { suspended: false, reason: '' }

  // Circuit breaker open — fall back to localStorage (can't reach Firestore)
  if (!firestoreCircuitBreaker.canOperate()) {
    try {
      const admin = JSON.parse(localStorage.getItem('securebank_admin') || '{}')
      return { suspended: admin.suspended || false, reason: admin.suspendReason || '' }
    } catch {
      return { suspended: false, reason: '' }
    }
  }

  try {
    const userSnap = await getDoc(doc(db, 'profiles', uid))
    if (!userSnap.exists()) return { suspended: false, reason: '' }

    const data = userSnap.data()
    const isSuspended = data.suspended === true
    const reason = isSuspended ? (data.suspendReason || '') : ''

    // Always sync localStorage so unsuspend is reflected immediately next time
    localStorage.setItem('securebank_admin', JSON.stringify({
      suspended: isSuspended,
      suspendReason: reason,
    }))

    return { suspended: isSuspended, reason }
  } catch (err) {
    console.error('[adminService] checkUserSuspensionStatus failed:', err.message)
    // Firestore unavailable — use localStorage as last resort
    try {
      const admin = JSON.parse(localStorage.getItem('securebank_admin') || '{}')
      return { suspended: admin.suspended || false, reason: admin.suspendReason || '' }
    } catch {
      return { suspended: false, reason: '' }
    }
  }
}
