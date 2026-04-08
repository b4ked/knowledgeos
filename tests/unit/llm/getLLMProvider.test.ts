import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Module-level mocks — hoisted before imports
vi.mock('@/lib/llm/AnthropicProvider', () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({ _type: 'anthropic' })),
}))
vi.mock('@/lib/llm/OpenAIProvider', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({ _type: 'openai' })),
}))

import { getLLMProvider } from '@/lib/llm/getLLMProvider'
import { AnthropicProvider } from '@/lib/llm/AnthropicProvider'
import { OpenAIProvider } from '@/lib/llm/OpenAIProvider'

describe('getLLMProvider', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns AnthropicProvider when LLM_PROVIDER=anthropic', () => {
    vi.stubEnv('LLM_PROVIDER', 'anthropic')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    const provider = getLLMProvider()

    expect(AnthropicProvider).toHaveBeenCalledWith('sk-ant-test', expect.any(Object))
    expect(provider).toBeDefined()
  })

  it('returns AnthropicProvider by default when LLM_PROVIDER is unset', () => {
    vi.stubEnv('LLM_PROVIDER', '')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    getLLMProvider()

    expect(AnthropicProvider).toHaveBeenCalled()
  })

  it('returns OpenAIProvider when LLM_PROVIDER=openai', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai')
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test')

    getLLMProvider()

    expect(OpenAIProvider).toHaveBeenCalledWith('sk-openai-test', expect.any(Object))
  })

  it('conventions.provider=openai overrides LLM_PROVIDER env var', () => {
    vi.stubEnv('LLM_PROVIDER', 'anthropic')
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test')

    getLLMProvider({ provider: 'openai' })

    expect(OpenAIProvider).toHaveBeenCalled()
  })

  it('conventions.provider=anthropic overrides LLM_PROVIDER=openai', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    getLLMProvider({ provider: 'anthropic' })

    expect(AnthropicProvider).toHaveBeenCalled()
  })

  it('throws when ANTHROPIC_API_KEY is missing for anthropic provider', () => {
    vi.stubEnv('LLM_PROVIDER', 'anthropic')
    vi.stubEnv('ANTHROPIC_API_KEY', '')

    expect(() => getLLMProvider()).toThrow('ANTHROPIC_API_KEY is not set')
  })

  it('throws when OPENAI_API_KEY is missing for openai provider', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai')
    vi.stubEnv('OPENAI_API_KEY', '')

    expect(() => getLLMProvider()).toThrow('OPENAI_API_KEY is not set')
  })

  it('both providers satisfy the LLMProvider interface', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    const anthropic = getLLMProvider({ provider: 'anthropic' })
    expect(anthropic).toBeDefined()

    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test')
    const openai = getLLMProvider({ provider: 'openai' })
    expect(openai).toBeDefined()
  })
})
