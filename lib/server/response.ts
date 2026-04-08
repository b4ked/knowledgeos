import { ApiError, isApiError } from './errors'

export function jsonError(error: unknown): Response {
  if (isApiError(error)) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error'
  return Response.json({ error: message }, { status: 500 })
}

export function errorDetails(error: unknown): { status: number; message: string } {
  if (isApiError(error)) {
    return { status: error.status, message: error.message }
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error'
  return { status: 500, message }
}

export function configError(message: string): never {
  throw new ApiError(500, message)
}
