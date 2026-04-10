'use client'

import { useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"

interface Props {
  email: string
  name: string | null
  plan: string
}

export default function AccountClient({ email, name: initialName, plan }: Props) {
  const [name, setName] = useState(initialName ?? "")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) {
        setProfileMsg({ type: "success", text: "Profile updated" })
      } else {
        setProfileMsg({ type: "error", text: data.error ?? "Could not update profile" })
      }
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match" })
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Password updated" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setPasswordMsg({ type: "error", text: data.error ?? "Could not update password" })
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== email) return
    setDeleting(true)
    try {
      await fetch("/api/account", { method: "DELETE" })
      await signOut({ callbackUrl: "/" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center gap-4 px-6 py-4 bg-gray-900 border-b border-gray-800">
        <Link href="/" className="text-sm font-semibold text-gray-100 hover:text-blue-300 transition-colors">
          KnowledgeOS
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-gray-400">Account</span>
      </header>

      <main className="max-w-lg mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100 mb-1">Account settings</h1>
          <p className="text-sm text-gray-500">
            {email} · <span className="capitalize">{plan}</span> plan
          </p>
        </div>

        {/* Profile */}
        <section className="border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-100 mb-4">Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-gray-900 border border-gray-800 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
              />
              <p className="text-xs text-gray-700 mt-1">Email cannot be changed in this version.</p>
            </div>
            {profileMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${
                profileMsg.type === "success"
                  ? "text-emerald-400 bg-emerald-950/50 border-emerald-900"
                  : "text-red-400 bg-red-950/50 border-red-900"
              }`}>
                {profileMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {profileSaving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </section>

        {/* Change password */}
        <section className="border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-100 mb-4">Change password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {passwordMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${
                passwordMsg.type === "success"
                  ? "text-emerald-400 bg-emerald-950/50 border-emerald-900"
                  : "text-red-400 bg-red-950/50 border-red-900"
              }`}>
                {passwordMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {passwordSaving ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>

        {/* Quick links */}
        <section className="border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-100 mb-3">Plan & usage</h2>
          <div className="flex gap-3">
            <Link
              href="/billing"
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
            >
              Billing & plans →
            </Link>
            <Link
              href="/usage"
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
            >
              View usage →
            </Link>
          </div>
        </section>

        {/* Danger zone */}
        <section className="border border-red-900/50 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-red-400 mb-1">Danger zone</h2>
          <p className="text-xs text-gray-500 mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 border border-red-900 text-red-400 hover:bg-red-900/30 rounded-lg text-sm transition-colors"
            >
              Delete account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Type <span className="text-gray-200 font-mono">{email}</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={email}
                className="w-full bg-gray-800 border border-red-900 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-red-700 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteInput("") }}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== email || deleting}
                  className="px-3 py-1.5 text-xs font-medium bg-red-900 text-red-200 hover:bg-red-800 disabled:opacity-40 rounded-lg transition-colors"
                >
                  {deleting ? "Deleting…" : "Permanently delete my account"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
