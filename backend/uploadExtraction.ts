import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse'

const execFileAsync = promisify(execFile)

export interface ExtractionResult {
  ok: boolean
  markdown?: string
  error?: string
}

interface ExtractionDeps {
  readFile?: typeof fs.readFile
  parsePdf?: (data: Buffer) => Promise<{ text?: string }>
  runMarkItDown?: (filePath: string) => Promise<ExtractionResult>
}

function getDefaultPythonCommand() {
  return process.env.MARKITDOWN_PYTHON?.trim() || 'python3'
}

async function runMarkItDownScript(filePath: string): Promise<ExtractionResult> {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const scriptPath = path.resolve(dirname, 'scripts/markitdown_extract.py')

  try {
    const { stdout } = await execFileAsync(getDefaultPythonCommand(), [scriptPath, filePath], {
      timeout: 60000,
      maxBuffer: 5 * 1024 * 1024,
    })
    const parsed = JSON.parse(stdout.trim()) as ExtractionResult
    if (!parsed.ok || !parsed.markdown?.trim()) {
      return { ok: false, error: parsed.error ?? 'Could not extract text from this file.' }
    }
    return { ok: true, markdown: parsed.markdown.trim() }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not extract text from this file.',
    }
  }
}

export async function extractPdfMarkdownFromFile(
  filePath: string,
  deps: ExtractionDeps = {},
): Promise<ExtractionResult> {
  const readFile = deps.readFile ?? fs.readFile
  const parsePdf = deps.parsePdf ?? ((data: Buffer) => pdfParse(data))

  try {
    const data = await readFile(filePath)
    const result = await parsePdf(data)
    const markdown = result.text?.trim()
    if (!markdown) {
      return { ok: false, error: 'No text could be extracted from this PDF.' }
    }
    return { ok: true, markdown }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not extract text from this PDF.',
    }
  }
}

export async function extractMarkdownFromFile(
  filePath: string,
  deps: ExtractionDeps = {},
): Promise<ExtractionResult> {
  if (path.extname(filePath).toLowerCase() === '.pdf') {
    const pdfResult = await extractPdfMarkdownFromFile(filePath, deps)
    if (pdfResult.ok && pdfResult.markdown?.trim()) return pdfResult
  }

  const runMarkItDown = deps.runMarkItDown ?? runMarkItDownScript
  return runMarkItDown(filePath)
}
