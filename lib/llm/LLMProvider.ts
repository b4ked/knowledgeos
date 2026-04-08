import type { Conventions } from '@/lib/conventions/types'

export interface LLMProvider {
  compile(sources: string[], conventions: Conventions): Promise<string>
  query(question: string, context: string[]): Promise<string>
  embed(text: string): Promise<number[]>
}
