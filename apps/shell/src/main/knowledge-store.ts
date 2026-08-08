import { readFile, writeFile, mkdir, stat, rename, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
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
  ext: 'pdf' | 'md'
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
}

interface StoredKnowledgeData {
  folders: KnowledgeBaseFolder[]
  documents: KnowledgeDocument[]
  chunks: KnowledgeChunkRecord[]
}

const DEFAULT_FOLDER_ID = 'default-kb'
const DEFAULT_FOLDER_NAME = 'Default Collection'

export class KnowledgeStore {
  private readonly storePath: string
  private data: StoredKnowledgeData = { folders: [], documents: [], chunks: [] }
  private loaded = false
  private lastMtimeMs = 0
  private kbDocCache = new Map<string, { text: string; mtimeMs: number }>()

  constructor(storePath: string) {
    this.storePath = storePath
  }

  private async ensureLoaded(force = false): Promise<void> {
    if (this.loaded && !force) {
      try {
        if (existsSync(this.storePath)) {
          const st = await stat(this.storePath)
          if (st.mtimeMs <= this.lastMtimeMs) return
        }
      } catch {
        return
      }
    }

    try {
      if (existsSync(this.storePath)) {
        const st = await stat(this.storePath)
        const raw = await readFile(this.storePath, 'utf-8')
        const parsed = JSON.parse(raw) as StoredKnowledgeData
        if (
          parsed &&
          Array.isArray(parsed.folders) &&
          Array.isArray(parsed.documents) &&
          Array.isArray(parsed.chunks)
        ) {
          this.data = parsed
          this.lastMtimeMs = st.mtimeMs
          this.loaded = true
        }
      }
    } catch {
      /* fail-open: keep existing in-memory data instead of clearing store */
    }

    if (!Array.isArray(this.data.folders)) {
      this.data.folders = []
    }
    if (!Array.isArray(this.data.documents)) {
      this.data.documents = []
    }
    if (!Array.isArray(this.data.chunks)) {
      this.data.chunks = []
    }

    // Ensure default collection folder exists
    if (!this.data.folders.some((f) => f.id === DEFAULT_FOLDER_ID)) {
      this.data.folders.unshift({
        id: DEFAULT_FOLDER_ID,
        name: DEFAULT_FOLDER_NAME,
        description: 'Default knowledge base collection for vector documents',
        createdAtMs: Date.now(),
      })
      await this.persist()
    }
  }

  private async persist(): Promise<void> {
    try {
      const dir = join(this.storePath, '..')
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      const tmpPath = `${this.storePath}.tmp.${Date.now()}`
      await writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8')
      await rename(tmpPath, this.storePath)
      const st = await stat(this.storePath).catch(() => null)
      if (st) this.lastMtimeMs = st.mtimeMs
    } catch {
      /* ignore persist failure */
    }
  }

  async listKnowledgeBases(): Promise<KnowledgeBaseFolder[]> {
    await this.ensureLoaded(true)
    return [...this.data.folders]
  }

  async createKnowledgeBase(
    name: string,
    description?: string,
  ): Promise<KnowledgeBaseFolder> {
    await this.ensureLoaded(true)
    const folder: KnowledgeBaseFolder = {
      id: crypto.randomUUID(),
      name: name.trim() || 'New Collection',
      description: description?.trim(),
      createdAtMs: Date.now(),
    }
    this.data.folders.push(folder)
    await this.persist()
    return folder
  }

  async renameKnowledgeBase(id: string, name: string): Promise<boolean> {
    await this.ensureLoaded(true)
    const folder = this.data.folders.find((f) => f.id === id)
    if (folder) {
      folder.name = name.trim() || folder.name
      await this.persist()
      return true
    }
    return false
  }

  async deleteKnowledgeBase(id: string): Promise<boolean> {
    await this.ensureLoaded(true)
    if (id === DEFAULT_FOLDER_ID) return false // protect default folder
    const initialLen = this.data.folders.length
    this.data.folders = this.data.folders.filter((f) => f.id !== id)

    // delete docs and chunks in this folder
    const docsToDelete = this.data.documents.filter((d) => d.knowledgeBaseId === id)
    for (const doc of docsToDelete) {
      if (doc.mdPath && existsSync(doc.mdPath)) {
        try {
          await unlink(doc.mdPath)
        } catch {
          /* ignore file removal error */
        }
      }
    }

    const docIds = new Set(docsToDelete.map((d) => d.id))
    this.data.documents = this.data.documents.filter((d) => d.knowledgeBaseId !== id)
    this.data.chunks = this.data.chunks.filter((c) => !docIds.has(c.documentId))
    if (this.data.folders.length !== initialLen) {
      await this.persist()
      return true
    }
    return false
  }

