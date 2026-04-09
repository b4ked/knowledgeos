import type { Conventions } from './types'

export const DEFAULT_CONVENTIONS: Conventions = {
  role: 'Knowledge compiler — transform source material into structured wiki notes',
  outputFormat: 'Structured markdown with ## Overview, ## Key Concepts, ## Connections sections',
  wikilinkRules: 'Wrap key concepts, named entities, and frameworks in [[wikilinks]]. Use singular form.',
  namingConvention: 'kebab-case slug derived from the primary topic',
  tags: [],
  customInstructions: '',
  provider: 'openai',
  compilationModel: 'gpt-4o',
  queryModel: 'gpt-4o',
}

export function buildSystemPrompt(conventions: Partial<Conventions> = {}): string {
  const c = { ...DEFAULT_CONVENTIONS, ...conventions }
  const tagLine = c.tags.length > 0
    ? `\n- Add these tags at the bottom: ${c.tags.map((t) => `#${t}`).join(' ')}`
    : ''
  const customLine = c.customInstructions
    ? `\n\nAdditional instructions: ${c.customInstructions}`
    : ''

  return `You are compiling multiple source notes into a single structured wiki note for a personal knowledge base.

Role: ${c.role}

Source material instructions:
- You will receive one or more source notes, each prefixed with "## Source N" and separated by "---"
- Read every source carefully before writing — each source contains distinct information that must be preserved
- Synthesise across all sources: do not simply paraphrase the first source and ignore the rest
- Retain specific facts, arguments, frameworks, examples, and named concepts from every source
- Where sources overlap, consolidate; where they differ, note the distinction
- The compiled note should be a faithful, comprehensive synthesis — not a brief summary

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
