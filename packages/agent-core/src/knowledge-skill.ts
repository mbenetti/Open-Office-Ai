import type { AgentSkill } from './skill'
import type { AgentToolCall, ToolExecution } from './types'

export interface KnowledgeMatch {
  documentName: string
  knowledgeBaseName: string
  headerPath: string
  text: string
  similarityScore: number
}

const KNOWLEDGE_SYSTEM_PROMPT = `## Knowledge Base RAG Search
You have access to the search_knowledge_base tool to query local vectorized knowledge base documents.
- When answering factual questions, searching for past notes, or requiring document context, call search_knowledge_base with a concise query.
- Use the returned document names, header paths, and text passages to formulate your answer. Citing sources is encouraged.`

export function createKnowledgeSkill(
  searchFn: (
    query: string,
    knowledgeBaseId?: string,
    topK?: number,
  ) => Promise<KnowledgeMatch[]>,
  getScopeKnowledgeBaseId?: () => string | undefined,
): AgentSkill {
  return {
    id: 'knowledge',
    systemPrompt: KNOWLEDGE_SYSTEM_PROMPT,
    tools: [
      {
        name: 'search_knowledge_base',
        description:
          'Perform semantic vector search across Knowledge Base documents to retrieve relevant passages, facts, and context.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The semantic query string chosen by the assistant',
            },
            topK: {
              type: 'integer',
              description: 'Number of top matching chunks to retrieve (default 5)',
            },
          },
          required: ['query'],
        },
      },
    ],
    executeTool: async (call: AgentToolCall): Promise<ToolExecution> => {
      if (call.name !== 'search_knowledge_base') {
        return { output: `Unknown tool: ${call.name}`, isError: true, summary: call.name }
      }

      const userScopeId = getScopeKnowledgeBaseId?.()

      // Option 1: Knowledge Base search is disabled by user
      if (userScopeId === 'NONE' || userScopeId === 'disabled') {
        return {
          output: 'Knowledge Base search is currently disabled by the user.',
          mutated: false,
          summary: 'search_knowledge_base (disabled)',
        }
      }

      const query = String(call.input.query ?? '').trim()
      if (!query) {
        return { output: 'Query string must not be empty.', isError: true, summary: 'search_knowledge_base' }
      }

      const topK = Math.max(1, Math.min(20, Number(call.input.topK) || 5))

      // Option 2 (ALL) vs Option 3 (Specific Collection ID)
      const targetKbId = userScopeId === 'ALL' || !userScopeId ? undefined : userScopeId

      try {
        const matches = await searchFn(query, targetKbId, topK)
        if (matches.length === 0) {
          return {
            output: `No relevant passages found in the knowledge base for query: "${query}".`,
            mutated: false,
            summary: `search_knowledge_base ("${query}") - 0 results`,
          }
        }

        const lines = matches.map(
          (m, i) =>
            `[Result ${i + 1}] Document: "${m.documentName}" | Collection: "${m.knowledgeBaseName}" | Path: ${m.headerPath} | Score: ${m.similarityScore}\n---\n${m.text}`,
        )

        return {
          output: `Found ${matches.length} matching passages in the Knowledge Base:\n\n${lines.join('\n\n')}`,
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
