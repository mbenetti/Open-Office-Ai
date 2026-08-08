import { afterEach, describe, expect, it, vi } from 'vitest'
import { webSearch } from '../src/index'

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.TAVILY_API_KEY
  delete process.env.SERPER_API_KEY
})

describe('webSearch cascade', () => {
  it('uses Tavily when tavilyApiKey is provided and successful', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ title: 'Tavily Result', url: 'https://tavily.com', content: 'Tavily snippet' }],
        answer: 'Tavily direct answer',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await webSearch('test query', 5, { tavilyApiKey: 'tvly-12345' })

    expect(res.method).toBe('tavily')
    expect(res.answer).toBe('Tavily direct answer')
    expect(res.results[0]?.title).toBe('Tavily Result')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('falls back to Serper when Tavily fails or has no key, and Serper key is present', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('serper.dev')) {
        return {
          ok: true,
          json: async () => ({
            organic: [{ title: 'Serper Result', link: 'https://google.com', snippet: 'Serper snippet' }],
          }),
        }
      }
      return { ok: false }
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await webSearch('test query', 5, { serperApiKey: 'serper-key-999' })

    expect(res.method).toBe('serper')
    expect(res.results[0]?.title).toBe('Serper Result')
  })

  it('falls back to DuckDuckGo when neither Tavily nor Serper keys are provided', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('duckduckgo')) {
        return {
          ok: true,
          text: async () => `<a class="result__a" href="/l/?uddg=https%3A%2F%2Fduckduckgo.com">Duck Result</a>`,
        }
      }
      return { ok: false }
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await webSearch('test query', 5)

    expect(res.method).toBe('duckduckgo')
    expect(res.results[0]?.title).toBe('Duck Result')
  })
})