  async moveDocumentToKb(docId: string, knowledgeBaseId: string): Promise<boolean> {
    await this.ensureLoaded(true)
    const doc = this.data.documents.find((d) => d.id === docId)
    if (doc) {
      doc.knowledgeBaseId = knowledgeBaseId
      for (const c of this.data.chunks) {
        if (c.documentId === docId) {
          c.knowledgeBaseId = knowledgeBaseId
        }
      }
      await this.persist()
      return true
    }
    return false
  }

  async listDocuments(knowledgeBaseId?: string): Promise<KnowledgeDocument[]> {
    await this.ensureLoaded(true)
    if (knowledgeBaseId) {
      return this.data.documents.filter((d) => d.knowledgeBaseId === knowledgeBaseId)
    }
    return [...this.data.documents]
  }

  async addDocument(
    filePath: string,
    knowledgeBaseId?: string,
    embeddingConfig?: EmbeddingProviderConfig,
  ): Promise<{ ok: true; document: KnowledgeDocument } | { ok: false; error: string }> {
    await this.ensureLoaded(true)
    const ext = extname(filePath).slice(1).toLowerCase()
    if (ext !== 'pdf' && ext !== 'md' && ext !== 'markdown') {
      return {
        ok: false,
        error: 'Only .pdf and .md files are supported in the Knowledge Base.',
      }
    }

    const targetFolderId =
      knowledgeBaseId && this.data.folders.some((f) => f.id === knowledgeBaseId)
        ? knowledgeBaseId
        : DEFAULT_FOLDER_ID

    const parsed = await parseFileToText(filePath)
    if (!parsed.ok || !parsed.text) {
      return {
        ok: false,
        error: parsed.error ?? 'Failed to extract text from document.',
      }
    }

    const chunks = chunkMarkdownDocument(parsed.text, { maxChunkSize: 2000 })
    if (chunks.length === 0) {
      return {
        ok: false,
        error: 'Document contains no readable text.',
      }
    }

    const docId = `doc-${crypto.randomUUID().slice(0, 8)}`
    const name = basename(filePath)
    const normExt: 'pdf' | 'md' = ext === 'pdf' ? 'pdf' : 'md'
    const totalChars = chunks.reduce((acc: number, c: DocumentChunk) => acc + c.charCount, 0)

    // Save permanent .md file copy of the full extracted text for TOC/range navigation
    const mdDir = join(this.storePath, '..', 'md-documents')
    if (!existsSync(mdDir)) {
      await mkdir(mdDir, { recursive: true })
    }
    const mdPath = join(mdDir, `${docId}.md`)
    await writeFile(mdPath, parsed.text, 'utf-8')

    // Extract Table of Contents (# and ## headings) with character offsets
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

    const chunkRecords: KnowledgeChunkRecord[] = []
    for (const c of chunks) {
      let vec: number[] | undefined = undefined
      if (embeddingConfig) {
        try {
          vec = await generateEmbedding(c.text, embeddingConfig)
        } catch {
          /* fail-open on single embedding error */
        }
      }
      chunkRecords.push({
        id: crypto.randomUUID(),
        documentId: docId,
        knowledgeBaseId: targetFolderId,
        chunkIndex: c.chunkIndex,
        headerPath: c.headerPath,
        text: c.text,
        charCount: c.charCount,
        ...(vec ? { embedding: vec } : {}),
      })
    }

    this.data.documents.unshift(document)
    this.data.chunks.push(...chunkRecords)
    await this.persist()

    return { ok: true, document }
  }

