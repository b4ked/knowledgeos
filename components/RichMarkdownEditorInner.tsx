'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertFrontmatter,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type MDXEditorProps,
} from '@mdxeditor/editor'
import type { RichMarkdownEditorProps } from './RichMarkdownEditor'

const CODE_LANGUAGES = {
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  css: 'CSS',
  json: 'JSON',
  md: 'Markdown',
  sql: 'SQL',
  bash: 'Bash',
}

export default function RichMarkdownEditorInner({ markdown, onChange }: RichMarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null)
  const lastExternalMarkdown = useRef(markdown)

  useEffect(() => {
    if (lastExternalMarkdown.current === markdown) return
    lastExternalMarkdown.current = markdown
    editorRef.current?.setMarkdown(markdown)
  }, [markdown])

  const plugins = useMemo<MDXEditorProps['plugins']>(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin(),
    frontmatterPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: 'md' }),
    codeMirrorPlugin({ codeBlockLanguages: CODE_LANGUAGES }),
    diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: markdown }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarContents: () => (
        <DiffSourceToggleWrapper>
          <UndoRedo />
          <Separator />
          <BlockTypeSelect />
          <BoldItalicUnderlineToggles />
          <CodeToggle />
          <Separator />
          <ListsToggle />
          <CreateLink />
          <InsertTable />
          <InsertCodeBlock />
          <InsertThematicBreak />
          <InsertFrontmatter />
        </DiffSourceToggleWrapper>
      ),
    }),
  ], [markdown])

  return (
    <MDXEditor
      ref={editorRef}
      markdown={markdown}
      onChange={(next) => {
        lastExternalMarkdown.current = next
        onChange(next)
      }}
      plugins={plugins}
      className="knowledgeos-mdx-editor"
      contentEditableClassName="knowledgeos-mdx-content"
    />
  )
}
