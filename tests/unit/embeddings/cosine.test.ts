import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from '@/lib/embeddings/cosine'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('returns 0 for zero vector', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  it('handles unit vectors correctly', () => {
    const a = [1 / Math.SQRT2, 1 / Math.SQRT2]
    const b = [1 / Math.SQRT2, 1 / Math.SQRT2]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1)
  })

  it('returns value between -1 and 1 for arbitrary vectors', () => {
    const sim = cosineSimilarity([3, 5, 1], [2, 4, 8])
    expect(sim).toBeGreaterThanOrEqual(-1)
    expect(sim).toBeLessThanOrEqual(1)
  })
})
