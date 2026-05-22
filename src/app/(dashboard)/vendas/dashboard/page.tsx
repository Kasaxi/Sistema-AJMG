'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Send, Users, CheckCircle, AlertCircle, XCircle, ShoppingBag, X,
  ArrowUpRight, ArrowDownRight, BarChart3, AlertTriangle, AlertOctagon, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LancarLeadsModal } from '@/components/vendas/lancar-leads-modal'
import { getDashboardData, getVendedores } from '@/app/actions/vendas-actions'
import type { Vendedor } from '@/types/vendas'
import { AVALIACAO_LABELS } from '@/types/vendas'
import { cn } from '@/lib/utils'

type DashData = Awaited<ReturnType<typeof getDashboardData>>

// Cores por categoria (regra "nunca verde" — VENDA_FECHADA usa azul-brand).
const CHART_BLUE = '#2F55F2'    // brand-bright
const CHART_NAVY = '#14224F'    // brand

const STATUS_COLOR: Record<string, string> = {
  REPROVADO:                  '#E11D48', // rose-600
  CONDICIONADO:               '#D97706', // amber-600
  APROVADO:                   '#2F55F2', // brand-bright
  DESISTENCIA:                '#94A3B8', // slate-400
  VENDA_FECHADA:              '#14224F', // brand navy
  QV_LIBERACAO_REAVALIAR:     '#7C3AED', // violet-600
  PRECISA_CARTA_CANCELAMENTO: '#EA580C', // orange-600
  EM_ANALISE:                 '#06B6D4', // cyan-600
  TOKEN:                      '#0EA5E9', // sky-500
}
const STATUS_LABEL: Record<string, string> = AVALIACAO_LABELS

// ─── Componentes auxiliares ─────────────────────────────────────────

interface KPIDashCardProps {
  label: string
  value: React.ReactNode
  icon: React.ElementType
  accent: string         // hex color for accent bar at the bottom
  sub?: React.ReactNode  // a small line below the number (e.g., "10.4% qualificação")
  subColor?: string      // color for sub text
  trend?: React.ReactNode
}
function KPIDashCard({ label, value, icon: Icon, accent, sub, subColor, trend }: KPIDashCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-[var(--ink-faint)]">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" strokeWidth={2.2} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--ink)] tabular-nums">
          {value}
        </span>
        {trend}
      </div>
      {sub && (
        <p className="mt-1 text-xs font-semibold" style={{ color: subColor ?? '#6B7280' }}>
          {sub}
        </p>
      )}
      <span className="absolute bottom-0 left-0 h-1 w-full" style={{ backgroundColor: accent }} />
    </div>
  )
}

function TrendChip({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--brand-tint)] px-1 py-0.5 text-[9px] font-semibold text-[var(--brand-bright)]">
        novo
      </span>
    )
  }
  const pct = ((current - previous) / previous) * 100
  const isUp = pct >= 0
  const Icon = isUp ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-semibold tabular-nums',
      isUp ? 'bg-[var(--brand-tint)] text-[var(--brand-bright)]' : 'bg-rose-50 text-rose-600'
    )}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.4} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Página ─────────────────────────────────────────────────────────

