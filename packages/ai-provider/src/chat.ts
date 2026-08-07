import { httpBodyDetail } from './http-error'
import type { AiChatResponse, AiProviderConfig, AiProviderId } from './types'
import { AI_CHAT_RESPONSE_TIMEOUT_MS, createStreamWatchdog, type StreamWatchdog } from './watchdog'

async function chatAnthropic(
  wd: StreamWatchdog,
  config: AiProviderConfig,
  system: string,
  user: string,
  baseUrl = 'https://api.anthropic.com',
): Promise<AiChatResponse> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    signal: wd.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      // Fetch in the Electron main process goes through Chromium's network stack; this header avoids 403.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  wd.touch()
  if (!response.ok) {
    return {
      ok: false,
      error: `Claude HTTP ${response.status}: ${httpBodyDetail(await response.text())}`,
    }
  }
  const json = (await response.json()) as { content?: Array<{ type: string; text?: string }> }
  const content = json.content
    ?.filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
  if (!content) return { ok: false, error: 'Claude returned an empty response' }
  return { ok: true, content }
}

async function chatGemini(
  wd: StreamWatchdog,
  config: AiProviderConfig,
  system: string,
  user: string,
  baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
): Promise<AiChatResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/models/${config.model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    signal: wd.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3 },
    }),
  })
  wd.touch()
  if (!response.ok) {
    return {
      ok: false,
      error: `Gemini HTTP ${response.status}: ${httpBodyDetail(await response.text())}`,
    }
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
  if (!content) return { ok: false, error: 'Gemini returned an empty response' }
  return { ok: true, content }
}

async function chatOpenAiCompatible(
  provider: AiProviderId,
  wd: StreamWatchdog,
  baseUrl: string,
  config: AiProviderConfig,
  system: string,
  user: string,
): Promise<AiChatResponse> {
  let finalSystem = system
  if (config.disableThinking) {
    finalSystem = "<no_thinking>\n<not_think>\n<no_think>\n<no_thinkik>\n" + finalSystem + "\n\nIMPORTANT: Do not use <think> tags. Do not output your thinking process. Respond directly to the user."
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: wd.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey?.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: finalSystem },
        { role: 'user', content: user },
      ],
      temperature: config.disableThinking ? 0 : 0.3,
      ...(config.disableThinking && (provider === 'ollama' || provider === 'vllm')
        ? {
            not_think: true,
            not_think_str: "TRUE", // Support string variant if needed
          }
        : {}),
      ...(config.disableThinking && provider === 'ollama'
        ? {
            think: false,
            options: {
              not_think: true,
              not_think_str: "TRUE",
            },
          }
        : {}),
      ...(config.disableThinking && provider === 'vllm'
        ? {
            chat_template_kwargs: {
              enable_thinking: false,
            },
            extra_body: {
              chat_template_kwargs: {
                enable_thinking: false,
              },
            },
          }
        : {}),
    }),
  })
  wd.touch()
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}: ${httpBodyDetail(await response.text())}` }
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  let content = json.choices?.[0]?.message?.content
  if (!content) return { ok: false, error: 'AI returned an empty response' }
  if (config.disableThinking) {
    if (content.includes('</think>')) {
      if (content.includes('<think>')) {
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '')
      } else {
        content = content.replace(/^[\s\S]*?<\/think>/, '')
      }
    }
  }
  return { ok: true, content }
}

const OPENAI_COMPATIBLE_BASE_URLS: Partial<Record<AiProviderId, string>> = {
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
}

/** route a one-shot (non-streaming, non-tool-calling) chat call by provider id */
export async function chatForProvider(
  provider: AiProviderId,
  config: AiProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  // non-streaming: the server generates the full answer before the headers arrive,
  // so the connect phase gets the long budget; the body read then gets the idle budget
  const wd = createStreamWatchdog(signal, AI_CHAT_RESPONSE_TIMEOUT_MS)
  return wd.guard(() => {
    switch (provider) {
      case 'anthropic':
        return chatAnthropic(wd, config, system, user)
      case 'gemini':
        return chatGemini(wd, config, system, user)
      case 'deepseek':
      case 'openai':
        return chatOpenAiCompatible(
          provider,
          wd,
          OPENAI_COMPATIBLE_BASE_URLS[provider]!,
          config,
          system,
          user,
        )
      case 'ollama':
      case 'vllm':
        if (!config.baseUrl)
          return Promise.resolve({
            ok: false as const,
            error: `A ${provider} provider requires a Base URL`,
          })
        return chatOpenAiCompatible(provider, wd, config.baseUrl, config, system, user)
      case 'custom':
        if (!config.baseUrl)
          return Promise.resolve({
            ok: false as const,
            error: 'A custom provider requires a Base URL',
          })
        return chatOpenAiCompatible(provider, wd, config.baseUrl, config, system, user)
      default:
        return Promise.resolve({ ok: false as const, error: `Unknown provider: ${provider}` })
    }
  })
}
