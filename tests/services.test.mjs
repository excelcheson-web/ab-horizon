import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, connectFirestoreEmulator, doc, getDocFromServer, getDocs, getFirestore, setDoc, terminate } from 'firebase/firestore'
import config from './config.mjs'
import { createAccount, seedDocument, projectId } from './fixtures.mjs'

function storage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), clear: () => data.clear() }
}

let server, client, ledger, transactions, otp, emailjs, account
before(async () => {
  globalThis.localStorage = storage()
  globalThis.sessionStorage = storage()
  server = await createServer(config)
  client = await server.ssrLoadModule('/tests/firebaseClient.mjs')
  ledger = await server.ssrLoadModule('/src/services/accountLedger.js')
  transactions = await server.ssrLoadModule('/src/services/transactionService.js')
  otp = await server.ssrLoadModule('/src/services/otpService.js')
  emailjs = await server.ssrLoadModule('/tests/emailjs.mjs')
})
beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  emailjs.setDeliveryFailure(false)
  account = await createAccount('normal-user')
  await signInWithEmailAndPassword(client.auth, account.email, account.password)
})
after(async () => {
  if (client) { await terminate(client.db); await deleteApp(client.app) }
  await server?.close()
})

const transfer = (id, amount = 30000) => ({ id, ref: id, amount, type: 'international', direction: 'outgoing', beneficiary: 'Test Recipient' })
const profile = () => getDocFromServer(doc(client.db, 'profiles', account.uid)).then(s => s.data())

test('normal profile without optional fields: transfer debits exactly once', async () => {
  const txn = await transactions.saveTransaction(transfer('first'))
  assert.equal(txn.balanceAfter, 20000)
  await transactions.saveTransaction(transfer('first'))
  assert.equal((await profile()).balanceCents, 2000000)
  assert.equal((await getDocs(collection(client.db, 'profiles', account.uid, 'transactions'))).size, 1)
})

test('retry after a later transfer returns original receipt and current balance', async () => {
  await transactions.saveTransaction(transfer('earlier'))
  await transactions.saveTransaction(transfer('later', 125))
  const retry = await transactions.saveTransaction(transfer('earlier'))
  assert.equal(retry.balanceAfter, 20000)
  assert.equal(retry.accountBalance, 19875)
  assert.equal((await profile()).balanceCents, 1987500)
  assert.equal(Number(localStorage.getItem('bank_balance')), 19875)
})

test('a reused reference with different transfer details is rejected', async () => {
  await transactions.saveTransaction(transfer('reused'))
  await assert.rejects(transactions.saveTransaction(transfer('reused', 1)), /reference|match/i)
  assert.equal((await profile()).balanceCents, 2000000)
})

test('concurrent transfers use server balance and cannot overdraw', async () => {
  const outcomes = await Promise.allSettled([
    transactions.saveTransaction(transfer('parallel-a')),
    transactions.saveTransaction(transfer('parallel-b')),
  ])
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1)
  assert.match(outcomes.find(x => x.status === 'rejected').reason.message, /insufficient/i)
  assert.equal((await profile()).balanceCents, 2000000)
})

test('standalone transaction cannot be saved without the balance debit', async () => {
  await assert.rejects(setDoc(doc(client.db, 'profiles', account.uid, 'transactions', 'unpaired'), {
    ...transfer('unpaired'), userId: account.uid, amountCents: 3000000,
    balanceBeforeCents: 5000000, balanceAfterCents: 2000000,
  }), { code: 'permission-denied' })
  assert.equal((await profile()).balanceCents, 5000000)
})

test('permissions failure never becomes a local successful transfer', async () => {
  const other = await createAccount('other-user')
  await assert.rejects(transactions.saveTransaction(transfer('forbidden'), { uid: other.uid, allowLocalFallback: true }), /not completed|signed in|permission/i)
  assert.deepEqual(transactions.readCachedTransactions(other.uid), [])
  assert.equal((await profile()).balanceCents, 5000000)
})

