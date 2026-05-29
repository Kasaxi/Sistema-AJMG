'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Check, X, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  message: string
  description?: string
  variant: ToastVariant
}

type ToastInput = string | { message: string; description?: string; variant?: ToastVariant }

type ToastApi = {
  toast: (input: ToastInput) => void
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION = 3500

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ElementType; iconWrap: string }> = {
  success: { icon: Check, iconWrap: 'bg-[var(--brand-tint)] text-[var(--brand-bright)]' },
  error: { icon: AlertCircle, iconWrap: 'bg-destructive/10 text-destructive' },
  info: { icon: Info, iconWrap: 'bg-[var(--brand-tint)] text-[var(--brand-bright)]' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current
      const item: ToastItem =
        typeof input === 'string'
          ? { id, message: input, variant: 'success' }
          : { id, message: input.message, description: input.description, variant: input.variant ?? 'success' }
      setItems((prev) => [...prev, item])
      const timer = setTimeout(() => dismiss(id), DURATION)
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  const api: ToastApi = {
    toast: push,
    success: (message, description) => push({ message, description, variant: 'success' }),
    error: (message, description) => push({ message, description, variant: 'error' }),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 print:hidden">
        {items.map((t) => {
          const { icon: Icon, iconWrap } = VARIANT_STYLES[t.variant]
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-lg shadow-black/5 ring-1 ring-black/5 duration-200 animate-in slide-in-from-bottom-3 fade-in"
            >
              <div className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', iconWrap)}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.6} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-[var(--ink)]">{t.message}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs leading-snug text-[var(--ink-soft)]">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fechar"
                className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>')
  }
  return ctx
}
