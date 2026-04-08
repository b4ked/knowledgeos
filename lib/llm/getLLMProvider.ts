import type { LLMProvider } from './LLMProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { OpenAIProvider } from './OpenAIProvider'
import type { Conventions } from '@/lib/conventions/types'

export function getLLMProvider(conventions?: Partial<Conventions>): LLMProvider {
  // conventions.provider overrides LLM_PROVIDER env var
  const provider = conventions?.provider ?? process.env.LLM_PROVIDER ?? 'anthropic'

  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY is not set')
    return new OpenAIProvider(key, {
      compilationModel: conventions?.compilationModel,
      queryModel: conventions?.queryModel,
    })
  }

  // Default: anthropic
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return new AnthropicProvider(key, {
    compilationModel: conventions?.compilationModel,
    queryModel: conventions?.queryModel,
  })
}
