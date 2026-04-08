'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface NoteViewerProps {
  content: string
  slug: string
}

// Render [[wikilinks]] as styled spans
function processWikilinks(text: string): React.ReactNode[] {
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[\[(.+)\]\]$/)
    if (match) {
      return (
        <span
          key={i}
          className="text-blue-400 bg-blue-950/40 px-0.5 rounded cursor-default"
          title={`Wikilink: ${match[1]}`}
        >
          {part}
        </span>
      )
    }
    return part
  })
}

const components: Components = {
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed text-gray-300">
      {typeof children === 'string' ? processWikilinks(children) : children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold text-gray-100 mt-6 mb-3 border-b border-gray-800 pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-gray-100 mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-200 mt-4 mb-2">{children}</h3>
  ),
  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="text-gray-300">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="bg-gray-900 rounded p-3 mb-3 overflow-x-auto text-xs text-gray-300">
          <code>{children}</code>
        </pre>
      )
    }
    return <code className="bg-gray-800 text-blue-300 px-1 py-0.5 rounded text-xs">{children}</code>
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-700 pl-4 my-3 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-gray-300 italic">{children}</em>,
  hr: () => <hr className="border-gray-800 my-4" />,
}

export default function NoteViewer({ content, slug }: NoteViewerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-medium text-gray-400">{slug}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
