import type { LanguageToolSettings } from './types'

export interface LanguageToolMatch {
  message: string
  shortMessage?: string
  offset: number
  length: number
  replacements: Array<{ value: string }>
  sentence?: string
  context?: {
    text: string
    offset: number
    length: number
  }
  rule?: {
    id: string
    description?: string
    category?: { id: string; name: string }
  }
}

export interface LanguageToolCheckResponse {
  ok: boolean
  language?: { code: string; name: string } | undefined
  matches?: LanguageToolMatch[] | undefined
  error?: string | undefined
}

export async function checkLanguageTool(
  text: string,
  language = 'auto',
  settings?: LanguageToolSettings,
): Promise<LanguageToolCheckResponse> {
  const rawUrl = settings?.serverUrl?.trim() || 'https://api.languagetool.org/v2'
  const serverUrl = rawUrl.replace(/\/+$/, '')
  const checkUrl = serverUrl.endsWith('/v2') ? `${serverUrl}/check` : `${serverUrl}/v2/check`

  const params = new URLSearchParams()
  params.append('text', text)
  params.append('language', language || settings?.defaultLanguage || 'auto')

  if (settings?.apiKey?.trim()) {
    params.append('apiKey', settings.apiKey.trim())
  }
  if (settings?.username?.trim()) {
    params.append('username', settings.username.trim())
  }

  try {
    const res = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (!res.ok) {
      return { ok: false, error: `LanguageTool API HTTP ${res.status}` }
    }

    const json = (await res.json()) as {
      language?: { code: string; name: string }
      matches?: LanguageToolMatch[]
    }
    return {
      ok: true,
      language: json.language,
      matches: json.matches || [],
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
