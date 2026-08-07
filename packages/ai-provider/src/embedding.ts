import type { EmbeddingProviderConfig } from './types'

/**
 * Generate a vector embedding for a string using the configured embedding provider
 * (OpenAI-compatible or Ollama).
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingProviderConfig,
): Promise<number[]> {
  const provider = config.provider ?? 'openai'
  const baseUrl = (config.baseUrl ?? (provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1')).replace(/\/+$/, '')
  const model = config.model || (provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small')
  const apiKey = config.apiKey?.trim() ?? ''

  if (provider === 'ollama') {
    // Ollama embeddings endpoint
    const url = `${baseUrl}/api/embeddings`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Ollama embedding request failed (${res.status}): ${errText || res.statusText}`)
    }

    const data = (await res.json()) as { embedding?: number[] }
    if (Array.isArray(data.embedding)) {
      return data.embedding
    }
    throw new Error('Invalid embedding response from Ollama endpoint')
  }

  // OpenAI-compatible embeddings endpoint
  const url = `${baseUrl}/embeddings`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI embedding request failed (${res.status}): ${errText || res.statusText}`)
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>
  }

  const vec = data.data?.[0]?.embedding
  if (Array.isArray(vec)) {
    return vec
  }

  throw new Error('Invalid embedding response from OpenAI-compatible endpoint')
}

/**
 * Compute cosine similarity score (-1.0 to 1.0) between two equal-length vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const valA = a[i]!
    const valB = b[i]!
    dotProduct += valA * valB
    normA += valA * valA
    normB += valB * valB
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
