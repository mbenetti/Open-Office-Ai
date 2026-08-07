import type { AgentSkill } from './skill'
import type { AgentToolCall, ToolExecution } from './types'

export interface SkillSummary {
  id: string
  name: string
  description: string
}

export interface SkillDetail extends SkillSummary {
  instructions: string
}

const SKILLS_SYSTEM_PROMPT = `## Reusable Skills
You have access to saved skills (reusable instruction bundles the user maintains in the Knowledge Management → Skills area).
- list_skills shows the available skills and their purpose.
- When the user's request matches a saved skill, call use_skill with its exact name and follow the returned instructions.
- The user can also invoke a skill manually with a slash command like /Skill_Name — that inserts the instructions directly.`

/**
 * The skills capability: lets the agent list saved skills and apply one by name
 * ("used by the chatbot on demand"). The manual path is the slash command in
 * the composer, handled by the renderer (resolveSlashCommand).
 */
export function createSkillsSkill(
  listFn: () => Promise<SkillSummary[]>,
  getFn: (name: string) => Promise<SkillDetail | null>,
): AgentSkill {
  return {
    id: 'skills',
    systemPrompt: SKILLS_SYSTEM_PROMPT,
    tools: [
      {
        name: 'list_skills',
        description: 'List the saved skills (reusable instruction bundles) with their descriptions.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'use_skill',
        description:
          'Apply a saved skill by its exact name (underscore-joined, e.g. Analyze_document). Returns the skill instructions to follow.',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string', description: 'Exact skill name' } },
          required: ['name'],
        },
      },
    ],
    executeTool: async (call: AgentToolCall): Promise<ToolExecution> => {
      if (call.name === 'list_skills') {
        const skills = await listFn()
        if (skills.length === 0) {
          return { output: 'No skills are saved yet.', mutated: false, summary: 'list_skills - 0 skills' }
        }
        const lines = skills.map(
          (s, i) => `${i + 1}. ${s.name} — ${s.description || 'no description'}`,
        )
        return {
          output: `Available skills (${skills.length}):\n${lines.join('\n')}`,
          mutated: false,
          summary: `list_skills - ${skills.length} skills`,
        }
      }
      if (call.name === 'use_skill') {
        const name = String(call.input.name ?? '').trim()
        if (!name) {
          return { output: 'Skill name is required.', isError: true, summary: 'use_skill' }
        }
        const skill = await getFn(name)
        if (!skill) {
          return {
            output: `Unknown skill "${name}". Use list_skills to see the available skills.`,
            mutated: false,
            summary: `use_skill ("${name}") - not found`,
          }
        }
        return {
          output: `Skill "${skill.name}": ${skill.description || ''}\n\n${skill.instructions}`,
          mutated: false,
          summary: `use_skill ("${skill.name}")`,
        }
      }
      return { output: `Unknown tool: ${call.name}`, isError: true, summary: call.name }
    },
  }
}

/**
 * Manual slash-command resolution: "/Skill_Name rest of message" becomes
 * the skill's instructions (plus the optional rest). Non-slash input passes
 * through unchanged.
 */
export async function resolveSlashCommand(
  input: string,
  getSkill: (name: string) => Promise<SkillDetail | null>,
): Promise<{ instruction: string; applied: boolean }> {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return { instruction: trimmed, applied: false }
  const match = /^\/([A-Za-z0-9_]+)(?:\s+([\s\S]*))?$/.exec(trimmed)
  if (!match) return { instruction: trimmed, applied: false }
  const skill = await getSkill(match[1]!)
  if (!skill) return { instruction: trimmed, applied: false }
  const rest = (match[2] ?? '').trim()
  const instruction = rest
    ? `${skill.instructions}\n\nAdditional request: ${rest}`
    : skill.instructions
  return { instruction, applied: true }
}
