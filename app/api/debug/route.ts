// Temporary debug endpoint — remove after confirming env vars are correct
export async function GET() {
  const key = process.env.OPENAI_API_KEY ?? ''
  return Response.json({
    LLM_PROVIDER: process.env.LLM_PROVIDER ?? '(not set)',
    OPENAI_API_KEY_prefix: key.slice(0, 14) || '(not set)',
    OPENAI_API_KEY_length: key.length,
    OPENAI_API_KEY_suffix: key.slice(-4) || '',
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
  })
}
