import { describe, expect, it } from 'vitest'
import { cosineSimilarity } from '../src/embedding'

describe('cosineSimilarity', () => {
  it('computes exact match as 1.0', () => {
    const vec = [0.1, 0.2, 0.3, 0.4]
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5)
  })

  it('computes orthogonal vectors as 0.0', () => {
    const vecA = [1, 0]
    const vecB = [0, 1]
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0, 5)
  })

  it('computes opposite vectors as -1.0', () => {
    const vecA = [1, 2, 3]
    const vecB = [-1, -2, -3]
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0, 5)
  })

  it('returns 0 for empty or mismatched vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })
})
