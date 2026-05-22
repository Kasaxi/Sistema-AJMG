'use client'

import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Tag, ChevronRight } from 'lucide-react'

const SECOES = [
  {
    label: 'Categorias da Agenda',
    description: 'Cor, ícone, ordem e visibilidade das categorias',
    href: '/configuracoes/categorias-agenda',
    icon: Tag,
    adminOnly: true,
  },
]

export default function ConfiguracoesPage() {
  return (
    <>
      <Header eyebrow="Sistema" title="Configurações" subtitle="Ajustes do sistema e preferências" />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        <div className="space-y-2">
          {SECOES.map(s => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-[var(--ink)]">{s.label}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{s.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink-soft)]" />
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
