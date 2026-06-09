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
const DELETED_TXNS_KEY = 'deleted_transactions'
const GLOBAL_DELETED_BUCKET = '__global'
const SYNC_PENDING_FIELD = '_syncPending'

const activeListeners = new Map()
const writeQueue = new Map()
const writeTimeouts = new Map()
const MIN_WRITE_INTERVAL = 5000

/** Read the current user's UID from localStorage. */
function getUid() {
  try {
    const u = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    return u.uid || u.id || null
  } catch { return null }
}

function getTxnId(txn) {
  const id = txn?.id ?? txn?.ref
  return id === undefined || id === null ? '' : String(id)
}

function readLocalTransactions() {
  try {
    const txns = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(txns) ? txns : []
  } catch {
    return []
  }
}

function dispatchHistoryEvent(txns) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: HISTORY_KEY,
      newValue: JSON.stringify(txns),
    }))
  } catch {
    // Some older browsers are fussy about constructing StorageEvent.
  }
}

function writeLocalTransactions(txns) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(txns))
    dispatchHistoryEvent(txns)
  } catch { /* silent */ }
}

function readDeletedBuckets() {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_TXNS_KEY) || '{}')
    if (Array.isArray(raw)) {
      return { [GLOBAL_DELETED_BUCKET]: raw.map(String) }
    }
    if (!raw || typeof raw !== 'object') return {}
    return Object.fromEntries(
      Object.entries(raw).map(([uid, ids]) => [
        uid,
        Array.isArray(ids) ? ids.map(String) : [],
      ])
    )
  } catch {
    return {}
  }
}

function getDeletedBucket(uid) {
  return uid ? String(uid) : GLOBAL_DELETED_BUCKET
}

function getDeletedIdsFromStorage(uid) {
  const buckets = readDeletedBuckets()
  const ids = new Set(buckets[GLOBAL_DELETED_BUCKET] || [])
  if (uid) {
    const uidDeletedIds = buckets[String(uid)] || []
    uidDeletedIds.forEach((id) => ids.add(String(id)))
  }
  return ids
}

function storeDeletedIds(uid, ids) {
  try {
    const buckets = readDeletedBuckets()
    buckets[getDeletedBucket(uid)] = Array.from(ids).map(String)
    localStorage.setItem(DELETED_TXNS_KEY, JSON.stringify(buckets))
  } catch { /* silent */ }
}

function stripLocalMetadata(txn) {
  const clean = { ...(txn || {}) }
  delete clean[SYNC_PENDING_FIELD]
  return clean
}

function sortTransactions(txns) {
  return [...txns].sort((a, b) => {
    const at = new Date(a?.date || 0).getTime() || 0
    const bt = new Date(b?.date || 0).getTime() || 0
    return bt - at
  })
}

function pruneDeletedTransactions(txns, deletedIds) {
  return txns.filter((txn) => {
    const id = getTxnId(txn)
    return id && !deletedIds.has(id)
  })
}

function markTransactionSynced(txnId) {
  const id = String(txnId)
  const history = readLocalTransactions()
  let changed = false
  const updated = history.map((txn) => {
    if (getTxnId(txn) !== id || txn[SYNC_PENDING_FIELD] !== true) return txn
    changed = true
    return stripLocalMetadata(txn)
  })
  if (changed) writeLocalTransactions(updated)
}

