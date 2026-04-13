import { getVpsConfig } from '@/lib/vpsProxy'

// Temporary debug endpoint — remove after confirming env vars are correct
export async function GET() {
  const key = process.env.OPENAI_API_KEY ?? ''
  const vps = getVpsConfig()
  return Response.json({
    LLM_PROVIDER: process.env.LLM_PROVIDER ?? '(not set)',
    OPENAI_API_KEY_prefix: key.slice(0, 14) || '(not set)',
    OPENAI_API_KEY_length: key.length,
    OPENAI_API_KEY_suffix: key.slice(-4) || '',
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    VAULT_MODE: process.env.VAULT_MODE ?? '(not set)',
    VERCEL: !!process.env.VERCEL,
    VPS_BASE_URL_raw: process.env.VPS_BASE_URL ?? '(not set)',
    VPS_API_TOKEN_set: !!process.env.VPS_API_TOKEN,
    VPS_BASE_URL_effective: vps?.baseUrl ?? '(not configured)',
  })
}
