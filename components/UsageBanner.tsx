'use client'

import { useEffect, useState } from 'react'

interface UsageData {
  used: number
  limit: number
  plan: string
}

interface UsageBannerProps {
  version?: number
}

export default function UsageBanner({ version = 0 }: UsageBannerProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    fetch('/api/usage')
      .then((r) => r.json())
      .then((data: UsageData) => {
        if (data.limit > 0) setUsage(data)
      })
      .catch(() => {})
  }, [version])

  if (!usage) return null

  const pct = Math.min(100, (usage.used / usage.limit) * 100)
  const atLimit = usage.used >= usage.limit
  const nearLimit = usage.used >= usage.limit - 2

  const barColor = atLimit
    ? 'bg-red-500'
    : nearLimit
    ? 'bg-amber-500'
    : 'bg-blue-500'

  const textColor = atLimit
    ? 'text-red-400'
    : nearLimit
    ? 'text-amber-400'
    : 'text-gray-500'

  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center gap-2 flex-1">
        <span className={`text-xs ${textColor}`}>
          {atLimit
            ? `Daily limit reached — ${usage.used}/${usage.limit} used`
            : `${usage.used}/${usage.limit} compilations & chats used today`}
        </span>
        <div className="flex-1 max-w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {atLimit && (
        <span className="text-xs text-gray-600">Resets at midnight UTC</span>
      )}
    </div>
  )
}
