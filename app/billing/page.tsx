import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    period: "forever",
    actions: "10 actions / day",
    features: ["Demo vault", "Local vault mode", "Cloud vault mode", "10 chats + compilations per day", "Knowledge graph", "Custom presets", "Obsidian export"],
    cta: "Current plan",
    disabled: true,
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "£10",
    period: "/ month",
    actions: "100 actions / day",
    features: ["Everything in Free", "100 chats + compilations per day", "Managed AI (no key needed)", "Email support"],
    cta: "Upgrade — coming soon",
    disabled: true,
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "£40",
    period: "/ month",
    actions: "500 actions / day",
    features: ["Everything in Starter", "500 chats + compilations per day", "Usage analytics", "Priority email support", "Early access to new features"],
    cta: "Upgrade — coming soon",
    disabled: true,
    highlight: true,
  },
  {
    id: "expert",
    name: "Expert",
    price: "£80",
    period: "/ month",
    actions: "1,000 actions / day",
    features: ["Everything in Pro", "1,000 chats + compilations per day"],
    cta: "Upgrade — coming soon",
    disabled: true,
    highlight: false,
  },
]

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const currentPlan = (session.user as { plan?: string }).plan ?? "free"

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center gap-4 px-6 py-4 bg-gray-900 border-b border-gray-800">
        <Link href="/" className="text-sm font-semibold text-gray-100 hover:text-blue-300 transition-colors">
          KnowledgeOS
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-gray-400">Billing</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-100 mb-1">Billing & Plans</h1>
          <p className="text-sm text-gray-500">
            You are on the{" "}
            <span className="text-gray-200 font-medium capitalize">{currentPlan}</span> plan.
            Stripe payments are coming soon.
          </p>
        </div>

        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-3 mb-8 text-sm text-amber-300">
          Stripe billing integration is in progress. Free users currently get 10 combined chats + compilations per day. Paid plan upgrades will be available soon.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 flex flex-col ${
                  isCurrent
                    ? "border-blue-700 bg-blue-950/20"
                    : plan.highlight
                    ? "border-gray-600 bg-gray-900"
                    : "border-gray-800 bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-100">{plan.name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.actions}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-100">{plan.price}</span>
                    <span className="text-xs text-gray-500 ml-1">{plan.period}</span>
                  </div>
                </div>

                {plan.highlight && (
                  <div className="text-xs text-blue-400 font-medium mb-3">Most popular</div>
                )}

                <ul className="space-y-1.5 mb-4 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-xs text-gray-400 flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={plan.disabled}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isCurrent
                      ? "bg-blue-900/50 text-blue-300 cursor-default"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isCurrent ? "Current plan" : plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        <div className="border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-100 mb-1">Team Plan</h2>
          <p className="text-xs text-gray-500 mb-3">
            £120/month — 3 members all on Expert, collaboration features, additional seats at cost.
          </p>
          <span className="inline-block bg-gray-800 text-gray-500 text-xs rounded-full px-3 py-1">
            Coming soon
          </span>
        </div>

        <p className="text-xs text-gray-700 text-center">
          All paid plans billed monthly. Cancel anytime. VAT may apply.
        </p>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <Link href="/account" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Account settings
          </Link>
        </div>
      </main>
    </div>
  )
}