async function loadDeletedTransactionIds(uid) {
  const localDeletedIds = getDeletedIdsFromStorage(uid)
  if (!uid) return localDeletedIds

  try {
    const snap = await Promise.race([
      getDocs(collection(db, 'profiles', uid, 'deletedTransactions')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ])

    const merged = new Set(localDeletedIds)
    snap.docs.forEach((d) => {
      merged.add(String(d.id))
      const dataId = d.data()?.id
      if (dataId !== undefined && dataId !== null) merged.add(String(dataId))
    })
    storeDeletedIds(uid, merged)
    return merged
  } catch (err) {
    console.warn('[transactionService] Deleted transaction load failed:', err.message)
    return localDeletedIds
  }
}

function backfillPendingLocalTransaction(uid, txn) {
  const id = getTxnId(txn)
  if (!uid || !id || txn[SYNC_PENDING_FIELD] !== true) return

  setDoc(doc(db, 'profiles', uid, 'transactions', id), stripLocalMetadata(txn))
    .then(() => markTransactionSynced(id))
    .catch(() => {})
}

export function rememberDeletedTransaction(txnId, uid = getUid()) {
  const id = String(txnId)
  const deletedIds = getDeletedIdsFromStorage(uid)
  deletedIds.add(id)
  storeDeletedIds(uid, deletedIds)
  removeTransactionFromLocalHistory(id, uid)
}

export function removeTransactionFromLocalHistory(txnId, uid = null) {
  if (uid) {
    const currentUid = getUid()
    if (!currentUid || String(currentUid) !== String(uid)) return
  }

  const id = String(txnId)
  const history = readLocalTransactions()
  const updated = history.filter((txn) => getTxnId(txn) !== id)
  if (updated.length !== history.length) writeLocalTransactions(updated)
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
  const id = getTxnId(txn)
  if (!id) return

  const uid = getUid()
  if (getDeletedIdsFromStorage(uid).has(id)) return

  try {
    const history = readLocalTransactions()
    if (!history.find((t) => getTxnId(t) === id)) {
      history.unshift({ ...txn, [SYNC_PENDING_FIELD]: true })
      writeLocalTransactions(history)
    }
  } catch { /* silent */ }

  // 2. Debounced Firestore write to prevent resource exhaustion
  if (uid) {
    const key = `txn-${uid}-${id}`
    debouncedWrite(key, async () => {
      await setDoc(doc(db, 'profiles', uid, 'transactions', id), stripLocalMetadata(txn))
      markTransactionSynced(id)
      console.log(`[transactionService] Transaction ${id} synced to Firestore`)
    }, MIN_WRITE_INTERVAL)
  }
}

/**
 * Load transactions for a user — merges Firestore + localStorage, deduplicates,
 * sorts newest-first. Falls back to localStorage if Firestore is unavailable.
 */
export async function loadTransactions(uid) {
  let localTxns = readLocalTransactions()
  let deletedIds = getDeletedIdsFromStorage(uid)
  localTxns = pruneDeletedTransactions(localTxns, deletedIds)

  if (!uid) {
    writeLocalTransactions(localTxns)
    return localTxns
  }

  try {
    const q = query(
      collection(db, 'profiles', uid, 'transactions'),
      orderBy('date', 'desc')
    )
    const [snap, remoteDeletedIds] = await Promise.all([
      Promise.race([
        getDocs(q),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]),
      loadDeletedTransactionIds(uid),
    ])
    deletedIds = remoteDeletedIds

    const firestoreTxns = pruneDeletedTransactions(
      snap.docs.map((d) => {
        const data = d.data()
        return { ...data, id: data.id ?? d.id }
      }),
      deletedIds
    )
    localTxns = pruneDeletedTransactions(readLocalTransactions(), deletedIds)

    if (firestoreTxns.length === 0 && localTxns.length === 0) {
      writeLocalTransactions([])
      return []
    }

    const merged = [...firestoreTxns]
    localTxns.forEach((lt) => {
      const id = getTxnId(lt)
      if (!id || merged.find((ft) => getTxnId(ft) === id)) return
      if (lt[SYNC_PENDING_FIELD] === true) {
        merged.push(lt)
        backfillPendingLocalTransaction(uid, lt)
      }
    })

    const sorted = sortTransactions(merged)
    writeLocalTransactions(sorted)

    return sorted
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

  const unsubscribe = onSnapshot(q, async (snap) => {
    const deletedIds = await loadDeletedTransactionIds(uid)
    const firestoreTxns = pruneDeletedTransactions(
      snap.docs.map((d) => {
        const data = d.data()
        return { ...data, id: data.id ?? d.id }
      }),
      deletedIds
    )
    const localTxns = pruneDeletedTransactions(readLocalTransactions(), deletedIds)

    const merged = [...firestoreTxns]
    localTxns.forEach((lt) => {
      const id = getTxnId(lt)
      if (!id || merged.find((ft) => getTxnId(ft) === id)) return
      if (lt[SYNC_PENDING_FIELD] === true) {
        merged.push(lt)
        backfillPendingLocalTransaction(uid, lt)
      }
    })

    const sorted = sortTransactions(merged)
    writeLocalTransactions(sorted)

    if (onUpdate && typeof onUpdate === 'function') {
      onUpdate(sorted)
    }
  }, (err) => {
    console.warn('[transactionService] Real-time listener error:', err.message)
    // Fall back to localStorage on error
    const localTxns = pruneDeletedTransactions(readLocalTransactions(), getDeletedIdsFromStorage(uid))
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
