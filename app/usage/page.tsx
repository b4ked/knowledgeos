import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

const PLAN_LIMITS: Record<string, { actions: string; description: string }> = {
  free: {
    actions: "10 / day",
    description: "Chats and compilations share a single combined daily limit of 10 on the free plan.",
  },
  starter: {
    actions: "100 / day",
    description: "Chats and compilations share a single combined daily limit of 100.",
  },
  pro: {
    actions: "500 / day",
    description: "Chats and compilations share a single combined daily limit of 500.",
  },
  expert: {
    actions: "1,000 / day",
    description: "Chats and compilations share a single combined daily limit of 1,000.",
  },
  team: {
    actions: "1,000 / day (shared)",
    description: "All team members share a combined daily limit of 1,000 across the team.",
  },
}

export default async function UsagePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const currentPlan = (session.user as { plan?: string }).plan ?? "free"
  const limits = PLAN_LIMITS[currentPlan] ?? PLAN_LIMITS.free

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center gap-4 px-6 py-4 bg-gray-900 border-b border-gray-800">
        <Link href="/" className="text-sm font-semibold text-gray-100 hover:text-blue-300 transition-colors">
          KnowledgeOS
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-gray-400">Usage</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-100 mb-1">Usage</h1>
          <p className="text-sm text-gray-500">
            Current plan:{" "}
            <span className="text-gray-200 font-medium capitalize">{currentPlan}</span>
          </p>
        </div>

        <div className="border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-100 mb-1">Daily limit</h2>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-gray-100">{limits.actions}</span>
            {currentPlan !== "free" && (
              <span className="text-xs text-gray-500">compilations + chats</span>
            )}
          </div>
          <p className="text-xs text-gray-500">{limits.description}</p>
        </div>

        {currentPlan === "free" && (
          <div className="border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-100 mb-2">Usage tracking</h2>
            <p className="text-xs text-gray-500 mb-3">
              Detailed per-action usage tracking is available on paid plans. On the free plan, chats and compilations share a combined daily limit of 10.
            </p>
            <Link
              href="/billing"
              className="inline-block text-xs text-blue-500 hover:text-blue-400 transition-colors"
            >
              View paid plans →
            </Link>
          </div>
        )}

        {currentPlan !== "free" && (
          <div className="border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-100 mb-2">This month</h2>
            <p className="text-xs text-gray-500 mb-4">
              Per-action usage analytics dashboard is coming soon. You'll be able to see compilations, chat queries, and vault size here.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Compilations</p>
                <p className="text-sm font-semibold text-gray-100">— / —</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Chat queries</p>
                <p className="text-sm font-semibold text-gray-100">— / —</p>
              </div>
            </div>
          </div>
        )}

        <div className="border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-100 mb-3">Plan limits comparison</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2">Plan</th>
                <th className="text-right pb-2">Daily actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {Object.entries(PLAN_LIMITS).map(([plan, info]) => (
                <tr key={plan} className={plan === currentPlan ? "text-gray-100" : "text-gray-500"}>
                  <td className="py-2 capitalize">
                    {plan}
                    {plan === currentPlan && (
                      <span className="ml-2 text-blue-400 text-xs">← current</span>
                    )}
                  </td>
                  <td className="text-right py-2">{info.actions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 flex gap-4">
          <Link href="/billing" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
            View billing →
          </Link>
          <Link href="/account" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Account settings →
          </Link>
        </div>
      </main>
    </div>
  )
}
