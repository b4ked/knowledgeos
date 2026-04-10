'use client'

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("No verification token found in the link.")
      return
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setStatus("success")
          setMessage(data.message)
        } else {
          setStatus("error")
          setMessage(data.error ?? "Verification failed")
        }
      })
      .catch(() => {
        setStatus("error")
        setMessage("Verification failed. Please try again.")
      })
  }, [token])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      {status === "loading" && (
        <>
          <div className="text-2xl mb-3">⏳</div>
          <h2 className="text-sm font-semibold text-gray-100">Verifying…</h2>
        </>
      )}
      {status === "success" && (
        <>
          <div className="text-2xl mb-3">✅</div>
          <h2 className="text-sm font-semibold text-gray-100 mb-2">Email verified</h2>
          <p className="text-xs text-gray-400 mb-4">{message}</p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Sign in to KnowledgeOS
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-2xl mb-3">❌</div>
          <h2 className="text-sm font-semibold text-gray-100 mb-2">Verification failed</h2>
          <p className="text-xs text-gray-400 mb-4">{message}</p>
          <Link
            href="/signup"
            className="inline-block text-blue-500 hover:text-blue-400 text-sm transition-colors"
          >
            Sign up again →
          </Link>
        </>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="bg-gray-900 border border-gray-800 rounded-xl p-8" />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
