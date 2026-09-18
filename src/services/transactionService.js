import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db } from './firebaseClient'
import {
  commitAccountMutation,
  getCurrentUserUid,
  getTransactionsQuery,
  inferDirection,
  loadTransferAccount,
} from './accountLedger'
import { parseAmountCents } from './money'

const HISTORY_KEY = 'transfer_history'
const DELETED_TXNS_KEY = 'deleted_transactions'
const GLOBAL_DELETED_BUCKET = '__global'

const activeListeners = new Map()
const SERVER_TRANSFER_TYPES = new Set(['local', 'international'])

export function getTransactionHistoryKey(uid = getCurrentUserUid()) {
  return uid ? `${HISTORY_KEY}:${uid}` : HISTORY_KEY
}

function getTxnId(txn) {
  const id = txn?.id ?? txn?.ref
  return id === undefined || id === null ? '' : String(id)
}

function parseStoredTransactions(key) {
  try {
    const txns = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(txns) ? txns : []
  } catch {
    return []
  }
}

function getTxnOwner(txn) {
  return txn?.userId || txn?.uid || txn?.ownerUid || ''
}

function belongsToUser(txn, uid) {
  const owner = getTxnOwner(txn)
  return !owner || String(owner) === String(uid)
}

function readLegacyTransactions(uid) {
  if (!uid) return []
  return parseStoredTransactions(HISTORY_KEY).filter((txn) => {
    const owner = getTxnOwner(txn)
    return owner && String(owner) === String(uid)
  })
}

function withTxnOwner(txns, uid) {
  return uid
    ? txns.map((txn) => ({ ...txn, userId: txn.userId || uid }))
    : txns
}

function readLocalTransactions(uid = getCurrentUserUid()) {
  if (!uid) return []

  const scopedKey = getTransactionHistoryKey(uid)
  const scopedTxns = parseStoredTransactions(scopedKey).filter((txn) => belongsToUser(txn, uid))
  if (scopedTxns.length > 0) return scopedTxns

  const legacyTxns = readLegacyTransactions(uid)
  if (legacyTxns.length > 0) writeLocalTransactions(legacyTxns, uid)
  return legacyTxns
}

export function readCachedTransactions(uid = getCurrentUserUid()) {
  return readLocalTransactions(uid)
}

function dispatchHistoryEvent(txns, uid) {
  if (typeof window === 'undefined') return
  const key = getTransactionHistoryKey(uid)
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key,
      newValue: JSON.stringify(txns),
    }))
  } catch {
    window.dispatchEvent(new CustomEvent('transfer-history-updated', {
      detail: { uid, txns },
    }))
  }
  window.dispatchEvent(new CustomEvent('transfer-history-updated', {
    detail: { uid, txns },
  }))
}

function writeLocalTransactions(txns, uid = getCurrentUserUid()) {
  if (!uid) return

  const ownedTxns = withTxnOwner(txns, uid)
  try {
    localStorage.setItem(getTransactionHistoryKey(uid), JSON.stringify(ownedTxns))
    dispatchHistoryEvent(ownedTxns, uid)
  } catch (err) {
    console.warn('[transactionService] local cache write failed:', err.message)
  }
}

function sortTransactions(txns) {
  return [...txns].sort((a, b) => {
    const at = new Date(a?.date || 0).getTime() || 0
    const bt = new Date(b?.date || 0).getTime() || 0
    return bt - at
  })
}

function upsertLocalTransaction(txn, uid = getCurrentUserUid()) {
  const id = getTxnId(txn)
  if (!id || !uid) return

  const history = readLocalTransactions(uid)
  const filtered = history.filter((item) => getTxnId(item) !== id)
  writeLocalTransactions(sortTransactions([{ ...txn, id, userId: txn.userId || uid }, ...filtered]), uid)
}

function isServerCommitError(err) {
  const message = String(err?.message || '').toLowerCase()
  return err?.code === 'permission-denied' ||
    err?.code === 'unavailable' ||
    message.includes('missing or insufficient permissions')
}

