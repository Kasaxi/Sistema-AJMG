'use client'

import { useEffect, useState } from 'react'
import { MobileSidebar } from './sidebar'
import { Bell } from 'lucide-react'
import { getCurrentProfile } from '@/app/actions/vendas-actions'

interface HeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: React.ReactNode
}

// Iniciais a partir do nome (1ª letra das duas primeiras palavras) ou do e-mail.
function iniciais(nome: string, email: string | null): string {
  const limpo = nome.trim()
  if (limpo) {
    const partes = limpo.split(/\s+/)
    const ini = (partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')
    if (ini) return ini.toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

export function Header({ title, subtitle, eyebrow, actions }: HeaderProps) {
  const [usuario, setUsuario] = useState<{ nome: string; email: string | null } | null>(null)

  useEffect(() => {
    let ativo = true
    getCurrentProfile()
      .then((p) => { if (ativo) setUsuario({ nome: p.nome, email: p.email }) })
      .catch(() => {})
    return () => { ativo = false }
  }, [])

  const avatarLabel = usuario ? iniciais(usuario.nome, usuario.email) : ''
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]/85 px-4 backdrop-blur-xl sm:px-8 print:static print:bg-white print:backdrop-blur-none">
      <div className="flex min-h-[5rem] items-center gap-5 py-3">
        <div className="print:hidden">
          <MobileSidebar />
        </div>

        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-bright)]">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate font-display text-[1.7rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 truncate text-sm text-[var(--ink-soft)]">{subtitle}</p>
          )}
        </div>

        {actions && <div className="hidden items-center gap-3 sm:flex">{actions}</div>}

        <div className="flex items-center gap-3 pl-1 print:hidden">
          <button aria-label="Notificações" className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-2xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40">
            <Bell className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} />
          </button>
          <div
            title={usuario?.nome || undefined}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--brand)] font-display text-[13px] font-bold text-[var(--on-brand)]"
          >
            {avatarLabel}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-3 pb-3 sm:hidden print:hidden">{actions}</div>
      )}
    </header>
  )
}
