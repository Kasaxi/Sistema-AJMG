'use client'

import { useState } from 'react'
import { Check, Copy, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  token: string
  variant?: 'outline' | 'ghost'
  className?: string
}

/**
 * Botão que copia o link do portal do cliente (`/portal/{token}`) pra clipboard.
 * Mostra feedback "Copiado" por 2s.
 */
export function SharePortalButton({ token, variant = 'outline', className }: Props) {
  const [copied, setCopied] = useState(false)

  async function copiar() {
    const url = `${window.location.origin}/portal/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback simples: prompt pra cópia manual
      window.prompt('Copie o link do portal:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={cn(
        'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
        variant === 'outline'
          ? 'border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)]'
          : 'text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]',
        copied && 'border-emerald-300 bg-emerald-50 text-emerald-700',
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Link copiado
        </>
      ) : (
        <>
          <LinkIcon className="h-4 w-4" /> Compartilhar portal
        </>
      )}
    </button>
  )
}
