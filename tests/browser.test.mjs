import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import config from './config.mjs'
import { createAccount, seedDocument } from './fixtures.mjs'

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

test('regression: ambiguous mobile amounts are rejected before requesting an OTP', async () => {
  const account = await createAccount('invalid-amount')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    for (const type of ['local', 'international']) {
      await login(page, account)
      await fillTransfer(page, type, '20.224.71')
      await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
      await page.locator('.tf-error').filter({ hasText: /amount/i }).waitFor({ timeout: 5000 })
      assert.equal(await page.getByRole('heading', { name: 'Security Verification' }).count(), 0)
      await assertBalance(page, '50000.00')
    }
  } finally { await context.close() }
})

test('fresh mobile device transfers grouped USD amounts from a legacy account', async () => {
  const account = await createAccount('legacy-mobile')
  await seedDocument(`profiles/${account.uid}`, { balance: 50000.29 }, ['balanceCents'])
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const desktop = await browser.newContext()
  try {
    const page = await mobile.newPage()
    const second = await desktop.newPage()
    await login(page, account)
    await login(second, account)
    await fillTransfer(page, 'international', '20,224.71')
    await enterCode(page, await requestCode(page))
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByRole('heading', { name: 'Transfer Successful' }).waitFor()
    await assertBalance(page, '29775.58')
    await assertBalance(second, '29775.58')
    await page.screenshot({ path: fileURLToPath(new URL('legacy-mobile-transfer.png', artifactDir)) })
    await login(second, account)
    await assertBalance(second, '29775.58')
    assert.equal(await second.getByTestId('history-count').textContent(), '1')
  } finally { await mobile.close(); await desktop.close() }
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

test('transfer confirmation can commit through the server API path', async () => {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await page.addInitScript(() => { window.__USE_TRANSFER_API__ = true })
    let apiCall
    await context.route('**/api/transfers/submit', async (route) => {
      const request = route.request()
      apiCall = {
        authorization: request.headers().authorization || '',
        body: request.postDataJSON(),
      }
      const txn = apiCall.body.transaction
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          serverCommitted: true,
          transactionId: txn.id,
          balanceAfter: 49975,
          balanceAfterCents: 4997500,
          transaction: {
            ...txn,
            amount: 25,
            amountCents: 2500,
            balanceAfter: 49975,
            balanceAfterCents: 4997500,
            status: 'completed',
          },
        }),
      })
    })

    await login(page, await createAccount('server-api'))
    await fillTransfer(page, 'local', '25')
    await enterCode(page, await requestCode(page))
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.getByRole('heading', { name: 'Transfer Successful' }).waitFor()
    await assertBalance(page, '49975.00')
    assert.match(apiCall.authorization, /^Bearer /)
    assert.equal(apiCall.body.transaction.type, 'local')
    assert.equal(apiCall.body.transaction.amount, 25)
    assert.match(apiCall.body.transaction.ref, /^TXN-/)
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

