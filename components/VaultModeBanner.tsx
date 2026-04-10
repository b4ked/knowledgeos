'use client'

export type VaultMode = 'remote' | 'local' | 'cloud'

interface VaultModeBannerProps {
  mode: VaultMode
  onSwitch: () => void
}

export default function VaultModeBanner({ mode, onSwitch }: VaultModeBannerProps) {
  const bannerClass =
    mode === 'local'
      ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
      : mode === 'cloud'
      ? 'bg-blue-950 border-blue-800 text-blue-400'
      : 'bg-gray-900 border-gray-800 text-gray-500'

  const dotClass =
    mode === 'local'
      ? 'bg-emerald-400'
      : mode === 'cloud'
      ? 'bg-blue-400'
      : 'bg-gray-600'

  const label =
    mode === 'local'
      ? 'Local vault'
      : mode === 'cloud'
      ? 'Cloud vault'
      : 'Demo vault (remote)'

  const switchLabel =
    mode === 'local' || mode === 'cloud' ? 'Switch to demo' : 'Use local vault'

  return (
    <div
      data-testid="vault-mode-banner"
      className={`flex items-center gap-2 px-3 py-1 text-xs border-b ${bannerClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotClass}`} />
      {label}
      <button
        onClick={onSwitch}
        className="ml-auto text-xs underline hover:no-underline opacity-60 hover:opacity-100 transition-opacity"
      >
        {switchLabel}
      </button>
    </div>
  )
}
