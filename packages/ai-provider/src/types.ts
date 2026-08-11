import type { AgentMessage, AgentToolCall, AgentToolDef } from '@genoffice/agent-core'

export type AiProviderId = 'custom' | 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'ollama' | 'vllm'

export type EmbeddingProviderId = 'openai' | 'ollama'

export interface EmbeddingProviderConfig {
  provider: EmbeddingProviderId
  baseUrl?: string | undefined
  model: string
  apiKey?: string | undefined
}

export const EMBEDDING_PROVIDERS: Array<{
  id: EmbeddingProviderId
  label: string
  defaultBaseUrl: string
  defaultModel: string
}> = [
  {
    id: 'openai',
    label: 'OpenAI-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'text-embedding-3-small',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'nomic-embed-text',
  },
]

export interface McpServerConfig {
  id: string
  name: string
  type: 'sse' | 'stdio'
  url?: string
  command?: string
  enabled: boolean
}

export interface AiProviderConfig {
  apiKey: string
  model: string
  /** only used by the custom (OpenAI-compatible) provider */
  baseUrl?: string | undefined
  disableThinking?: boolean
}

export interface AiProviderMeta {
  id: AiProviderId
  label: string
  models: string[]
  defaultModel: string
  keyPlaceholder: string
  needsBaseUrl?: boolean
}

export interface AiSearchSettings {
  tavilyApiKey?: string | undefined
  serperApiKey?: string | undefined
}

export interface LanguageToolSettings {
  enabled?: boolean | undefined
  serverUrl?: string | undefined
  apiKey?: string | undefined
  username?: string | undefined
  defaultLanguage?: string | undefined
}

export type GrammarLanguage = 'en' | 'es' | 'auto'
export type GrammarEngineMode = 'llm' | 'auto'

export interface GrammarSettings {
  enabled: boolean
  language: GrammarLanguage
  engine: GrammarEngineMode
}

export interface AiSettings {
  provider: AiProviderId
  providers: Record<AiProviderId, AiProviderConfig>
  mcpServers?: McpServerConfig[] | undefined
  embedding?: EmbeddingProviderConfig | undefined
  search?: AiSearchSettings | undefined
  grammar?: GrammarSettings | undefined
  languageTool?: LanguageToolSettings | undefined
}

/** pre-provider settings shape (single OpenAI-compatible endpoint); migrated into "custom" */
export interface LegacyAiSettings {
  baseUrl?: string
  apiKey?: string
  model?: string
}

export interface AiChatRequest {
  settings: AiSettings
  system: string
  user: string
}

export interface AiChatResponse {
  ok: boolean
  content?: string
  error?: string
}

export interface AiStreamRequest {
  requestId: string
  settings: AiSettings
  system: string
  messages: AgentMessage[]
  tools?: AgentToolDef[]
  maxTokens?: number
}

export interface AiStreamChunk {
  requestId: string
  /** 'ping' = wire-level keepalive so the renderer can tell a live stream from a dead one */
  type: 'delta' | 'tool-call' | 'done' | 'error' | 'ping'
  text?: string
  /** complete parsed tool call (emitted once its arguments finish streaming) */
  toolCall?: AgentToolCall
  error?: string
  /** machine-readable error cause ('timeout', exhausted 'credits'); lets the renderer localize the message */
  errorCode?: 'timeout' | 'credits'
  /** normalized stop reason carried on 'done' ('max_tokens' = output cut off by the token limit) */
  stopReason?: string
}
