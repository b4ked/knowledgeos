import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import type { LLMProvider } from '@/lib/llm/LLMProvider'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}))

import { AnthropicProvider } from '@/lib/llm/AnthropicProvider'

describe('AnthropicProvider', () => {
  beforeEach(() => mockCreate.mockClear())
  it('sends correct message structure to Anthropic', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '## Overview\n\nTest output [[Concept]]' }],
    })

    const provider = new AnthropicProvider('sk-ant-test')
    await provider.compile(['Source content'], DEFAULT_CONVENTIONS)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        system: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: expect.stringContaining('Source content') }),
        ]),
      })
    )
  })

  it('returns compiled content string', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '# Compiled Note\n\n[[Concept]]' }],
    })

    const provider = new AnthropicProvider('sk-ant-test')
    const result = await provider.compile(['raw content'], DEFAULT_CONVENTIONS)

    expect(typeof result).toBe('string')
    expect(result).toContain('Compiled Note')
  })

  it('includes all sources in the user message', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'compiled' }],
    })

    const provider = new AnthropicProvider('sk-ant-test')
    await provider.compile(['Source A', 'Source B'], DEFAULT_CONVENTIONS)

    const call = mockCreate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('Source A')
    expect(call.messages[0].content).toContain('Source B')
  })

  it('uses compilationModel option when provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
    })

    const provider = new AnthropicProvider('sk-ant-test', {
      compilationModel: 'claude-haiku-4-5-20251001',
    })
    await provider.compile(['content'], DEFAULT_CONVENTIONS)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' })
    )
  })

  it('throws typed error on API failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'))

    const provider = new AnthropicProvider('sk-ant-test')

    await expect(provider.compile(['content'], DEFAULT_CONVENTIONS)).rejects.toThrow(
      'API rate limit exceeded'
    )
  })

  it('AnthropicProvider satisfies LLMProvider interface (type check)', () => {
    const provider: LLMProvider = new AnthropicProvider('sk-ant-test')
    expect(provider).toBeDefined()
  })
})
