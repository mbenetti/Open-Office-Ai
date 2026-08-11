import type { AiSettings, GrammarLanguage } from './types'
import { chatForProvider } from './chat'

export interface GrammarCorrectionRequest {
  text: string
  language?: GrammarLanguage | undefined
  settings?: AiSettings | undefined
}

export interface GrammarCorrectionResponse {
  ok: boolean
  correctedText?: string
  language?: string
  engineUsed?: 'llm'
  error?: string
}

export async function correctGrammar(
  request: GrammarCorrectionRequest,
): Promise<GrammarCorrectionResponse> {
  const text = request.text.trim()
  if (!text) {
    return { ok: true, correctedText: '' }
  }

  const configuredLang = request.language || request.settings?.grammar?.language || 'auto'
  const engine = request.settings?.grammar?.engine || 'auto'

  // Detect Spanish if auto or if text contains Spanish characters/words
  let targetLang: 'en' | 'es' = 'en'
  if (configuredLang === 'es') {
    targetLang = 'es'
  } else if (configuredLang === 'auto') {
    const spanishWords =
      /\b(el|la|los|las|un|una|unos|unas|y|en|con|que|por|para|esta|estan|es|son|del|al|como)\b/i
    if (spanishWords.test(text) || /[áéíóúñ¿¡]/i.test(text)) {
      targetLang = 'es'
    }
  }

  // 2. Active LLM Provider (Fallback or Primary)
  if (request.settings) {
    try {
      const provider = request.settings.provider
      const config = request.settings.providers[provider]
      if (config) {
        const systemPrompt =
          targetLang === 'es'
            ? `Eres un corrector ortográfico y gramatical profesional de español. Tu única tarea es corregir la gramática, ortografía y puntuación del texto proporcionado. Devuelve ÚNICAMENTE el texto corregido, sin explicaciones, sin comillas adicionales ni introducción.`
            : `You are a professional grammar and spelling corrector. Fix any grammar, spelling, or punctuation errors in the text. Return ONLY the corrected text, with no explanations, extra quotes, or intro.`

        const userPrompt = `Text to correct:\n${text}`
        const chatRes = await chatForProvider(provider, config, systemPrompt, userPrompt)

        if (chatRes.ok && chatRes.content) {
          let corrected = chatRes.content.trim()
          if (corrected.startsWith('"') && corrected.endsWith('"') && !text.startsWith('"')) {
            corrected = corrected.slice(1, -1).trim()
          }
          return {
            ok: true,
            correctedText: corrected,
            language: targetLang,
            engineUsed: 'llm',
          }
        }
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  return { ok: false, error: 'Grammar correction engine unavailable' }
}
