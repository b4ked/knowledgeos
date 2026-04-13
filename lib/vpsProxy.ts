/**
 * When VAULT_MODE=remote, heavy operations (embeddings, query, compile)
 * should run on the VPS backend which has the LLM API key and a writable
 * filesystem. This helper proxies the request to the VPS.
 */
const DEFAULT_PUBLIC_VPS_BASE_URL = 'https://knos-api.parrytech.co'

function resolveVpsBaseUrl(rawBaseUrl?: string | null): string | null {
  const baseUrl = rawBaseUrl?.trim()
  if (!baseUrl) {
    return process.env.VERCEL ? DEFAULT_PUBLIC_VPS_BASE_URL : null
  }

  try {
    const url = new URL(baseUrl)
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && process.env.VERCEL) {
      return process.env.VPS_PUBLIC_BASE_URL?.trim() || DEFAULT_PUBLIC_VPS_BASE_URL
    }
    return baseUrl
  } catch {
    return baseUrl
  }
}

export function getVpsConfig(): { baseUrl: string; token: string } | null {
  if (process.env.VAULT_MODE !== 'remote') return null
  return getAnyVpsConfig()
}

export function getAnyVpsConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = resolveVpsBaseUrl(process.env.VPS_BASE_URL)
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
