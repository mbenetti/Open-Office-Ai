import type { AiProviderId, AiProviderMeta, AiSettings, LegacyAiSettings } from './types'

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'API Key (Optional)',
    needsBaseUrl: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    models: [
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-opus-4-5-20251101',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
    ],
    defaultModel: 'claude-opus-4-7',
    keyPlaceholder: 'sk-ant-api03-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    models: ['deepseek-r1', 'llama3', 'mistral', 'qwen2.5'],
    defaultModel: 'deepseek-r1',
    keyPlaceholder: 'API Key (Optional)',
    needsBaseUrl: true,
  },
  {
    id: 'vllm',
    label: 'vLLM',
    models: ['qwen2.5-7b-instruct', 'deepseek-r1-distill-qwen-7b'],
    defaultModel: 'qwen2.5-7b-instruct',
    keyPlaceholder: 'API Key (Optional)',
    needsBaseUrl: true,
  },
]

/**
 * Fresh settings with every provider's default model and an empty key,
 * except providers listed in `defaultApiKeys` (e.g. an app-specific
 * preconfigured Anthropic key). Callers own that policy; this package
 * has no hardcoded keys.
 */
export function defaultAiSettings(
  defaultApiKeys?: Partial<Record<AiProviderId, string>>,
): AiSettings {
  const providers = {} as AiSettings['providers']
  for (const meta of AI_PROVIDERS) {
    providers[meta.id] = {
      apiKey: defaultApiKeys?.[meta.id] ?? '',
      model: meta.defaultModel,
      baseUrl:
        meta.id === 'custom'
          ? 'https://api.openai.com/v1'
          : meta.id === 'ollama'
            ? 'http://localhost:11434/v1'
            : meta.id === 'vllm'
              ? 'http://localhost:8000/v1'
              : undefined,
      disableThinking: false,
    }
  }
  return {
    provider: 'custom',
    providers,
    mcpServers: [],
    embedding: {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      apiKey: '',
    },
  }
}

/**
 * Merge on-disk settings over freshly computed defaults, migrating legacy shapes.
 * `stored` is whatever the caller read from its settings file (already JSON-parsed);
 * this function does no file I/O.
 */
export function resolveAiSettings(
  stored: Partial<AiSettings> & LegacyAiSettings,
  defaults: AiSettings,
): AiSettings {
  if (!stored.providers) {
    if (stored.apiKey || stored.baseUrl) {
      defaults.providers.custom = {
        apiKey: stored.apiKey ?? '',
        model: stored.model ?? 'gpt-4o-mini',
        baseUrl: stored.baseUrl ?? 'https://api.openai.com/v1',
      }
    }
    return defaults
  }
  const provider = (stored.provider as string) === 'genspark' ? 'custom' : (stored.provider ?? defaults.provider)
  return {
    provider,
    providers: { ...defaults.providers, ...stored.providers },
    mcpServers: stored.mcpServers ?? defaults.mcpServers ?? [],
    embedding: stored.embedding ?? defaults.embedding,
  }
}
