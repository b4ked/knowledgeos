'use client'

import type { Toast } from '@/lib/toast/useToast'

const TYPE_CLASSES: Record<Toast['type'], string> = {
  success: 'bg-green-900 border-green-700 text-green-200',
  error:   'bg-red-900 border-red-700 text-red-200',
  info:    'bg-gray-800 border-gray-700 text-gray-200',
}

interface ToastStackProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 px-3 py-2 rounded border text-xs shadow-lg ${TYPE_CLASSES[t.type]}`}
        >
          <span className="flex-1 leading-relaxed">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity leading-none"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
