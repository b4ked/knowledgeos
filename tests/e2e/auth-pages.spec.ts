import { test, expect } from "@playwright/test"

test.describe("Auth pages", () => {
  test("signup page renders correctly", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.getByText("Create your free account")).toBeVisible()
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible()
    await expect(page.getByRole("button", { name: /create free account/i })).toBeVisible()
    await expect(page.getByText(/sign in/i)).toBeVisible()
  })

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByText("Sign in to KnowledgeOS")).toBeVisible()
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible()
    await expect(page.getByText(/forgot password/i)).toBeVisible()
    await expect(page.getByText(/create one free/i)).toBeVisible()
  })

  test("forgot password page renders correctly", async ({ page }) => {
    await page.goto("/forgot-password")
    await expect(page.getByText("Reset your password")).toBeVisible()
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible()
  })

  test("verify email page handles missing token", async ({ page }) => {
    await page.goto("/verify-email")
    // Should show verifying state or error
    await page.waitForTimeout(1000)
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("billing page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/billing")
    await expect(page).toHaveURL(/\/login/)
  })

  test("account page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/account")
    await expect(page).toHaveURL(/\/login/)
  })

  test("usage page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/usage")
    await expect(page).toHaveURL(/\/login/)
  })

  test("main app shows sign in and sign up buttons when unauthenticated", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /sign up free/i })).toBeVisible()
  })

  test("signup form validates password match", async ({ page }) => {
    await page.goto("/signup")
    await page.fill('[placeholder="you@example.com"]', "test@example.com")
    await page.fill('[placeholder="At least 8 characters"]', "password123")
    await page.fill('[placeholder="Repeat password"]', "different123")
    await page.getByRole("button", { name: /create free account/i }).click()
    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })

  test("signup form validates password length", async ({ page }) => {
    await page.goto("/signup")
    await page.fill('[placeholder="you@example.com"]', "test@example.com")
    await page.fill('[placeholder="At least 8 characters"]', "short")
    await page.fill('[placeholder="Repeat password"]', "short")
    await page.getByRole("button", { name: /create free account/i }).click()
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible()
  })

  test("KnowledgeOS logo links to landing page from auth layout", async ({ page }) => {
    await page.goto("/signup")
    const logoLink = page.getByRole("link", { name: "KnowledgeOS" }).first()
    await expect(logoLink).toHaveAttribute("href", "/")
  })
})
