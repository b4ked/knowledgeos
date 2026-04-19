'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type AdminUser = {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  plan: string
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

type PlatformSettings = {
  globalCompilationModel: string
  globalQueryModel: string
  globalImageModel: string
  enforceGlobalModels: boolean
  compileMaxOutputTokens: number
  queryMaxOutputTokens: number
  imageExtractMaxOutputTokens: number
  enableOpenAIImageEnrichment: boolean
  ingestionMaxFilesPerJob: number
  ingestionMaxFileSizeMb: number
  ingestionRequestsPerMinute: number
  ingestionMaxConcurrentJobsPerOwner: number
}

const PLAN_OPTIONS = ['free', 'pro', 'team', 'enterprise']

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/platform-settings'),
      ])

      const usersData = await usersRes.json()
      const settingsData = await settingsRes.json()
      if (!usersRes.ok) throw new Error(usersData.error ?? 'Failed to load users')
      if (!settingsRes.ok) throw new Error(settingsData.error ?? 'Failed to load platform settings')
      setUsers(usersData.users ?? [])
      setSettings(settingsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.email.localeCompare(b.email)),
    [users],
  )

  async function updateUser(userId: string, patch: Partial<Pick<AdminUser, 'plan' | 'isAdmin'>>) {
    setError(null)
    setMsg(null)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to update user')
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)))
    setMsg(`Updated ${data.user.email}`)
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    setError(null)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save platform settings')
      setSettings(data.settings)
      setMsg('Platform settings saved for all users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save platform settings')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-100 p-8">Loading admin dashboard…</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center gap-4 px-6 py-4 bg-gray-900 border-b border-gray-800">
        <Link href="/" className="text-sm font-semibold text-gray-100 hover:text-blue-300 transition-colors">
          KnowledgeOS
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-gray-400">Admin dashboard</span>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="border border-gray-800 rounded-xl p-5 bg-gray-900/30">
          <h2 className="text-sm font-semibold mb-3">All users</h2>
          <p className="text-xs text-gray-500 mb-4">Manage plans and admin roles.</p>
          <div className="overflow-auto max-h-[75vh] border border-gray-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 sticky top-0">
                <tr className="text-gray-400">
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Plan</th>
                  <th className="text-left px-3 py-2">Admin</th>
                  <th className="text-left px-3 py-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="border-t border-gray-800">
                    <td className="px-3 py-2 text-gray-200">
                      <div>{u.email}</div>
                      {u.name && <div className="text-gray-500">{u.name}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.plan}
                        onChange={(e) => updateUser(u.id, { plan: e.target.value })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
                      >
                        {PLAN_OPTIONS.map((plan) => (
                          <option key={plan} value={plan}>{plan}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={u.isAdmin}
                        onChange={(e) => updateUser(u.id, { isAdmin: e.target.checked })}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">{u.emailVerified ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-gray-800 rounded-xl p-5 bg-gray-900/30">
          <h2 className="text-sm font-semibold mb-3">Global platform controls</h2>
          <p className="text-xs text-gray-500 mb-4">
            These settings apply across chat, compilation, and ingestion for all users.
          </p>

          {settings && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs">
                  <span className="block text-gray-400 mb-1">Global compilation model</span>
                  <input
                    value={settings.globalCompilationModel}
                    onChange={(e) => setSettings({ ...settings, globalCompilationModel: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-gray-400 mb-1">Global query/chat model</span>
                  <input
                    value={settings.globalQueryModel}
                    onChange={(e) => setSettings({ ...settings, globalQueryModel: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                </label>
                <label className="text-xs md:col-span-2">
                  <span className="block text-gray-400 mb-1">Global image extraction model</span>
                  <input
                    value={settings.globalImageModel}
                    onChange={(e) => setSettings({ ...settings, globalImageModel: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={settings.enforceGlobalModels}
                  onChange={(e) => setSettings({ ...settings, enforceGlobalModels: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Force global models for all users (ignore per-user model overrides)</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <NumberField label="Compile max output tokens" value={settings.compileMaxOutputTokens} onChange={(v) => setSettings({ ...settings, compileMaxOutputTokens: v })} />
                <NumberField label="Query max output tokens" value={settings.queryMaxOutputTokens} onChange={(v) => setSettings({ ...settings, queryMaxOutputTokens: v })} />
                <NumberField label="Image extract output tokens" value={settings.imageExtractMaxOutputTokens} onChange={(v) => setSettings({ ...settings, imageExtractMaxOutputTokens: v })} />
                <NumberField label="Ingestion max files/job" value={settings.ingestionMaxFilesPerJob} onChange={(v) => setSettings({ ...settings, ingestionMaxFilesPerJob: v })} />
                <NumberField label="Ingestion max file size (MB)" value={settings.ingestionMaxFileSizeMb} onChange={(v) => setSettings({ ...settings, ingestionMaxFileSizeMb: v })} />
                <NumberField label="Ingestion requests/minute" value={settings.ingestionRequestsPerMinute} onChange={(v) => setSettings({ ...settings, ingestionRequestsPerMinute: v })} />
                <NumberField label="Ingestion max concurrent jobs/user" value={settings.ingestionMaxConcurrentJobsPerOwner} onChange={(v) => setSettings({ ...settings, ingestionMaxConcurrentJobsPerOwner: v })} />
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={settings.enableOpenAIImageEnrichment}
                  onChange={(e) => setSettings({ ...settings, enableOpenAIImageEnrichment: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Enable OpenAI image enrichment in ingestion</span>
              </label>

              <div className="pt-2">
                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
                >
                  {savingSettings ? 'Saving…' : 'Save global settings'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {(msg || error) && (
        <div className="max-w-7xl mx-auto px-6 pb-8">
          {msg && <p className="text-xs text-emerald-400">{msg}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="text-xs">
      <span className="block text-gray-400 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
      />
    </label>
  )
}
