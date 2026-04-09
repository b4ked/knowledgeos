/**
 * Phase 2 — Vercel/Frontend integration verification
 * Run with: npx playwright test tests/e2e/phase2-frontend.spec.ts
 * Requires: Next.js dev server running on localhost:3000
 */
import { test, expect } from '@playwright/test'

const APP_URL = process.env.VERCEL_URL ?? 'http://localhost:3000'

test.describe('Phase 2 — Frontend (remote mode default)', () => {

  test('app loads and shows KnowledgeOS header', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page.locator('header').getByText('KnowledgeOS')).toBeVisible()
  })

  test('vault mode banner is visible and shows remote by default', async ({ page }) => {
    await page.goto(APP_URL)
    const banner = page.locator('[data-testid="vault-mode-banner"]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Demo vault')
  })

  test('sidebar shows raw and wiki tabs', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page.locator('button:has-text("Raw")')).toBeVisible()
    await expect(page.locator('button:has-text("Wiki")')).toBeVisible()
  })

  test('wiki tab loads notes from backend', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('button:has-text("Wiki")')
    // Wait for at least one note item to appear in the sidebar
    await expect(page.locator('aside li, aside button').filter({ hasText: /\w/ }).first()).toBeVisible({ timeout: 10000 })
  })

  test('raw tab loads notes from backend', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('button:has-text("Raw")')
    await expect(page.locator('aside li, aside button').filter({ hasText: /\w/ }).first()).toBeVisible({ timeout: 10000 })
  })

  test('graph view renders nodes', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('button:has-text("Graph")')
    await expect(page.locator('svg circle').first()).toBeVisible({ timeout: 15000 })
  })

  test('settings modal shows vault mode section', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('button:has-text("Settings")')
    await expect(page.locator('text=Vault Mode')).toBeVisible()
    await expect(page.locator('text=Demo vault (remote server)')).toBeVisible()
  })

  test('settings modal shows local vault option on Chrome', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip()
    await page.goto(APP_URL)
    await page.click('button:has-text("Settings")')
    await expect(page.locator('button:has-text("Switch to local vault")')).toBeVisible()
  })

  test('clicking note in wiki tab loads content', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('button:has-text("Wiki")')
    const noteItem = page.locator('aside li, aside button').filter({ hasText: /\w/ }).first()
    await expect(noteItem).toBeVisible({ timeout: 10000 })
    await noteItem.click()
    // Content pane should show some markdown content
    await expect(page.locator('main').first()).not.toBeEmpty()
  })

  test('clicking banner switch opens settings modal', async ({ page }) => {
    await page.goto(APP_URL)
    await page.click('[data-testid="vault-mode-banner"] button')
    await expect(page.locator('text=Vault Mode')).toBeVisible()
  })

})
