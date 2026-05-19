'use client'

import { MobileSidebar } from './sidebar'
import { Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, eyebrow, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]/85 px-4 backdrop-blur-xl sm:px-8">
      <div className="flex min-h-[5rem] items-center gap-5 py-3">
        <MobileSidebar />

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

        <div className="flex items-center gap-3 pl-1">
          <button aria-label="Notificações" className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-2xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]">
            <Bell className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--brand-bright)] ring-2 ring-[var(--surface)]" />
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--brand)] font-display text-[13px] font-bold text-[var(--on-brand)]">
            AD
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-3 pb-3 sm:hidden">{actions}</div>
      )}
    </header>
  )
}
