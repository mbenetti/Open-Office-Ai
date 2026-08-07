import { describe, expect, it, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { KnowledgeStore } from '../src/main/knowledge-store'

const TEST_DIR = join(tmpdir(), `test-knowledge-store-${Date.now()}`)
const TEST_STORE_PATH = join(TEST_DIR, 'knowledge-store.json')

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

/** Seed a store file with two extra collections and one chunk each. */
function seedStore(): void {
  mkdirSync(TEST_DIR, { recursive: true })
  writeFileSync(
    TEST_STORE_PATH,
    JSON.stringify(
      {
        folders: [
          { id: 'default-kb', name: 'Default Collection', createdAtMs: 1 },
          { id: 'kb-dam', name: 'DAM', createdAtMs: 2 },
          { id: 'kb-finance', name: 'Finance', createdAtMs: 3 },
        ],
        documents: [
          {
            id: 'doc-1',
            knowledgeBaseId: 'kb-dam',
            name: 'dam.md',
            path: 'dam.md',
            ext: 'md',
            sizeBytes: 1,
            addedAtMs: 1,
            chunkCount: 1,
            totalChars: 1,
          },
          {
            id: 'doc-2',
            knowledgeBaseId: 'kb-finance',
            name: 'fin.md',
            path: 'fin.md',
            ext: 'md',
            sizeBytes: 1,
            addedAtMs: 1,
            chunkCount: 1,
            totalChars: 1,
          },
        ],
        chunks: [
          {
            id: 'chunk-1',
            documentId: 'doc-1',
            knowledgeBaseId: 'kb-dam',
            chunkIndex: 0,
            headerPath: '',
            text: 'ISO 27001 compliance requirement',
            charCount: 1,
          },
          {
            id: 'chunk-2',
            documentId: 'doc-2',
            knowledgeBaseId: 'kb-finance',
            chunkIndex: 0,
            headerPath: '',
            text: 'Quarterly revenue grew 12 percent',
            charCount: 1,
          },
        ],
      },
      null,
      2,
    ),
  )
}

describe('KnowledgeStore', () => {
  it('initializes with default collection', async () => {
    const store = new KnowledgeStore(TEST_STORE_PATH)
    const kbs = await store.listKnowledgeBases()
    expect(kbs).toHaveLength(1)
    expect(kbs[0]!.name).toBe('Default Collection')
  })

  it('creates new collections and persists them', async () => {
    const store1 = new KnowledgeStore(TEST_STORE_PATH)
    await store1.createKnowledgeBase('DAM')
    await store1.createKnowledgeBase('Finance')

    const kbs1 = await store1.listKnowledgeBases()
    expect(kbs1.map((k) => k.name)).toContain('DAM')
    expect(kbs1.map((k) => k.name)).toContain('Finance')

    // Test a second instance reading from the same persisted file
    const store2 = new KnowledgeStore(TEST_STORE_PATH)
    const kbs2 = await store2.listKnowledgeBases()
    expect(kbs2.map((k) => k.name)).toContain('DAM')
    expect(kbs2.map((k) => k.name)).toContain('Finance')
  })

  it('lists every created collection, not just the default', async () => {
    seedStore()
    const store = new KnowledgeStore(TEST_STORE_PATH)
    const kbs = await store.listKnowledgeBases()
    expect(kbs.map((k) => k.name)).toEqual(['Default Collection', 'DAM', 'Finance'])
  })

  it('filters search results strictly to the selected collection', async () => {
    seedStore()
    const store = new KnowledgeStore(TEST_STORE_PATH)
    const matches = await store.searchKnowledgeBase('revenue', 'kb-finance')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.knowledgeBaseId).toBe('kb-finance')
    expect(matches[0]!.text).toContain('revenue')
  })

  it('does not fall back to other collections when the selected one has no chunks', async () => {
    seedStore()
    const store = new KnowledgeStore(TEST_STORE_PATH)
    // 'kb-dam' has chunks but none match 'revenue'; the finance chunk must NOT leak in.
    const matches = await store.searchKnowledgeBase('revenue', 'kb-dam')
    expect(matches.every((m) => m.knowledgeBaseId === 'kb-dam')).toBe(true)
  })

  it('treats a collection with no documents as an empty result set', async () => {
    seedStore()
    const store = new KnowledgeStore(TEST_STORE_PATH)
    const matches = await store.searchKnowledgeBase('revenue', 'kb-empty')
    expect(matches).toHaveLength(0)
  })

  it('supports comma-separated multi-collection selection from the chatbox', async () => {
    seedStore()
    const store = new KnowledgeStore(TEST_STORE_PATH)
    const matches = await store.searchKnowledgeBase('quarterly', 'kb-dam,kb-finance')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.knowledgeBaseId).toBe('kb-finance')
  })
})
