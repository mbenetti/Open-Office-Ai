import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Reusable AI skills ("slash commands"): each skill is a named prompt/instruction
 * bundle that the chat can recall on demand (agent tool) or that the user inserts
 * manually with `/Skill_Name` in the composer.
 */

export interface SkillRecord {
  id: string
  /** one word or underscore-joined words, e.g. "Analyze_document" */
  name: string
  description: string
  /** the instruction/context text injected into the chat */
  instructions: string
  createdAtMs: number
  updatedAtMs: number
}

export interface SkillPatch {
  name?: string
  description?: string
  instructions?: string
}

const DEFAULT_SKILLS: Array<Pick<SkillRecord, 'name' | 'description' | 'instructions'>> = [
  {
    name: 'Analyze_document',
    description: 'Deep analysis of the open document: structure, key points, and quality.',
    instructions:
      'Analyze the open document thoroughly. Summarize its structure and purpose, list the key points, ' +
      'identify any inconsistencies or gaps, and give a short quality assessment. Cite specific parts of the document.',
  },
  {
    name: 'Extract_key_points',
    description: 'List the essential takeaways of the document as a bulleted summary.',
    instructions:
      'Extract the essential key points of the document as a concise bulleted list. ' +
      'Keep each point short and grounded in the actual content of the document.',
  },
]

export class SkillStore {
  private readonly storePath: string
  private data: SkillRecord[] = []
  private loaded = false

  constructor(storePath: string) {
    this.storePath = storePath
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      if (existsSync(this.storePath)) {
        const raw = readFileSync(this.storePath, 'utf8')
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          this.data = parsed.filter(
            (s): s is SkillRecord =>
              !!s &&
              typeof s.id === 'string' &&
              typeof s.name === 'string' &&
              typeof s.instructions === 'string',
          )
        }
      }
    } catch {
      // corrupt file: start from defaults
    }
    // Seed the two built-in skills on first run so the slash menu is never empty
    if (this.data.length === 0) {
      const now = Date.now()
      this.data = DEFAULT_SKILLS.map((d, i) => ({
        id: `skill-${i + 1}`,
        ...d,
        createdAtMs: now,
        updatedAtMs: now,
      }))
      this.persist()
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.storePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const tmpPath = `${this.storePath}.tmp.${Date.now()}`
      writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8')
      renameSync(tmpPath, this.storePath)
    } catch {
      // ignore persist failure
    }
  }

  listSkills(): SkillRecord[] {
    this.ensureLoaded()
    return [...this.data]
  }

  /** Skills the chat can autocomplete/insert; lighter shape (no instructions). */
  listSkillSummaries(): Array<{ id: string; name: string; description: string }> {
    return this.listSkills().map(({ id, name, description }) => ({ id, name, description }))
  }

  getSkillByName(name: string): SkillRecord | null {
    this.ensureLoaded()
    const normalized = name.trim().toLowerCase()
    return (
      this.data.find((s) => s.name.toLowerCase() === normalized) ??
      this.data.find((s) => s.name.toLowerCase() === normalized.replace(/\s+/g, '_')) ??
      null
    )
  }

  createSkill(
    name: string,
    description: string,
    instructions: string,
  ): { ok: true; skill: SkillRecord } | { ok: false; error: string } {
    this.ensureLoaded()
    const cleanName = name.trim().replace(/\s+/g, '_')
    if (!cleanName) return { ok: false, error: 'Skill name is required.' }
    if (this.data.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
      return { ok: false, error: `A skill named "${cleanName}" already exists.` }
    }
    if (!instructions.trim()) return { ok: false, error: 'Skill instructions are required.' }
    const now = Date.now()
    const skill: SkillRecord = {
      id: `skill-${crypto.randomUUID()}`,
      name: cleanName,
      description: description.trim(),
      instructions: instructions.trim(),
      createdAtMs: now,
      updatedAtMs: now,
    }
    this.data.push(skill)
    this.persist()
    return { ok: true, skill }
  }

  updateSkill(id: string, patch: SkillPatch): { ok: true; skill: SkillRecord } | { ok: false; error: string } {
    this.ensureLoaded()
    const skill = this.data.find((s) => s.id === id)
    if (!skill) return { ok: false, error: 'Skill not found.' }
    if (patch.name !== undefined) {
      const cleanName = patch.name.trim().replace(/\s+/g, '_')
      if (!cleanName) return { ok: false, error: 'Skill name cannot be empty.' }
      if (this.data.some((s) => s.id !== id && s.name.toLowerCase() === cleanName.toLowerCase())) {
        return { ok: false, error: `A skill named "${cleanName}" already exists.` }
      }
      skill.name = cleanName
    }
    if (patch.description !== undefined) skill.description = patch.description.trim()
    if (patch.instructions !== undefined) {
      if (!patch.instructions.trim()) return { ok: false, error: 'Skill instructions cannot be empty.' }
      skill.instructions = patch.instructions.trim()
    }
    skill.updatedAtMs = Date.now()
    this.persist()
    return { ok: true, skill }
  }

  deleteSkill(id: string): boolean {
    this.ensureLoaded()
    const next = this.data.filter((s) => s.id !== id)
    if (next.length === this.data.length) return false
    this.data = next
    this.persist()
    return true
  }
}
