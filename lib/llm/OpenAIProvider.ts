import OpenAI from 'openai'
import type { LLMProvider } from './LLMProvider'
import type { Conventions } from '@/lib/conventions/types'
import { buildSystemPrompt } from '@/lib/conventions/defaults'

const EMBEDDING_MODEL = 'text-embedding-3-small'
// Conservative char chunk to stay comfortably under the model input token limit.
const EMBEDDING_CHUNK_CHARS = 24_000

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private compilationModel: string
  private queryModel: string
  private compileMaxTokens: number
  private queryMaxTokens: number

  constructor(
    apiKey: string,
    options?: {
      compilationModel?: string
      queryModel?: string
      compileMaxTokens?: number
      queryMaxTokens?: number
    }
  ) {
    this.client = new OpenAI({ apiKey })
    this.compilationModel = options?.compilationModel ?? 'gpt-4o'
    this.queryModel = options?.queryModel ?? 'gpt-4o'
    this.compileMaxTokens = options?.compileMaxTokens ?? 8192
    this.queryMaxTokens = options?.queryMaxTokens ?? 2048
  }

  async compile(sources: string[], conventions: Conventions): Promise<string> {
    const systemPrompt = buildSystemPrompt(conventions)
    const userContent = sources
      .map((s, i) => `## Source ${i + 1}\n\n${s}`)
      .join('\n\n---\n\n')

    const completion = await this.client.chat.completions.create({
      model: this.compilationModel,
      max_tokens: this.compileMaxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    })

    const text = completion.choices[0]?.message.content
    if (!text) throw new Error('No content in OpenAI response')
    return text
  }

  async query(question: string, context: string[]): Promise<string> {
    const contextText = context
      .map((c, i) => `## Note ${i + 1}\n\n${c}`)
      .join('\n\n---\n\n')

    const completion = await this.client.chat.completions.create({
      model: this.queryModel,
      max_tokens: this.queryMaxTokens,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant answering questions based on the provided knowledge base notes. Cite which notes you drew from.',
        },
        {
          role: 'user',
          content: `Context:\n${contextText}\n\nQuestion: ${question}`,
        },
      ],
    })

    const text = completion.choices[0]?.message.content
    if (!text) throw new Error('No content in OpenAI response')
    return text
  }

  async embed(text: string): Promise<number[]> {
    const chunks = splitEmbeddingText(text)
    const response = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunks.length === 1 ? chunks[0] : chunks,
    })
    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('No embedding returned by OpenAI')
    }
    if (response.data.length === 1) return response.data[0].embedding
    return averageEmbeddings(response.data.map((d) => d.embedding))
  }

  get embeddingModel(): string { return EMBEDDING_MODEL }
}

function splitEmbeddingText(text: string): string[] {
  const clean = text.trim()
  if (!clean) return [' ']
  if (clean.length <= EMBEDDING_CHUNK_CHARS) return [clean]

  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(clean.length, start + EMBEDDING_CHUNK_CHARS)
    if (end < clean.length) {
      const boundary = clean.lastIndexOf('\n', end)
      if (boundary > start + 1000) end = boundary
    }
    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)
    start = end
  }
  return chunks.length > 0 ? chunks : [' ']
}

function averageEmbeddings(vectors: number[][]): number[] {
  const dims = vectors[0]?.length ?? 0
  if (dims === 0) throw new Error('Invalid embedding vector from OpenAI')
  const out = new Array<number>(dims).fill(0)

  for (const v of vectors) {
    if (v.length !== dims) throw new Error('Embedding dimension mismatch from OpenAI')
    for (let i = 0; i < dims; i++) out[i] += v[i]
  }
  for (let i = 0; i < dims; i++) out[i] /= vectors.length
  return out
}
