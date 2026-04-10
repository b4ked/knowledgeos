import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-lg font-semibold tracking-wide text-gray-100 hover:text-blue-300 transition-colors"
          >
            KnowledgeOS
          </Link>
          <p className="text-xs text-gray-600 mt-1">The knowledge base that builds itself</p>
        </div>
        {children}
      </div>
    </div>
  )
}
