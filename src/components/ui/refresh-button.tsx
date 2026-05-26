'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RefreshButtonProps {
  /** Função chamada quando o botão é clicado. Pode ser async. */
  onRefresh: () => Promise<void> | void
  /** Se passado, sobrescreve o loading state interno. */
  loading?: boolean
  className?: string
  /** Label customizado de a11y (default: "Atualizar"). */
  label?: string
}

/**
 * Botão circular de atualização — ícone gira enquanto carrega.
 * Reusável em todos os headers de página. Esconde no print.
 */
export function RefreshButton({
  onRefresh,
  loading: externalLoading,
  className,
  label = 'Atualizar',
}: RefreshButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = externalLoading ?? internalLoading

  async function handle() {
    if (isLoading) return
    setInternalLoading(true)
    try {
      await onRefresh()
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isLoading}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40 disabled:cursor-not-allowed disabled:opacity-60 print:hidden',
        className,
      )}
    >
      <RefreshCw className={cn('h-4 w-4 transition-transform', isLoading && 'animate-spin')} />
    </button>
  )
}
