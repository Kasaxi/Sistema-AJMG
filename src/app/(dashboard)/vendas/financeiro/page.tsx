'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, DollarSign, ShoppingBag, TrendingUp, Receipt, X,
  Trophy, History, MoreHorizontal, Edit2, Trash2,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react'
import { LancarVendaModal } from '@/components/vendas/lancar-venda-modal'
import {
  getVendasFinanceiro, getVendedores, getClienteById, deleteCliente,
} from '@/app/actions/vendas-actions'
import type { Cliente, Vendedor } from '@/types/vendas'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

type VendasData = Awaited<ReturnType<typeof getVendasFinanceiro>>

const TIPO_VENDA_LABELS: Record<string, string> = { NOVO: 'Novo', USADO: 'Usado', AMBOS: 'Ambos' }

interface TrendIndicatorProps {
  current: number
  previous: number
}
function TrendIndicator({ current, previous }: TrendIndicatorProps) {
  // Sem base de comparação: não renderiza.
  if (previous === 0 && current === 0) return null
  // Período anterior sem dados mas atual com: trend "novo" — sinal positivo neutro.
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-tint)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-bright)]">
        novo
      </span>
    )
  }
  const pct = ((current - previous) / previous) * 100
  const isUp = pct >= 0
  const Icon = isUp ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
      isUp ? 'bg-[var(--brand-tint)] text-[var(--brand-bright)]' : 'bg-rose-50 text-rose-600'
    )}>
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

interface KPICardProps {
  label: string
  value: React.ReactNode
  icon: React.ElementType
  tone: 'brand' | 'accent' | 'neutral' | 'soft'
  trend?: React.ReactNode
}
function KPICard({ label, value, icon: Icon, tone, trend }: KPICardProps) {
  const toneIcon = {
    brand:   'bg-[var(--brand-tint)] text-[var(--brand)]',
    accent:  'bg-[var(--brand-tint)] text-[var(--brand-bright)]',
    neutral: 'bg-slate-100 text-slate-600',
    soft:    'bg-violet-50 text-violet-600',
  }[tone]
  const accentBar = {
    brand:   'bg-[var(--brand)]',
    accent:  'bg-[var(--brand-bright)]',
    neutral: 'bg-slate-300',
    soft:    'bg-violet-500',
  }[tone]
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className={cn('absolute left-0 top-4 h-12 w-[3px] rounded-r', accentBar)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{label}</p>
            {trend}
          </div>
          <div className="mt-2 min-w-0 font-display text-2xl font-extrabold tracking-[-0.02em] text-[var(--ink)] tabular-nums">
            {value}
          </div>
        </div>
        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-2xl', toneIcon)}>
          <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  )
}

