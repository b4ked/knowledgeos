import path from 'path'

export function getVaultPath(): string {
  return process.env.VAULT_PATH ? path.resolve(process.env.VAULT_PATH) : path.resolve('./vault')
}

export function getBackendUrl(): string | null {
  const url = process.env.KNOWLEDGEOS_BACKEND_URL?.trim()
  return url ? url.replace(/\/$/, '') : null
}

export function getFrontendBackendSecret(): string | null {
  const secret = process.env.KNOWLEDGEOS_BACKEND_SHARED_SECRET?.trim()
  return secret || null
}

export function getBackendSharedSecret(): string | null {
  const secret = process.env.KNOWLEDGEOS_PROXY_SECRET?.trim()
  return secret || null
}
