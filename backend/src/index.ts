import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express'
import { BACKEND_SHARED_SECRET_HEADER } from '@/lib/server/auth'
import { compileNotes } from '@/lib/server/compile'
import { readConventions, saveConventions } from '@/lib/server/conventions'
import { reindexEmbeddings } from '@/lib/server/embeddings'
import { getGraph } from '@/lib/server/graph'
import { createNote, deleteNote, listNotes, readNote } from '@/lib/server/notes'
import { queryVault } from '@/lib/server/query'
import { getBackendSharedSecret, getVaultPath } from '@/lib/server/config'
import { errorDetails } from '@/lib/server/response'

const app = express()
const port = Number(process.env.PORT || 8787)

app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    provider: process.env.LLM_PROVIDER ?? 'anthropic',
    vaultPath: getVaultPath(),
    timestamp: new Date().toISOString(),
  })
})

app.use('/api', (req, res, next) => {
  const expectedSecret = getBackendSharedSecret()
  if (!expectedSecret) {
    res.status(500).json({ error: 'KNOWLEDGEOS_PROXY_SECRET is not set' })
    return
  }

  const providedSecret = req.header(BACKEND_SHARED_SECRET_HEADER)
  if (providedSecret !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
})

app.get('/api/notes', asyncHandler(async (req, res) => {
  res.json(await listNotes(singleQueryValue(req.query.folder)))
}))

app.post('/api/notes', asyncHandler(async (req, res) => {
  res.status(201).json(await createNote(req.body))
}))

app.get('/api/notes/:slug', asyncHandler(async (req, res) => {
  res.json(await readNote(singleParamValue(req.params.slug), singleQueryValue(req.query.folder)))
}))

app.delete('/api/notes/:slug', asyncHandler(async (req, res) => {
  await deleteNote(singleParamValue(req.params.slug), singleQueryValue(req.query.folder))
  res.status(204).send()
}))

app.post('/api/compile', asyncHandler(async (req, res) => {
  res.json(await compileNotes(req.body))
}))

app.post('/api/query', asyncHandler(async (req, res) => {
  res.json(await queryVault(req.body))
}))

app.get('/api/graph', asyncHandler(async (_req, res) => {
  res.json(await getGraph())
}))

app.post('/api/embeddings/reindex', asyncHandler(async (_req, res) => {
  res.json(await reindexEmbeddings())
}))

app.get('/api/conventions', asyncHandler(async (_req, res) => {
  res.json(await readConventions())
}))

app.put('/api/conventions', asyncHandler(async (req, res) => {
  res.json(await saveConventions(req.body))
}))

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const details = errorDetails(error)
  res.status(details.status).json({ error: details.message })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`KnowledgeOS backend listening on http://0.0.0.0:${port}`)
})

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }
}

function singleQueryValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null
  }

  return typeof value === 'string' ? value : null
}

function singleParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return value ?? ''
}
