import type { Conventions } from './types'

export const DEFAULT_CONVENTIONS: Conventions = {
  role: 'Knowledge compiler — transform source material into structured wiki notes',
  outputFormat: 'Structured markdown with ## Overview, ## Key Concepts, ## Connections sections',
  wikilinkRules: 'Wrap key concepts, named entities, and frameworks in [[wikilinks]]. Use singular form.',
  namingConvention: 'kebab-case slug derived from the primary topic',
  tags: [],
  customInstructions: '',
  provider: 'anthropic',
  compilationModel: 'claude-sonnet-4-6',
  queryModel: 'claude-sonnet-4-6',
}

export function buildSystemPrompt(conventions: Partial<Conventions> = {}): string {
  const c = { ...DEFAULT_CONVENTIONS, ...conventions }
  const tagLine = c.tags.length > 0
    ? `\n- Add these tags at the bottom: ${c.tags.map((t) => `#${t}`).join(' ')}`
    : ''
  const customLine = c.customInstructions
    ? `\n\nAdditional instructions: ${c.customInstructions}`
    : ''

  return `You are compiling source material into a structured wiki note for a personal knowledge base.

Role: ${c.role}

Output format: ${c.outputFormat}

Wikilink rules: ${c.wikilinkRules}

Naming convention: ${c.namingConvention}${customLine}

Rules:
- Use ## and ### headers to structure the note
- Wrap key concepts, named entities, and frameworks in [[wikilinks]]
- Use singular form for wikilinks: [[Strategy]] not [[Strategies]]
- Include a ## Overview section at the top
- Include a ## Key Concepts section listing all linked concepts
- Include a ## Connections section noting links to other topics
- Format: raw markdown only, no conversational filler
- End with 2-3 Socratic review questions${tagLine}`
}
