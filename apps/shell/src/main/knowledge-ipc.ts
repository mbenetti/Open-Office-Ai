import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { KnowledgeStore } from './knowledge-store'
import { SkillStore, type SkillPatch } from './skills-store'
import { defaultAiSettings, resolveAiSettings, type AiSettings, type LegacyAiSettings } from '@genoffice/ai-provider'

export function getSharedGenOfficeDir(): string {
  const home = homedir()
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'GenOffice')
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    return join(appData, 'GenOffice')
  }
  const config = process.env.XDG_CONFIG_HOME || join(home, '.config')
  return join(config, 'GenOffice')
}

let knowledgeStore: KnowledgeStore | null = null
let skillStore: SkillStore | null = null

export function getKnowledgeStore(): KnowledgeStore {
  if (!knowledgeStore) {
    const dir = getSharedGenOfficeDir()
    knowledgeStore = new KnowledgeStore(join(dir, 'knowledge-store.json'))
  }
  return knowledgeStore
}

export function getSkillStore(): SkillStore {
  if (!skillStore) {
    const dir = getSharedGenOfficeDir()
    skillStore = new SkillStore(join(dir, 'skills.json'))
  }
  return skillStore
}

let registered = false

export function registerKnowledgeIpc(): void {
  if (registered) return
  registered = true

  const store = getKnowledgeStore()

  const getEmbeddingConfig = () => {
    try {
      const dir = getSharedGenOfficeDir()
      const settingsPath = join(dir, 'ai-settings.json')
      if (existsSync(settingsPath)) {
        const stored = JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<AiSettings> & LegacyAiSettings
        const settings = resolveAiSettings(stored, defaultAiSettings())
        return settings.embedding
      }
    } catch {
      /* ignore */
    }
    return undefined
  }

  ipcMain.handle('knowledge:list-kb', () => store.listKnowledgeBases())

  ipcMain.handle('knowledge:create-kb', (_event, opts: unknown) => {
    const o = opts as { name?: string; description?: string } | undefined
    return store.createKnowledgeBase(o?.name ?? 'New Collection', o?.description)
  })

  ipcMain.handle('knowledge:rename-kb', (_event, opts: unknown) => {
    const o = opts as { id?: string; name?: string } | undefined
    if (!o?.id || !o.name) return false
    return store.renameKnowledgeBase(o.id, o.name)
  })

  ipcMain.handle('knowledge:delete-kb', (_event, id: unknown) => {
    if (typeof id !== 'string') return false
    return store.deleteKnowledgeBase(id)
  })

  ipcMain.handle('knowledge:list', (_event, knowledgeBaseId: unknown) =>
    store.listDocuments(typeof knowledgeBaseId === 'string' ? knowledgeBaseId : undefined),
  )

  ipcMain.handle('knowledge:add', async (_event, opts: unknown) => {
    const o =
      typeof opts === 'string'
        ? { filePath: opts, knowledgeBaseId: undefined }
        : (opts as { filePath?: string; knowledgeBaseId?: string } | undefined)
    if (!o?.filePath) return { ok: false, error: 'Invalid file path' }
    return store.addDocument(o.filePath, o.knowledgeBaseId, getEmbeddingConfig())
  })

  ipcMain.handle('knowledge:preview', (_event, id: unknown) => {
    if (typeof id !== 'string') return null
    return store.getDocumentPreview(id)
  })

  ipcMain.handle('knowledge:delete', (_event, id: unknown) => {
    if (typeof id !== 'string') return false
    return store.deleteDocument(id)
  })

  ipcMain.handle('knowledge:read-doc', async (_event, opts: unknown) => {
    const o = opts as { docIdOrPath?: string; offset?: number; maxChars?: number } | undefined
    if (!o?.docIdOrPath) return { ok: false, error: 'docIdOrPath is required' }
    const offset = Math.max(0, Number(o.offset) || 0)
    const maxChars = Math.min(Math.max(1, Number(o.maxChars) || 24000), 48000)
    const result = await store.readDocumentText(o.docIdOrPath)
    if (!result.ok || !result.text) {
      return { ok: false, error: result.error ?? 'Failed to read document' }
    }
    const totalChars = result.text.length
    const slice = result.text.slice(offset, offset + maxChars)
    return {
      ok: true,
      totalChars,
      offset,
      text: slice,
    }
  })

  ipcMain.handle('knowledge:move-doc', (_event, opts: unknown) => {
    const o = opts as { docId?: string; knowledgeBaseId?: string } | undefined
    if (!o?.docId || !o.knowledgeBaseId) return false
    return store.moveDocumentToKb(o.docId, o.knowledgeBaseId)
  })

  ipcMain.handle('knowledge:search', async (_event, opts: unknown) => {
    const o = opts as {
      query?: string
      knowledgeBaseId?: string | string[]
      topK?: number
      mode?: 'hybrid' | 'vector' | 'fts'
      scope?: 'chunks' | 'documents'
    } | undefined
    if (!o?.query) return []
    return store.searchKnowledgeBase(
      o.query,
      o.knowledgeBaseId,
      o.topK ?? 5,
      getEmbeddingConfig(),
      { mode: o.mode, scope: o.scope },
    )
  })

  ipcMain.handle('knowledge:pick', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win ?? undefined as any, {
      title: 'Select Knowledge Base Document (.pdf or .md)',
      properties: ['openFile'],
      filters: [
        { name: 'Knowledge Documents', extensions: ['pdf', 'md', 'markdown'] },
        { name: 'PDF Documents', extensions: ['pdf'] },
        { name: 'Markdown Documents', extensions: ['md', 'markdown'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]!
  })

  // ── Skills (slash commands) ─────────────────────────────────────────────
  const skills = getSkillStore()

  ipcMain.handle('skills:list', () => skills.listSkillSummaries())
  ipcMain.handle('skills:get', (_event, name: unknown) =>
    typeof name === 'string' ? skills.getSkillByName(name) : null,
  )
  ipcMain.handle('skills:create', (_event, opts: unknown) => {
    const o = opts as { name?: string; description?: string; instructions?: string } | undefined
    return skills.createSkill(o?.name ?? '', o?.description ?? '', o?.instructions ?? '')
  })
  ipcMain.handle('skills:update', (_event, opts: unknown) => {
    const o = opts as { id?: string; patch?: SkillPatch } | undefined
    if (typeof o?.id !== 'string') return { ok: false, error: 'Skill id is required.' }
    return skills.updateSkill(o.id, o.patch ?? {})
  })
  ipcMain.handle('skills:delete', (_event, id: unknown) =>
    typeof id === 'string' ? skills.deleteSkill(id) : false,
  )
}
