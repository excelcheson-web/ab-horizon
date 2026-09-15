import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import config from './config.mjs'
import { createAccount } from './fixtures.mjs'

let server, browser
const artifactDir = new URL('../test-results/', import.meta.url)
before(async () => {
  await mkdir(artifactDir, { recursive: true })
  server = await createServer(config)
  await server.listen()
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })

async function login(page, account) {
  await page.goto('http://127.0.0.1:4179/tests/index.html')
  await page.getByRole('textbox', { name: 'Test email' }).fill(account.email)
  await page.getByRole('button', { name: 'Test sign in' }).click()
  await page.getByTestId('balance').waitFor()
}

async function fillTransfer(page, type, amount = '30000') {
  await page.getByRole('button', { name: `Open ${type}`, exact: true }).click()
  const fields = page.locator('.tf-form input')
  const values = type === 'international'
    ? ['Test Recipient', 'GB82WEST12345698765432', 'WESTGB2L', 'Test Bank', 'United Kingdom', amount, 'Regression test']
    : ['Test Recipient', '1234567890', 'Test Bank', amount]
  for (let i = 0; i < values.length; i++) await fields.nth(i).fill(values[i])
}

async function requestCode(page) {
  await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
  await page.getByRole('heading', { name: 'Security Verification' }).waitFor()
  return page.getByTestId('test-inbox').textContent()
}

async function enterCode(page, code, selector = '.otp-security-box') {
  assert.match(code, /^\d{6}$/)
  for (let i = 0; i < code.length; i++) await page.locator(selector).nth(i).fill(code[i])
  if (selector === '.otp-security-box') {
    assert.equal((await page.locator(selector).evaluateAll(inputs => inputs.map(input => input.value))).join(''), code)
  }
}

async function assertBalance(page, expected) {
  await page.waitForFunction(value => document.querySelector('[data-testid="balance"]')?.textContent === value, expected, { timeout: 20000 })
}

test('desktop international OTP transfer updates a second device and survives reload', async () => {
  const account = await createAccount('desktop')
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 1365, height: 900 } }), browser.newContext()])
  try {
    const [page, second] = await Promise.all(contexts.map(c => c.newPage()))
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await login(page, account)
    await login(second, account)
    await fillTransfer(page, 'international')
    const code = await requestCode(page)
    await enterCode(page, code === '111111' ? '222222' : '111111')
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByText('Invalid or expired code.', { exact: false }).waitFor()
    await assertBalance(second, '50000.00')
    await enterCode(page, code)
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByRole('heading', { name: 'Transfer Successful' }).waitFor()
    await assertBalance(page, '20000.00')
    await assertBalance(second, '20000.00')
    await page.screenshot({ path: fileURLToPath(new URL('international-desktop.png', artifactDir)) })
    await login(second, account)
    await assertBalance(second, '20000.00')
    assert.equal(await second.getByTestId('history-count').textContent(), '1')
    assert.deepEqual(errors, [])
  } finally { await Promise.all(contexts.map(c => c.close())) }
})

test('mobile local transfer deducts cents and generates a PDF receipt', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await login(page, await createAccount('mobile'))
    await fillTransfer(page, 'local', '125.25')
    await enterCode(page, await requestCode(page))
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByRole('heading', { name: 'Transfer Successful' }).waitFor()
    await assertBalance(page, '49874.75')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PDF Receipt', exact: false }).click()
    const download = await downloadPromise
    const data = await readFile(await download.path())
    assert.equal(data.subarray(0, 5).toString(), '%PDF-')
    assert.ok(data.length > 1000)
    await page.screenshot({ path: fileURLToPath(new URL('local-mobile.png', artifactDir)) })
    const bounds = await page.locator('.tf-receipt').boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391)
  } finally { await context.close() }
})

test('30-minute lock preserves the open form and unlocks with the PIN', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await page.clock.install()
    await login(page, await createAccount('lock'))
    await fillTransfer(page, 'international', '250')
    await page.clock.fastForward(29 * 60 * 1000)
    assert.equal(await page.getByRole('dialog', { name: 'Session locked' }).count(), 0)
    await page.clock.fastForward(60 * 1000 + 200)
    await page.getByRole('dialog', { name: 'Session locked' }).waitFor()
    await enterCode(page, '246810', '.sl-pin-box')
    await page.getByRole('dialog', { name: 'Session locked' }).waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.tf-form input').nth(0).inputValue(), 'Test Recipient')
    assert.equal(await page.locator('.tf-form input').nth(5).inputValue(), '250')
  } finally { await context.close() }
})

