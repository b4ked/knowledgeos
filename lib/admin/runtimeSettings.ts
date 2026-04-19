import type { VaultSettings } from '@/lib/vault/settings'

export interface RuntimeAdminSettings {
  globalCompilationModel: string
  globalQueryModel: string
  globalImageModel: string
  enforceGlobalModels: boolean
  compileMaxOutputTokens: number
  queryMaxOutputTokens: number
  imageExtractMaxOutputTokens: number
  enableOpenAIImageEnrichment: boolean
  ingestionMaxFilesPerJob: number
  ingestionMaxFileSizeMb: number
  ingestionRequestsPerMinute: number
  ingestionMaxConcurrentJobsPerOwner: number
}

const DEFAULTS: RuntimeAdminSettings = {
  globalCompilationModel: 'gpt-4o',
  globalQueryModel: 'gpt-4o',
  globalImageModel: 'gpt-4o-mini',
  enforceGlobalModels: true,
  compileMaxOutputTokens: 8192,
  queryMaxOutputTokens: 2048,
  imageExtractMaxOutputTokens: 1536,
  enableOpenAIImageEnrichment: false,
  ingestionMaxFilesPerJob: 200,
  ingestionMaxFileSizeMb: 50,
  ingestionRequestsPerMinute: 120,
  ingestionMaxConcurrentJobsPerOwner: 2,
}

function asInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.floor(value)
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = asInt(value, fallback)
  return Math.min(max, Math.max(min, n))
}

function clampString(value: unknown, fallback: string, maxLen: number): string {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (!v) return fallback
  return v.slice(0, maxLen)
}

export function normalizeRuntimeAdminSettings(settings?: Partial<VaultSettings> | null): RuntimeAdminSettings {
  return {
    globalCompilationModel: clampString(settings?.globalCompilationModel, DEFAULTS.globalCompilationModel, 100),
    globalQueryModel: clampString(settings?.globalQueryModel, DEFAULTS.globalQueryModel, 100),
    globalImageModel: clampString(settings?.globalImageModel, DEFAULTS.globalImageModel, 100),
    enforceGlobalModels: settings?.enforceGlobalModels ?? DEFAULTS.enforceGlobalModels,
    compileMaxOutputTokens: clampInt(settings?.compileMaxOutputTokens, DEFAULTS.compileMaxOutputTokens, 256, 64000),
    queryMaxOutputTokens: clampInt(settings?.queryMaxOutputTokens, DEFAULTS.queryMaxOutputTokens, 128, 16000),
    imageExtractMaxOutputTokens: clampInt(
      settings?.imageExtractMaxOutputTokens,
      DEFAULTS.imageExtractMaxOutputTokens,
      128,
      8000,
    ),
    enableOpenAIImageEnrichment: Boolean(settings?.enableOpenAIImageEnrichment),
    ingestionMaxFilesPerJob: clampInt(settings?.ingestionMaxFilesPerJob, DEFAULTS.ingestionMaxFilesPerJob, 1, 5000),
    ingestionMaxFileSizeMb: clampInt(settings?.ingestionMaxFileSizeMb, DEFAULTS.ingestionMaxFileSizeMb, 1, 500),
    ingestionRequestsPerMinute: clampInt(
      settings?.ingestionRequestsPerMinute,
      DEFAULTS.ingestionRequestsPerMinute,
      10,
      5000,
    ),
    ingestionMaxConcurrentJobsPerOwner: clampInt(
      settings?.ingestionMaxConcurrentJobsPerOwner,
      DEFAULTS.ingestionMaxConcurrentJobsPerOwner,
      1,
      50,
    ),
  }
}
