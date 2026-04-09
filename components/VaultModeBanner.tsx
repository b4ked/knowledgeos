'use client'

export type VaultMode = 'remote' | 'local'

interface VaultModeBannerProps {
  mode: VaultMode
  onSwitch: () => void
}

export default function VaultModeBanner({ mode, onSwitch }: VaultModeBannerProps) {
  return (
    <div
      data-testid="vault-mode-banner"
      className={`flex items-center gap-2 px-3 py-1 text-xs border-b ${
        mode === 'local'
          ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
          : 'bg-gray-900 border-gray-800 text-gray-500'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full inline-block ${
          mode === 'local' ? 'bg-emerald-400' : 'bg-gray-600'
        }`}
      />
      {mode === 'local' ? 'Local vault' : 'Demo vault (remote)'}
      <button
        onClick={onSwitch}
        className="ml-auto text-xs underline hover:no-underline opacity-60 hover:opacity-100 transition-opacity"
      >
        {mode === 'local' ? 'Switch to demo' : 'Use local vault'}
      </button>
    </div>
  )
}
