/**
 * When VAULT_MODE=remote, heavy operations (embeddings, query, compile)
 * should run on the VPS backend which has the LLM API key and a writable
 * filesystem. This helper proxies the request to the VPS.
 */
export function getVpsConfig(): { baseUrl: string; token: string } | null {
  if (process.env.VAULT_MODE !== 'remote') return null
  const baseUrl = process.env.VPS_BASE_URL
  const token = process.env.VPS_API_TOKEN
  if (!baseUrl || !token) return null
  return { baseUrl, token }
}

export async function proxyToVps(
  path: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const vps = getVpsConfig()
  if (!vps) throw new Error('VPS not configured')

  const res = await fetch(`${vps.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vps.token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
