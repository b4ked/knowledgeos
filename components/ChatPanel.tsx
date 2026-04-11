'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { VaultMode } from './VaultModeBanner'

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-1.5 leading-relaxed last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="text-base font-bold text-gray-100 mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-100 mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium text-gray-200 mt-2 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 my-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-gray-300 pl-1">{children}</li>,
  code: ({ children, className, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? '')
    const isBlock = !!match || (typeof children === 'string' && String(children).includes('\n'))
    if (isBlock) {
      return (
        <div className="my-2 rounded-lg overflow-hidden">
          {match && (
            <div className="bg-gray-700 px-3 py-1 text-xs text-gray-400 font-mono">{match[1]}</div>
          )}
          <pre className="bg-gray-900 p-3 overflow-x-auto text-xs leading-relaxed">
            <code className={className ?? ''}>{children}</code>
          </pre>
        </div>
      )
    }
    return (
      <code className="bg-gray-800 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    )
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-blue-500 pl-3 my-2 text-gray-400 italic bg-blue-950/20 rounded-r py-1">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-gray-600">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-800">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-gray-800/50">{children}</tr>,
  th: ({ children }) => <th className="text-left py-2 px-3 text-gray-300 font-semibold">{children}</th>,
  td: ({ children }) => <td className="py-2 px-3 text-gray-400">{children}</td>,
  strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-gray-300 italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
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
  onQueryComplete?: () => void
  onQueryInsights?: (query: string, sources: string[]) => void
  vaultMode?: VaultMode
  getLocalNotesForQuery?: (question: string) => Promise<Array<{ slug: string; content: string }>>
}

export default function ChatPanel({ onSourceClick, onSourcesUpdate, onQueryComplete, onQueryInsights, vaultMode = 'remote', getLocalNotesForQuery }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-expand textarea up to 5 lines
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 20 // approx px per line
    const maxHeight = lineHeight * 5 + 16 // 5 lines + padding
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [input])

  async function handleSubmit() {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setError(null)
    onSourcesUpdate?.([])
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const body = vaultMode === 'local' && getLocalNotesForQuery
        ? { question, notes: await getLocalNotesForQuery(question) }
        : { question }

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      onQueryInsights?.(question, sources)
      onQueryComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — could not reach query API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Chat</span>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {vaultMode === 'local'
              ? 'Using the local RAG index in this browser'
              : vaultMode === 'cloud'
              ? 'Using the cloud RAG index in your account'
              : 'Using the demo vault RAG index'}
          </p>
        </div>
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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-gray-600 text-center mt-10">
            Ask a question about your knowledge base
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[80%]">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="w-full text-sm leading-relaxed text-gray-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {msg.content}
                </ReactMarkdown>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <span className="text-xs text-gray-500">Sources: </span>
                    {msg.sources.map((slug, j) => (
                      <button
                        key={j}
                        onClick={() => onSourceClick(slug)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline mr-2 transition-colors"
                        title={slug}
                      >
                        {slug.split('/').pop() ?? slug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start items-center gap-1.5 py-1">
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
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
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="Ask your vault… (Enter to send, Shift+Enter for newline)"
            disabled={loading}
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-50 resize-none overflow-hidden leading-5"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="px-3 py-1.5 text-xs font-medium bg-blue-900 text-blue-200 rounded hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
