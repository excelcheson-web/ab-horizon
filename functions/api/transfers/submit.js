// Cloudflare Pages Function - server-authoritative transfer commit
// Route: /api/transfers/submit (POST only)

const FIREBASE_API_KEY = 'AIzaSyDt0vYV7xfhoNHsCc6XnUfTFQl6SkBNFyk'
const DEFAULT_PROJECT_ID = 'td-project-pro'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const IDENTITY_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup'
const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'

let cachedAccessToken = null

export async function onRequestPost({ request, env }) {
  try {
    const authUser = await verifyRequestUser(request, env)
    const body = await readJson(request)
    const txn = body?.transaction || body?.txn
    const prepared = prepareTransferPayload(txn, authUser)
    const accessToken = await getServiceAccessToken(env)
    const result = await commitTransfer(prepared, accessToken, env)
    return json(result)
  } catch (err) {
    const status = err.status || statusFromCode(err.code)
    return json({
      error: err.message || 'Transfer could not be processed.',
      code: err.code || 'transfer-failed',
      reference: err.reference || '',
    }, status)
  }
}

export async function onRequestOptions() {
  return json({}, 204)
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405)
}

async function verifyRequestUser(request, env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw httpError(401, 'auth/missing-token', 'Sign in again before transferring.')

  const apiKey = env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || FIREBASE_API_KEY
  const lookup = await fetchJson(`${IDENTITY_LOOKUP_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  }, 10000)

  const user = lookup?.users?.[0]
  if (!user?.localId) throw httpError(401, 'auth/invalid-token', 'Sign in again before transferring.')
  return { uid: user.localId, email: user.email || '' }
}

function prepareTransferPayload(txn, authUser) {
  if (!txn || typeof txn !== 'object') throw httpError(400, 'invalid-transaction', 'Transfer details are missing.')

  const type = String(txn.type || '')
  if (!['local', 'international'].includes(type)) {
    throw httpError(400, 'unsupported-transfer-type', 'This transfer type is not supported by the secure transfer server.')
  }

  const uid = String(txn.userId || txn.uid || '')
  if (!uid || uid !== authUser.uid) {
    throw httpError(403, 'auth/user-mismatch', 'This transfer does not belong to the signed-in account.')
  }

  const amountCents = parseAmountCents(txn.amount)
  const ref = String(txn.ref || txn.id || '').trim()
  const txnId = String(txn.id || ref).trim()
  const requestId = String(txn.idempotencyKey || txn.ref || txnId).trim()
  if (!/^TXN-[A-Z0-9-]{6,}$/.test(ref) || !txnId || !requestId) {
    throw httpError(400, 'invalid-reference', 'Transfer reference is invalid.')
  }

  const common = {
    beneficiary: cleanRequired(txn.beneficiary, 'Beneficiary name'),
    bankName: cleanRequired(txn.bankName, 'Bank name'),
  }
  const recipient = type === 'local'
    ? { ...common, accountNumber: cleanRequired(txn.accountNumber, 'Account number') }
    : {
        ...common,
        iban: cleanRequired(txn.iban, 'IBAN / account number'),
        swift: cleanRequired(txn.swift, 'SWIFT / BIC code'),
        country: cleanRequired(txn.country, 'Country'),
        description: cleanOptional(txn.description),
      }

  return {
    uid,
    type,
    ref,
    txnId,
    requestId,
    amountCents,
    amount: dollarsFromCents(amountCents),
    direction: 'outgoing',
    date: validIso(txn.date) ? txn.date : new Date().toISOString(),
    recipient,
  }
}

async function commitTransfer(prepared, accessToken, env) {
  const projectId = getProjectId(env)
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  const docs = {
    profile: docName(projectId, `profiles/${prepared.uid}`),
    txn: docName(projectId, `profiles/${prepared.uid}/transactions/${prepared.txnId}`),
    request: docName(projectId, `profiles/${prepared.uid}/ledgerRequests/${prepared.requestId}`),
  }

  let lastErr
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let transaction
    try {
      transaction = await beginFirestoreTransaction(base, accessToken)
      const snap = await batchGetDocuments(base, accessToken, [docs.profile, docs.request], transaction)
      const profileDoc = snap.get(docs.profile)
      const requestDoc = snap.get(docs.request)
      if (!profileDoc) throw httpError(404, 'account-not-found', 'Account profile was not found. Contact support before transferring.')

      const profile = decodeFields(profileDoc.fields || {})
      const currentCents = readBalanceCents(profile)
      if (!Number.isSafeInteger(currentCents) || currentCents < 0) {
        throw httpError(409, 'balance-review-required', 'Account balance requires review. The transaction was not processed.')
      }

      if (requestDoc) {
        return await recoverExistingTransfer(base, accessToken, docs, prepared, profile, requestDoc, transaction)
      }

      if (profile.suspended) {
        throw httpError(403, 'account-restricted', profile.suspendReason || 'This account is temporarily restricted. The transaction was not processed.')
      }

      const nextCents = currentCents - prepared.amountCents
      if (nextCents < 0) throw httpError(409, 'insufficient-funds', 'Insufficient balance for this transaction.')
      if (!Number.isSafeInteger(nextCents)) {
        throw httpError(409, 'balance-review-required', 'Account balance requires review. The transaction was not processed.')
      }

      const now = new Date().toISOString()
      const committedTxn = {
        id: prepared.txnId,
        userId: prepared.uid,
        ref: prepared.ref,
        type: prepared.type,
        direction: prepared.direction,
        ...prepared.recipient,
        amount: prepared.amount,
        amountCents: prepared.amountCents,
        balanceBefore: dollarsFromCents(currentCents),
        balanceBeforeCents: currentCents,
        balanceAfter: dollarsFromCents(nextCents),
        balanceAfterCents: nextCents,
        date: prepared.date,
        status: 'completed',
        committedAt: now,
        idempotencyKey: prepared.requestId,
      }

      const result = await commitFirestoreTransaction(base, accessToken, transaction, [
        {
          update: { name: docs.txn, fields: encodeFields(committedTxn) },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: docs.request,
            fields: encodeFields({
              id: prepared.requestId,
              userId: prepared.uid,
              transactionId: prepared.txnId,
              amountCents: prepared.amountCents,
              direction: prepared.direction,
              type: prepared.type,
              balanceAfterCents: nextCents,
              createdAt: now,
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: docs.profile,
            fields: encodeFields({
              balance: dollarsFromCents(nextCents),
              balanceCents: nextCents,
              lastTransactionId: prepared.txnId,
              updatedAt: now,
            }),
          },
          updateMask: { fieldPaths: ['balance', 'balanceCents', 'lastTransactionId', 'updatedAt'] },
          currentDocument: { exists: true },
        },
      ])

      return {
        transaction: committedTxn,
        transactionId: prepared.txnId,
        balanceAfter: dollarsFromCents(nextCents),
        balanceAfterCents: nextCents,
        commitTime: result.commitTime,
        serverCommitted: true,
      }
    } catch (err) {
      lastErr = err
      await rollbackFirestoreTransaction(base, accessToken, transaction)
      if (!isRetryableFirestoreError(err) || attempt === 2) break
      await wait(150 * (attempt + 1))
    }
  }

  lastErr.reference = lastErr.reference || prepared.ref
  throw lastErr
}

async function recoverExistingTransfer(base, accessToken, docs, prepared, profile, requestDoc, transaction) {
  const existing = decodeFields(requestDoc.fields || {})
  if (existing.amountCents !== prepared.amountCents ||
      existing.direction !== prepared.direction ||
      existing.type !== prepared.type) {
    throw httpError(409, 'reference-mismatch', 'This transfer reference already exists with different details. Contact support before retrying.', prepared.ref)
  }

  const existingTxnId = String(existing.transactionId || prepared.txnId)
  const existingTxnName = docName(getProjectFromDocName(docs.profile), `profiles/${prepared.uid}/transactions/${existingTxnId}`)
  const snap = await batchGetDocuments(base, accessToken, [existingTxnName], transaction)
  const txnDoc = snap.get(existingTxnName)
  if (!txnDoc) throw httpError(409, 'reference-incomplete', 'This transfer reference is incomplete. Contact support before retrying.', prepared.ref)

  const existingTxn = decodeFields(txnDoc.fields || {})
  if (existingTxn.idempotencyKey !== prepared.requestId ||
      existingTxn.amountCents !== prepared.amountCents ||
      existingTxn.direction !== prepared.direction ||
      existingTxn.balanceAfterCents !== existing.balanceAfterCents ||
      ['beneficiary', 'accountNumber', 'iban', 'swift', 'bankName', 'country', 'description'].some(
        key => (existingTxn[key] || '') !== ((prepared.recipient[key] || ''))
      )) {
    throw httpError(409, 'reference-mismatch', 'This transfer reference does not match the saved transaction. Contact support before retrying.', prepared.ref)
  }

  return {
    transaction: { id: existingTxnId, ...existingTxn },
    transactionId: existingTxnId,
    balanceAfter: dollarsFromCents(readBalanceCents(profile)),
    balanceAfterCents: readBalanceCents(profile),
    alreadyCommitted: true,
    serverCommitted: true,
  }
}

async function beginFirestoreTransaction(base, accessToken) {
  const data = await fetchJson(`${base}:beginTransaction`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ options: { readWrite: {} } }),
  }, 8000)
  if (!data.transaction) throw httpError(502, 'firestore-transaction-failed', 'Could not start transfer confirmation.')
  return data.transaction
}

async function batchGetDocuments(base, accessToken, documents, transaction) {
  const rows = await fetchJson(`${base}:batchGet`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ documents, transaction }),
  }, 10000)
  const map = new Map()
  for (const row of rows || []) {
    if (row.found?.name) map.set(row.found.name, row.found)
  }
  return map
}

async function commitFirestoreTransaction(base, accessToken, transaction, writes) {
  return fetchJson(`${base}:commit`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ writes, transaction }),
  }, 12000)
}

async function rollbackFirestoreTransaction(base, accessToken, transaction) {
  if (!transaction) return
  await fetch(`${base}:rollback`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ transaction }),
  }).catch(() => {})
}

async function getServiceAccessToken(env) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) return cachedAccessToken.token

  const serviceAccount = readServiceAccount(env)
  const now = Math.floor(Date.now() / 1000)
  const assertion = await signJwt({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: TOKEN_URL,
    scope: DATASTORE_SCOPE,
    iat: now,
    exp: now + 3600,
  }, serviceAccount.private_key)

  const response = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  }, 10000)

  cachedAccessToken = {
    token: response.access_token,
    expiresAt: Date.now() + ((response.expires_in || 3600) * 1000),
  }
  return cachedAccessToken.token
}

function readServiceAccount(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed.client_email && parsed.private_key) return parsed
    } catch {
      throw httpError(500, 'server-config-error', 'Transfer server service account is invalid.')
    }
  }

  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    return {
      project_id: env.FIREBASE_PROJECT_ID || env.GOOGLE_PROJECT_ID || DEFAULT_PROJECT_ID,
      client_email: env.GOOGLE_CLIENT_EMAIL,
      private_key: String(env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n'),
    }
  }

  throw httpError(503, 'server-not-configured', 'Secure transfer server is not configured. Add Firebase service account secrets in Cloudflare.')
}

async function signJwt(payload, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))
  return `${input}.${base64UrlBytes(new Uint8Array(signature))}`
}

function pemToArrayBuffer(pem) {
  const body = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlBytes(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) {
      const message = data?.error?.message || data?.error || `Request failed with status ${res.status}`
      const error = httpError(res.status, data?.error?.status || data?.error?.code || 'upstream-error', message)
      error.upstream = data
      throw error
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw httpError(504, 'upstream-timeout', 'Transfer server timed out while confirming with Firebase.')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function encodeFields(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  )
}

function encodeValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value)) return { integerValue: String(value) }
    return { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } }
  return { stringValue: String(value) }
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]))
}

function decodeValue(value) {
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return value.timestampValue
  if ('nullValue' in value) return null
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {})
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue)
  return undefined
}

function parseAmountCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw httpError(400, 'invalid-amount', 'Enter a valid amount.')
    const cents = Math.round(value * 100)
    if (Math.abs(value * 100 - cents) > 1e-6) throw httpError(400, 'invalid-amount', 'Enter a valid amount with no more than 2 decimal places.')
    if (!Number.isSafeInteger(cents) || cents <= 0) throw httpError(400, 'invalid-amount', 'Enter a valid amount.')
    return cents
  }

  const raw = String(value || '').trim().replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw httpError(400, 'invalid-amount', 'Enter a valid amount.')
  const [dollars, cents = ''] = raw.split('.')
  const result = (Number(dollars) * 100) + Number(cents.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result <= 0) throw httpError(400, 'invalid-amount', 'Enter a valid amount.')
  return result
}

function readBalanceCents(profile) {
  if (Number.isFinite(profile.balanceCents)) return Math.round(profile.balanceCents)
  return Math.round(Number(profile.balance || 0) * 100)
}

function dollarsFromCents(cents) {
  return Math.round(cents) / 100
}

function cleanRequired(value, label) {
  const text = String(value || '').trim()
  if (!text) throw httpError(400, 'missing-field', `${label} is required.`)
  return text.slice(0, 180)
}

function cleanOptional(value) {
  return String(value || '').trim().slice(0, 240)
}

function validIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function docName(projectId, path) {
  return `projects/${projectId}/databases/(default)/documents/${path}`
}

function getProjectId(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (raw) {
    try {
      return JSON.parse(raw).project_id || env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID
    } catch {
      return env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID
    }
  }
  return env.FIREBASE_PROJECT_ID || env.GOOGLE_PROJECT_ID || DEFAULT_PROJECT_ID
}

function getProjectFromDocName(name) {
  return String(name).split('/')[1]
}

function isRetryableFirestoreError(err) {
  const code = String(err.code || err.message || '').toUpperCase()
  const status = err.status || 0
  return status === 409 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    code.includes('ABORTED') || code.includes('UNAVAILABLE') || code.includes('DEADLINE')
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function httpError(status, code, message, reference = '') {
  const err = new Error(message)
  err.status = status
  err.code = code
  err.reference = reference
  return err
}

function statusFromCode(code) {
  if (String(code || '').startsWith('auth/')) return 401
  return 500
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw httpError(400, 'invalid-json', 'Invalid JSON body.')
  }
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}