function toServerCommitError(err, reference = '') {
  if (!isServerCommitError(err)) return err
  const message = err?.code === 'unavailable'
    ? 'Transfer confirmation is unavailable. Check your history before starting a new transfer, or retry this transfer.'
    : 'Transfer blocked by account permissions. Contact support before trying again.'
  const wrapped = new Error(`${message} Code: ${err.code || 'permission-denied'}.${reference ? ` Reference: ${reference}.` : ''}`)
  wrapped.code = err?.code || 'server-commit-failed'
  wrapped.cause = err
  return wrapped
}

function isLocalDevHost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

function shouldUseServerTransfer(txn, options) {
  if (options.forceClientCommit) return false
  if (!SERVER_TRANSFER_TYPES.has(txn?.type)) return false
  if (typeof window === 'undefined') return false
  if (typeof window !== 'undefined' && window.__USE_TRANSFER_API__ === true) return true
  return !isLocalDevHost()
}

async function saveTransactionViaServer(txn, uid, id) {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user || user.uid !== uid) {
    const error = new Error('Your account session has changed or expired. Sign in to this account again before transferring.')
    error.code = user ? 'auth/user-mismatch' : 'auth/session-expired'
    throw error
  }

  const token = await user.getIdToken()
  const res = await fetch('/api/transfers/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: {
        ...txn,
        id,
        ref: txn.ref || id,
        userId: uid,
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Transfer server did not confirm the balance update. Please try again.')
    err.code = data.code || `transfer-server-${res.status}`
    err.reference = data.reference || txn.ref || id
    throw err
  }

  return data
}

function canFallbackToClientCommit(err) {
  return err?.code === 'server-not-configured' ||
    err?.code === 'transfer-server-404' ||
    err?.code === 'transfer-server-405'
}

async function commitTransactionFromClient(txn, uid, id) {
  return commitAccountMutation({
    uid,
    amount: txn.amount,
    direction: inferDirection(txn.type, txn.direction),
    type: txn.type,
    txnData: {
      ...txn,
      id,
      ref: txn.ref || id,
    },
    idempotencyKey: txn.idempotencyKey || txn.ref || id,
  })
}

export async function prepareTransfer(uid, amount, previousReference = '') {
  try {
    return await loadTransferAccount(uid, parseAmountCents(amount), previousReference)
  } catch (err) {
    throw toServerCommitError(err)
  }
}

function readDeletedBuckets() {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_TXNS_KEY) || '{}')
    if (Array.isArray(raw)) return { [GLOBAL_DELETED_BUCKET]: raw.map(String) }
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
  } catch {
    // Local tombstones are best-effort UI cache only.
  }
}

function pruneDeletedTransactions(txns, deletedIds) {
  return txns.filter((txn) => {
    const id = getTxnId(txn)
    return id && !deletedIds.has(id)
  })
}

