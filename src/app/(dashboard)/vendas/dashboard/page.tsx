'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, TrendingUp, CheckCircle, XCircle, DollarSign, Target } from 'lucide-react'
import { getDashboardData } from '@/app/actions/vendas-actions'
import { formatCurrency, cn } from '@/lib/utils'

type DashData = Awaited<ReturnType<typeof getDashboardData>>

const C = {
  brand: '#14224F',
  brandBright: '#2F55F2',
  ink: '#0B1020',
  slate: '#94A3B8',
  rose: '#E11D48',
  amber: '#D97706',
  violet: '#7C3AED',
}
const PIE_COLORS = [C.brandBright, C.rose, C.amber, C.brand, C.violet, C.slate]
const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid #E7E9F1',
  boxShadow: '0 12px 32px -16px rgba(11,16,32,0.25)',
  fontSize: 12,
} as const

function KPICard({
  title, value, icon: Icon, tone, sub,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  tone: 'brand' | 'neutral' | 'danger' | 'accent'
  sub?: string
}) {
  const toneClass = {
    brand: 'bg-[var(--brand-tint)] text-[var(--brand)]',
    accent: 'bg-[var(--brand-tint)] text-[var(--brand-bright)]',
    neutral: 'bg-slate-100 text-slate-600',
    danger: 'bg-rose-50 text-rose-600',
  }[tone]

  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{title}</p>
        <div className={cn('grid h-9 w-9 place-items-center rounded-xl', toneClass)}>
          <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--ink)] tabular-nums">
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-[var(--ink-faint)]">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-bold tracking-tight text-[var(--ink)]">{title}</h3>
      {children}
    </div>
  )
}

export default function DashboardVendasPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getDashboardData(mes)
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [mes])

  useEffect(() => { loadData() }, [loadData])

  const mesOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) }
  })

  const statusPieData = data ? [
    { name: 'Aprovados', value: data.aprovados },
    { name: 'Reprovados', value: data.reprovados },
    { name: 'Condicionados', value: data.condicionados },
    { name: 'Vendas Fechadas', value: data.vendasFechadas },
  ].filter(d => d.value > 0) : []

  const tipoImovelData = data ? [
    { name: 'Novo', value: data.byTipoImovel.novo },
    { name: 'Usado', value: data.byTipoImovel.usado },
    { name: 'Ambos', value: data.byTipoImovel.ambos },
  ].filter(d => d.value > 0) : []

  const motivosData = data
    ? Object.entries(data.motivosReprovacao)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }))
    : []

  const periodo = (
    <Select value={mes} onValueChange={v => v && setMes(v)}>
      <SelectTrigger className="h-11 w-52 rounded-2xl border-[var(--line)] bg-[var(--surface)] text-sm shadow-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {mesOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="Dashboard"
        subtitle="Métricas e indicadores de desempenho"
        actions={periodo}
      />

      <div className="mx-auto w-full max-w-[1240px] flex-1 space-y-6 px-4 py-8 sm:px-8 sm:py-10">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          </div>
        ) : data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <KPICard title="Total Leads" value={data.total} icon={Users} tone="neutral" />
            <KPICard title="Aprovados" value={data.aprovados} icon={CheckCircle} tone="brand" />
            <KPICard title="Reprovados" value={data.reprovados} icon={XCircle} tone="danger" />
            <KPICard title="Vendas Fechadas" value={data.vendasFechadas} icon={Target} tone="brand" />
            <KPICard title="Volume de Vendas" value={formatCurrency(data.valorTotalVendas)} icon={DollarSign} tone="accent" />
            <KPICard title="Taxa Conversão" value={`${data.taxaConversao}%`} icon={TrendingUp} tone="accent" sub="Leads → Vendas" />
          </div>
        )}

        {!loading && data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data.byVendedor.length > 0 && (
              <ChartCard title="Performance por Vendedor">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byVendedor} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F6" />
                    <XAxis dataKey="vendedor" tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(47,85,242,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Total" fill={C.slate} radius={[5, 5, 0, 0]} barSize={16} />
                    <Bar dataKey="aprovados" name="Aprovados" fill={C.brand} radius={[5, 5, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {statusPieData.length > 0 && (
              <ChartCard title="Distribuição por Status">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {statusPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {tipoImovelData.length > 0 && (
              <ChartCard title="Por Tipo de Imóvel">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={tipoImovelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={3}>
                      {tipoImovelData.map((_, i) => (
                        <Cell key={i} fill={[C.brandBright, C.ink, C.slate][i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {motivosData.length > 0 && (
              <ChartCard title="Motivos de Reprovação">
                <div className="space-y-3">
                  {motivosData.map((m) => (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="flex-1 truncate text-xs text-[var(--ink-soft)]">{m.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-rose-500"
                          style={{ width: `${(m.value / (motivosData[0]?.value ?? 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs font-bold tabular-nums text-[var(--ink)]">{m.value}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            )}
          </div>
        )}

        {!loading && data && data.total === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-24 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--brand-tint)] ring-1 ring-inset ring-[var(--brand-bright)]/15">
              <TrendingUp className="h-8 w-8 text-[var(--brand)]" strokeWidth={1.8} />
            </div>
            <p className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-[var(--ink)]">
              Sem dados neste período
            </p>
            <p className="mt-2 max-w-sm text-sm text-[var(--ink-soft)]">
              Selecione outro mês ou cadastre clientes para ver os indicadores.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
