'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2, Users, LayoutDashboard, UserCheck, BarChart3,
  DollarSign, Clock, AlertTriangle, ChevronDown, ChevronRight,
  LogOut, Settings, Menu, X, Calendar, Hammer, ShoppingCart, FileText, Wrench, Inbox, Home,
  PanelLeftClose, PanelLeftOpen,
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
    label: 'Manutenções',
    icon: Wrench,
    enabled: true,
    moduloKey: 'MANUTENCAO',
    items: [
      { label: 'Ordens de serviço', href: '/manutencoes',               icon: Wrench },
      { label: 'Solicitações',      href: '/manutencoes/solicitacoes',  icon: Inbox },
    ],
  },
  {
    label: 'Imóveis',
    icon: Home,
    enabled: true,
    moduloKey: 'IMOVEIS',
    items: [
      { label: 'Inventário', href: '/imoveis', icon: Home, exact: true },
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

function SidebarContent({ onNavigate, colapsada = false, onToggle }: { onNavigate?: () => void; colapsada?: boolean; onToggle?: () => void }) {
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
      {/* Logo + toggle de recolher */}
      <div className={cn('flex items-center gap-2 pb-3 pt-7', colapsada ? 'flex-col px-2' : 'px-5')}>
        <Link href="/vendas/clientes" onClick={onNavigate} className="group flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--brand-bright)] shadow-lg shadow-[var(--brand-bright)]/25 transition-transform group-hover:scale-105">
            <Building2 className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          {!colapsada && (
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-bold leading-tight tracking-tight text-white">
                Sistema de Gestão
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Empresarial
              </p>
            </div>
          )}
        </Link>
        {/* Botão recolher/expandir — só desktop */}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
            title={colapsada ? 'Expandir menu' : 'Recolher menu'}
            className="hidden h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white lg:grid"
          >
            {colapsada ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="scrollbar-slim min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {renderModules.map((mod) => {
          const ModIcon = mod.icon
          const visibleItems = mod.items.filter(item => !item.adminOnly || isAdmin)

          // ── Modo recolhido: só o ícone do módulo (navega pro 1º item) ──
          if (colapsada) {
            const primeiro = visibleItems[0]
            const ativo = mod.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
            if (!mod.enabled || !primeiro) {
              return (
                <div
                  key={mod.label}
                  title={mod.enabled ? mod.label : `${mod.label} (em breve)`}
                  className={cn('grid h-10 w-full place-items-center rounded-xl', mod.enabled ? 'text-white/40' : 'text-white/20')}
                >
                  <ModIcon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
                </div>
              )
            }
            return (
              <Link
                key={mod.label}
                href={primeiro.href}
                onClick={onNavigate}
                title={mod.label}
                className={cn(
                  'grid h-10 w-full place-items-center rounded-xl transition-colors',
                  ativo ? 'bg-[var(--brand-bright)] text-white shadow-lg shadow-[var(--brand-bright)]/25' : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <ModIcon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
              </Link>
            )
          }

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
                    const matches = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/')
                    // Se um irmão tem path mais específico que também bate, ele vence
                    const moreSpecificSibling = visibleItems.some(s =>
                      s.href !== item.href
                      && s.href.length > item.href.length
                      && (pathname === s.href || pathname.startsWith(s.href + '/'))
                    )
                    const isActive = matches && !moreSpecificSibling
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
          onClick={onNavigate}
          title="Configurações"
          className={cn(
            'flex items-center gap-3 rounded-xl py-2 text-sm text-white/50 transition-all duration-200 hover:bg-white/[0.04] hover:text-white',
            colapsada ? 'justify-center px-0' : 'px-3',
          )}
        >
          <Settings className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={2.2} />
          {!colapsada && 'Configurações'}
        </Link>
        <button
          onClick={handleLogout}
          title="Sair"
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-xl py-2 text-sm text-white/50 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-300',
            colapsada ? 'justify-center px-0' : 'px-3',
          )}
        >
          <LogOut className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={2.2} />
          {!colapsada && 'Sair'}
        </button>
      </div>
    </div>
  )
}

export function Sidebar({ colapsada = false, onToggle }: { colapsada?: boolean; onToggle?: () => void }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 z-50 hidden lg:flex lg:flex-col transition-[width] duration-200',
        colapsada ? 'lg:w-16' : 'lg:w-64',
      )}
    >
      <SidebarContent colapsada={colapsada} onToggle={onToggle} />
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
        <div className="fixed inset-0 z-50 h-dvh lg:hidden">
          <div
            className="fixed inset-0 h-dvh bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col shadow-2xl animate-in slide-in-from-left duration-300 motion-reduce:animate-none">
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
