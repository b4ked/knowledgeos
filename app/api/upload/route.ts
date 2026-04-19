import { getAnyVpsConfig } from '@/lib/vpsProxy'
import { readPlatformSettings } from '@/lib/admin/platformSettings'

export const maxDuration = 60

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
  '.txt', '.md', '.markdown', '.html', '.htm', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.rtf', '.xml', '.json',
])

async function readPayload(request: Request): Promise<File[] | Array<{ filename: string; content: string; mimeType?: string }>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json() as {
      files?: Array<{ filename?: string; content?: string; mimeType?: string }>
      filename?: string
      content?: string
      mimeType?: string
    }

    return Array.isArray(body.files)
      ? body.files
          .filter((file): file is { filename: string; content: string; mimeType?: string } => !!file?.filename && !!file?.content)
      : body.filename && body.content
        ? [{ filename: body.filename, content: body.content, mimeType: body.mimeType }]
        : []
  }

  const formData = await request.formData()
  const entries = formData.getAll('files')
  const files = entries.filter((entry): entry is File => entry instanceof File)

  if (files.length === 0) {
    const single = formData.get('file')
    if (single instanceof File) files.push(single)
  }

  return files
}

export async function GET() {
  const vps = getAnyVpsConfig()
  if (!vps) {
    return Response.json({ error: 'VPS extraction is not configured.' }, { status: 501 })
  }
  return Response.json({ uploadUrl: `${vps.baseUrl}/api/upload-public` })
}

export async function POST(request: Request) {
  const files = await readPayload(request)
  const admin = await readPlatformSettings()

  if (files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 })
  }
  if (files.length > admin.ingestionMaxFilesPerJob) {
    return Response.json({ error: `Upload up to ${admin.ingestionMaxFilesPerJob} files at a time.` }, { status: 400 })
  }

  for (const file of files) {
    const filename = file instanceof File ? file.name : file.filename
    const ext = ('.' + (filename.split('.').pop() ?? '')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return Response.json({ error: `Unsupported file type: ${ext}` }, { status: 400 })
    }
    const bytes = file instanceof File
      ? file.size
      : Math.floor(((file.content?.replace(/\s+/g, '').length ?? 0) * 3) / 4)
    if (bytes > admin.ingestionMaxFileSizeMb * 1024 * 1024) {
      return Response.json(
        { error: `${filename} exceeds ${admin.ingestionMaxFileSizeMb}MB limit.` },
        { status: 400 },
      )
    }
  }

  const vps = getAnyVpsConfig()
  if (!vps) {
    return Response.json(
      { error: 'File import requires VPS extraction to be configured on the server.' },
      { status: 501 },
    )
  }

  const payload = await Promise.all(
    files.map(async (file) => {
      if (!(file instanceof File)) return file
      const arrayBuffer = await file.arrayBuffer()
      return {
        filename: file.name,
        content: Buffer.from(arrayBuffer).toString('base64'),
        mimeType: file.type,
      }
    }),
  )

  const res = await fetch(`${vps.baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vps.token}`,
    },
    body: JSON.stringify({ files: payload }),
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
