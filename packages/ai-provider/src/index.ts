export type {
  AiChatRequest,
  AiChatResponse,
  AiProviderConfig,
  AiProviderId,
  AiProviderMeta,
  AiSettings,
  AiStreamChunk,
  AiStreamRequest,
  EmbeddingProviderConfig,
  EmbeddingProviderId,
  McpServerConfig,
  GrammarSettings,
  GrammarLanguage,
  GrammarEngineMode,
  LanguageToolSettings,
  LegacyAiSettings,
} from './types'
export { EMBEDDING_PROVIDERS } from './types'
export {
  AI_PROVIDERS,
  defaultAiSettings,
  resolveAiSettings,
} from './providers'
export { generateEmbedding, cosineSimilarity } from './embedding'
export { correctGrammar, type GrammarCorrectionRequest, type GrammarCorrectionResponse } from './grammar'
export {
  checkLanguageTool,
  type LanguageToolMatch,
  type LanguageToolCheckResponse,
} from './languagetool'
export { chatForProvider } from './chat'
export { AiCreditsError, sseLines, streamForProvider } from './stream'
export type { StreamCallbacks } from './stream'
export {
  AI_CHAT_RESPONSE_TIMEOUT_MS,
  AI_CONNECT_TIMEOUT_MS,
  AI_IDLE_TIMEOUT_MS,
  AiTimeoutError,
  createStreamWatchdog,
} from './watchdog'
export type { StreamWatchdog } from './watchdog'
