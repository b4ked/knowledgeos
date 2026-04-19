'use client'

import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"

export default function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)

  if (status === "loading") {
    return <div className="w-16 h-6 bg-gray-800 rounded animate-pulse" />
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/login"
          className="px-3 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          Sign up free
        </Link>
      </div>
    )
  }

  const plan = (session.user as { plan?: string }).plan ?? "free"
  const isAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors flex items-center gap-1.5"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="max-w-[140px] truncate">{session.user.email}</span>
        <span className="text-gray-600 text-[10px]">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-800">
              <p className="text-xs text-gray-300 truncate font-medium">{session.user.email}</p>
              <p className="text-xs text-gray-600 capitalize mt-0.5">{plan} plan</p>
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            >
              Account settings
            </Link>
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            >
              Billing & plans
            </Link>
            <Link
              href="/usage"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            >
              Usage
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-gray-800 transition-colors"
              >
                Admin dashboard
              </Link>
            )}
            <div className="border-t border-gray-800 mt-1 pt-1">
              <button
                onClick={async () => {
                  setOpen(false)
                  try {
                    window.localStorage.setItem("knowledgeos.activeVaultMode", "remote")
                    window.localStorage.removeItem("knowledgeos.pendingVaultMode")
                  } catch {
                    // Ignore storage failures during sign-out
                  }
                  try {
                    await fetch("/api/preferences", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ vaultMode: "remote" }),
                      keepalive: true,
                    })
                  } catch {
                    // Ignore preference persistence failures during sign-out
                  }
                  signOut({ callbackUrl: "/" })
                }}
                className="block w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-gray-100 hover:bg-gray-800 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
