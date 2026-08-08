import { describe, expect, it, vi } from 'vitest'
import { createKnowledgeSkill, type KnowledgeDocInfo } from '../src/knowledge-skill'

describe('createKnowledgeSkill', () => {
  const sampleDocs: KnowledgeDocInfo[] = [
    {
      id: 'doc-101',
      name: 'annual_report.pdf',
      sizeBytes: 1024,
      totalChars: 1500,
      toc: [
        { level: 1, title: 'Executive Summary', offset: 0 },
        { level: 2, title: 'Financial Results', offset: 250 },
      ],
    },
  ]

  it('lists knowledge documents with TOC information', async () => {
    const listDocsFn = vi.fn(async () => sampleDocs)
    const skill = createKnowledgeSkill(
      vi.fn(async () => []),
      () => 'default-kb',
      listDocsFn,
      vi.fn(),
    )

    const result = await skill.executeTool({
      id: 't1',
      name: 'list_knowledge_documents',
      input: {},
    })

    expect(result.isError).toBeFalsy()
    expect(result.output).toContain('annual_report.pdf')
    expect(result.output).toContain('Table of Contents:')
    expect(result.output).toContain('- # Executive Summary (offset: 0)')
    expect(result.output).toContain('- ## Financial Results (offset: 250)')
  })

  it('reads knowledge document content by offset or jumps directly to TOC heading', async () => {
    const listDocsFn = vi.fn(async () => sampleDocs)
    const readDocFn = vi.fn(async (docId: string, offset: number) => ({
      ok: true,
      totalChars: 1500,
      offset,
      text: '## Financial Results\nRevenue grew by 20%.',
    }))

    const skill = createKnowledgeSkill(
      vi.fn(async () => []),
      () => 'default-kb',
      listDocsFn,
      readDocFn,
    )

    const result = await skill.executeTool({
      id: 't2',
      name: 'read_knowledge_document',
      input: { index: 0, heading: 'Financial Results' },
    })

    expect(readDocFn).toHaveBeenCalledWith('doc-101', 250, 24000)
    expect(result.isError).toBeFalsy()
    expect(result.output).toContain('annual_report.pdf')
    expect(result.output).toContain('Revenue grew by 20%.')
  })
})
