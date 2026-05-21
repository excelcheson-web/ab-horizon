/**
 * transactionService.js
 * Centralised transaction persistence — writes to localStorage (immediate)
 * AND Firestore subcollection profiles/{uid}/transactions/{id} (cross-device sync).
 * 
 * DEBOUNCED WRITES: All Firestore writes are batched with a 5-second delay
 * to prevent "Write stream exhausted maximum allowed queued writes" errors.
 */
import { db } from './firebaseClient'
import { doc, setDoc, collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore'

const HISTORY_KEY = 'transfer_history'

// Store active listeners for cleanup
const activeListeners = new Map()

// Debounced write queue for Firestore operations
const writeQueue = new Map()
const writeTimeouts = new Map()
const MIN_WRITE_INTERVAL = 5000 // 5 seconds between writes to same doc

/** Read the current user's UID from localStorage. */
function getUid() {
  try {
    const u = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    return u.uid || u.id || null
  } catch { return null }
}

/**
 * Debounced Firestore write to prevent resource exhaustion.
 * Batches writes to the same document with a 5-second delay.
 */
function debouncedWrite(key, operation, delay = 5000) {
  // Clear existing timeout for this key
  if (writeTimeouts.has(key)) {
    clearTimeout(writeTimeouts.get(key))
  }

  // Store the operation
  writeQueue.set(key, operation)

  // Set new timeout
  const timeoutId = setTimeout(async () => {
    const op = writeQueue.get(key)
    if (!op) return

    writeQueue.delete(key)
    writeTimeouts.delete(key)

    try {
      await op()
      console.log(`[transactionService] Debounced write completed for ${key}`)
    } catch (err) {
      console.warn(`[transactionService] Debounced write failed for ${key}:`, err.message)
      // Don't retry - let next operation handle it
    }
  }, delay)

  writeTimeouts.set(key, timeoutId)
}

/**
 * Save a transaction to localStorage immediately, Firestore debounced.
 * Call this instead of directly writing to localStorage in each component.
 */
export function saveTransaction(txn) {
  // 1. Write to localStorage immediately (always works, even offline)
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    if (!history.find((t) => t.id === txn.id)) {
      history.unshift(txn)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }
  } catch { /* silent */ }

  // 2. Debounced Firestore write to prevent resource exhaustion
  const uid = getUid()
  if (uid) {
    const key = `txn-${uid}-${txn.id}`
    debouncedWrite(key, async () => {
      await setDoc(doc(db, 'profiles', uid, 'transactions', String(txn.id)), txn)
      console.log(`[transactionService] Transaction ${txn.id} synced to Firestore`)
    }, MIN_WRITE_INTERVAL)
  }
}

/**
 * Load transactions for a user — merges Firestore + localStorage, deduplicates,
 * sorts newest-first. Falls back to localStorage if Firestore is unavailable.
 */
export async function loadTransactions(uid) {
  // Always start with localStorage as the baseline
  let localTxns = []
  try {
    localTxns = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch { /* silent */ }

  if (!uid) return localTxns

  try {
    const q = query(
      collection(db, 'profiles', uid, 'transactions'),
      orderBy('date', 'desc')
    )
    const snap = await Promise.race([
      getDocs(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ])
    const firestoreTxns = snap.docs.map((d) => d.data())

    if (firestoreTxns.length === 0 && localTxns.length === 0) return []

    // Merge: start with Firestore, add any local-only txns not yet synced
    const merged = [...firestoreTxns]
    localTxns.forEach((lt) => {
      if (!merged.find((ft) => String(ft.id) === String(lt.id))) {
        merged.push(lt)
        // Back-fill this local-only txn to Firestore (fire-and-forget)
        setDoc(doc(db, 'profiles', uid, 'transactions', String(lt.id)), lt)
          .catch(() => {})
      }
    })

    // Sort newest first
    merged.sort((a, b) => new Date(b.date) - new Date(a.date))

    // Update localStorage with the merged result so it's available offline
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(merged)) } catch { /* silent */ }

    return merged
  } catch (err) {
    console.warn('[transactionService] Firestore load failed, using localStorage:', err.message)
    return localTxns
  }
}

/**
 * Subscribe to real-time transaction updates from Firestore.
 * Automatically syncs new transactions to localStorage.
 * @param {string} uid - User ID
 * @param {function} onUpdate - Callback function called with updated transactions array
 * @returns {function} Unsubscribe function
 */
export function subscribeToTransactions(uid, onUpdate) {
  if (!uid) {
    console.warn('[transactionService] Cannot subscribe without UID')
    return () => {}
  }

  // Clean up any existing listener for this UID
  if (activeListeners.has(uid)) {
    activeListeners.get(uid)()
    activeListeners.delete(uid)
  }

  const q = query(
    collection(db, 'profiles', uid, 'transactions'),
    orderBy('date', 'desc')
  )

  const unsubscribe = onSnapshot(q, (snap) => {
    const firestoreTxns = snap.docs.map((d) => ({
      ...d.data(),
      id: d.id, // Ensure ID is set
    }))

    // Get local transactions
    let localTxns = []
    try {
      localTxns = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    } catch { /* silent */ }

    // Merge: Firestore takes precedence, add local-only txns
    const merged = [...firestoreTxns]
    localTxns.forEach((lt) => {
      if (!merged.find((ft) => String(ft.id) === String(lt.id))) {
        merged.push(lt)
        // Back-fill to Firestore
        setDoc(doc(db, 'profiles', uid, 'transactions', String(lt.id)), lt)
          .catch(() => {})
      }
    })

    // Sort newest first
    merged.sort((a, b) => new Date(b.date) - new Date(a.date))

    // Update localStorage with merged result
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(merged))
    } catch { /* silent */ }

    // Notify callback
    if (onUpdate && typeof onUpdate === 'function') {
      onUpdate(merged)
    }

    // Broadcast event for other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: HISTORY_KEY,
      newValue: JSON.stringify(merged),
    }))
  }, (err) => {
    console.warn('[transactionService] Real-time listener error:', err.message)
    // Fall back to localStorage on error
    let localTxns = []
    try {
      localTxns = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    } catch { /* silent */ }
    if (onUpdate && typeof onUpdate === 'function') {
      onUpdate(localTxns)
    }
  })

  // Store unsubscribe function
  activeListeners.set(uid, unsubscribe)

  return unsubscribe
}

/**
 * Unsubscribe from real-time transaction updates.
 * @param {string} uid - User ID
 */
export function unsubscribeFromTransactions(uid) {
  if (activeListeners.has(uid)) {
    activeListeners.get(uid)()
    activeListeners.delete(uid)
  }
}

/**
 * Unsubscribe all active listeners.
 */
export function unsubscribeAll() {
  activeListeners.forEach((unsubscribe) => unsubscribe())
  activeListeners.clear()
}
