import { describe, expect, it, vi } from 'vitest'

import { extractMarkdownFromFile, extractPdfMarkdownFromFile } from '@/backend/uploadExtraction'

describe('extractPdfMarkdownFromFile', () => {
  it('extracts text from PDFs with the dedicated parser', async () => {
    const parsePdf = vi.fn().mockResolvedValue({ text: '  Parsed PDF text  ' })
    const readFile = vi.fn().mockResolvedValue(Buffer.from('pdf'))

    const result = await extractPdfMarkdownFromFile('/tmp/test.pdf', {
      readFile,
      parsePdf,
    })

    expect(result).toEqual({ ok: true, markdown: 'Parsed PDF text' })
    expect(readFile).toHaveBeenCalledWith('/tmp/test.pdf')
    expect(parsePdf).toHaveBeenCalled()
  })
})

describe('extractMarkdownFromFile', () => {
  it('does not call MarkItDown when PDF parsing succeeds', async () => {
    const runMarkItDown = vi.fn()

    const result = await extractMarkdownFromFile('/tmp/test.pdf', {
      readFile: vi.fn().mockResolvedValue(Buffer.from('pdf')),
      parsePdf: vi.fn().mockResolvedValue({ text: 'PDF text' }),
      runMarkItDown,
    })

    expect(result).toEqual({ ok: true, markdown: 'PDF text' })
    expect(runMarkItDown).not.toHaveBeenCalled()
  })

  it('falls back to MarkItDown when PDF parsing fails', async () => {
    const runMarkItDown = vi.fn().mockResolvedValue({ ok: true, markdown: 'fallback text' })

    const result = await extractMarkdownFromFile('/tmp/test.pdf', {
      readFile: vi.fn().mockResolvedValue(Buffer.from('pdf')),
      parsePdf: vi.fn().mockRejectedValue(new Error('pdf parser failed')),
      runMarkItDown,
    })

    expect(result).toEqual({ ok: true, markdown: 'fallback text' })
    expect(runMarkItDown).toHaveBeenCalledWith('/tmp/test.pdf')
  })
})
