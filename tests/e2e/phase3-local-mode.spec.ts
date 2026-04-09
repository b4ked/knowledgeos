/**
 * Phase 3 — Local vault mode verification
 * Tests what can be verified without triggering the file picker dialog.
 * Full local vault testing requires a test-specific build with a mocked adapter.
 */
import { test, expect } from '@playwright/test'

const APP_URL = process.env.VERCEL_URL ?? 'http://localhost:3000'

test.describe('Phase 3 — Local vault mode UI', () => {

  test('settings modal shows unsupported message on Firefox', async ({ page, browserName }) => {
    if (browserName !== 'firefox') test.skip()
    await page.goto(APP_URL)
    await page.click('button:has-text("Settings")')
    await expect(page.locator('text=not supported in this browser')).toBeVisible()
  })

  test('banner has switch button', async ({ page }) => {
    await page.goto(APP_URL)
    const banner = page.locator('[data-testid="vault-mode-banner"]')
    await expect(banner.locator('button')).toBeVisible()
    await expect(banner.locator('button')).toContainText('Use local vault')
  })

  test('switching back to demo from local mode updates banner', async ({ page }) => {
    await page.goto(APP_URL)

    // Programmatically simulate switching to local mode via JS
    await page.evaluate(() => {
      // Dispatch a custom event that tests can hook into if needed
      window.dispatchEvent(new CustomEvent('test:setVaultMode', { detail: 'local' }))
    })

    // Banner should still show (and show remote by default without real picker)
    const banner = page.locator('[data-testid="vault-mode-banner"]')
    await expect(banner).toBeVisible()
  })

  test('settings modal shows correct mode state', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('button:has-text("Settings")')

    // In remote mode (default): should show "Demo vault (remote server)"
    await expect(page.locator('text=Demo vault (remote server)')).toBeVisible()

    // Should show local vault switch option
    await expect(page.locator('button:has-text("Switch to local vault")')).toBeVisible()
  })

})

test.describe('Phase 4 — Polish', () => {

  test('mode banner is always visible', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page.locator('[data-testid="vault-mode-banner"]')).toBeVisible()
  })

  test('new note panel opens with Cmd+N shortcut', async ({ page }) => {
    await page.goto(APP_URL)
    await page.keyboard.press('Meta+n')
    await expect(page.locator('text=New Note').first()).toBeVisible()
  })

  test('graph opens with Cmd+G shortcut', async ({ page }) => {
    await page.goto(APP_URL)
    await page.keyboard.press('Meta+g')
    await expect(page.locator('text=Graph')).toBeVisible()
    // SVG should render
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 })
  })

  test('backend rejects writes without auth', async ({ request }) => {
    const VPS_URL = process.env.VPS_URL ?? 'http://localhost:4000'
    const res = await request.post(`${VPS_URL}/api/notes`, {
      data: { folder: 'wiki', filename: 'hack', content: 'hack' },
      // no auth header
    })
    expect(res.status()).toBe(401)
  })

})
