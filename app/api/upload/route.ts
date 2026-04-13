import { getAnyVpsConfig } from '@/lib/vpsProxy'

export const maxDuration = 60

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
  '.txt', '.md', '.markdown', '.html', '.htm', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.rtf', '.xml', '.json',
])

export async function POST(request: Request) {
  const formData = await request.formData()
  const entries = formData.getAll('files')
  const files = entries.filter((entry): entry is File => entry instanceof File)

  if (files.length === 0) {
    const single = formData.get('file')
    if (single instanceof File) files.push(single)
  }

  if (files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 })
  }
  if (files.length > 10) {
    return Response.json({ error: 'Upload up to 10 files at a time.' }, { status: 400 })
  }

  for (const file of files) {
    const ext = ('.' + (file.name.split('.').pop() ?? '')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return Response.json({ error: `Unsupported file type: ${ext}` }, { status: 400 })
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
