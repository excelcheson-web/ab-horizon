import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Read-only public-page checks. Never signs in or submits a transaction.
const baseUrl = process.argv[2] || 'https://optimaunion.com/'
const artifacts = new URL('../test-results/', import.meta.url)
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1365, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      assert.equal(response.status(), 200)
      await page.locator('.hp-hero').waitFor()
      for (const button of await page.getByRole('button', { name: 'Sign In', exact: true }).all()) {
        if (await button.isVisible()) { await button.click(); break }
      }
      await page.getByLabel('Email address', { exact: true }).waitFor()
      await page.getByLabel('Password', { exact: true }).waitFor()
      await page.screenshot({ path: fileURLToPath(new URL(`live-${name}.png`, artifacts)) })
      assert.deepEqual(errors, [])
      console.log(JSON.stringify({ check: `live-${name}`, status: response.status(), title: await page.title(),
        scripts: await page.locator('script[type="module"][src]').evaluateAll(scripts => scripts.map(script => script.getAttribute('src'))) }))
      if (name === 'desktop') {
        const admin = await page.goto(new URL('admin-portal-99.html', baseUrl).href, { waitUntil: 'domcontentloaded' })
        assert.equal(admin.status(), 200)
        await page.getByText('Admin Operations Panel', { exact: true }).waitFor()
        assert.deepEqual(errors, [])
        console.log('live-admin-auth-gate: passed')
      }
    } finally { await context.close() }
  }
} finally { await browser.close() }
