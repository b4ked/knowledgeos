'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-1.5 leading-relaxed last:mb-0">{children}</p>,
  h1: ({ children }) => <p className="font-semibold text-gray-100 mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-semibold text-gray-200 mb-1">{children}</p>,
  h3: ({ children }) => <p className="font-medium text-gray-200 mb-1">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-gray-300">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="bg-gray-800 rounded p-2 mb-1.5 overflow-x-auto text-xs text-gray-300 whitespace-pre">
          <code>{children}</code>
        </pre>
      )
    }
    return <code className="bg-gray-800 text-blue-300 px-0.5 rounded text-xs">{children}</code>
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-600 pl-3 my-1.5 text-gray-400 italic">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-gray-300 italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

interface ChatPanelProps {
  onSourceClick: (slug: string) => void
  onSourcesUpdate?: (slugs: string[]) => void
}

export default function ChatPanel({ onSourceClick, onSourcesUpdate }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSubmit() {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setError(null)
    onSourcesUpdate?.([])
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      const data = await res.json() as { answer?: string; sources?: string[]; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Query failed')
        return
      }

      const sources = data.sources ?? []
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer ?? '', sources },
      ])
      onSourcesUpdate?.(sources)
    } catch {
      setError('Network error — could not reach query API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Chat</span>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null); onSourcesUpdate?.([]) }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-gray-600 text-center mt-10">
            Ask a question about your knowledge base
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-900 text-blue-100'
                  : 'bg-gray-900 text-gray-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  <span className="text-gray-500">Sources: </span>
                  {msg.sources.map((slug, j) => (
                    <button
                      key={j}
                      onClick={() => onSourceClick(slug)}
                      className="text-blue-400 hover:text-blue-300 underline mr-2 transition-colors"
                    >
                      {slug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-500">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-800 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit() }}
            placeholder="Ask your vault… (Enter to send)"
            disabled={loading}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="px-3 py-1.5 text-xs font-medium bg-blue-900 text-blue-200 rounded hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
