'use client'

type ImportStatus = 'ready' | 'error'

export interface FileImportItem {
  clientId: string
  filename: string
  status: ImportStatus
  error?: string
  preset: string
}

interface FileImportModalProps {
  items: FileImportItem[]
  presetOptions: string[]
  samePresetForAll: boolean
  sharedPreset: string
  uploading: boolean
  compiling: boolean
  compileError?: string | null
  onClose: () => void
  onCompile: () => void
  onSamePresetChange: (value: boolean) => void
  onSharedPresetChange: (value: string) => void
  onItemPresetChange: (clientId: string, value: string) => void
}

export default function FileImportModal({
  items,
  presetOptions,
  samePresetForAll,
  sharedPreset,
  uploading,
  compiling,
  compileError,
  onClose,
  onCompile,
  onSamePresetChange,
  onSharedPresetChange,
  onItemPresetChange,
}: FileImportModalProps) {
  const readyCount = items.filter((item) => item.status === 'ready').length
  const errorCount = items.length - readyCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Import files to raw vault</h2>
            <p className="mt-1 text-xs text-gray-500">
              {readyCount} ready
              {errorCount > 0 ? ` · ${errorCount} conversion error${errorCount !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none text-gray-500 transition-colors hover:text-gray-200"
          >
            ×
          </button>
        </div>

        <div className="border-b border-gray-800 px-5 py-4">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={samePresetForAll}
              onChange={(event) => onSamePresetChange(event.target.checked)}
              className="accent-blue-500"
            />
            <span>Use the same preset for all converted files</span>
          </label>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-gray-500">Preset</span>
            <select
              value={sharedPreset}
              onChange={(event) => onSharedPresetChange(event.target.value)}
              className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-100 outline-none transition-colors focus:border-blue-500"
            >
              {presetOptions.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.clientId}
                className={`rounded-lg border px-4 py-3 ${
                  item.status === 'error' ? 'border-red-900 bg-red-950/30' : 'border-gray-800 bg-gray-950'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-100">{item.filename}</p>
                    {item.status === 'error' ? (
                      <p className="mt-1 text-xs text-red-300">{item.error ?? 'Could not extract text from this file.'}</p>
                    ) : (
                      <p className="mt-1 text-xs text-emerald-300">Ready to compile</p>
                    )}
                  </div>

                  {item.status === 'ready' && !samePresetForAll && (
                    <select
                      value={item.preset}
                      onChange={(event) => onItemPresetChange(item.clientId, event.target.value)}
                      className="shrink-0 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-100 outline-none transition-colors focus:border-blue-500"
                    >
                      {presetOptions.map((preset) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-800 px-5 py-4">
          {compileError && <p className="mb-3 text-xs text-red-400">{compileError}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {uploading ? 'Uploading files…' : compiling ? 'Compiling files…' : 'Compile each converted file into the wiki.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded border border-gray-700 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
              >
                Close
              </button>
              <button
                onClick={onCompile}
                disabled={readyCount === 0 || uploading || compiling}
                className="rounded bg-blue-900 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {compiling ? 'Compiling…' : `Compile ${readyCount} file${readyCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
