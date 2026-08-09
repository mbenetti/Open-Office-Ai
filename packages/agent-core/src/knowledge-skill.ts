import type { AgentSkill } from './skill'
import type { AgentToolCall, ToolExecution } from './types'

export interface KnowledgeMatch {
  documentName: string
  knowledgeBaseName: string
  headerPath: string
  text: string
  similarityScore: number
  scoreType?: 'RRF Score' | 'Cosine Similarity' | 'BM25 Score' | undefined
  searchMode?: 'hybrid' | 'vector' | 'fts' | undefined
  searchScope?: 'chunks' | 'documents' | undefined
}

export interface KnowledgeDocInfo {
  id: string
  name: string
  sizeBytes: number
  totalChars: number
  toc?: Array<{ level: 1 | 2; title: string; offset: number }> | undefined
}

const KNOWLEDGE_SYSTEM_PROMPT = `## Knowledge Base Documents & RAG Search
You have access to local Knowledge Base documents and search tools:
1. search_knowledge_base: Perform hybrid (vector + SQLite FTS5 full-text), vector-only, or FTS-only search across Knowledge Base passages or complete documents.
2. list_knowledge_documents: List all documents in the active Knowledge Base collection along with their Table of Contents (# and ## headings with character offsets).
3. read_knowledge_document: Read/page through a Knowledge Base document's full text content by character offset OR jump directly to a section heading title from its Table of Contents.

- When answering factual questions, searching for past notes, or requiring document context, use search_knowledge_base for search, or list_knowledge_documents and read_knowledge_document to inspect full document sections via Table of Contents navigation.`

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function createKnowledgeSkill(
  searchFn: (
    query: string,
    knowledgeBaseId?: string,
    topK?: number,
    options?: { mode?: 'hybrid' | 'vector' | 'fts'; scope?: 'chunks' | 'documents' },
  ) => Promise<KnowledgeMatch[]>,
  getScopeKnowledgeBaseId?: () => string | undefined,
  listDocsFn?: (
    knowledgeBaseId?: string,
  ) => Promise<KnowledgeDocInfo[]>,
  readDocFn?: (
    docIdOrPath: string,
    offset: number,
    maxChars?: number,
  ) => Promise<{ ok: boolean; totalChars?: number; offset?: number; text?: string; error?: string }>,
): AgentSkill {
  return {
    id: 'knowledge',
    systemPrompt: KNOWLEDGE_SYSTEM_PROMPT,
    tools: [
      {
        name: 'search_knowledge_base',
        description:
          'Perform hybrid search (vector embeddings + SQLite FTS5 full-text search blended via RRF), vector-only search, or FTS-only search across Knowledge Base passages or complete documents.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query string chosen by the assistant',
            },
            mode: {
              type: 'string',
              enum: ['hybrid', 'vector', 'fts'],
              description:
                'Search method: "hybrid" (RRF blend of vector + FTS5, default), "vector" (semantic similarity), or "fts" (exact keyword/phrase BM25 match)',
            },
            scope: {
              type: 'string',
              enum: ['chunks', 'documents'],
              description:
                'Search target scope: "chunks" (passage-level, default) or "documents" (returns complete document matches)',
            },
            topK: {
              type: 'integer',
              description: 'Number of top matching results to retrieve (default 5)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_knowledge_documents',
        description:
          'List all documents in the active Knowledge Base collection, including their document IDs, names, sizes, total character counts, and Table of Contents (# and ## headings).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'read_knowledge_document',
        description:
          'Read text content of a Knowledge Base document. Jump directly to a section heading title from the Table of Contents or pass a character offset to page through text.',
        inputSchema: {
          type: 'object',
          properties: {
            index: {
              type: 'integer',
              description: '0-based index of the document from list_knowledge_documents',
            },
            docId: {
              type: 'string',
              description: 'document ID or name from the Knowledge Base document list',
            },
            offset: {
              type: 'integer',
              description: 'start character position (default 0)',
            },
            heading: {
              type: 'string',
              description:
                'heading title from the document Table of Contents to jump directly to that section',
            },
          },
        },
      },
    ],
    executeTool: async (call: AgentToolCall): Promise<ToolExecution> => {
      const userScopeId = getScopeKnowledgeBaseId?.()

      // Knowledge Base search is disabled by user
      if (userScopeId === 'NONE' || userScopeId === 'disabled') {
        return {
          output: 'Knowledge Base access is currently disabled by the user.',
          mutated: false,
          summary: `${call.name} (disabled)`,
        }
      }

      const targetKbId = userScopeId === 'ALL' || !userScopeId ? undefined : userScopeId

      if (call.name === 'list_knowledge_documents') {
        if (!listDocsFn) {
          return {
            output: 'Document listing is unavailable in this environment.',
            isError: true,
            summary: 'list_knowledge_documents',
          }
        }
        try {
          const docs = await listDocsFn(targetKbId)
          if (docs.length === 0) {
            return {
              output: 'No documents found in the active Knowledge Base collection.',
              mutated: false,
              summary: 'list_knowledge_documents - 0 docs',
            }
          }
          const formatted = docs.map((d, i) => {
            let line = `${i} | ID: ${d.id} | Name: ${d.name} | Size: ${formatSize(d.sizeBytes)} | Total Chars: ${d.totalChars}`
            if (d.toc && d.toc.length > 0) {
              const tocLines = d.toc.map(
                (t) =>
                  `    ${'  '.repeat(t.level - 1)}- ${'#'.repeat(t.level)} ${t.title} (offset: ${t.offset})`,
              )
              line += `\n  Table of Contents:\n${tocLines.join('\n')}`
            }
            return line
          })
          return {
            output: `Active Knowledge Base Documents (${docs.length}):\n\n${formatted.join('\n\n')}`,
            mutated: false,
            summary: `list_knowledge_documents - ${docs.length} docs`,
          }
        } catch (err) {
          return {
            output: `Failed to list Knowledge Base documents: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
            summary: 'list_knowledge_documents error',
          }
        }
      }

      if (call.name === 'read_knowledge_document') {
        if (!readDocFn) {
          return {
            output: 'Document reading is unavailable in this environment.',
            isError: true,
            summary: 'read_knowledge_document',
          }
        }

        const docs = listDocsFn ? await listDocsFn(targetKbId) : []
        let doc: KnowledgeDocInfo | undefined = undefined

        if (call.input.docId && typeof call.input.docId === 'string') {
          const q = call.input.docId.toLowerCase().trim()
          doc = docs.find(
            (d) =>
              d.id.toLowerCase() === q ||
              d.id.toLowerCase().replace(/^doc-/, '') === q.replace(/^doc-/, '') ||
              d.name.toLowerCase() === q ||
              d.name.toLowerCase().includes(q),
          )
        }
        if (!doc && call.input.index !== undefined) {
          const idx = Number(call.input.index)
          if (Number.isInteger(idx) && idx >= 0 && idx < docs.length) {
            doc = docs[idx]
          }
        }

        const docIdOrPath = doc ? doc.id : String(call.input.docId ?? call.input.index ?? '')
        if (!docIdOrPath) {
          return {
            output: 'Document index or ID is required (see list_knowledge_documents).',
            isError: true,
            summary: 'read_knowledge_document',
          }
        }

        let offset = Math.max(0, Number(call.input.offset) || 0)
        if (
          call.input.heading &&
          typeof call.input.heading === 'string' &&
          doc?.toc &&
          doc.toc.length > 0
        ) {
          const target = call.input.heading.toLowerCase().trim()
          const match =
            doc.toc.find((t) => t.title.toLowerCase() === target) ||
            doc.toc.find((t) => t.title.toLowerCase().includes(target))
          if (match) {
            offset = match.offset
          }
        }

        try {
          const result = await readDocFn(docIdOrPath, offset, 24000)
          if (!result.ok) {
            return {
              output: result.error ?? 'Failed to read Knowledge Base document.',
              isError: true,
              summary: `read_knowledge_document (${doc ? doc.name : docIdOrPath})`,
            }
          }
          const docName = doc ? doc.name : docIdOrPath
          const end = (result.offset ?? 0) + (result.text?.length ?? 0)
          const header = `Knowledge Base Document "${docName}", total characters ${result.totalChars}, this slice ${result.offset}-${end}${
            end < (result.totalChars ?? 0)
              ? ' (not finished, continue with offset=' + end + ')'
              : ' (end of file)'
          }`
          return {
            output: `${header}\n---\n${result.text ?? ''}`,
            mutated: false,
            summary: `read_knowledge_document ("${docName}")`,
          }
        } catch (err) {
          return {
            output: `Error reading Knowledge Base document: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
            summary: 'read_knowledge_document error',
          }
        }
      }

      if (call.name !== 'search_knowledge_base') {
        return { output: `Unknown tool: ${call.name}`, isError: true, summary: call.name }
      }

      const query = String(call.input.query ?? '').trim()
      if (!query) {
        return {
          output: 'Query string must not be empty.',
          isError: true,
          summary: 'search_knowledge_base',
        }
      }

      const topK = Math.max(1, Math.min(20, Number(call.input.topK) || 5))
      const mode = (call.input.mode as 'hybrid' | 'vector' | 'fts') || 'hybrid'
      const scope = (call.input.scope as 'chunks' | 'documents') || 'chunks'

      try {
        const matches = await searchFn(query, targetKbId, topK, { mode, scope })
        if (matches.length === 0) {
          return {
            output: `No relevant passages found in the knowledge base for query: "${query}".`,
            mutated: false,
            summary: `search_knowledge_base ("${query}") - 0 results`,
          }
        }

        const lines = matches.map(
          (m, i) =>
            `[Result ${i + 1}] Document: "${m.documentName}" | Collection: "${m.knowledgeBaseName}" | Path: ${m.headerPath} | Score (${m.scoreType ?? 'Score'}): ${m.similarityScore}\n---\n${m.text}`,
        )

        return {
          output: `Found ${matches.length} matching result(s) in the Knowledge Base (mode: ${mode}, scope: ${scope}):\n\n${lines.join('\n\n')}`,
          mutated: false,
          summary: `search_knowledge_base ("${query}") - ${matches.length} matches`,
        }
      } catch (err) {
        return {
          output: `Knowledge Base search failed: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
          summary: 'search_knowledge_base error',
        }
      }
    },
  }
}
