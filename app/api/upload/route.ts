import { getVpsConfig } from '@/lib/vpsProxy'

export const maxDuration = 60

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
  '.txt', '.md', '.html', '.htm', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.rtf', '.xml', '.json',
])

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = ('.' + (file.name.split('.').pop() ?? '')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return Response.json({ error: `Unsupported file type: ${ext}` }, { status: 400 })
  }

  const vps = getVpsConfig()
  if (!vps) {
    return Response.json(
      { error: 'File import requires demo vault mode. Connect to the demo vault in Settings.' },
      { status: 501 },
    )
  }

  // Convert file to base64 so we can send it as JSON to the VPS
  // (avoids needing multipart middleware on the backend)
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const res = await fetch(`${vps.baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vps.token}`,
    },
    body: JSON.stringify({ filename: file.name, content: base64, mimeType: file.type }),
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
