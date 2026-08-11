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
  engineUsed?: 'transformer' | 'llm'
  error?: string
}

let transformerPipelinePromise: Promise<any> | null = null

async function getTransformerPipeline() {
  if (!transformerPipelinePromise) {
    transformerPipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers')
      return pipeline('text2text-generation', 'Xenova/flan-t5-small')
    })().catch((err) => {
      console.warn('[grammar] Failed to initialize local ONNX transformer pipeline:', err)
      transformerPipelinePromise = null
      throw err
    })
  }
  return transformerPipelinePromise
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

  // 1. Local Transformer ONNX (@xenova/transformers)
  if (engine === 'transformer' || engine === 'auto') {
    try {
      const pipe = await getTransformerPipeline()
      const prompt =
        targetLang === 'es'
          ? `Corrige la gramática y ortografía en español: "${text}"`
          : `Fix grammar: ${text}`

      const res = await pipe(prompt, {
        max_new_tokens: Math.max(128, Math.ceil(text.length * 1.5)),
      })

      let corrected = res?.[0]?.generated_text?.trim() || ''

      // Clean wrapping quotes if the model echoed them
      if (corrected.startsWith('"') && corrected.endsWith('"') && !text.startsWith('"')) {
        corrected = corrected.slice(1, -1).trim()
      }

      if (corrected && corrected !== prompt) {
        return {
          ok: true,
          correctedText: corrected,
          language: targetLang,
          engineUsed: 'transformer',
        }
      }
    } catch (err) {
      if (engine === 'transformer') {
        console.warn('[grammar] Local ONNX transformer failed:', err)
      }
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
