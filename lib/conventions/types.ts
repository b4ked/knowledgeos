export interface Conventions {
  role: string
  outputFormat: string
  wikilinkRules: string
  namingConvention: string
  tags: string[]
  customInstructions: string
  provider: 'anthropic' | 'openai'
  compilationModel: string
  queryModel: string
}
