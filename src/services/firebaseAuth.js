import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebaseClient'

function centsFromAmount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}

async function safeUpdate(docRef, fields) {
  try {
    await setDoc(docRef, fields, { merge: true })
  } catch (err) {
    console.warn('[firebaseAuth] safeUpdate failed:', err.message)
    throw err
  }
}

function generateAccountNumber() {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  return digits.join('')
}

function normalizeProfile(uid, raw) {
  const balanceCents = Number.isFinite(raw.balanceCents)
    ? Math.round(raw.balanceCents)
    : centsFromAmount(raw.balance ?? 0)
  const savingsVaultCents = Number.isFinite(raw.savingsVaultCents)
    ? Math.round(raw.savingsVaultCents)
    : centsFromAmount(raw.savingsVault ?? raw.savings_vault ?? 0)

  return {
    uid,
    id: uid,
    email: raw.email || '',
    full_name: raw.full_name || raw.name || 'User',
    name: raw.full_name || raw.name || 'User',
    accountNumber: raw.accountNumber || raw.account_number || '',
    account_number: raw.accountNumber || raw.account_number || '',
    accountType: raw.accountType || raw.account_type || 'Savings Account',
    account_type: raw.accountType || raw.account_type || 'Savings Account',
    pin: raw.pin || '',
    profilePic: raw.profilePic || raw.profile_pic || '',
    profile_pic: raw.profilePic || raw.profile_pic || '',
    balance: balanceCents / 100,
    balanceCents,
    savingsVault: savingsVaultCents / 100,
    savingsVaultCents,
    suspended: raw.suspended || false,
    suspendReason: raw.suspendReason || '',
    featureFlags: raw.featureFlags || undefined,
  }
}

function cacheProfile(profile) {
  try {
    localStorage.setItem('securebank_user', JSON.stringify(profile))
    localStorage.setItem('user_account_type', profile.accountType || '')
    localStorage.setItem('user_email', profile.email || '')
    localStorage.setItem('user_name', profile.name || profile.full_name || '')
    localStorage.setItem('user_account_number', profile.accountNumber || '')
    localStorage.setItem('bank_balance', String(profile.balance ?? 0))
    localStorage.setItem('bank_balance_owner', profile.uid || profile.id || '')
    localStorage.setItem('balance_local_update_ts', String(Date.now()))
    localStorage.setItem('savings_vault', String(profile.savingsVault ?? 0))
  } catch (err) {
    console.warn('[firebaseAuth] cacheProfile failed:', err.message)
  }
}

export async function registerUser(userData) {
  const email = userData.email
  const password = userData.password
  const fullName = userData.name || userData.full_name || 'New User'
  const accountNumber = userData.accountNumber || userData.account_number || generateAccountNumber()

  if (!email || !password) {
    throw new Error('Email and password are required to register.')
  }

  const { user } = await createUserWithEmailAndPassword(auth, email, password)

  const profileData = {
    uid: user.uid,
    full_name: fullName,
    email,
    accountNumber,
    accountType: userData.accountType || 'Savings Account',
    pin: userData.pin || '',
    profilePic: userData.profilePic || '',
    balance: 0,
    balanceCents: 0,
    savingsVault: 0,
    savingsVaultCents: 0,
    createdAt: new Date().toISOString(),
  }

  try {
    await setDoc(doc(db, 'profiles', user.uid), profileData)
  } catch (err) {
    console.warn('[registerUser] Firestore profile write failed:', err.message)
    try { await deleteUser(user) } catch { /* best effort cleanup */ }
    try { await signOut(auth) } catch { /* silent */ }
    throw new Error('Registration could not finish because the account profile was not saved. Please check Firebase/App Check and try again.')
  }

  const profile = normalizeProfile(user.uid, profileData)
  cacheProfile(profile)
  return profile
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function getCachedNameForUid(uid) {
  try {
    const cached = JSON.parse(localStorage.getItem('securebank_user') || '{}')
    const cachedUid = cached.uid || cached.id || ''
    return cachedUid === uid ? (cached.full_name || cached.name || '') : ''
  } catch {
    return ''
  }
}

export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required to log in.')
  }

  const { user } = await signInWithEmailAndPassword(auth, email, password)
  let snap

  try {
    snap = await withTimeout(getDoc(doc(db, 'profiles', user.uid)), 8000)
  } catch {
    try { await signOut(auth) } catch { /* silent */ }
    throw new Error('Account profile could not be loaded from the bank server. Please check your connection and try again.')
  }

  if (!snap.exists()) {
    try { await signOut(auth) } catch { /* silent */ }
    throw new Error('Account profile was not found. Please contact support before using this account.')
  }

  const data = snap.data()
  if (!data.full_name && !data.name) {
    const storedName = getCachedNameForUid(user.uid)
    data.full_name = user.displayName || storedName || (user.email ? user.email.split('@')[0] : '') || 'Account Holder'
    data.email = data.email || user.email || email
    data.accountNumber = data.accountNumber || generateAccountNumber()
    data.accountType = data.accountType || 'Savings Account'
    await setDoc(doc(db, 'profiles', user.uid), {
      full_name: data.full_name,
      email: data.email,
      accountNumber: data.accountNumber,
      accountType: data.accountType,
    }, { merge: true })
  }

  const profile = normalizeProfile(user.uid, data)
  cacheProfile(profile)
  return profile
}

export async function logoutUser() {
  await signOut(auth)
}

export async function getUserProfile(uid) {
  const snap = await withTimeout(getDoc(doc(db, 'profiles', uid)), 8000)
  if (!snap.exists()) return null
  const profile = normalizeProfile(uid, snap.data())
  cacheProfile(profile)
  return profile
}

export async function updateUserProfile(uid, fields) {
  await safeUpdate(doc(db, 'profiles', uid), fields)
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}
