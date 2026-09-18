import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker from '../src/worker.js'

function envWithAssets() {
  return {
    ASSETS: {
      fetch: async () => new Response('asset fallback', { status: 200 }),
    },
  }
}

test('worker routes transfer API requests before static assets', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/transfers/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
    envWithAssets(),
    {},
  )

  assert.equal(response.status, 401)
  assert.match(await response.text(), /auth\/missing-token/)
})

test('worker serves static assets outside API routes', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/dashboard'),
    envWithAssets(),
    {},
  )

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'asset fallback')
})