  async getDocumentPreview(id: string): Promise<KnowledgeDocumentPreview | null> {
    await this.ensureLoaded(true)
    const doc = this.data.documents.find((d) => d.id === id)
    if (!doc) return null

    const chunks = this.data.chunks
      .filter((c) => c.documentId === id)
      .sort((a, b) => a.chunkIndex - b.chunkIndex)

    const fullText = chunks.map((c) => c.text).join('\n\n')

    return {
      document: doc,
      chunks,
      fullText,
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.ensureLoaded(true)
    const doc = this.data.documents.find((d) => d.id === id)
    if (doc?.mdPath && existsSync(doc.mdPath)) {
      try {
        await unlink(doc.mdPath)
      } catch {
        /* ignore file removal error */
      }
    }
    const initialLen = this.data.documents.length
    this.data.documents = this.data.documents.filter((d) => d.id !== id)
    this.data.chunks = this.data.chunks.filter((c) => c.documentId !== id)
    if (this.data.documents.length !== initialLen) {
      await this.persist()
      return true
    }
    return false
  }

  async readDocumentText(
    docIdOrPath: string,
  ): Promise<{ ok: boolean; text?: string; error?: string }> {
    await this.ensureLoaded(true)
    const doc = this.data.documents.find(
      (d) => d.id === docIdOrPath || d.path === docIdOrPath || d.mdPath === docIdOrPath || d.name === docIdOrPath,
    )
    if (!doc) {
      return { ok: false, error: 'Document not found in Knowledge Base.' }
    }

    const targetPath = doc.mdPath && existsSync(doc.mdPath) ? doc.mdPath : doc.path
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
   * Perform semantic vector search across Knowledge Base chunks.
   * The knowledgeBaseId filter (single id, comma-separated ids, or array) is
   * strict: only chunks belonging to the selected collection(s) are returned,
   * never a silent fallback to all collections.
   */
  async searchKnowledgeBase(
    query: string,
    knowledgeBaseId?: string | string[] | null,
    topK = 5,
    embeddingConfig?: EmbeddingProviderConfig,
  ): Promise<SearchResultMatch[]> {
    await this.ensureLoaded(true)
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []

    const docMap = new Map(this.data.documents.map((d) => [d.id, d.name]))
    const folderMap = new Map(this.data.folders.map((f) => [f.id, f.name]))

    // Internal matcher helper
    const executeSearch = async (candidateChunks: KnowledgeChunkRecord[]): Promise<SearchResultMatch[]> => {
      if (candidateChunks.length === 0) return []

      // Handle wildcard "*"
      if (trimmedQuery === '*') {
        return candidateChunks.slice(0, Math.max(1, topK)).map((chunk) => ({
          documentId: chunk.documentId,
          documentName: docMap.get(chunk.documentId) ?? 'Document',
          knowledgeBaseId: chunk.knowledgeBaseId,
          knowledgeBaseName: folderMap.get(chunk.knowledgeBaseId) ?? 'Collection',
          chunkIndex: chunk.chunkIndex,
          headerPath: chunk.headerPath,
          text: chunk.text,
          similarityScore: 1.0,
        }))
      }

      // Try embedding the query
      let queryVec: number[] | undefined = undefined
      if (embeddingConfig) {
        try {
          queryVec = await generateEmbedding(trimmedQuery, embeddingConfig)
        } catch {
          /* fallback to hybrid keyword matching */
        }
      }

      // Lazy backfill embeddings for candidate chunks if config is present but chunk lacks vector
      if (queryVec && embeddingConfig) {
        let updated = false
        for (const chunk of candidateChunks) {
          if (!chunk.embedding || chunk.embedding.length !== queryVec.length) {
            try {
              chunk.embedding = await generateEmbedding(chunk.text, embeddingConfig)
              updated = true
            } catch {
              /* ignore single chunk embedding fail */
            }
          }
        }
        if (updated) void this.persist()
      }

      const matches: SearchResultMatch[] = []
      const queryLower = trimmedQuery.toLowerCase()
      const qTerms = queryLower.split(/[\s,;&+/\\]+/).filter((t) => t.length > 0)

      for (const chunk of candidateChunks) {
        let score: number
        if (queryVec && chunk.embedding && chunk.embedding.length === queryVec.length) {
          score = cosineSimilarity(queryVec, chunk.embedding)
        } else {
          const textLower = chunk.text.toLowerCase()
          let termHits = 0
          for (const term of qTerms) {
            if (textLower.includes(term)) termHits++
          }
          const termScore = qTerms.length > 0 ? termHits / qTerms.length : 0
          const phraseBonus = textLower.includes(queryLower) ? 0.5 : 0
          score = Math.min(1.0, termScore * 0.8 + phraseBonus)
        }

        if (score >= 0.0) {
          matches.push({
            documentId: chunk.documentId,
            documentName: docMap.get(chunk.documentId) ?? 'Document',
            knowledgeBaseId: chunk.knowledgeBaseId,
            knowledgeBaseName: folderMap.get(chunk.knowledgeBaseId) ?? 'Collection',
            chunkIndex: chunk.chunkIndex,
            headerPath: chunk.headerPath,
            text: chunk.text,
            similarityScore: Math.round(score * 100) / 100,
          })
        }
      }

      matches.sort((a, b) => b.similarityScore - a.similarityScore)
      const positive = matches.filter((m) => m.similarityScore > 0)
      const resultList = positive.length > 0 ? positive : matches
      return resultList.slice(0, Math.max(1, topK))
    }

    // Filter candidate chunks: the user-selected collection(s) are a hard
    // filter — an empty match means "no results", not "search everything".
    let eligibleChunks = this.data.chunks
    if (knowledgeBaseId) {
      const allowedSet = new Set(
        (Array.isArray(knowledgeBaseId)
          ? knowledgeBaseId
          : String(knowledgeBaseId).split(',')
        )
          .map((id) => String(id).trim())
          .filter(Boolean),
      )
      if (allowedSet.size > 0 && !allowedSet.has('ALL') && !allowedSet.has('ALL_KBS')) {
        const docKbMap = new Map(this.data.documents.map((d) => [d.id, d.knowledgeBaseId]))
        eligibleChunks = eligibleChunks.filter(
          (c) => allowedSet.has(c.knowledgeBaseId) || allowedSet.has(docKbMap.get(c.documentId) ?? ''),
        )
      }
    }

    return executeSearch(eligibleChunks)
  }
}