export default function FinanceiroPage() {
  const [data, setData] = useState<VendasData | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const hasLoaded = useRef(false)

  const [filters, setFilters] = useState<{
    vendedor_id?: string
    tipo_venda?: 'NOVO' | 'USADO' | 'AMBOS'
    data_inicio?: string
    data_fim?: string
  }>({})

  const [lancarOpen, setLancarOpen] = useState(false)
  const [editingVenda, setEditingVenda] = useState<Cliente | null>(null)
  const [vendasPage, setVendasPage] = useState(1)
  const VENDAS_PER_PAGE = 10

  const loadData = useCallback(async () => {
    if (hasLoaded.current) setRefetching(true)
    else setLoading(true)
    try {
      const [vendasData, vendedoresData] = await Promise.all([
        getVendasFinanceiro(filters),
        getVendedores(),
      ])
      setData(vendasData)
      setVendedores(vendedoresData)
      hasLoaded.current = true
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefetching(false)
    }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  const activeFilters = Object.values(filters).filter(Boolean).length

  function handleFilterChange<K extends keyof typeof filters>(key: K, value: string) {
    setFilters(prev => {
      const next = (value || undefined) as typeof prev[K]
      if (prev[key] === next) return prev
      return { ...prev, [key]: next }
    })
    setVendasPage(1) // reset paginação ao trocar filtros
  }

  async function handleEditVenda(id: string) {
    const cli = await getClienteById(id)
    setEditingVenda(cli)
  }

  async function handleDeleteVenda(id: string) {
    if (!confirm('Excluir esta venda? O cliente também será removido.')) return
    await deleteCliente(id)
    loadData()
  }

  const lancarBtn = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={loadData}
        disabled={refetching}
        aria-label="Atualizar"
        className="h-11 cursor-pointer rounded-2xl border-[var(--line)] px-4"
      >
        <RefreshCw className={cn('h-4 w-4', refetching && 'animate-spin')} strokeWidth={2.2} />
      </Button>
      <Button
        onClick={() => setLancarOpen(true)}
        className="h-11 gap-2 rounded-2xl bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)] shadow-[0_8px_20px_-8px_var(--brand)] transition-all hover:bg-[var(--brand-hover)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Lançar Venda
      </Button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="Controle Financeiro de Vendas"
        subtitle="Acompanhe o faturamento e performance da equipe"
        actions={lancarBtn}
      />

      <div className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
        {/* Filtros */}
        <div className={cn(
          'mb-8 grid grid-cols-2 gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:grid-cols-4',
          'transition-opacity',
          refetching && 'opacity-70'
        )}>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Vendedor</label>
            <Select value={filters.vendedor_id ?? ''} onValueChange={v => handleFilterChange('vendedor_id', v ?? '')}>
              <SelectTrigger className="h-10 rounded-xl border-[var(--line)] text-sm">
                <SelectValue placeholder="Todos os vendedores">
                  {(v: string | null) => v ? (vendedores.find(x => x.id === v)?.nome ?? v) : 'Todos os vendedores'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os vendedores</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Tipo de Venda</label>
            <Select value={filters.tipo_venda ?? ''} onValueChange={v => handleFilterChange('tipo_venda', v ?? '')}>
              <SelectTrigger className="h-10 rounded-xl border-[var(--line)] text-sm">
                <SelectValue placeholder="Todos os tipos">
                  {(v: string | null) => v ? (TIPO_VENDA_LABELS[v] ?? v) : 'Todos os tipos'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os tipos</SelectItem>
                {Object.entries(TIPO_VENDA_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">De</label>
            <Input
              type="date"
              value={filters.data_inicio ?? ''}
              onChange={e => handleFilterChange('data_inicio', e.target.value)}
              className="h-10 rounded-xl border-[var(--line)] text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Até</label>
            <Input
              type="date"
              value={filters.data_fim ?? ''}
              onChange={e => handleFilterChange('data_fim', e.target.value)}
              className="h-10 rounded-xl border-[var(--line)] text-sm"
            />
          </div>
          {activeFilters > 0 && (
            <div className="col-span-full flex justify-end">
              <button
                onClick={() => setFilters({})}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Faturamento Total"
              value={formatCurrency(data.faturamento_total)}
              icon={DollarSign}
              tone="brand"
              trend={data.previous && (
                <TrendIndicator current={data.faturamento_total} previous={data.previous.faturamento_total} />
              )}
            />
            <KPICard
              label="Vendas Realizadas"
              value={data.vendas_realizadas}
              icon={ShoppingBag}
              tone="accent"
              trend={data.previous && (
                <TrendIndicator current={data.vendas_realizadas} previous={data.previous.vendas_realizadas} />
              )}
            />
            <KPICard
              label="Faturamento por Tipo"
              value={
                <div className="space-y-0.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--ink-faint)]">Novo</span>
                    <span className="font-bold tabular-nums text-[var(--ink)]">
                      {formatCurrency(data.faturamento_por_tipo.novo)}
                      <span className="ml-1 text-[10px] font-semibold text-[var(--ink-faint)]">({data.count_por_tipo.novo})</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--ink-faint)]">Usado</span>
                    <span className="font-bold tabular-nums text-[var(--ink)]">
                      {formatCurrency(data.faturamento_por_tipo.usado)}
                      <span className="ml-1 text-[10px] font-semibold text-[var(--ink-faint)]">({data.count_por_tipo.usado})</span>
                    </span>
                  </div>
                </div>
              }
              icon={TrendingUp}
              tone="soft"
            />
            <KPICard
              label="Ticket Médio"
              value={formatCurrency(data.ticket_medio)}
              icon={Receipt}
              tone="neutral"
              trend={data.previous && (
                <TrendIndicator current={data.ticket_medio} previous={data.previous.ticket_medio} />
              )}
            />
          </div>
        )}

        {/* Ranking + Últimas Vendas — proporção 2:3 dá mais espaço à tabela com mais colunas */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          {/* Ranking de Vendedores */}
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]">
                <Trophy className="h-4 w-4" />
              </div>
              <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">Ranking de Vendedores</h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
              </div>
            ) : !data || data.ranking.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--ink-faint)]">Sem vendas no período.</p>
            ) : (
              <div className="space-y-2.5">
                {data.ranking.map((r, i) => (
                  <div
                    key={r.vendedor_id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3"
                  >
                    <div className={cn(
                      'grid h-9 w-9 place-items-center rounded-full text-xs font-bold tabular-nums',
                      i === 0 ? 'bg-[var(--brand)] text-[var(--on-brand)]'
                      : i === 1 ? 'bg-[var(--brand-bright)]/15 text-[var(--brand-bright)]'
                      : 'bg-slate-100 text-slate-600'
                    )}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--ink)]">{r.nome}</p>
                      <p className="text-xs text-[var(--ink-faint)]">{r.vendas} {r.vendas === 1 ? 'venda' : 'vendas'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-sm font-bold tabular-nums text-[var(--ink)]">{formatCurrency(r.total)}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">total</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimas Vendas */}
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
                  <History className="h-4 w-4" />
                </div>
                <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">Últimas Vendas</h2>
              </div>
              <Button
                onClick={() => setLancarOpen(true)}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} /> Lançar
              </Button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : !data || data.vendas.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--ink-faint)]">Nenhuma venda registrada no período.</p>
            ) : (() => {
              const totalPages = Math.ceil(data.vendas.length / VENDAS_PER_PAGE)
              const safePage = Math.min(vendasPage, totalPages)
              const start = (safePage - 1) * VENDAS_PER_PAGE
              const pageVendas = data.vendas.slice(start, start + VENDAS_PER_PAGE)
              return (
                <div className={cn('overflow-x-auto transition-opacity', refetching && 'opacity-70')}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--line)] text-left">
                        {['Cliente', 'Vendedor', 'Tipo', 'Valor', 'Data', ''].map((h, i) => (
                          <th key={i} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {pageVendas.map(v => (
                        <tr key={v.id} className="group transition-colors hover:bg-[var(--paper)]">
                          <td className="px-2 py-2.5 font-semibold text-[var(--ink)]">{v.nome}</td>
                          <td className="px-2 py-2.5 text-[var(--ink-soft)]">{v.vendedor?.nome ?? '—'}</td>
                          <td className="px-2 py-2.5">
                            <span className="inline-flex items-center rounded-md bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/15">
                              {v.tipo_venda ?? '—'}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 font-bold tabular-nums text-[var(--ink)]">{formatCurrency(v.valor_venda)}</td>
                          <td className="px-2 py-2.5 tabular-nums text-[var(--ink-soft)]">{formatDate(v.data_venda)}</td>
                          <td className="px-2 py-2.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger render={
                                <Button
                                  aria-label="Ações"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer rounded-lg text-[var(--ink-faint)] opacity-100 transition-opacity hover:bg-[var(--paper)] hover:text-[var(--ink)] data-[popup-open]:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              } />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditVenda(v.id)}>
                                  <Edit2 className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteVenda(v.id)} variant="destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                      <span className="text-xs text-[var(--ink-soft)]">
                        <span className="tabular-nums">{start + 1}–{Math.min(start + VENDAS_PER_PAGE, data.vendas.length)}</span> de <span className="tabular-nums">{data.vendas.length}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setVendasPage(p => Math.max(1, p - 1))}
                          disabled={safePage === 1}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Página anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 text-xs font-semibold tabular-nums text-[var(--ink)]">
                          {safePage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setVendasPage(p => Math.min(totalPages, p + 1))}
                          disabled={safePage === totalPages}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Próxima página"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      <LancarVendaModal
        open={lancarOpen}
        onClose={() => setLancarOpen(false)}
        onSaved={loadData}
      />

      <LancarVendaModal
        open={!!editingVenda}
        onClose={() => setEditingVenda(null)}
        onSaved={loadData}
        vendaToEdit={editingVenda}
      />
    </div>
  )
}
