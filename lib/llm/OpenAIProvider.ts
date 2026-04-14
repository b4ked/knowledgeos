import OpenAI from 'openai'
import type { LLMProvider } from './LLMProvider'
import type { Conventions } from '@/lib/conventions/types'
import { buildSystemPrompt } from '@/lib/conventions/defaults'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private compilationModel: string
  private queryModel: string

  constructor(
    apiKey: string,
    options?: { compilationModel?: string; queryModel?: string }
  ) {
    this.client = new OpenAI({ apiKey })
    this.compilationModel = options?.compilationModel ?? 'gpt-4o'
    this.queryModel = options?.queryModel ?? 'gpt-4o'
  }

  async compile(sources: string[], conventions: Conventions): Promise<string> {
    const systemPrompt = buildSystemPrompt(conventions)
    const userContent = sources
      .map((s, i) => `## Source ${i + 1}\n\n${s}`)
      .join('\n\n---\n\n')

    const completion = await this.client.chat.completions.create({
      model: this.compilationModel,
      max_tokens: 8192,
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
      max_tokens: 2048,
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
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  }

  get embeddingModel(): string { return 'text-embedding-3-small' }
}
