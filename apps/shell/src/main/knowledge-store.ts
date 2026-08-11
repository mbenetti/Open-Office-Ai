import { readFile, writeFile, mkdir, stat, rename, unlink } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseFileToText, chunkMarkdownDocument, extractToc, type DocumentChunk, type TocItem } from '@genoffice/file-parse'
import { generateEmbedding, cosineSimilarity, type EmbeddingProviderConfig } from '@genoffice/ai-provider'

export interface KnowledgeBaseFolder {
  id: string
  name: string
  description?: string | undefined
  createdAtMs: number
}

export interface KnowledgeDocument {
  id: string
  knowledgeBaseId: string
  name: string
  path: string
  ext: string
  sizeBytes: number
  addedAtMs: number
  chunkCount: number
  totalChars: number
  toc?: TocItem[] | undefined
  mdPath?: string | undefined
}

export interface KnowledgeChunkRecord {
  id: string
  documentId: string
  knowledgeBaseId: string
  chunkIndex: number
  headerPath: string
  text: string
  charCount: number
  embedding?: number[]
}

export interface KnowledgeDocumentPreview {
  document: KnowledgeDocument
  chunks: KnowledgeChunkRecord[]
  fullText: string
}

export interface SearchResultMatch {
  documentId: string
  documentName: string
  knowledgeBaseId: string
  knowledgeBaseName: string
  chunkIndex: number
  headerPath: string
  text: string
  similarityScore: number
  scoreType?: 'RRF Score' | 'Cosine Similarity' | 'BM25 Score' | undefined
  searchMode?: 'hybrid' | 'vector' | 'fts' | undefined
  searchScope?: 'chunks' | 'documents' | undefined
}

interface LegacyStoredKnowledgeData {
  folders: KnowledgeBaseFolder[]
  documents: KnowledgeDocument[]
  chunks: KnowledgeChunkRecord[]
}

const DEFAULT_FOLDER_ID = 'default-kb'
const DEFAULT_FOLDER_NAME = 'Default Collection'

function sanitizeFtsQuery(q: string): string {
  const terms = q.replace(/[^\w\s\u00C0-\u024F\u4E00-\u9FFF]/g, ' ').split(/\s+/).filter(Boolean)
  if (terms.length === 0) return ''
  return terms.map((t) => `"${t}"*`).join(' AND ')
}

export class KnowledgeStore {
  private readonly dbPath: string
  private readonly jsonStorePath: string
  private db: DatabaseSync | null = null
  private kbDocCache = new Map<string, { text: string; mtimeMs: number }>()

  constructor(storePath: string) {
    this.jsonStorePath = storePath
    this.dbPath = storePath.replace(/\.json$/i, '.sqlite')
  }