test('an expired OTP is refused by the transfer screen without a debit', async () => {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await page.clock.install()
    await login(page, await createAccount('expired'))
    await fillTransfer(page, 'local', '25')
    const code = await requestCode(page)
    await page.clock.fastForward(10 * 60 * 1000 + 1)
    await enterCode(page, code)
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByText('Invalid or expired code.', { exact: false }).waitFor()
    await assertBalance(page, '50000.00')
    assert.equal(await page.getByTestId('history-count').textContent(), '0')
  } finally { await context.close() }
})

test('network failure after OTP never displays success or caches a completed transfer', async () => {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const account = await createAccount('network-failure')
    await login(page, account)
    await fillTransfer(page, 'local', '25')
    const code = await requestCode(page)
    await context.route('http://127.0.0.1:8080/**', route => route.abort('failed'))
    await enterCode(page, code)
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.locator('.tf-error').waitFor({ timeout: 60000 })
    assert.equal(await page.getByRole('heading', { name: 'Transfer Successful' }).count(), 0)
    assert.equal(await page.getByTestId('history-count').textContent(), '0')
    await context.unroute('http://127.0.0.1:8080/**')
    await login(page, account)
    await assertBalance(page, '50000.00')
  } finally { await context.close() }
})

test('email verification uses the delivered code without showing a backup code', async () => {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await login(page, await createAccount('email-verification'))
    await page.getByRole('button', { name: 'Open email verification' }).click()
    await page.getByRole('heading', { name: 'Verify Your Email' }).waitFor()
    await page.locator('.otp-box').first().waitFor()
    const code = await page.getByTestId('test-inbox').textContent()
    assert.equal(await page.locator('.otp-code-hint').count(), 0)
    await enterCode(page, code, '.otp-box')
    await page.getByText('Email verified', { exact: true }).waitFor()
  } finally { await context.close() }
})

test('complete app: sign in, preserve transfer at lock, debit, and switch accounts', async () => {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    let deliveredCode
    await page.exposeFunction('receiveTestEmail', params => { deliveredCode = params.otp_code })
    await page.addInitScript(() => window.addEventListener('test-email', event => window.receiveTestEmail(event.detail)))
    await page.clock.install()
    async function appLogin(account) {
      await page.goto('http://127.0.0.1:4179/')
      await page.locator('.hp-nav-signin').click()
      await page.getByLabel('Email address', { exact: true }).fill(account.email)
      await page.getByLabel('Password', { exact: true }).fill(account.password)
      await page.getByRole('button', { name: 'Sign In to Your Account', exact: true }).click()
      await page.locator('.db-balance-amount').waitFor()
      await page.locator('.db-balance-amount [aria-label="$50,000.00"]').waitFor()
    }
    await appLogin(await createAccount('app-first'))
    await page.locator('.db-quick-btn').filter({ hasText: /^Transfer$/ }).click()
    const inputs = page.locator('.tf-form input')
    for (const [i, value] of ['Only First Account Recipient', '1234567890', 'Test Bank', '100'].entries()) await inputs.nth(i).fill(value)
    await page.clock.fastForward(30 * 60 * 1000 + 200)
    await page.getByRole('dialog', { name: 'Session locked' }).waitFor()
    await enterCode(page, '246810', '.sl-pin-box')
    await page.getByRole('dialog', { name: 'Session locked' }).waitFor({ state: 'hidden' })
    assert.equal(await inputs.nth(0).inputValue(), 'Only First Account Recipient')
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByRole('heading', { name: 'Security Verification' }).waitFor()
    await enterCode(page, deliveredCode)
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByRole('heading', { name: 'Transfer Successful' }).waitFor()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.locator('.db-balance-amount [aria-label="$49,900.00"]').waitFor()
    await page.screenshot({ path: fileURLToPath(new URL('app-dashboard.png', artifactDir)) })
    await appLogin(await createAccount('app-second'))
    assert.equal(await page.getByText('Only First Account Recipient', { exact: true }).count(), 0)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})
