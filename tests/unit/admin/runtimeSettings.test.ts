import { describe, expect, it } from 'vitest'
import { normalizeRuntimeAdminSettings } from '@/lib/admin/runtimeSettings'

describe('normalizeRuntimeAdminSettings', () => {
  it('returns defaults when settings are missing', () => {
    const result = normalizeRuntimeAdminSettings()
    expect(result.compileMaxOutputTokens).toBe(8192)
    expect(result.queryMaxOutputTokens).toBe(2048)
    expect(result.imageExtractMaxOutputTokens).toBe(1536)
    expect(result.enableOpenAIImageEnrichment).toBe(false)
    expect(result.ingestionMaxFilesPerJob).toBe(200)
    expect(result.ingestionMaxFileSizeMb).toBe(50)
    expect(result.ingestionRequestsPerMinute).toBe(120)
    expect(result.ingestionMaxConcurrentJobsPerOwner).toBe(2)
  })

  it('clamps numeric values to safe bounds', () => {
    const result = normalizeRuntimeAdminSettings({
      compileMaxOutputTokens: 999999,
      queryMaxOutputTokens: -1,
      imageExtractMaxOutputTokens: 0,
      ingestionMaxFilesPerJob: 100000,
      ingestionMaxFileSizeMb: 0,
      ingestionRequestsPerMinute: 1,
      ingestionMaxConcurrentJobsPerOwner: -10,
      enableOpenAIImageEnrichment: true,
    })

    expect(result.compileMaxOutputTokens).toBe(64000)
    expect(result.queryMaxOutputTokens).toBe(128)
    expect(result.imageExtractMaxOutputTokens).toBe(128)
    expect(result.ingestionMaxFilesPerJob).toBe(5000)
    expect(result.ingestionMaxFileSizeMb).toBe(1)
    expect(result.ingestionRequestsPerMinute).toBe(10)
    expect(result.ingestionMaxConcurrentJobsPerOwner).toBe(1)
    expect(result.enableOpenAIImageEnrichment).toBe(true)
  })
})
