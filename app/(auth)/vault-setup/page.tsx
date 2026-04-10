'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function VaultSetupPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<'cloud' | 'local' | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleContinue() {
    if (!selected) return
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultMode: selected }),
      })
    } catch {
      // Non-fatal — preference can be changed later in settings
    } finally {
      setSaving(false)
    }
    router.push('/login?vaultSetup=1')
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-lg w-full">
      <h1 className="text-sm font-semibold text-gray-100 mb-1">Choose your vault</h1>
      <p className="text-xs text-gray-500 mb-6">
        Where would you like to store your notes? You can change this at any time in settings.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Cloud Vault */}
        <button
          onClick={() => setSelected('cloud')}
          className={`flex flex-col gap-2 p-4 rounded-lg border text-left transition-colors ${
            selected === 'cloud'
              ? 'border-blue-500 bg-blue-950/40'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">☁️</span>
            <span className="text-sm font-medium text-gray-100">Cloud vault</span>
            {selected === 'cloud' && (
              <span className="ml-auto text-blue-400 text-xs">✓</span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Notes stored securely in the cloud. Access from any device, no local setup needed.
          </p>
          <span className="text-xs text-blue-400 mt-1">Recommended</span>
        </button>

        {/* Local Vault */}
        <button
          onClick={() => setSelected('local')}
          className={`flex flex-col gap-2 p-4 rounded-lg border text-left transition-colors ${
            selected === 'local'
              ? 'border-emerald-500 bg-emerald-950/40'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">💻</span>
            <span className="text-sm font-medium text-gray-100">Local vault</span>
            {selected === 'local' && (
              <span className="ml-auto text-emerald-400 text-xs">✓</span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Notes stored on your computer as markdown files. Works with existing Obsidian vaults.
          </p>
          <span className="text-xs text-emerald-500 mt-1">Requires file access</span>
        </button>
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected || saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
      >
        {saving ? 'Saving…' : 'Continue to sign in'}
      </button>

      <p className="text-xs text-gray-700 text-center mt-3">
        Not sure?{' '}
        <Link href="/login" className="text-gray-500 hover:text-gray-400">
          Skip for now
        </Link>
      </p>
    </div>
  )
}
