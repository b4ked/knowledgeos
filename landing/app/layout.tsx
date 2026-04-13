import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KnowledgeOS — The knowledge base that builds itself',
  description:
    'Turn scattered research into a structured, queryable intelligence system. AI-compiled wiki notes, interactive knowledge graph, and RAG-powered chat — all from your own source material.',
  keywords: [
    'knowledge base',
    'AI notes',
    'personal knowledge management',
    'PKM',
    'knowledge graph',
    'RAG',
    'AI research tool',
    'wiki',
    'Obsidian alternative',
  ],
  openGraph: {
    title: 'KnowledgeOS — The knowledge base that builds itself',
    description:
      'Turn scattered research into a structured, queryable intelligence system. AI-compiled wiki notes, knowledge graph, and chat — powered by your own sources.',
    type: 'website',
    url: 'https://knoswmba.parrytech.co',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KnowledgeOS — The knowledge base that builds itself',
    description: 'AI-compiled wiki notes, knowledge graph, and RAG chat — from your own source material.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  )
}
