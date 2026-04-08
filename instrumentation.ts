export async function register() {
  // Only runs in the Node.js runtime (not Edge) — dotenv and path are Node-only
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { config } = await import('dotenv')
    const { resolve } = await import('path')
    config({ path: resolve(process.cwd(), '.env.local'), override: true })
  }
}
