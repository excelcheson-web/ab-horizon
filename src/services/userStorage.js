import { getCurrentUserUid } from './accountLedger'

export function getScopedStorageKey(key, uid = getCurrentUserUid()) {
  return uid ? `${key}:${uid}` : key
}

export function readScopedJson(key, fallback, uid = getCurrentUserUid()) {
  try {
    const raw = localStorage.getItem(getScopedStorageKey(key, uid))
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function readScopedArray(key, uid = getCurrentUserUid()) {
  const value = readScopedJson(key, [], uid)
  return Array.isArray(value) ? value : []
}

export function readScopedObject(key, uid = getCurrentUserUid()) {
  const value = readScopedJson(key, {}, uid)
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function writeScopedJson(key, value, uid = getCurrentUserUid()) {
  const storageKey = getScopedStorageKey(key, uid)
  const serialized = JSON.stringify(value)
  try {
    localStorage.setItem(storageKey, serialized)
  } catch (err) {
    console.warn('[userStorage] scoped write failed:', err.message)
    return
  }

  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: storageKey,
      newValue: serialized,
    }))
  } catch {
    window.dispatchEvent(new CustomEvent('scoped-storage-updated', {
      detail: { key: storageKey, uid, value },
    }))
  }
  window.dispatchEvent(new CustomEvent('scoped-storage-updated', {
    detail: { key: storageKey, uid, value },
  }))
}