test('post-OTP server timeout returns to the form with a retryable reference', async () => {
  const context = await browser.newContext()
  const heldRoutes = []
  try {
    const page = await context.newPage()
    await page.addInitScript(() => {
      window.__TRANSFER_TIMEOUTS__ = { prepare: 5000, otp: 5000, commit: 1000 }
    })
    const account = await createAccount('confirmation-timeout')
    await login(page, account)
    await fillTransfer(page, 'local', '25')
    const code = await requestCode(page)
    await context.route('http://127.0.0.1:8080/**', route => heldRoutes.push(route))
    await enterCode(page, code)
    await page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click()
    await page.locator('.tf-error').filter({ hasText: /same reference was saved/i }).waitFor({ timeout: 10000 })
    assert.equal(await page.locator('.server-spinner').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Transfer Successful' }).count(), 0)
    assert.equal(await page.getByTestId('history-count').textContent(), '0')
    assert.equal(await page.locator('.tf-form input').nth(0).inputValue(), 'Test Recipient')
    assert.equal(await page.locator('.tf-form input').nth(3).inputValue(), '25')
    const pending = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(item => item.startsWith('pending_transfer:'))
      return key ? JSON.parse(localStorage.getItem(key) || '{}') : {}
    })
    assert.match(pending.ref || '', /^TXN-/)
    for (const route of heldRoutes.splice(0)) await route.abort('failed').catch(() => {})
    await context.unroute('http://127.0.0.1:8080/**')
    await login(page, account)
    await assertBalance(page, '50000.00')
  } finally {
    for (const route of heldRoutes.splice(0)) await route.abort('failed').catch(() => {})
    await context.close()
  }
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

test('admin user selector stays readable and searchable on mobile and desktop', async () => {
  const admin = await createAccount('picker-admin', { isAdmin: true })
  const name = 'Alexandria Catherine Montgomery-Wellington'
  const email = `alexandria.montgomery.wellington.${crypto.randomUUID()}@example.test`
  await createAccount('picker-user', { name, email, accountNumber: '9012345678', balance: 3518504, balanceCents: 351850400 })
  await createAccount('picker-second', { name: 'Zora Picker Test', accountNumber: '8123456789' })
  for (const width of [320, 390, 768, 1365]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 700, hasTouch: width <= 700 })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', err => errors.push(err.message))
      await page.goto('http://127.0.0.1:4179/tests/admin.html')
      await page.getByRole('textbox', { name: 'Test admin email' }).fill(admin.email)
      await page.getByRole('button', { name: 'Test admin sign in' }).click()
      await page.getByRole('button', { name: 'Choose user' }).click()
      const list = page.getByRole('list', { name: 'Users', exact: true })
      const search = page.getByRole('searchbox', { name: 'Find user' })
      const option = list.getByRole('button', { name: `${name} ${email} Account 9012345678`, exact: true })
      await option.waitFor()
      await page.screenshot({ path: fileURLToPath(new URL(`admin-user-list-${width}.png`, artifactDir)) })
      await search.fill('Montgomery-Wellington')
      await option.waitFor()
      const optionBounds = await option.boundingBox()
      assert.ok(optionBounds.width >= (width <= 700 ? width - 48 : 170))
      assert.ok(optionBounds.x >= 0 && optionBounds.x + optionBounds.width <= width)
      const clipped = await option.evaluate(element => [element, ...element.children].some(child => child.scrollWidth > child.clientWidth + 1))
      assert.equal(clipped, false, `User details must not clip at ${width}px`)
      if (width <= 700) {
        assert.equal(await search.evaluate(element => getComputedStyle(element).fontSize), '16px')
      }
      await page.screenshot({ path: fileURLToPath(new URL(`admin-users-${width}.png`, artifactDir)) })
      await option.click()
      await page.locator('.admin-user-banner .admin-user-email').filter({ hasText: email }).waitFor()
      await page.getByRole('button', { name: 'Change user', exact: false }).waitFor()
      await list.waitFor({ state: 'detached' })
      await page.screenshot({ path: fileURLToPath(new URL(`admin-selected-user-${width}.png`, artifactDir)), animations: 'disabled' })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `Long user details must fit ${width}px`)
      for (const value of await page.locator('.admin-user-banner .admin-stat-value').all()) {
        const lines = await value.evaluate(element => {
          const range = document.createRange()
          range.selectNodeContents(element)
          return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size
        })
        assert.equal(lines, 1, `Balance and status must remain readable at ${width}px`)
      }
      await page.getByRole('button', { name: 'Change user', exact: false }).click()
      await search.fill('no-such-customer')
      await page.getByText('No matching users.', { exact: true }).waitFor()
      await search.fill('8123456789')
      await list.getByRole('button', { name: /Zora Picker Test/ }).click()
      await page.locator('.admin-user-banner .admin-user-name').filter({ hasText: 'Zora Picker Test' }).waitFor()
      await list.waitFor({ state: 'detached' })
      const trigger = page.getByRole('button', { name: 'Change user', exact: false })
      await trigger.click()
      await search.fill(email)
      await option.waitFor()
      await search.press('Escape')
      await list.waitFor({ state: 'detached' })
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
      assert.equal(await page.locator('.admin-user-banner .admin-user-name').textContent(), 'Zora Picker Test')
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      assert.equal(horizontalOverflow, false, `Admin page must fit ${width}px`)
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
})
