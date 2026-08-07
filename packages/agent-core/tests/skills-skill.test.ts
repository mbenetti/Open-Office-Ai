import { describe, expect, it, vi } from 'vitest'
import { createSkillsSkill, resolveSlashCommand, type SkillDetail, type SkillSummary } from '../src'

const SUMMARY: SkillSummary[] = [
  { id: 's1', name: 'Analyze_document', description: 'Deep analysis of the open document.' },
  { id: 's2', name: 'Extract_key_points', description: 'Bulleted summary of takeaways.' },
]

const DETAILS: Record<string, SkillDetail> = {
  Analyze_document: {
    id: 's1',
    name: 'Analyze_document',
    description: 'Deep analysis of the open document.',
    instructions: 'Analyze the document thoroughly and cite specific parts.',
  },
  Extract_key_points: {
    id: 's2',
    name: 'Extract_key_points',
    description: 'Bulleted summary of takeaways.',
    instructions: 'Extract the essential key points as a concise bulleted list.',
  },
}

const getDetail = async (name: string): Promise<SkillDetail | null> =>
  Object.values(DETAILS).find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ?? null

describe('resolveSlashCommand', () => {
  it('passes non-slash input through unchanged', async () => {
    const res = await resolveSlashCommand('Summarize the document', getDetail)
    expect(res).toEqual({ instruction: 'Summarize the document', applied: false })
  })

  it('applies a known skill by name', async () => {
    const res = await resolveSlashCommand('/Analyze_document', getDetail)
    expect(res.applied).toBe(true)
    expect(res.instruction).toContain('Analyze the document thoroughly')
  })

  it('appends the rest of the message to the skill instructions', async () => {
    const res = await resolveSlashCommand('/Extract_key_points focus on pricing', getDetail)
    expect(res.applied).toBe(true)
    expect(res.instruction).toContain('Extract the essential key points')
    expect(res.instruction).toContain('Additional request: focus on pricing')
  })

  it('leaves unknown skills untouched', async () => {
    const res = await resolveSlashCommand('/No_such_skill hello', getDetail)
    expect(res).toEqual({ instruction: '/No_such_skill hello', applied: false })
  })

  it('ignores slash inputs with invalid names (spaces, punctuation)', async () => {
    const spaced = await resolveSlashCommand('/My Skill please', getDetail)
    expect(spaced.applied).toBe(false)
    const punctuated = await resolveSlashCommand('/Analyze! this', getDetail)
    expect(punctuated.applied).toBe(false)
  })

  it('handles a bare slash and empty input', async () => {
    const bare = await resolveSlashCommand('/', getDetail)
    expect(bare).toEqual({ instruction: '/', applied: false })
    const empty = await resolveSlashCommand('', getDetail)
    expect(empty).toEqual({ instruction: '', applied: false })
  })
})

describe('createSkillsSkill', () => {
  it('exposes list_skills and use_skill tools plus a system prompt', () => {
    const skill = createSkillsSkill(async () => SUMMARY, getDetail)
    expect(skill.id).toBe('skills')
    expect(skill.systemPrompt).toContain('Reusable Skills')
    expect(skill.tools.map((t) => t.name)).toEqual(['list_skills', 'use_skill'])
    const useSkill = skill.tools.find((t) => t.name === 'use_skill')!
    expect(useSkill.inputSchema).toHaveProperty('required', ['name'])
  })

  it('lists the saved skills through list_skills', async () => {
    const skill = createSkillsSkill(async () => SUMMARY, getDetail)
    const res = await skill.executeTool!({
      id: 't1',
      name: 'list_skills',
      input: {},
    })
    expect(res.mutated).toBe(false)
    expect(res.output).toContain('Available skills (2)')
    expect(res.output).toContain('Analyze_document — Deep analysis of the open document.')
    expect(res.summary).toBe('list_skills - 2 skills')
  })

  it('reports an empty skill repo', async () => {
    const skill = createSkillsSkill(async () => [], getDetail)
    const res = await skill.executeTool!({ id: 't1', name: 'list_skills', input: {} })
    expect(res.output).toBe('No skills are saved yet.')
  })

  it('returns the instructions for a known skill via use_skill', async () => {
    const skill = createSkillsSkill(async () => SUMMARY, getDetail)
    const res = await skill.executeTool!({
      id: 't1',
      name: 'use_skill',
      input: { name: 'Analyze_document' },
    })
    expect(res.isError).toBeUndefined()
    expect(res.output).toContain('Skill "Analyze_document"')
    expect(res.output).toContain('Analyze the document thoroughly')
    expect(res.summary).toBe('use_skill ("Analyze_document")')
  })

  it('fails gracefully for an unknown skill', async () => {
    const skill = createSkillsSkill(async () => SUMMARY, getDetail)
    const res = await skill.executeTool!({ id: 't1', name: 'use_skill', input: { name: 'Nope' } })
    expect(res.output).toContain('Unknown skill "Nope"')
    expect(res.summary).toContain('not found')
  })

  it('errors when use_skill is called without a name', async () => {
    const skill = createSkillsSkill(async () => SUMMARY, getDetail)
    const res = await skill.executeTool!({ id: 't1', name: 'use_skill', input: {} })
    expect(res.isError).toBe(true)
    expect(res.output).toBe('Skill name is required.')
  })

  it('propagates listFn failures as tool errors', async () => {
    const listFn = vi.fn().mockRejectedValue(new Error('store unavailable'))
    const skill = createSkillsSkill(listFn, getDetail)
    await expect(skill.executeTool!({ id: 't1', name: 'list_skills', input: {} })).rejects.toThrow(
      'store unavailable',
    )
  })
})