export default function DashboardVendasPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const hasLoaded = useRef(false)

  const [filters, setFilters] = useState<{
    vendedor_id?: string
    status_novo?: string
    status_usado?: string
    data_inicio?: string
    data_fim?: string
  }>({})

  const [lancarLeadsOpen, setLancarLeadsOpen] = useState(false)

  const [chartSeries, setChartSeries] = useState<{ avaliacoes: boolean; leads: boolean }>({
    avaliacoes: true,
    leads: true,
  })
  function toggleSeries(key: 'avaliacoes' | 'leads') {
    setChartSeries(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // Garante que pelo menos uma série esteja visível.
      if (!next.avaliacoes && !next.leads) return prev
      return next
    })
  }

  const loadData = useCallback(async () => {
    if (hasLoaded.current) setRefetching(true)
    else setLoading(true)
    try {
      const [dash, vends] = await Promise.all([getDashboardData(filters), getVendedores()])
      setData(dash)
      setVendedores(vends)
      hasLoaded.current = true
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false); setRefetching(false)
    }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  function handleFilterChange<K extends keyof typeof filters>(key: K, value: string) {
    setFilters(prev => {
      const next = (value || undefined) as typeof prev[K]
      if (prev[key] === next) return prev
      return { ...prev, [key]: next }
    })
  }

  const activeFilters = Object.values(filters).filter(Boolean).length

  const headerActions = (
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
        onClick={() => setLancarLeadsOpen(true)}
        className="h-11 cursor-pointer gap-2 rounded-2xl bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)] shadow-[0_8px_20px_-8px_var(--brand)] hover:bg-[var(--brand-hover)]"
      >
        <Send className="h-4 w-4" strokeWidth={2.4} /> Lançar Leads
      </Button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="Dashboard"
        subtitle="Visão completa do funil de vendas e performance da equipe"
        actions={headerActions}
      />

      <div className="mx-auto w-full max-w-[1480px] flex-1 space-y-6 px-4 py-8 sm:px-8 sm:py-10">
        {/* Filtros */}
        <div className={cn(
          'grid grid-cols-2 gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:grid-cols-5',
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
                {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Status Novo</label>
            <Select value={filters.status_novo ?? ''} onValueChange={v => handleFilterChange('status_novo', v ?? '')}>
              <SelectTrigger className="h-10 rounded-xl border-[var(--line)] text-sm">
                <SelectValue placeholder="Todos os status">
                  {(v: string | null) => v ? (STATUS_LABEL[v] ?? v) : 'Todos os status'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Status Usado</label>
            <Select value={filters.status_usado ?? ''} onValueChange={v => handleFilterChange('status_usado', v ?? '')}>
              <SelectTrigger className="h-10 rounded-xl border-[var(--line)] text-sm">
                <SelectValue placeholder="Todos os status">
                  {(v: string | null) => v ? (STATUS_LABEL[v] ?? v) : 'Todos os status'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Início</label>
            <Input type="date" value={filters.data_inicio ?? ''} onChange={e => handleFilterChange('data_inicio', e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Fim</label>
            <Input type="date" value={filters.data_fim ?? ''} onChange={e => handleFilterChange('data_fim', e.target.value)} className="h-10 rounded-xl text-sm" />
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : data && (
          <div className={cn(
            'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 transition-opacity',
            refetching && 'opacity-70'
          )}>
            <KPIDashCard
              label="Leads Enviados"
              value={data.leads_enviados.toLocaleString('pt-BR')}
              icon={Send}
              accent={CHART_BLUE}
              sub="distribuição manual"
              subColor="#6B7280"
              trend={data.previous && <TrendChip current={data.leads_enviados} previous={data.previous.leads_enviados} />}
            />
            <KPIDashCard
              label="Total Avaliações"
              value={data.total_avaliacoes.toLocaleString('pt-BR')}
              icon={Users}
              accent={CHART_BLUE}
              sub={`${data.taxas.conversao_aval.toFixed(1)}% conversão (Leads → Aval)`}
              subColor={CHART_BLUE}
              trend={data.previous && <TrendChip current={data.total_avaliacoes} previous={data.previous.total_avaliacoes} />}
            />
            <KPIDashCard
              label="Vendas Fechadas"
              value={data.vendas_fechadas.toLocaleString('pt-BR')}
              icon={ShoppingBag}
              accent={CHART_NAVY}
              sub={`${data.taxas.conversao_venda.toFixed(1)}% (Aval → Venda)`}
              subColor={CHART_NAVY}
              trend={data.previous && <TrendChip current={data.vendas_fechadas} previous={data.previous.vendas_fechadas} />}
            />
            <KPIDashCard
              label="Aprovados"
              value={data.aprovados.toLocaleString('pt-BR')}
              icon={CheckCircle}
              accent={CHART_BLUE}
              sub={`${data.taxas.qualificacao.toFixed(1)}% qualificação`}
              subColor={CHART_BLUE}
              trend={data.previous && <TrendChip current={data.aprovados} previous={data.previous.aprovados} />}
            />
            <KPIDashCard
              label="Condicionados"
              value={data.condicionados.toLocaleString('pt-BR')}
              icon={AlertCircle}
              accent="#D97706"
              sub={`${data.taxas.condicionamento.toFixed(1)}% do total`}
              subColor="#D97706"
              trend={data.previous && <TrendChip current={data.condicionados} previous={data.previous.condicionados} />}
            />
            <KPIDashCard
              label="Reprovados"
              value={data.reprovados.toLocaleString('pt-BR')}
              icon={XCircle}
              accent="#E11D48"
              sub={`${data.taxas.perda.toFixed(1)}% perda`}
              subColor="#E11D48"
              trend={data.previous && <TrendChip current={data.reprovados} previous={data.previous.reprovados} />}
            />
          </div>
        )}

        {/* Evolução diária */}
        {!loading && data && data.evolucao_diaria.length > 0 && (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-bold tracking-tight text-[var(--ink)]">
                Evolução de Clientes (Diário)
              </h3>
              <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1">
                {([
                  { key: 'avaliacoes' as const, label: 'Avaliações', color: CHART_BLUE },
                  { key: 'leads' as const, label: 'Leads', color: CHART_NAVY },
                ]).map(({ key, label, color }) => {
                  const active = chartSeries[key]
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSeries(key)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                        active ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
                      )}
                      style={{
                        backgroundColor: active ? `${color}1A` : 'transparent',
                        color: active ? color : 'var(--ink-soft)',
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.evolucao_diaria} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="gradAvaliacoes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_NAVY} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={CHART_NAVY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E7E9F1" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="data"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickFormatter={d => {
                    const parts = d.split('-')
                    return `${parts[2]}/${parts[1]}`
                  }}
                  axisLine={{ stroke: '#E7E9F1' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E7E9F1', fontSize: 12 }}
                  labelFormatter={d => `Data: ${d}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {chartSeries.avaliacoes && (
                  <Area
                    type="monotone"
                    dataKey="avaliacoes"
                    stroke={CHART_BLUE}
                    strokeWidth={2.2}
                    fill="url(#gradAvaliacoes)"
                    name="Avaliações"
                  />
                )}
                {chartSeries.leads && (
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke={CHART_NAVY}
                    strokeWidth={2.2}
                    fill="url(#gradLeads)"
                    name="Leads"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Performance + Status */}
        {!loading && data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Performance por Vendedor */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <h3 className="mb-4 font-display text-base font-bold tracking-tight text-[var(--ink)]">
                Performance por Vendedor
              </h3>
              {data.performance_vendedores.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--ink-faint)]">Sem dados no período.</p>
              ) : (
                <div className="space-y-2">
                  {data.performance_vendedores.map(v => {
                    const maxAval = Math.max(1, ...data.performance_vendedores.map(p => p.avaliacoes))
                    const maxLeads = Math.max(1, ...data.performance_vendedores.map(p => p.leads_recebidos))
                    return (
                      <div key={v.vendedor_id} className="space-y-2 rounded-xl bg-[var(--paper)] p-3 ring-1 ring-inset ring-[var(--line)]/60 transition-all duration-200 hover:bg-[var(--surface)] hover:shadow-sm hover:ring-[var(--brand-bright)]/20">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-[10px] font-bold text-[var(--on-brand)]">
                            {initials(v.nome)}
                          </div>
                          <span className="flex-1 truncate text-sm font-semibold text-[var(--ink)]">{v.nome}</span>
                          <span className="text-sm font-bold tabular-nums text-[var(--ink)]">{v.avaliacoes}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]/50">
                          <div
                            className="h-full rounded-full bg-[var(--brand-bright)] transition-all"
                            style={{ width: `${(v.avaliacoes / maxAval) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--ink-faint)]">
                          <span>Leads Recebidos</span>
                          <span className="font-bold tabular-nums">{v.leads_recebidos}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-[var(--line)]/50">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all"
                            style={{ width: `${(v.leads_recebidos / maxLeads) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Status dos Leads */}
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <h3 className="mb-4 font-display text-base font-bold tracking-tight text-[var(--ink)]">
                Status dos Leads
              </h3>
              {data.status_leads.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--ink-faint)]">Sem dados no período.</p>
              ) : (
                <div className="space-y-2">
                  {data.status_leads.map(s => {
                    const max = Math.max(1, ...data.status_leads.map(x => x.total))
                    const color = STATUS_COLOR[s.status] ?? '#94A3B8'
                    return (
                      <div key={s.status} className="space-y-1.5 rounded-xl bg-[var(--paper)] p-3 ring-1 ring-inset ring-[var(--line)]/60 transition-all duration-200 hover:bg-[var(--surface)] hover:shadow-sm hover:ring-[var(--brand-bright)]/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold" style={{ color }}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </span>
                          <span className="text-sm font-bold tabular-nums text-[var(--ink)]">{s.total}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]/50">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(s.total / max) * 100}%`, backgroundColor: color }}
                          />
                        </div>
                        <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                          <span>Novo <span className="text-[var(--ink-soft)]">{s.novo}</span></span>
                          <span className="text-[var(--line)]">|</span>
                          <span>Usado <span className="text-[var(--ink-soft)]">{s.usado}</span></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Análise de Motivos */}
        {!loading && data && (data.motivos_reprovacao.length > 0 || data.motivos_condicionamento.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--brand-bright)]" strokeWidth={2.2} />
              <h2 className="font-display text-base font-bold tracking-tight text-[var(--ink)]">
                Análise de Motivos
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MotivosCard
                title="Motivos de Reprovação"
                icon={AlertOctagon}
                total={data.motivos_reprovacao.reduce((s, m) => s + m.total, 0)}
                accentColor="#E11D48"
                items={data.motivos_reprovacao.slice(0, 5)}
              />
              <MotivosCard
                title="Motivos de Condicionamento"
                icon={AlertTriangle}
                total={data.motivos_condicionamento.reduce((s, m) => s + m.total, 0)}
                accentColor="#D97706"
                items={data.motivos_condicionamento.slice(0, 5)}
              />
            </div>
          </div>
        )}
      </div>

      <LancarLeadsModal
        open={lancarLeadsOpen}
        onClose={() => setLancarLeadsOpen(false)}
        onSaved={loadData}
      />
    </div>
  )
}

interface MotivosCardProps {
  title: string
  icon: React.ElementType
  total: number
  accentColor: string
  items: Array<{ motivo: string; total: number; novo: number; usado: number }>
}
function MotivosCard({ title, icon: Icon, total, accentColor, items }: MotivosCardProps) {
  const max = Math.max(1, ...items.map(i => i.total))
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="grid h-7 w-7 place-items-center rounded-lg"
            style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
          </div>
          <h3 className="font-display text-sm font-bold tracking-tight text-[var(--ink)]">{title}</h3>
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color: accentColor }}>
          {total} TOTAL
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--ink-faint)]">Sem motivos no período.</p>
      ) : (
        <div className="space-y-2">
          {items.map((m, i) => (
            <div key={i} className="space-y-1.5 rounded-xl bg-[var(--paper)] p-3 ring-1 ring-inset ring-[var(--line)]/60 transition-all duration-200 hover:bg-[var(--surface)] hover:shadow-sm hover:ring-[var(--brand-bright)]/20">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--ink)]" style={{ fontStyle: m.motivo.trim() === '' || m.motivo === 'Não especificado' ? 'italic' : 'normal' }}>
                  {m.motivo.trim() || 'Não especificado'}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--ink)]">{m.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]/50">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(m.total / max) * 100}%`, backgroundColor: accentColor }}
                />
              </div>
              <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                <span>Novo <span className="text-[var(--ink-soft)]">{m.novo}</span></span>
                <span className="text-[var(--line)]">|</span>
                <span>Usado <span className="text-[var(--ink-soft)]">{m.usado}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