async function loadDeletedTransactionIds(uid) {
  const localDeletedIds = getDeletedIdsFromStorage(uid)
  if (!uid) return localDeletedIds

  try {
    const snap = await getDocs(collection(db, 'profiles', uid, 'deletedTransactions'))
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

export function rememberDeletedTransaction(txnId, uid = getCurrentUserUid()) {
  const id = String(txnId)
  const deletedIds = getDeletedIdsFromStorage(uid)
  deletedIds.add(id)
  storeDeletedIds(uid, deletedIds)
  removeTransactionFromLocalHistory(id, uid)
}

export function removeTransactionFromLocalHistory(txnId, uid = null) {
  if (uid) {
    const currentUid = getCurrentUserUid()
    if (!currentUid || String(currentUid) !== String(uid)) return
  }

  const id = String(txnId)
  const history = readLocalTransactions()
  const updated = history.filter((txn) => getTxnId(txn) !== id)
  if (updated.length !== history.length) writeLocalTransactions(updated)
}

export async function saveTransaction(txn, options = {}) {
  const uid = options.uid || txn?.userId || getCurrentUserUid()
  const id = getTxnId(txn)
  if (!uid) throw new Error('You must be signed in before making a transaction.')
  if (!id) throw new Error('Transaction ID is required.')
  if (getDeletedIdsFromStorage(uid).has(id)) {
    throw new Error('This transaction was deleted and cannot be reused.')
  }

  let result
  if (shouldUseServerTransfer(txn, options)) {
    try {
      result = await saveTransactionViaServer(txn, uid, id)
    } catch (err) {
      if (canFallbackToClientCommit(err)) {
        console.warn('[transfer] secure transfer server unavailable; using client ledger path until Cloudflare secrets are configured.', {
          code: err.code,
          reference: err.reference || txn.ref || id,
        })
        try {
          result = await commitTransactionFromClient(txn, uid, id)
        } catch (fallbackErr) {
          console.error('[transfer] fallback commit failed', { code: fallbackErr.code || 'transfer-failed', reference: txn.ref || id })
          throw toServerCommitError(fallbackErr, txn.ref || id)
        }
      } else {
        console.error('[transfer] server commit failed', { code: err.code || 'transfer-failed', reference: err.reference || txn.ref || id })
        throw toServerCommitError(err, err.reference || txn.ref || id)
      }
    }
  } else {
    try {
      result = await commitTransactionFromClient(txn, uid, id)
    } catch (err) {
      console.error('[transfer] commit failed', { code: err.code || 'transfer-failed', reference: txn.ref || id })
      throw toServerCommitError(err, txn.ref || id)
    }
  }

  if (result?.serverCommitted !== true) {
    throw new Error('Transaction was not completed because the bank server did not confirm the balance update. Please try again.')
  }

  const committed = result.transaction || {
    ...txn,
    id: result.transactionId || id,
    balanceAfter: result.balanceAfter,
    balanceAfterCents: result.balanceAfterCents,
  }
  upsertLocalTransaction(committed, uid)
  return { ...committed, accountBalance: result.balanceAfter }
}

export async function loadTransactions(uid) {
  const deletedIds = await loadDeletedTransactionIds(uid)

  if (!uid) {
    const localTxns = pruneDeletedTransactions(readLocalTransactions(uid), deletedIds)
    writeLocalTransactions(localTxns, uid)
    return localTxns
  }

  try {
    const snap = await getDocs(getTransactionsQuery(uid))
    const firestoreTxns = pruneDeletedTransactions(
      snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      deletedIds
    )
    const sorted = sortTransactions(firestoreTxns)
    writeLocalTransactions(sorted, uid)
    return sorted
  } catch (err) {
    console.warn('[transactionService] Firestore load failed; showing cached history:', err.message)
    return pruneDeletedTransactions(readLocalTransactions(uid), deletedIds)
  }
}

export function subscribeToTransactions(uid, onUpdate) {
  if (!uid) return () => {}

  if (activeListeners.has(uid)) {
    activeListeners.get(uid)()
    activeListeners.delete(uid)
  }

  const unsubscribe = onSnapshot(
    getTransactionsQuery(uid),
    async (snap) => {
      const deletedIds = await loadDeletedTransactionIds(uid)
      const txns = pruneDeletedTransactions(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        deletedIds
      )
      const sorted = sortTransactions(txns)
      writeLocalTransactions(sorted, uid)
      onUpdate?.(sorted)
    },
    (err) => {
      console.warn('[transactionService] Real-time listener error:', err.message)
      onUpdate?.(pruneDeletedTransactions(readLocalTransactions(uid), getDeletedIdsFromStorage(uid)))
    }
  )

  activeListeners.set(uid, unsubscribe)
  return unsubscribe
}

export function unsubscribeFromTransactions(uid) {
  if (activeListeners.has(uid)) {
    activeListeners.get(uid)()
    activeListeners.delete(uid)
  }
}

export function unsubscribeAll() {
  activeListeners.forEach((unsubscribe) => unsubscribe())
  activeListeners.clear()
}

export async function tombstoneTransaction(uid, txnId) {
  const id = String(txnId)
  await setDoc(doc(db, 'profiles', uid, 'deletedTransactions', id), {
    id,
    deletedAt: new Date().toISOString(),
  })
  await deleteDoc(doc(db, 'profiles', uid, 'transactions', id))
  rememberDeletedTransaction(id, uid)
}
