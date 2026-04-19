import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_CONVENTIONS } from '@/lib/conventions/defaults'
import type { LLMProvider } from '@/lib/llm/LLMProvider'

const mockChatCreate = vi.fn()
const mockEmbeddingCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create: mockChatCreate } },
    embeddings: { create: mockEmbeddingCreate },
  })),
}))

import { OpenAIProvider } from '@/lib/llm/OpenAIProvider'

describe('OpenAIProvider', () => {
  beforeEach(() => {
    mockChatCreate.mockClear()
    mockEmbeddingCreate.mockClear()
  })
  it('sends correct message structure to OpenAI', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '## Overview\n\n[[Concept]]' } }],
    })

    const provider = new OpenAIProvider('sk-openai-test')
    await provider.compile(['Source content'], DEFAULT_CONVENTIONS)

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining('Source content') }),
        ]),
      })
    )
  })

  it('returns compiled content string', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '# Compiled\n\n[[Topic]]' } }],
    })

    const provider = new OpenAIProvider('sk-openai-test')
    const result = await provider.compile(['raw content'], DEFAULT_CONVENTIONS)

    expect(typeof result).toBe('string')
    expect(result).toContain('Compiled')
  })

  it('includes all sources in the user message', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'compiled' } }],
    })

    const provider = new OpenAIProvider('sk-openai-test')
    await provider.compile(['Source A', 'Source B'], DEFAULT_CONVENTIONS)

    const call = mockChatCreate.mock.calls[0][0]
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMsg.content).toContain('Source A')
    expect(userMsg.content).toContain('Source B')
  })

  it('uses compilationModel option when provided', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'ok' } }],
    })

    const provider = new OpenAIProvider('sk-openai-test', { compilationModel: 'gpt-4o-mini' })
    await provider.compile(['content'], DEFAULT_CONVENTIONS)

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' })
    )
  })

  it('throws typed error on API failure', async () => {
    mockChatCreate.mockRejectedValueOnce(new Error('insufficient_quota'))

    const provider = new OpenAIProvider('sk-openai-test')

    await expect(provider.compile(['content'], DEFAULT_CONVENTIONS)).rejects.toThrow(
      'insufficient_quota'
    )
  })

  it('OpenAIProvider satisfies LLMProvider interface (type check)', () => {
    const provider: LLMProvider = new OpenAIProvider('sk-openai-test')
    expect(provider).toBeDefined()
  })

  it('chunks long embedding input and averages chunk vectors', async () => {
    const longText = 'a'.repeat(50_000)
    mockEmbeddingCreate.mockResolvedValueOnce({
      data: [
        { embedding: [1, 3] },
        { embedding: [3, 5] },
      ],
    })

    const provider = new OpenAIProvider('sk-openai-test')
    const result = await provider.embed(longText)

    expect(mockEmbeddingCreate).toHaveBeenCalledTimes(1)
    const call = mockEmbeddingCreate.mock.calls[0][0]
    expect(Array.isArray(call.input)).toBe(true)
    expect(call.input.length).toBeGreaterThan(1)
    expect(result).toEqual([2, 4])
  })
})
