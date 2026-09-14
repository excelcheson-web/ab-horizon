import {
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  collection,
} from 'firebase/firestore'
import { auth, db } from './firebaseClient'

export const BALANCE_KEY = 'bank_balance'
export const BALANCE_OWNER_KEY = 'bank_balance_owner'
export const BALANCE_UPDATED_KEY = 'balance_local_update_ts'

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function centsFromAmount(value) {
  return Math.round(toFiniteNumber(value) * 100)
}

export function dollarsFromCents(cents) {
  return centsFromAmount(cents / 100) / 100
}

export function readBalanceCents(profile = {}) {
  if (Number.isFinite(profile.balanceCents)) return Math.round(profile.balanceCents)
  return centsFromAmount(profile.balance ?? 0)
}

export function readBalance(profile = {}) {
  return dollarsFromCents(readBalanceCents(profile))
}

export function cacheAccountSnapshot(uid, profile = {}) {
  if (!uid || typeof localStorage === 'undefined') return

  const balance = readBalance(profile)
  try {
    const cached = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    localStorage.setItem('securebank_user', JSON.stringify({
      ...cached,
      ...profile,
      uid,
      id: uid,
      balance,
      balanceCents: readBalanceCents(profile),
    }))
    localStorage.setItem(BALANCE_KEY, String(balance))
    localStorage.setItem(BALANCE_OWNER_KEY, uid)
    localStorage.setItem(BALANCE_UPDATED_KEY, String(Date.now()))
    if (profile.savingsVault !== undefined || profile.savings_vault !== undefined) {
      localStorage.setItem('savings_vault', String(profile.savingsVault ?? profile.savings_vault ?? 0))
    }
  } catch (err) {
    console.warn('[accountLedger] cache update failed:', err.message)
  }
}

export function getCurrentUserUid() {
  const authUid = auth.currentUser?.uid
  if (authUid) return authUid

  try {
    const user = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    return user.uid || user.id || ''
  } catch {
    return ''
  }
}

export function getCurrentUserEmail() {
  const authEmail = auth.currentUser?.email
  if (authEmail) return authEmail

  try {
    const user = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    return user.email || localStorage.getItem('user_email') || ''
  } catch {
    return ''
  }
}

export async function loadAccountProfile(uid) {
  if (!uid) throw new Error('User ID is required')
  const snap = await getDoc(doc(db, 'profiles', uid))
  if (!snap.exists()) {
    throw new Error('Account profile was not found. Please contact support before using this account.')
  }
  const profile = { id: snap.id, uid: snap.id, ...snap.data() }
  cacheAccountSnapshot(uid, profile)
  return profile
}

export function subscribeToAccountProfile(uid, onUpdate, onError) {
  if (!uid) return () => {}

  return onSnapshot(
    doc(db, 'profiles', uid),
    (snap) => {
      if (!snap.exists()) {
        onError?.(new Error('Account profile was not found.'))
        return
      }
      const profile = { id: snap.id, uid: snap.id, ...snap.data() }
      cacheAccountSnapshot(uid, profile)
      onUpdate?.(profile)
    },
    (err) => {
      console.warn('[accountLedger] profile listener failed:', err.message)
      onError?.(err)
    }
  )
}

export function getTransactionsQuery(uid) {
  return query(collection(db, 'profiles', uid, 'transactions'), orderBy('date', 'desc'))
}

function directionSign(direction, type) {
  if (direction === 'incoming') return 1
  if (direction === 'outgoing') return -1
  if (['deposit', 'credit', 'incoming', 'loan_disbursement', 'refund', 'payroll'].includes(type)) return 1
  return -1
}

export function inferDirection(type, direction) {
  if (direction === 'incoming' || direction === 'outgoing') return direction
  if (['deposit', 'credit', 'incoming', 'loan_disbursement', 'refund', 'payroll'].includes(type)) return 'incoming'
  return 'outgoing'
}

