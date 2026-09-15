import assert from 'node:assert/strict'

export const projectId = 'demo-bank-checks'
export const password = 'EmulatorOnly-Checks-123!'
const firestoreUrl = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`

export async function createAccount(name, profile = {}) {
  const email = `${name}-${crypto.randomUUID()}@example.test`
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  assert.equal(response.status, 200)
  const { localId: uid } = await response.json()
  await seedDocument(`profiles/${uid}`, {
    uid, email, name, pin: '246810', balance: 50000, balanceCents: 5000000,
    savingsVault: 0, savingsVaultCents: 0, ...profile,
  })
  return { uid, email, password }
}

export async function seedDocument(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
    typeof value === 'number' ? { doubleValue: value } :
      typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value },
  ]))
  const mask = new URLSearchParams(Object.keys(data).map(key => ['updateMask.fieldPaths', key]))
  const response = await fetch(`${firestoreUrl}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  assert.equal(response.status, 200, await response.text())
}
