'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2, Users, LayoutDashboard, UserCheck, BarChart3,
  DollarSign, Clock, AlertTriangle, ChevronDown, ChevronRight,
  LogOut, Settings, Menu, X, Calendar, Hammer, ShoppingCart, FileText
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getCurrentProfile } from '@/app/actions/vendas-actions'
import { profileHasModule, type CurrentProfile } from '@/lib/permissions'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
  exact?: boolean   // se true, só ativa em match exato (sem startsWith)
}

interface NavModule {
  label: string
  icon: React.ElementType
  items: NavItem[]
  enabled: boolean
  moduloKey: string // chave em acesso_modulos / VENDAS
}

const modules: NavModule[] = [
  {
    label: 'Vendas',
    icon: UserCheck,
    enabled: true,
    moduloKey: 'VENDAS',
    items: [
      { label: 'Clientes', href: '/vendas/clientes', icon: Users },
      { label: 'CRM / Funil', href: '/vendas/crm', icon: LayoutDashboard },
      { label: 'Financeiro', href: '/vendas/financeiro', icon: DollarSign },
      { label: 'Vendedores', href: '/vendas/vendedores', icon: UserCheck, adminOnly: true },
      { label: 'Dashboard', href: '/vendas/dashboard', icon: BarChart3 },
    ],
  },
  {
    label: 'Agenda',
    icon: Calendar,
    enabled: true,
    moduloKey: 'AGENDA',
    items: [
      { label: 'Visão geral', href: '/agenda', icon: Calendar },
    ],
  },
  {
    label: 'Obras',
    icon: Hammer,
    enabled: true,
    moduloKey: 'OBRAS',
    items: [
      { label: 'Empreendimentos', href: '/obras', icon: Hammer, exact: true },
    ],
  },
  {
    label: 'Compras',
    icon: ShoppingCart,
    enabled: true,
    moduloKey: 'COMPRAS',
    items: [
      { label: 'Orçamentos',   href: '/compras/cotacoes',     icon: FileText,  adminOnly: true },
      { label: 'Fornecedores', href: '/compras/fornecedores', icon: Building2 },
    ],
  },
  {
    label: 'Financeiro',
    icon: DollarSign,
    enabled: false,
    moduloKey: 'FINANCEIRO',
    items: [
      { label: 'Lançamentos', href: '/financeiro/lancamentos', icon: DollarSign },
      { label: 'DRE', href: '/financeiro/dre', icon: BarChart3 },
    ],
  },
  {
    label: 'RH / Ponto',
    icon: Clock,
    enabled: false,
    moduloKey: 'RH',
    items: [
      { label: 'Funcionários', href: '/ponto/funcionarios', icon: Users },
      { label: 'Espelho de Ponto', href: '/ponto/espelho', icon: Clock },
    ],
  },
  {
    label: 'Cobrança',
    icon: AlertTriangle,
    enabled: false,
    moduloKey: 'COBRANCA',
    items: [
      { label: 'Clientes', href: '/cobranca/clientes', icon: Users },
      { label: 'Notificações', href: '/cobranca/notificacoes', icon: AlertTriangle },
    ],
  },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openModules, setOpenModules] = useState<string[]>(['Vendas'])
  const [profile, setProfile] = useState<CurrentProfile | null>(null)

  useEffect(() => {
    getCurrentProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [])

  const isAdmin = profile?.role === 'ADMIN'
  const visibleModules = profile
    ? modules.filter(m => m.enabled && profileHasModule(profile, m.moduloKey))
    : []
  const disabledModulesForAdmin = isAdmin
    ? modules.filter(m => !m.enabled)
    : []
  const renderModules = [...visibleModules, ...disabledModulesForAdmin]

  function toggleModule(label: string) {
    setOpenModules(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      className="flex h-full flex-col text-white"
      style={{ backgroundColor: 'var(--sidebar-bg, #0E1430)' }}
    >
      {/* Logo */}
      <div className="px-5 pb-3 pt-7">
        <Link href="/vendas/clientes" className="group flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--brand-bright)] shadow-lg shadow-[var(--brand-bright)]/25 transition-transform group-hover:scale-105">
            <Building2 className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-bold leading-tight tracking-tight text-white">
              Sistema de Gestão
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Empresarial
            </p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {renderModules.map((mod) => {
          const ModIcon = mod.icon
          const visibleItems = mod.items.filter(item => !item.adminOnly || isAdmin)

          // Módulo habilitado com 1 sub-item visível → vira link direto
          if (mod.enabled && visibleItems.length === 1) {
            const item = visibleItems[0]
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={mod.label}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-[var(--brand-bright)] text-white shadow-lg shadow-[var(--brand-bright)]/25'
                    : 'text-white/60 hover:bg-white/[0.04] hover:text-white',
                )}
              >
                <ModIcon className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={2.2} />
                <span className="flex-1 text-left">{mod.label}</span>
              </Link>
            )
          }

          // Caso contrário: grupo expandível (ou desabilitado)
          const isOpen = openModules.includes(mod.label)
          const hasActiveChild = mod.items.some(item => pathname.startsWith(item.href))

          return (
            <div key={mod.label}>
              <button
                onClick={() => mod.enabled && toggleModule(mod.label)}
                disabled={!mod.enabled}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                  mod.enabled
                    ? hasActiveChild
                      ? 'bg-white/[0.06] text-white'
                      : 'cursor-pointer text-white/60 hover:bg-white/[0.04] hover:text-white'
                    : 'cursor-not-allowed text-white/30'
                )}
              >
                <ModIcon
                  className={cn(
                    'h-[1.05rem] w-[1.05rem] shrink-0',
                    mod.enabled && hasActiveChild ? 'text-[var(--brand-bright)]' : 'text-current'
                  )}
                  strokeWidth={2.2}
                />
                <span className="flex-1 text-left">{mod.label}</span>
                {!mod.enabled && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white/25">
                    Em breve
                  </span>
                )}
                {mod.enabled && (
                  isOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                    : <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                )}
              </button>

              {mod.enabled && isOpen && (
                <div className="mt-1 space-y-0.5 pl-3.5">
                  {visibleItems.map((item) => {
                    const ItemIcon = item.icon
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'relative flex items-center gap-2.5 rounded-xl py-2 pl-4 pr-3 text-sm transition-all duration-200',
                          isActive
                            ? 'bg-[var(--brand-bright)] font-semibold text-white shadow-lg shadow-[var(--brand-bright)]/25'
                            : 'text-white/50 hover:bg-white/[0.04] hover:text-white'
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-1 px-3 pb-5 pt-2">
        <Link
          href="/configuracoes"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 transition-all duration-200 hover:bg-white/[0.04] hover:text-white"
        >
          <Settings className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
          Configurações
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
          Sair
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 z-50 hidden lg:flex lg:w-64 lg:flex-col">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="cursor-pointer rounded-xl p-2 text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 shadow-2xl animate-in slide-in-from-left duration-300 motion-reduce:animate-none">
            <SidebarContent onNavigate={() => setOpen(false)} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-4 top-6 cursor-pointer rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
