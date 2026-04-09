import { defineConfig, devices } from '@playwright/test'

const VPS_URL = process.env.VPS_URL ?? 'http://localhost:4000'
const VERCEL_URL = process.env.VERCEL_URL ?? 'http://localhost:3000'
const VPS_TOKEN = process.env.VPS_API_TOKEN ?? 'knowledgeos-vps-token'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: VERCEL_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

export { VPS_URL, VERCEL_URL, VPS_TOKEN }
