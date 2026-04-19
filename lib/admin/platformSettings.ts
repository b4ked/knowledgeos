import { db } from '@/lib/db'
import { platformSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { normalizeRuntimeAdminSettings, type RuntimeAdminSettings } from '@/lib/admin/runtimeSettings'
import { readSettings } from '@/lib/vault/settings'

const SETTINGS_ROW_ID = 1

function toDbRow(settings: RuntimeAdminSettings) {
  return {
    id: SETTINGS_ROW_ID,
    globalCompilationModel: settings.globalCompilationModel,
    globalQueryModel: settings.globalQueryModel,
    globalImageModel: settings.globalImageModel,
    enforceGlobalModels: settings.enforceGlobalModels,
    compileMaxOutputTokens: settings.compileMaxOutputTokens,
    queryMaxOutputTokens: settings.queryMaxOutputTokens,
    imageExtractMaxOutputTokens: settings.imageExtractMaxOutputTokens,
    enableOpenAIImageEnrichment: settings.enableOpenAIImageEnrichment,
    ingestionMaxFilesPerJob: settings.ingestionMaxFilesPerJob,
    ingestionMaxFileSizeMb: settings.ingestionMaxFileSizeMb,
    ingestionRequestsPerMinute: settings.ingestionRequestsPerMinute,
    ingestionMaxConcurrentJobsPerOwner: settings.ingestionMaxConcurrentJobsPerOwner,
    updatedAt: new Date(),
  }
}

export async function readPlatformSettings(): Promise<RuntimeAdminSettings> {
  try {
    const [row] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, SETTINGS_ROW_ID))
      .limit(1)
    if (row) return normalizeRuntimeAdminSettings(row)
  } catch {
    // DB table may not be migrated yet — fallback below
  }

  const fileSettings = await readSettings()
  return normalizeRuntimeAdminSettings(fileSettings)
}

export async function writePlatformSettings(update: Partial<RuntimeAdminSettings>): Promise<RuntimeAdminSettings> {
  const current = await readPlatformSettings()
  const normalized = normalizeRuntimeAdminSettings({ ...current, ...update })

  try {
    await db
      .insert(platformSettings)
      .values(toDbRow(normalized))
      .onConflictDoUpdate({
        target: platformSettings.id,
        set: { ...toDbRow(normalized), id: SETTINGS_ROW_ID },
      })
  } catch {
    // If DB is unavailable, caller can still decide whether to mirror to VPS/file settings.
  }

  return normalized
}