  private initDatabase(): DatabaseSync {
    if (this.db) return this.db

    const dir = join(this.dbPath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const db = new DatabaseSync(this.dbPath)
    db.exec('PRAGMA foreign_keys = ON;')

    // Create primary schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        knowledge_base_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        ext TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        added_at_ms INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        total_chars INTEGER NOT NULL,
        toc_json TEXT,
        md_path TEXT
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        knowledge_base_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        header_path TEXT NOT NULL,
        text TEXT NOT NULL,
        char_count INTEGER NOT NULL,
        embedding_json TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        chunk_id UNINDEXED,
        document_id UNINDEXED,
        knowledge_base_id UNINDEXED,
        document_name,
        header_path,
        text,
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        document_id UNINDEXED,
        knowledge_base_id UNINDEXED,
        document_name,
        full_text,
        content='',
        tokenize='unicode61 remove_diacritics 2'
      );
    `)

    this.db = db
    this.ensureDefaultFolderAndMigrate()
    return db
  }

  private ensureDefaultFolderAndMigrate(): void {
    const db = this.db!

    // 1. Migrate legacy JSON data if present
    if (existsSync(this.jsonStorePath)) {
      try {
        const raw = readFileSync(this.jsonStorePath, 'utf-8')
        const parsed = JSON.parse(raw) as LegacyStoredKnowledgeData
        if (parsed && Array.isArray(parsed.folders)) {
          db.exec('BEGIN TRANSACTION;')
          const stmtFolder = db.prepare(
            `INSERT OR IGNORE INTO collections (id, name, description, created_at_ms) VALUES (?, ?, ?, ?)`,
          )
          for (const f of parsed.folders) {
            stmtFolder.run(f.id, f.name, f.description ?? null, f.createdAtMs)
          }

          const stmtDoc = db.prepare(
            `INSERT OR IGNORE INTO documents (id, knowledge_base_id, name, path, ext, size_bytes, added_at_ms, chunk_count, total_chars, toc_json, md_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          for (const d of parsed.documents ?? []) {
            stmtDoc.run(
              d.id,
              d.knowledgeBaseId,
              d.name,
              d.path,
              d.ext,
              d.sizeBytes,
              d.addedAtMs,
              d.chunkCount,
              d.totalChars,
              d.toc ? JSON.stringify(d.toc) : null,
              d.mdPath ?? null,
            )
          }

          const stmtChunk = db.prepare(
            `INSERT OR IGNORE INTO chunks (id, document_id, knowledge_base_id, chunk_index, header_path, text, char_count, embedding_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          const stmtFts = db.prepare(
            `INSERT OR IGNORE INTO chunks_fts (chunk_id, document_id, knowledge_base_id, document_name, header_path, text) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          const stmtDocFts = db.prepare(
            `INSERT OR IGNORE INTO documents_fts (document_id, knowledge_base_id, document_name, full_text) VALUES (?, ?, ?, ?)`,
          )

          const docMap = new Map((parsed.documents ?? []).map((d) => [d.id, d.name]))
          for (const c of parsed.chunks ?? []) {
            stmtChunk.run(
              c.id,
              c.documentId,
              c.knowledgeBaseId,
              c.chunkIndex,
              c.headerPath,
              c.text,
              c.charCount,
              c.embedding ? JSON.stringify(c.embedding) : null,
            )
            stmtFts.run(
              c.id,
              c.documentId,
              c.knowledgeBaseId,
              docMap.get(c.documentId) ?? 'Document',
              c.headerPath,
              c.text,
            )
          }
          db.exec('COMMIT;')
          try {
            unlinkSync(this.jsonStorePath)
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore migration fail */
      }
    }

    // 2. Ensure default folder exists
    const stmtCheck = db.prepare(`SELECT id FROM collections WHERE id = ?`)
    const row = stmtCheck.get(DEFAULT_FOLDER_ID)
    if (!row) {
      const stmtIns = db.prepare(
        `INSERT INTO collections (id, name, description, created_at_ms) VALUES (?, ?, ?, ?)`,
      )
      stmtIns.run(
        DEFAULT_FOLDER_ID,
        DEFAULT_FOLDER_NAME,
        'Default knowledge base collection for vector documents',
        Date.now(),
      )
    }
  }

  async listKnowledgeBases(): Promise<KnowledgeBaseFolder[]> {
    const db = this.initDatabase()
    const stmt = db.prepare(`SELECT id, name, description, created_at_ms FROM collections ORDER BY created_at_ms ASC`)
    const rows = stmt.all() as Array<{ id: string; name: string; description: string | null; created_at_ms: number }>
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ...(r.description ? { description: r.description } : {}),
      createdAtMs: r.created_at_ms,
    }))
  }

  async createKnowledgeBase(
    name: string,
    description?: string,
  ): Promise<KnowledgeBaseFolder> {
    const db = this.initDatabase()
    const folder: KnowledgeBaseFolder = {
      id: crypto.randomUUID(),
      name: name.trim() || 'New Collection',
      description: description?.trim(),
      createdAtMs: Date.now(),
    }
    const stmt = db.prepare(`INSERT INTO collections (id, name, description, created_at_ms) VALUES (?, ?, ?, ?)`)
    stmt.run(folder.id, folder.name, folder.description ?? null, folder.createdAtMs)
    return folder
  }

  async renameKnowledgeBase(id: string, name: string): Promise<boolean> {
    const db = this.initDatabase()
    const stmt = db.prepare(`UPDATE collections SET name = ? WHERE id = ?`)
    const result = stmt.run(name.trim() || 'Collection', id)
    return (result.changes ?? 0) > 0
  }

  async deleteKnowledgeBase(id: string): Promise<boolean> {
    const db = this.initDatabase()
    if (id === DEFAULT_FOLDER_ID) return false // protect default folder

    // Fetch documents in this folder to delete .md files from disk
    const stmtDocs = db.prepare(`SELECT md_path FROM documents WHERE knowledge_base_id = ?`)
    const docs = stmtDocs.all(id) as Array<{ md_path: string | null }>
    for (const d of docs) {
      if (d.md_path && existsSync(d.md_path)) {
        try {
          await unlink(d.md_path)
        } catch {
          /* ignore file removal error */
        }
      }
    }

    db.exec('BEGIN TRANSACTION;')
    db.prepare(`DELETE FROM chunks_fts WHERE knowledge_base_id = ?`).run(id)
    db.prepare(`DELETE FROM documents_fts WHERE knowledge_base_id = ?`).run(id)
    db.prepare(`DELETE FROM chunks WHERE knowledge_base_id = ?`).run(id)
    db.prepare(`DELETE FROM documents WHERE knowledge_base_id = ?`).run(id)
    const result = db.prepare(`DELETE FROM collections WHERE id = ?`).run(id)
    db.exec('COMMIT;')

    return (result.changes ?? 0) > 0
  }

  async moveDocumentToKb(docId: string, knowledgeBaseId: string): Promise<boolean> {
    const db = this.initDatabase()
    db.exec('BEGIN TRANSACTION;')
    const r1 = db.prepare(`UPDATE documents SET knowledge_base_id = ? WHERE id = ?`).run(knowledgeBaseId, docId)
    db.prepare(`UPDATE chunks SET knowledge_base_id = ? WHERE document_id = ?`).run(knowledgeBaseId, docId)
    db.prepare(`UPDATE chunks_fts SET knowledge_base_id = ? WHERE document_id = ?`).run(knowledgeBaseId, docId)
    db.exec('COMMIT;')
    return (r1.changes ?? 0) > 0
  }

  async listDocuments(knowledgeBaseId?: string): Promise<KnowledgeDocument[]> {
    const db = this.initDatabase()
    let rows: Array<{
      id: string
      knowledge_base_id: string
      name: string
      path: string
      ext: string
      size_bytes: number
      added_at_ms: number
      chunk_count: number
      total_chars: number
      toc_json: string | null
      md_path: string | null
    }>

    if (knowledgeBaseId) {
      const stmt = db.prepare(`SELECT * FROM documents WHERE knowledge_base_id = ? ORDER BY added_at_ms DESC`)
      rows = stmt.all(knowledgeBaseId) as typeof rows
    } else {
      const stmt = db.prepare(`SELECT * FROM documents ORDER BY added_at_ms DESC`)
      rows = stmt.all() as typeof rows
    }

    return rows.map((r) => {
      let toc: TocItem[] | undefined = undefined
      if (r.toc_json) {
        try {
          toc = JSON.parse(r.toc_json) as TocItem[]
        } catch {
          /* ignore */
        }
      }
      return {
        id: r.id,
        knowledgeBaseId: r.knowledge_base_id,
        name: r.name,
        ext: r.ext as string,
        addedAtMs: r.added_at_ms,
        chunkCount: r.chunk_count,
        totalChars: r.total_chars,
        ...(toc ? { toc } : {}),
        ...(r.md_path ? { mdPath: r.md_path } : {}),
      }
    })
  }

  async addDocument(
    filePath: string,
    knowledgeBaseId?: string,
    embeddingConfig?: EmbeddingProviderConfig,
  ): Promise<{ ok: true; document: KnowledgeDocument } | { ok: false; error: string }> {
    const db = this.initDatabase()
    const ext = extname(filePath).slice(1).toLowerCase()
    const SUPPORTED_EXTS = new Set(['pdf', 'md', 'markdown', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'tsv', 'json', 'xml', 'html', 'htm'])
    if (!SUPPORTED_EXTS.has(ext)) {
      return {
        ok: false,
        error: 'Unsupported file type for the Knowledge Base.',
      }
    }

    const stmtKbCheck = db.prepare(`SELECT id FROM collections WHERE id = ?`)
    const targetFolderId =
      knowledgeBaseId && stmtKbCheck.get(knowledgeBaseId) ? knowledgeBaseId : DEFAULT_FOLDER_ID

    const parsed = await parseFileToText(filePath)
    if (!parsed.ok || !parsed.text) {
      return {
        ok: false,
        error: parsed.error ?? 'Failed to extract text from document.',
      }
    }

    const chunks = chunkMarkdownDocument(parsed.text, { maxChunkSize: 4000 })
    if (chunks.length === 0) {
      return {
        ok: false,
        error: 'Document contains no readable text.',
      }
    }

    const docId = `doc-${crypto.randomUUID().slice(0, 8)}`
    const name = basename(filePath)
    const normExt = ext
    const totalChars = chunks.reduce((acc: number, c: DocumentChunk) => acc + c.charCount, 0)

    // Save permanent .md file copy
    const mdDir = join(this.dbPath, '..', 'md-documents')
    if (!existsSync(mdDir)) {
      await mkdir(mdDir, { recursive: true })
    }
    const mdPath = join(mdDir, `${docId}.md`)
    await writeFile(mdPath, parsed.text, 'utf-8')

    // Extract Table of Contents (# and ## headings)
    const toc = extractToc(parsed.text)

    const document: KnowledgeDocument = {
      id: docId,
      knowledgeBaseId: targetFolderId,
      name,
      path: filePath,
      ext: normExt,
      sizeBytes: parsed.text.length,
      addedAtMs: Date.now(),
      chunkCount: chunks.length,
      totalChars,
      toc: toc.length > 0 ? toc : undefined,
      mdPath,
    }

    db.exec('BEGIN TRANSACTION;')
    const stmtDoc = db.prepare(`INSERT INTO documents (id, knowledge_base_id, name, path, ext, size_bytes, added_at_ms, chunk_count, total_chars, toc_json, md_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    stmtDoc.run(
      document.id,
      document.knowledgeBaseId,
      document.name,
      document.path,
      document.ext,
      document.sizeBytes,
      document.addedAtMs,
      document.chunkCount,
      document.totalChars,
      document.toc ? JSON.stringify(document.toc) : null,
      document.mdPath ?? null,
    )

    const stmtChunk = db.prepare(`INSERT INTO chunks (id, document_id, knowledge_base_id, chunk_index, header_path, text, char_count, embedding_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    const stmtFts = db.prepare(`INSERT INTO chunks_fts (chunk_id, document_id, knowledge_base_id, document_name, header_path, text) VALUES (?, ?, ?, ?, ?, ?)`)
    const stmtDocFts = db.prepare(`INSERT INTO documents_fts (document_id, knowledge_base_id, document_name, full_text) VALUES (?, ?, ?, ?)`)
    stmtDocFts.run(docId, targetFolderId, name, parsed.text)

    for (const c of chunks) {
      let vec: number[] | undefined = undefined
      if (embeddingConfig) {
        try {
          vec = await generateEmbedding(c.text, embeddingConfig)
        } catch {
          /* fail-open on single embedding error */
        }
      }
      const chunkId = crypto.randomUUID()
      stmtChunk.run(
        chunkId,
        docId,
        targetFolderId,
        c.chunkIndex,
        c.headerPath,
        c.text,
        c.charCount,
        vec ? JSON.stringify(vec) : null,
      )
      stmtFts.run(chunkId, docId, targetFolderId, name, c.headerPath, c.text)
    }

    db.exec('COMMIT;')

    return { ok: true, document }
  }

  async getDocumentPreview(id: string): Promise<KnowledgeDocumentPreview | null> {
    const db = this.initDatabase()
    const stmtDoc = db.prepare(`SELECT * FROM documents WHERE id = ?`)
    const docRow = stmtDoc.get(id) as any
    if (!docRow) return null

    let toc: TocItem[] | undefined = undefined
    if (docRow.toc_json) {
      try {
        toc = JSON.parse(docRow.toc_json)
      } catch {
        /* ignore */
      }
    }

    const doc: KnowledgeDocument = {
      id: docRow.id,
      knowledgeBaseId: docRow.knowledge_base_id,
      name: docRow.name,
      path: docRow.path,
      ext: docRow.ext,
      sizeBytes: docRow.size_bytes,
      addedAtMs: docRow.added_at_ms,
      chunkCount: docRow.chunk_count,
      totalChars: docRow.total_chars,
      ...(toc ? { toc } : {}),
      ...(docRow.md_path ? { mdPath: docRow.md_path } : {}),
    }

    const stmtChunks = db.prepare(`SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC`)
    const chunkRows = stmtChunks.all(id) as any[]

    const chunks: KnowledgeChunkRecord[] = chunkRows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      knowledgeBaseId: r.knowledge_base_id,
      chunkIndex: r.chunk_index,
      headerPath: r.header_path,
      text: r.text,
      charCount: r.char_count,
      ...(r.embedding_json ? { embedding: JSON.parse(r.embedding_json) } : {}),
    }))

    const fullText = chunks.map((c) => c.text).join('\n\n')

    return { document: doc, chunks, fullText }
  }

  async deleteDocument(id: string): Promise<boolean> {
    const db = this.initDatabase()
    const stmtDoc = db.prepare(`SELECT md_path FROM documents WHERE id = ?`)
    const docRow = stmtDoc.get(id) as { md_path: string | null } | undefined
    if (docRow?.md_path && existsSync(docRow.md_path)) {
      try {
        await unlink(docRow.md_path)
      } catch {
        /* ignore file removal error */
      }
    }

    db.exec('BEGIN TRANSACTION;')
    db.prepare(`DELETE FROM chunks_fts WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = ?)`).run(id)
    db.prepare(`DELETE FROM documents_fts WHERE document_id = ?`).run(id)
    db.prepare(`DELETE FROM chunks WHERE document_id = ?`).run(id)
    const result = db.prepare(`DELETE FROM documents WHERE id = ?`).run(id)
    db.exec('COMMIT;')

    return (result.changes ?? 0) > 0
  }

  async readDocumentText(
    docIdOrPath: string,
  ): Promise<{ ok: boolean; text?: string; error?: string }> {
    const db = this.initDatabase()
    const stmt = db.prepare(`SELECT * FROM documents WHERE id = ? OR path = ? OR md_path = ? OR name = ?`)
    const docRow = stmt.get(docIdOrPath, docIdOrPath, docIdOrPath, docIdOrPath) as any
    if (!docRow) {
      return { ok: false, error: 'Document not found in Knowledge Base.' }
    }

    const targetPath = docRow.md_path && existsSync(docRow.md_path) ? docRow.md_path : docRow.path
    try {
      const st = await stat(targetPath)
      const cached = this.kbDocCache.get(targetPath)
      if (cached && cached.mtimeMs === st.mtimeMs) {
        return { ok: true, text: cached.text }
      }
      const text = await readFile(targetPath, 'utf-8')
      this.kbDocCache.set(targetPath, { text, mtimeMs: st.mtimeMs })
      if (this.kbDocCache.size > 16) {
        const oldest = this.kbDocCache.keys().next().value
        if (oldest) this.kbDocCache.delete(oldest)
      }
      return { ok: true, text }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /**
   * Hybrid RAG Search (Vector Cosine Similarity + SQLite FTS5 BM25) blended with
   * Reciprocal Rank Fusion (RRF), supporting mode (hybrid/vector/fts) and scope (chunks/documents).
   */
  async searchKnowledgeBase(
    query: string,
    knowledgeBaseId?: string | string[] | null,
    topK = 5,
    embeddingConfig?: EmbeddingProviderConfig,
    options?: { mode?: 'hybrid' | 'vector' | 'fts'; scope?: 'chunks' | 'documents' },
  ): Promise<SearchResultMatch[]> {
    const db = this.initDatabase()
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []

    const searchMode = options?.mode ?? 'hybrid'
    const searchScope = options?.scope ?? 'chunks'

    // Build filter set for collection IDs
    let allowedSet: Set<string> | null = null
    if (knowledgeBaseId) {
      const list = (Array.isArray(knowledgeBaseId) ? knowledgeBaseId : String(knowledgeBaseId).split(','))
        .map((s) => s.trim())
        .filter(Boolean)
      if (list.length > 0 && !list.includes('ALL') && !list.includes('ALL_KBS')) {
        allowedSet = new Set(list)
      }
    }

    // Fetch candidate chunks from SQLite
    let chunkRows: any[]
    if (allowedSet && allowedSet.size > 0) {
      const placeholders = Array.from(allowedSet).map(() => '?').join(',')
      const stmt = db.prepare(`SELECT c.*, d.name AS document_name, k.name AS knowledge_base_name FROM chunks c JOIN documents d ON c.document_id = d.id JOIN collections k ON c.knowledge_base_id = k.id WHERE c.knowledge_base_id IN (${placeholders}) OR d.knowledge_base_id IN (${placeholders})`)
      const args = [...Array.from(allowedSet), ...Array.from(allowedSet)]
      chunkRows = stmt.all(...args) as any[]
    } else {
      const stmt = db.prepare(`SELECT c.*, d.name AS document_name, k.name AS knowledge_base_name FROM chunks c JOIN documents d ON c.document_id = d.id JOIN collections k ON c.knowledge_base_id = k.id`)
      chunkRows = stmt.all() as any[]
    }

    if (chunkRows.length === 0) return []

    // 1. Vector Search Ranking
    let queryVec: number[] | undefined = undefined
    if (embeddingConfig && trimmedQuery !== '*') {
      try {
        queryVec = await generateEmbedding(trimmedQuery, embeddingConfig)
      } catch {
        /* fallback */
      }
    }

    interface RankItem {
      chunkId: string
      row: any
      score: number
    }

    const vectorList: RankItem[] = []
    if (queryVec) {
      for (const r of chunkRows) {
        let emb: number[] | undefined = r.embedding_json ? JSON.parse(r.embedding_json) : undefined
        if (!emb && embeddingConfig) {
          try {
            emb = await generateEmbedding(r.text, embeddingConfig)
            db.prepare(`UPDATE chunks SET embedding_json = ? WHERE id = ?`).run(JSON.stringify(emb), r.id)
          } catch {
            /* ignore */
          }
        }
        if (emb && emb.length === queryVec.length) {
          const sim = cosineSimilarity(queryVec, emb)
          vectorList.push({ chunkId: r.id, row: r, score: sim })
        }
      }
      vectorList.sort((a, b) => b.score - a.score)
    }

    // 2. FTS5 Keyword/BM25 Ranking
    const ftsList: RankItem[] = []
    const docFtsRankMap = new Map<string, number>()
    const ftsQuery = sanitizeFtsQuery(trimmedQuery)
    if (ftsQuery) {
      try {
        if (searchScope === 'documents') {
          const stmtDocFts = db.prepare(`SELECT f.document_id, bm25(documents_fts) AS bm25_score FROM documents_fts f WHERE documents_fts MATCH ? ORDER BY bm25_score ASC`)
          const docFtsRows = stmtDocFts.all(ftsQuery) as Array<{ document_id: string; bm25_score: number }>
          docFtsRows.forEach((df, idx) => docFtsRankMap.set(df.document_id, idx + 1))
        }

        const stmtFts = db.prepare(`SELECT f.chunk_id, bm25(chunks_fts) AS bm25_score FROM chunks_fts f WHERE chunks_fts MATCH ? ORDER BY bm25_score ASC`)
        const ftsRows = stmtFts.all(ftsQuery) as Array<{ chunk_id: string; bm25_score: number }>
        const rowMap = new Map(chunkRows.map((r) => [r.id, r]))
        for (const f of ftsRows) {
          const row = rowMap.get(f.chunk_id)
          if (row) {
            ftsList.push({ chunkId: f.chunk_id, row, score: -f.bm25_score })
          }
        }
      } catch {
        /* ignore FTS query syntax error */
      }
    }

    let rrfMatches: SearchResultMatch[] = []

    if (searchMode === 'vector') {
      rrfMatches = vectorList.map((item) => ({
        documentId: item.row.document_id,
        documentName: item.row.document_name ?? 'Document',
        knowledgeBaseId: item.row.knowledge_base_id,
        knowledgeBaseName: item.row.knowledge_base_name ?? 'Collection',
        chunkIndex: item.row.chunk_index,
        headerPath: item.row.header_path,
        text: item.row.text,
        similarityScore: Math.round(item.score * 1000) / 1000,
        scoreType: 'Cosine Similarity',
        searchMode: 'vector',
        searchScope,
      }))
    } else if (searchMode === 'fts') {
      rrfMatches = ftsList.map((item) => ({
        documentId: item.row.document_id,
        documentName: item.row.document_name ?? 'Document',
        knowledgeBaseId: item.row.knowledge_base_id,
        knowledgeBaseName: item.row.knowledge_base_name ?? 'Collection',
        chunkIndex: item.row.chunk_index,
        headerPath: item.row.header_path,
        text: item.row.text,
        similarityScore: Math.round(item.score * 1000) / 1000,
        scoreType: 'BM25 Score',
        searchMode: 'fts',
        searchScope,
      }))
    } else {
      // 3. Reciprocal Rank Fusion (RRF) Blending
      const vectorRankMap = new Map<string, number>()
      vectorList.forEach((item, idx) => vectorRankMap.set(item.chunkId, idx + 1))

      const ftsRankMap = new Map<string, number>()
      ftsList.forEach((item, idx) => ftsRankMap.set(item.chunkId, idx + 1))

      const allChunkIds = new Set([...vectorRankMap.keys(), ...ftsRankMap.keys()])
      
      // If neither vector nor FTS returned matches, fall back to simple term match
      if (allChunkIds.size === 0) {
        const qLower = trimmedQuery.toLowerCase()
        chunkRows.forEach((r) => {
          if (r.text.toLowerCase().includes(qLower)) {
            allChunkIds.add(r.id)
            vectorRankMap.set(r.id, 1)
          }
        })
      }

      const rowMap = new Map(chunkRows.map((r) => [r.id, r]))
      const RRF_K = 60

      for (const cid of allChunkIds) {
        const row = rowMap.get(cid)
        if (!row) continue

        const vRank = vectorRankMap.get(cid)
        let fRank = ftsRankMap.get(cid)
        if (searchScope === 'documents' && docFtsRankMap.has(row.document_id)) {
          fRank = docFtsRankMap.get(row.document_id)
        }

        const vScore = vRank ? 1 / (RRF_K + vRank) : 0
        const fScore = fRank ? 1 / (RRF_K + fRank) : 0
        const rrfScore = vScore + fScore

        rrfMatches.push({
          documentId: row.document_id,
          documentName: row.document_name ?? 'Document',
          knowledgeBaseId: row.knowledge_base_id,
          knowledgeBaseName: row.knowledge_base_name ?? 'Collection',
          chunkIndex: row.chunk_index,
          headerPath: row.header_path,
          text: row.text,
          similarityScore: Math.round(rrfScore * 1000) / 1000,
          scoreType: 'RRF Score',
          searchMode: 'hybrid',
          searchScope,
        })
      }

      rrfMatches.sort((a, b) => b.similarityScore - a.similarityScore)
    }

    // Document Scope Aggregation: load full document text from disk .md file/cache
    if (searchScope === 'documents') {
      const docSeen = new Set<string>()
      const docMatches: SearchResultMatch[] = []

      for (const m of rrfMatches) {
        if (!docSeen.has(m.documentId)) {
          docSeen.add(m.documentId)

          let fullDocText = m.text
          try {
            const docRead = await this.readDocumentText(m.documentId)
            if (docRead.ok && docRead.text) {
              fullDocText = docRead.text
            }
          } catch {
            /* fallback to chunk text */
          }

          docMatches.push({
            ...m,
            headerPath: '(Full Document)',
            text: fullDocText,
            searchScope: 'documents',
          })
        }
      }
      rrfMatches = docMatches
    }

    return rrfMatches.slice(0, Math.max(1, topK))
  }
}
