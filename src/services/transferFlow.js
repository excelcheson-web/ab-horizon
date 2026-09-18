import { getCurrentUserUid } from './accountLedger'
import { readScopedObject, writeScopedJson } from './userStorage'

const PENDING_TRANSFER_KEY = 'pending_transfer'
const PENDING_TTL_MS = 24 * 60 * 60 * 1000

const DEFAULT_TIMEOUTS = {
  prepare: 15000,
  otp: 20000,
  commit: 25000,
}

export function getTransferTimeout(stage) {
  if (typeof window !== 'undefined') {
    const value = Number(window.__TRANSFER_TIMEOUTS__?.[stage])
    if (Number.isFinite(value) && value > 0) return value
  }
  return DEFAULT_TIMEOUTS[stage] || 15000
}

export function withDeadline(promise, timeoutMs, message, code = 'deadline-exceeded') {
  let timeoutId
  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message)
      error.code = code
      reject(error)
    }, timeoutMs)

    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(timeoutId))
  })
}

export function isDeadlineError(err) {
  return err?.code === 'deadline-exceeded'
}

export function rememberPendingTransfer(txn) {
  if (!txn?.userId || !txn?.ref || !txn?.type) return
  writeScopedJson(PENDING_TRANSFER_KEY, {
    ...txn,
    savedAt: Date.now(),
  }, txn.userId)
}

export function readPendingTransfer(type, uid = getCurrentUserUid()) {
  const pending = readScopedObject(PENDING_TRANSFER_KEY, uid)
  if (!pending?.ref || pending.type !== type) return null
  if (!Number.isFinite(pending.savedAt) || Date.now() - pending.savedAt > PENDING_TTL_MS) {
    clearPendingTransfer(pending.ref, uid)
    return null
  }
  return pending
}

export function clearPendingTransfer(ref = '', uid = getCurrentUserUid()) {
  const pending = readScopedObject(PENDING_TRANSFER_KEY, uid)
  if (!pending?.ref) return
  if (ref && pending.ref !== ref) return
  writeScopedJson(PENDING_TRANSFER_KEY, {}, uid)
}
