/**
 * Search utilities (main process) — Tavily API first, Serper Google API second, with DuckDuckGo as default fallback.
 * Runs in the main process (Node fetch) to avoid renderer CORS.
 */

import {
  COPYRIGHT_HOSTS,
  asRecord,
  safeHost,
  type ImageSearchResult,
  type WebSearchResult,
} from './shared'

export type { ImageSearchResult, WebSearchResult } from './shared'

export interface SearchOptions {
  tavilyApiKey?: string | undefined
  serperApiKey?: string | undefined
}

// ── Web search ──────────────────────────────────────────────────────

export async function tavilyWebSearch(
  query: string,
  maxResults = 6,
  apiKey: string,
): Promise<{ results: WebSearchResult[]; answer?: string; method: string } | null> {
  try {
    const resp = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
      }),
    })
    if (resp.ok) {
      const data = asRecord(await resp.json())
      const raw: unknown[] = Array.isArray(data.results) ? data.results : []
      const results: WebSearchResult[] = raw.slice(0, maxResults).map((item) => {
        const o = asRecord(item)
        return {
          title: String(o.title ?? ''),
          url: String(o.url ?? ''),
          snippet: String(o.content ?? o.snippet ?? ''),
        }
      })
      const answer =
        typeof data.answer === 'string' && data.answer.trim() ? data.answer.trim() : undefined
      if (results.length > 0) {
        return { results, ...(answer ? { answer } : {}), method: 'tavily' }
      }
    }
  } catch {
    /* fallback to next search engine */
  }
  return null
}

export async function serperWebSearch(
  query: string,
  maxResults = 6,
  apiKey: string,
): Promise<{ results: WebSearchResult[]; answer?: string; method: string } | null> {
  try {
    const resp = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: maxResults, gl: 'us', hl: 'en' }),
    })
    if (resp.ok) {
      const data = asRecord(await resp.json())
      const organic: unknown[] = Array.isArray(data.organic) ? data.organic : []
      const results: WebSearchResult[] = organic.slice(0, maxResults).map((item) => {
        const o = asRecord(item)
        return {
          title: String(o.title ?? ''),
          url: String(o.link ?? ''),
          snippet: String(o.snippet ?? ''),
        }
      })
      const answerBox = asRecord(data.answerBox)
      const answerRaw =
        answerBox.answer || answerBox.snippet || asRecord(data.knowledgeGraph).description
      const answer = typeof answerRaw === 'string' && answerRaw ? answerRaw : undefined
      if (results.length > 0) {
        return { results, ...(answer ? { answer } : {}), method: 'serper' }
      }
    }
  } catch {
    /* fallback to DuckDuckGo */
  }
  return null
}

export async function webSearch(
  query: string,
  maxResults = 6,
  options?: SearchOptions,
): Promise<{
  results: WebSearchResult[]
  answer?: string
  method: string
}> {
  // 1. Tavily API (used first if key provided)
  const tavilyKey = (options?.tavilyApiKey || process.env.TAVILY_API_KEY || '').trim()
  if (tavilyKey) {
    const tavily = await tavilyWebSearch(query, maxResults, tavilyKey)
    if (tavily) return tavily
  }

  // 2. Serper API (used if key provided)
  const serperKey = (options?.serperApiKey || process.env.SERPER_API_KEY || '').trim()
  if (serperKey) {
    const serper = await serperWebSearch(query, maxResults, serperKey)
    if (serper) return serper
  }

  // 3. DuckDuckGo fallback (works without API key)
  return { ...(await duckWebSearch(query, maxResults)), method: 'duckduckgo' }
}

// ── Image search ────────────────────────────────────────────────────

export async function imageSearch(
  query: string,
  maxResults = 8,
  options?: SearchOptions,
): Promise<{
  images: ImageSearchResult[]
  method: string
}> {
  const serperKey = (options?.serperApiKey || process.env.SERPER_API_KEY || '').trim()
  if (serperKey) {
    try {
      const resp = await fetchWithTimeout('https://google.serper.dev/images', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: Math.min(maxResults, 10), gl: 'us', hl: 'en' }),
      })
      if (resp.ok) {
        const data = asRecord(await resp.json())
        const raw: unknown[] = Array.isArray(data.images) ? data.images : []
        const images: ImageSearchResult[] = []
        for (const item of raw) {
          const img = asRecord(item)
          const imageUrl = String(img.imageUrl ?? img.original ?? '')
          if (!imageUrl) continue
          if (COPYRIGHT_HOSTS.some((d) => imageUrl.toLowerCase().includes(d))) continue
          const entry: ImageSearchResult = {
            title: String(img.title ?? ''),
            imageUrl,
            sourceUrl: String(img.link ?? ''),
            source: String(img.source ?? safeHost(img.link)),
          }
          if (typeof img.imageWidth === 'number') entry.width = img.imageWidth
          if (typeof img.imageHeight === 'number') entry.height = img.imageHeight
          images.push(entry)
          if (images.length >= maxResults) break
        }
        if (images.length) return { images, method: 'serper' }
      }
    } catch {
      /* fall back to DuckDuckGo */
    }
  }
  return { images: await duckImageSearch(query, maxResults), method: 'duckduckgo' }
}

// ── DuckDuckGo fallback (no key required) ──────────────────

async function duckWebSearch(
  query: string,
  maxResults: number,
): Promise<{ results: WebSearchResult[] }> {
  try {
    const resp = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )
    const html = await resp.text()
    const results: WebSearchResult[] = []
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null && results.length < maxResults) {
      const url = decodeDuckUrl(m[1]!)
      const title = stripTags(m[2]!)
      if (url && title) results.push({ title, url, snippet: '' })
    }
    return { results }
  } catch {
    return { results: [] }
  }
}

async function duckImageSearch(
  query: string,
  maxResults: number,
): Promise<ImageSearchResult[]> {
  try {
    const tokenResp = await fetchWithTimeout(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )
    const tokenHtml = await tokenResp.text()
    const vqd = /vqd=["']?([\d-]+)["']?/.exec(tokenHtml)?.[1]
    if (!vqd) return []
    const resp = await fetchWithTimeout(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://duckduckgo.com/' } },
    )
    const data = asRecord(await resp.json())
    const list: unknown[] = Array.isArray(data.results) ? data.results : []
    const out: ImageSearchResult[] = []
    for (const item of list.slice(0, maxResults)) {
      const img = asRecord(item)
      const imageUrl = String(img.image ?? '')
      if (!imageUrl || COPYRIGHT_HOSTS.some((d) => imageUrl.toLowerCase().includes(d))) continue
      const entry: ImageSearchResult = {
        title: String(img.title ?? ''),
        imageUrl,
        sourceUrl: String(img.url ?? ''),
        source: safeHost(img.url),
      }
      if (typeof img.width === 'number') entry.width = img.width
      if (typeof img.height === 'number') entry.height = img.height
      out.push(entry)
    }
    return out
  } catch {
    return []
  }
}

// ── utils ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim()
}

function decodeDuckUrl(href: string): string {
  const m = /[?&]uddg=([^&]+)/.exec(href)
  if (m) return decodeURIComponent(m[1]!)
  return href.startsWith('http') ? href : ''
}
