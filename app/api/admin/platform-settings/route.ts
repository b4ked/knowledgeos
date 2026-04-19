import { requireAdmin } from '@/lib/admin/requireAdmin'
import { readPlatformSettings, writePlatformSettings } from '@/lib/admin/platformSettings'
import type { RuntimeAdminSettings } from '@/lib/admin/runtimeSettings'
import { getAnyVpsConfig } from '@/lib/vpsProxy'

async function mirrorToVps(settings: RuntimeAdminSettings) {
  const vps = getAnyVpsConfig()
  if (!vps) return
  try {
    await fetch(`${vps.baseUrl}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vps.token}`,
      },
      body: JSON.stringify({
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
      }),
    })
  } catch (err) {
    console.warn('admin platform settings: VPS mirror failed', err)
  }
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const settings = await readPlatformSettings()
  return Response.json(settings)
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const body = await request.json() as Partial<RuntimeAdminSettings>
  const settings = await writePlatformSettings(body)
  await mirrorToVps(settings)
  return Response.json({ ok: true, settings })
}
