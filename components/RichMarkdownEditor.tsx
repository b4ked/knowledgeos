'use client'

import dynamic from 'next/dynamic'

export interface RichMarkdownEditorProps {
  markdown: string
  onChange: (markdown: string) => void
}

const RichMarkdownEditorInner = dynamic(() => import('./RichMarkdownEditorInner'), {
  ssr: false,
  loading: () => <div className="h-full bg-gray-950 p-4 text-xs text-gray-600">Loading editor...</div>,
})

export default function RichMarkdownEditor(props: RichMarkdownEditorProps) {
  return <RichMarkdownEditorInner {...props} />
}