test('two concurrent affordable transfers both commit their exact debits', async () => {
  await Promise.all([
    transactions.saveTransaction(transfer('concurrent-small-a', 300)),
    transactions.saveTransaction(transfer('concurrent-small-b', 400)),
  ])
  assert.equal((await profile()).balanceCents, 4930000)
  assert.equal((await getDocs(collection(client.db, 'profiles', account.uid, 'transactions'))).size, 2)
})

test('suspended account cannot transfer', async () => {
  await seedDocument(`profiles/${account.uid}`, { suspended: true })
  await assert.rejects(transactions.saveTransaction(transfer('suspended')), /restricted/i)
  assert.equal((await profile()).balanceCents, 5000000)
})

test('a separate authenticated device reads the deducted balance and history', async () => {
  const app2 = initializeApp({ projectId, apiKey: 'emulator-only' }, crypto.randomUUID())
  const auth2 = getAuth(app2)
  const db2 = getFirestore(app2)
  connectAuthEmulator(auth2, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db2, '127.0.0.1', 8080)
  try {
    await signInWithEmailAndPassword(auth2, account.email, account.password)
    await transactions.saveTransaction(transfer('cross-device'))
    assert.equal((await getDocFromServer(doc(db2, 'profiles', account.uid))).data().balanceCents, 2000000)
    assert.equal((await getDocs(collection(db2, 'profiles', account.uid, 'transactions'))).size, 1)
  } finally { await terminate(db2); await deleteApp(app2) }
})

test('switching users keeps history and account cache isolated', async () => {
  const firstUid = account.uid
  await transactions.saveTransaction(transfer('owned-by-first'))
  localStorage.setItem('securebank_user', JSON.stringify({ uid: firstUid, name: 'First User', pin: '111111' }))
  const other = await createAccount('second-user')
  await signInWithEmailAndPassword(client.auth, other.email, other.password)
  assert.deepEqual(transactions.readCachedTransactions(), [])
  ledger.cacheAccountSnapshot(other.uid, { balanceCents: 12345 })
  assert.equal(JSON.parse(localStorage.getItem('securebank_user')).pin, undefined)
  assert.equal(transactions.readCachedTransactions(firstUid).length, 1)
  ledger.cacheAccountSnapshot(firstUid, { balanceCents: 999 })
  assert.equal(localStorage.getItem('bank_balance_owner'), other.uid)
})

test('empty, incorrect, expired and reused OTPs are rejected', async t => {
  assert.equal(otp.verifyOtp(''), false)
  const code = otp.generateOtp()
  assert.equal(otp.verifyOtp('abcdef'), false)
  assert.equal(otp.verifyOtp(code), true)
  assert.equal(otp.verifyOtp(code), false)
  const expiring = otp.generateOtp()
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  t.mock.timers.tick(10 * 60 * 1000 + 1)
  assert.equal(otp.verifyOtp(expiring), false)
})

test('OTP belongs to the signed-in user and transfer reference', async () => {
  const code = otp.generateOtp({ context: 'transfer-one' })
  assert.equal(otp.verifyOtp(code, { context: 'transfer-two' }), false)
  const other = await createAccount('otp-other')
  await signOut(client.auth)
  await signInWithEmailAndPassword(client.auth, other.email, other.password)
  assert.equal(otp.verifyOtp(code, { context: 'transfer-one' }), false)
})

test('five incorrect OTP attempts invalidate the challenge', () => {
  const code = otp.generateOtp()
  const incorrect = code === '111111' ? '222222' : '111111'
  for (let i = 0; i < 5; i++) assert.equal(otp.verifyOtp(incorrect), false)
  assert.equal(otp.verifyOtp(code), false)
})

test('email delivery failure does not leave a valid OTP', async () => {
  emailjs.setDeliveryFailure(true)
  await assert.rejects(otp.sendOtp(account.email, 'transfer'), /delivery/i)
  assert.equal(otp.getLastCode({ context: 'transfer' }), '')
})
