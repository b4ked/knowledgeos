import type { Conventions } from './types'

export const BUILT_IN_PRESETS: Record<string, Partial<Conventions>> = {
  default: {},
  document: {
    role: 'Document synthesiser — turn one source document into a concise, well-structured wiki note',
    outputFormat: 'Start with a single # descriptive title, then use ## Overview, ## Key Points, ## Connections sections.',
    wikilinkRules: 'Link key concepts, named entities, and frameworks in [[wikilinks]] where they add retrieval value.',
    namingConvention: 'Use a short descriptive title derived from the document topic, never generic titles like "Overview" or "Notes".',
    customInstructions: 'The first heading must be a short descriptive document title. Never use generic headings like Overview, Summary, Notes, Document, or Untitled as the title.',
  },
  zettelkasten: {
    role: 'Zettelkasten note writer — create atomic, evergreen notes with unique identifiers',
    outputFormat: 'Start with a single # descriptive title. Single atomic idea per note. Then use ## Idea, ## Evidence, ## Links sections.',
    wikilinkRules: 'Link to exactly one concept per [[wikilink]]. Prefer atomic concept names.',
    namingConvention: 'Use a short descriptive title for the note, e.g. "learning-through-retrieval-practice".',
    customInstructions: 'Keep each note under 300 words. One idea only. The first heading must be a concise descriptive title, not a generic label.',
  },
  academic: {
    role: 'Academic knowledge synthesiser — create structured literature notes',
    outputFormat: 'Start with a single # descriptive title, then use ## Abstract, ## Methodology, ## Findings, ## Critique, ## Citations sections.',
    wikilinkRules: 'Link author names, theories, and key terms in [[wikilinks]]',
    namingConvention: 'Use a short descriptive title or author-year-keyword style, e.g. "kahneman-2011-thinking-fast".',
    customInstructions: 'Include a critical analysis. Note methodological strengths/weaknesses. The first heading must be a concise descriptive title, not a generic label.',
  },
  meeting: {
    role: 'Meeting note compiler — extract decisions, actions, and context',
    outputFormat: 'Start with a single # descriptive title, then use ## Context, ## Decisions, ## Action Items, ## Open Questions sections.',
    wikilinkRules: 'Link project names, people, and recurring topics in [[wikilinks]]',
    namingConvention: 'Use a short descriptive date-topic style title, e.g. "2025-01-15-product-review".',
    customInstructions: 'Lead with decisions made. List action items with owners if mentioned. The first heading must be a concise descriptive title, not a generic label.',
  },
}

export const DEFAULT_CONVENTIONS: Conventions = {
  role: 'Knowledge compiler — transform source material into structured wiki notes',
  outputFormat: 'Start with a single # descriptive title, then use ## Overview, ## Key Concepts, ## Connections sections.',
  wikilinkRules: 'Wrap key concepts, named entities, and frameworks in [[wikilinks]]. Use singular form.',
  namingConvention: 'Use a short descriptive title derived from the primary topic. Never use generic titles like Overview, Summary, Notes, or Untitled.',
  tags: [],
  customInstructions: 'The first heading must be a short descriptive title specific to the topic. Never use generic headings like Overview, Summary, Notes, Document, or Untitled as the title.',
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
- Start with exactly one top-level heading: # Short Descriptive Title
- Use ## and ### headers to structure the note
- Wrap key concepts, named entities, and frameworks in [[wikilinks]]
- Use singular form for wikilinks: [[Strategy]] not [[Strategies]]
- Never use generic titles such as Overview, Summary, Notes, Document, or Untitled as the main title
- Include a ## Overview section immediately after the title
- Include a ## Key Concepts section listing all linked concepts
- Include a ## Connections section noting links to other topics
- Format: raw markdown only, no conversational filler
- End with 2-3 Socratic review questions${tagLine}`
}
