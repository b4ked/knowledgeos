import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider } from './LLMProvider'
import type { Conventions } from '@/lib/conventions/types'
import { buildSystemPrompt } from '@/lib/conventions/defaults'

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  private compilationModel: string
  private queryModel: string

  constructor(
    apiKey: string,
    options?: { compilationModel?: string; queryModel?: string }
  ) {
    this.client = new Anthropic({ apiKey })
    this.compilationModel = options?.compilationModel ?? 'claude-sonnet-4-6'
    this.queryModel = options?.queryModel ?? 'claude-sonnet-4-6'
  }

  async compile(sources: string[], conventions: Conventions): Promise<string> {
    const systemPrompt = buildSystemPrompt(conventions)
    const userContent = sources
      .map((s, i) => `## Source ${i + 1}\n\n${s}`)
      .join('\n\n---\n\n')

    const message = await this.client.messages.create({
      model: this.compilationModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const block = message.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') {
      throw new Error('No text block in Anthropic response')
    }
    return block.text
  }

  async query(question: string, context: string[]): Promise<string> {
    const contextText = context
      .map((c, i) => `## Note ${i + 1}\n\n${c}`)
      .join('\n\n---\n\n')

    const message = await this.client.messages.create({
      model: this.queryModel,
      max_tokens: 2048,
      system:
        'You are a helpful assistant answering questions based on the provided knowledge base notes. Cite which notes you drew from.',
      messages: [
        {
          role: 'user',
          content: `Context:\n${contextText}\n\nQuestion: ${question}`,
        },
      ],
    })

    const block = message.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') {
      throw new Error('No text block in Anthropic response')
    }
    return block.text
  }

  async embed(text: string): Promise<number[]> {
    const key = process.env.VOYAGE_API_KEY
    if (!key) {
      throw new Error(
        'VOYAGE_API_KEY is required for embeddings with the Anthropic provider. ' +
        'Add it to .env.local or switch LLM_PROVIDER=openai.'
      )
    }
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: 'voyage-3-lite' }),
    })
    if (!res.ok) throw new Error(`Voyage API error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { data: { embedding: number[] }[] }
    return data.data[0].embedding
  }

  get embeddingModel(): string { return 'voyage-3-lite' }
}
