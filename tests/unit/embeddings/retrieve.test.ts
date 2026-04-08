import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LLMProvider } from '@/lib/llm/LLMProvider'

// Mock the store and adapter modules
vi.mock('@/lib/embeddings/store', () => ({
  readStore: vi.fn(),
}))

vi.mock('@/lib/vault/LocalVaultAdapter', () => ({
  LocalVaultAdapter: vi.fn().mockImplementation(() => ({
    readNote: vi.fn(),
  })),
}))

import { retrieveContext } from '@/lib/embeddings/retrieve'
import { readStore } from '@/lib/embeddings/store'
import { LocalVaultAdapter } from '@/lib/vault/LocalVaultAdapter'

const mockReadStore = vi.mocked(readStore)
const mockAdapterConstructor = vi.mocked(LocalVaultAdapter)

function makeMockLLM(embedding: number[]): LLMProvider {
  return {
    compile: vi.fn(),
    query: vi.fn(),
    embed: vi.fn().mockResolvedValue(embedding),
    embeddingModel: 'test-model',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('retrieveContext', () => {
  it('returns top-K results by cosine similarity', async () => {
    // Question embedding: points in direction of note-b
    const questionVec = [0, 1]
    const store = {
      'note-a': [1, 0],  // orthogonal to question
      'note-b': [0, 1],  // identical to question
      'note-c': [0.5, 0.5], // 45 degrees
    }
    mockReadStore.mockResolvedValue(store)

    const mockAdapter = { readNote: vi.fn().mockResolvedValue('content') }
    mockAdapterConstructor.mockImplementation(() => mockAdapter as never)

    const llm = makeMockLLM(questionVec)
    const results = await retrieveContext('test question', '/vault', llm, 2)

    expect(results).toHaveLength(2)
    expect(results[0].slug).toBe('note-b')
    expect(results[1].slug).toBe('note-c')
  })

  it('returns fewer results if store has fewer than topK entries', async () => {
    mockReadStore.mockResolvedValue({ 'only-note': [1, 0] })
    const mockAdapter = { readNote: vi.fn().mockResolvedValue('content') }
    mockAdapterConstructor.mockImplementation(() => mockAdapter as never)

    const llm = makeMockLLM([1, 0])
    const results = await retrieveContext('q', '/vault', llm, 5)
    expect(results).toHaveLength(1)
  })

  it('returns empty array if store is empty', async () => {
    mockReadStore.mockResolvedValue({})
    const llm = makeMockLLM([1, 0])
    const results = await retrieveContext('q', '/vault', llm)
    expect(results).toHaveLength(0)
  })

  it('includes content and slug in results', async () => {
    mockReadStore.mockResolvedValue({ 'my-note': [1, 0] })
    const mockAdapter = { readNote: vi.fn().mockResolvedValue('Note body text') }
    mockAdapterConstructor.mockImplementation(() => mockAdapter as never)

    const llm = makeMockLLM([1, 0])
    const results = await retrieveContext('q', '/vault', llm, 1)

    expect(results[0].slug).toBe('my-note')
    expect(results[0].content).toBe('Note body text')
  })
})
