import type { Folder } from './contracts'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function requireFolder(folder: string | null): Folder {
  if (folder === 'raw' || folder === 'wiki') {
    return folder
  }

  throw new ApiError(400, 'folder must be raw or wiki')
}

export function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  throw new ApiError(400, message)
}
