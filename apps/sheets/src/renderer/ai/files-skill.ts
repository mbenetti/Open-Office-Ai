import type { AgentSkill } from '@genoffice/agent-core'
import type { AttachmentMeta } from '../../shared/desktop-api'
import { ATTACHMENT_IMAGE_EXTS } from '../../shared/desktop-api'
import { t } from '../i18n/locale'

/**
 * Chat-attachment capability as an AgentSkill (same structure as the files-skill
 * in apps/docs and apps/slides): each turn's context lists the attached local
 * files, and read_attachment reads their extracted text in pages (parsing
 * happens in the main process; files never leave the machine).
 */

const READ_CHUNK_CHARS = 24_000

const FILES_SYSTEM_PROMPT = `## Attachments
The user may attach local files to the conversation (see the "attachment list" in each turn's context).
- When available, attachments include a Table of Contents (TOC) listing # (Level 1) and ## (Level 2) headings and their character offsets.
- When the user's request involves attachment content, read it with read_attachment first, then answer or generate; never guess the content from the file name.
- You can navigate by passing offset OR by passing a heading title from the TOC to jump directly to that section.
- Long files are read in pages: the result reports the total character count and the current range; to continue, set offset to the previous chunk's end position.
- Image attachments (png/jpg/gif/webp) are already sent as images with the user message — just look at them; read_attachment is only for text-like attachments.
- Do not call read_attachment when there are no attachments or they are unrelated to the request.`

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function createFilesSkill(getAttachments: () => readonly AttachmentMeta[]): AgentSkill {
  return {
    id: 'files',
    systemPrompt: FILES_SYSTEM_PROMPT,
    tools: [
      {
        name: 'read_attachment',
        description:
          "Read an attachment's text content (parsed locally). Jump directly to a TOC heading by name/title or pass a character offset. Long files are paged.",
        inputSchema: {
          type: 'object',
          properties: {
            index: {
              type: 'integer',
              description: 'Attachment index (0-based, see the attachment list)',
            },
            offset: { type: 'integer', description: 'Starting character position, default 0' },
            heading: {
              type: 'string',
              description:
                'Heading title from the TOC to jump directly to that section (matches # or ## headings)',
            },
          },
          required: ['index'],
        },
      },
    ],
    buildContext: () => {
      const list = getAttachments()
      if (list.length === 0) return ''
      const lines = list.map((a, i) => {
        let line = `${i} | ${a.name} | .${a.ext} | ${formatSize(a.sizeBytes)}`
        if (a.toc && a.toc.length > 0) {
          const tocStr = a.toc
            .map(
              (t) =>
                `    ${'  '.repeat(t.level - 1)}- ${'#'.repeat(t.level)} ${t.title} (offset: ${t.offset})`,
            )
            .join('\n')
          line += `\n  Table of Contents:\n${tocStr}`
        }
        return line
      })
      return `Attachment list (index | file name | type | size):\n${lines.join('\n')}`
    },
    executeTool: async (call) => {
      if (call.name !== 'read_attachment') {
        return { output: `Unknown tool: ${call.name}`, isError: true, summary: call.name }
      }
      const list = getAttachments()
      const index = Number(call.input.index)
      const att = Number.isInteger(index) ? list[index] : undefined
      if (!att) {
        return {
          output: 'Invalid attachment index (see the attachment list)',
          isError: true,
          summary: t('aiToolReadAttachment'),
        }
      }
      // Images skip text extraction: already provided as multimodal images with
      // the user message on send
      if (ATTACHMENT_IMAGE_EXTS.has(att.ext)) {
        return {
          output: `${att.name} is an image attachment, already sent as an image with the user message — just look at the image in the message; no text to read.`,
          mutated: false,
          summary: t('aiToolImageAttachment', { name: att.name }),
        }
      }
      let offset = Math.max(0, Number(call.input.offset) || 0)
      if (
        call.input.heading &&
        typeof call.input.heading === 'string' &&
        att.toc &&
        att.toc.length > 0
      ) {
        const target = call.input.heading.toLowerCase().trim()
        const match =
          att.toc.find((t) => t.title.toLowerCase() === target) ||
          att.toc.find((t) => t.title.toLowerCase().includes(target))
        if (match) {
          offset = match.offset
        }
      }
      const result = await window.desktopApi.readAttachment(att.path, offset, READ_CHUNK_CHARS)
      if (!result.ok) {
        return {
          output: result.error ?? 'Read failed',
          isError: true,
          summary: t('aiToolReadFile', { name: att.name }),
        }
      }
      const end = (result.offset ?? 0) + (result.text?.length ?? 0)
      const header = `File ${att.name}, total characters ${result.totalChars}, this chunk ${result.offset}-${end}${
        end < (result.totalChars ?? 0)
          ? ' (not finished; continue with offset=' + end + ')'
          : ' (end of file)'
      }`
      return {
        output: `${header}\n---\n${result.text ?? ''}`,
        mutated: false,
        summary: t('aiToolReadAttachmentOf', { name: att.name }),
      }
    },
  }
}
