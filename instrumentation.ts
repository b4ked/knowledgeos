import { config } from 'dotenv'
import { resolve } from 'path'

export function register() {
  // Force .env.local values to win over any inherited shell environment variables.
  // This ensures OPENAI_API_KEY / ANTHROPIC_API_KEY from .env.local are always used,
  // regardless of what the launching shell has set.
  config({ path: resolve(process.cwd(), '.env.local'), override: true })
}