function normalizeTransactionId(id) {
  return String(id || `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
}

export async function commitAccountMutation({
  uid = getCurrentUserUid(),
  amount,
  direction,
  type = 'debit',
  txnData = {},
  idempotencyKey,
}) {
  if (!uid) throw new Error('User ID is required')

  const amountCents = centsFromAmount(amount)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error('Enter a valid amount.')
  }

  const ref = txnData.ref || idempotencyKey || normalizeTransactionId(txnData.id)
  const txnId = normalizeTransactionId(txnData.id || ref)
  const requestId = String(idempotencyKey || ref || txnId)
  const normalizedType = type || txnData.type || 'debit'
  const normalizedDirection = inferDirection(normalizedType, direction || txnData.direction)
  const sign = directionSign(normalizedDirection, normalizedType)
  const nowIso = new Date().toISOString()

  const result = await runTransaction(db, async (firestoreTxn) => {
    const profileRef = doc(db, 'profiles', uid)
    const txnRef = doc(db, 'profiles', uid, 'transactions', txnId)
    const requestRef = doc(db, 'profiles', uid, 'ledgerRequests', requestId)

    const [profileSnap, requestSnap] = await Promise.all([
      firestoreTxn.get(profileRef),
      firestoreTxn.get(requestRef),
    ])

    if (!profileSnap.exists()) {
      throw new Error('Account profile was not found. The transaction was not processed.')
    }

    if (requestSnap.exists()) {
      const existing = requestSnap.data()
      const existingTxnId = existing.transactionId || txnId
      const existingBalanceAfterCents = Math.round(Number(existing.balanceAfterCents))
      const profileBalanceCents = readBalanceCents(profileSnap.data())
      if (!Number.isFinite(existingBalanceAfterCents) || profileBalanceCents !== existingBalanceAfterCents) {
        throw new Error('This transfer reference already exists, but the server balance does not match it. Please contact support before retrying.')
      }
      const existingTxnSnap = await firestoreTxn.get(doc(db, 'profiles', uid, 'transactions', String(existingTxnId)))
      return {
        transaction: existingTxnSnap.exists() ? { id: existingTxnSnap.id, ...existingTxnSnap.data() } : null,
        transactionId: existingTxnId,
        balanceAfter: dollarsFromCents(existingBalanceAfterCents),
        balanceAfterCents: existingBalanceAfterCents,
        alreadyCommitted: true,
        serverCommitted: true,
      }
    }

    const profile = profileSnap.data()
    if (profile.suspended) {
      throw new Error(profile.suspendReason || 'This account is temporarily restricted. The transaction was not processed.')
    }

    const currentCents = readBalanceCents(profile)
    const nextCents = currentCents + (sign * amountCents)

    if (nextCents < 0) {
      throw new Error('Insufficient balance for this transaction.')
    }

    const balanceBefore = dollarsFromCents(currentCents)
    const balanceAfter = dollarsFromCents(nextCents)
    const committedTxn = {
      ...txnData,
      id: txnId,
      userId: uid,
      ref,
      type: normalizedType,
      direction: normalizedDirection,
      amount: dollarsFromCents(amountCents),
      amountCents,
      balanceBefore,
      balanceBeforeCents: currentCents,
      balanceAfter,
      balanceAfterCents: nextCents,
      date: txnData.date || nowIso,
      status: txnData.status || 'completed',
      committedAt: serverTimestamp(),
      idempotencyKey: requestId,
    }

    firestoreTxn.set(txnRef, committedTxn)
    firestoreTxn.set(requestRef, {
      id: requestId,
      userId: uid,
      transactionId: txnId,
      amountCents,
      direction: normalizedDirection,
      type: normalizedType,
      balanceAfterCents: nextCents,
      createdAt: serverTimestamp(),
    })
    firestoreTxn.update(profileRef, {
      balance: balanceAfter,
      balanceCents: nextCents,
      lastTransactionId: txnId,
      updatedAt: serverTimestamp(),
    })

    return {
      transaction: committedTxn,
      transactionId: txnId,
      balanceAfter,
      balanceAfterCents: nextCents,
      serverCommitted: true,
    }
  })

  if (Number.isFinite(result.balanceAfter)) {
    cacheAccountSnapshot(uid, {
      balance: result.balanceAfter,
      balanceCents: Number.isFinite(result.balanceAfterCents)
        ? result.balanceAfterCents
        : centsFromAmount(result.balanceAfter),
    })
  }

  return result
}
