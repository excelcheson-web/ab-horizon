import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { initializeApp, deleteApp } from 'firebase/app'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth, deleteUser } from 'firebase/auth'
import { doc, getDocFromServer, getFirestore, terminate } from 'firebase/firestore'

if (!process.argv.includes('--allow-production-test-data')) {
  throw new Error('This opt-in check creates and removes a temporary production test account. Pass --allow-production-test-data to run it.')
}
if (!process.env.APPDATA) throw new Error('Run this manual check on Windows with the Firebase CLI installed and signed in.')
const require = createRequire(import.meta.url)
const { configstore } = require(join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/configstore.js'))
const token = configstore.get('tokens')?.access_token
assert.ok(token, 'Firebase CLI login required')
const root = 'https://firestore.googleapis.com/v1/projects/td-project-pro/databases/(default)/documents'
function adminRequest(path, method = 'GET', body) {
  const config = [`url = ${JSON.stringify(`${root}/${path}`)}`, `header = "Authorization: Bearer ${token}"`, 'header = "Content-Type: application/json"', `request = "${method}"`]
  if (body) config.push(`data = ${JSON.stringify(JSON.stringify(body))}`)
  const raw = execFileSync('curl.exe', ['--silent', '--show-error', '--max-time', '30', '--config', '-'], {
    input: config.join('\n'), encoding: 'utf8', maxBuffer: 1024 * 1024,
  })
  const result = raw.trim() ? JSON.parse(raw) : {}
  if (result.error && !(method === 'DELETE' && result.error.code === 404)) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result
}

adminRequest('profiles?pageSize=1&mask.fieldPaths=uid')
const data = new Map()
globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const client = await server.ssrLoadModule('/src/services/firebaseClient.js')
const transactions = await server.ssrLoadModule('/src/services/transactionService.js')
assert.equal(client.auth.app.options.projectId, 'td-project-pro')
const email = `ledger-check-${randomUUID()}@example.invalid`
const password = randomBytes(24).toString('base64url')
const references = [`LIVE-CHECK-${randomUUID()}`, `LIVE-CHECK-${randomUUID()}`]
let user, secondApp, secondDb
let cleanupFailed = false
const artifact = new URL('../test-results/live-ledger-fixture.json', import.meta.url)
try {
  user = (await createUserWithEmailAndPassword(client.auth, email, password)).user
  assert.equal(user.email, email)
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true })
  await writeFile(artifact, JSON.stringify({ uid: user.uid, email, references, cleanedUp: false }))
  adminRequest(`profiles/${user.uid}`, 'PATCH', { fields: {
    uid: { stringValue: user.uid }, email: { stringValue: email },
    name: { stringValue: 'Temporary automated ledger check' },
    balance: { doubleValue: 0.29 }, isTestAccount: { booleanValue: true },
  } })
  const first = { id: references[0], ref: references[0], amount: 0.01, type: 'international', direction: 'outgoing', beneficiary: 'Automated test only' }
  if (process.argv.includes('--expect-denied')) {
    await assert.rejects(transactions.saveTransaction(first), { code: 'permission-denied' })
    console.log('live-legacy-reproduction: permission-denied confirmed')
  } else {
    secondApp = initializeApp(client.auth.app.options, `second-device-${randomUUID()}`)
    const secondAuth = getAuth(secondApp)
    secondDb = getFirestore(secondApp)
    await signInWithEmailAndPassword(secondAuth, email, password)
    await transactions.prepareTransfer(user.uid, 0.01)
    const saved = await transactions.saveTransaction(first)
    assert.equal(saved.balanceAfterCents, 28)
    const secondBalance = async () => (await getDocFromServer(doc(secondDb, 'profiles', user.uid))).data().balanceCents
    assert.equal(await secondBalance(), 28)
    await transactions.saveTransaction(first)
    assert.equal(await secondBalance(), 28)
    await transactions.saveTransaction({ ...first, id: references[1], ref: references[1], amount: 0.25 })
    assert.equal(await secondBalance(), 3)
    await transactions.prepareTransfer(user.uid, 0.25, references[1])
    await transactions.saveTransaction({ ...first, id: references[1], ref: references[1], amount: 0.25 })
    assert.equal(await secondBalance(), 3)
    console.log('live-ledger: legacy cents, fresh second session, exact debits, and idempotent retries passed')
  }
} finally {
  if (user) {
    for (const reference of references) {
      for (const collection of ['transactions', 'ledgerRequests']) {
        try { adminRequest(`profiles/${user.uid}/${collection}/${reference}`, 'DELETE') }
        catch (err) { cleanupFailed = true; console.error('Test record cleanup failed:', err.message) }
      }
    }
    try { adminRequest(`profiles/${user.uid}`, 'DELETE') }
    catch (err) { cleanupFailed = true; console.error('Test profile cleanup failed:', err.message) }
    try { await deleteUser(user) }
    catch (err) { cleanupFailed = true; console.error('Test auth cleanup failed:', err.code) }
  }
  if (secondDb) await terminate(secondDb)
  if (secondApp) await deleteApp(secondApp)
  await terminate(client.db)
  await terminate(client.adminDb)
  await deleteApp(client.auth.app)
  await deleteApp(client.adminAuth.app)
  await server.close()
  if (cleanupFailed) throw new Error('Temporary test cleanup requires attention')
  if (user) await writeFile(artifact, JSON.stringify({ uid: user.uid, email, references, cleanedUp: true }))
  console.log('temporary-test-account-cleanup: completed')
}
