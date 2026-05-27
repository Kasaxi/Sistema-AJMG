'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshButton } from '@/components/ui/refresh-button'
import { Plus, Search, Wrench, MapPin, User, CalendarDays, Clock } from 'lucide-react'
import { listManutencoes } from '@/app/actions/manutencoes-actions'
import type { Manutencao, ManutencaoStatus } from '@/types/manutencoes'
import { MANUTENCAO_STATUS_LABEL } from '@/types/manutencoes'
import { cn } from '@/lib/utils'

const STATUS_FILTERS: { id: 'ALL' | ManutencaoStatus; label: string }[] = [
  { id: 'ALL',           label: 'Todas' },
  { id: 'AGENDADA',      label: 'Agendadas' },
  { id: 'EM_ANDAMENTO',  label: 'Em andamento' },
  { id: 'CONCLUIDA',     label: 'Concluídas' },
  { id: 'CANCELADA',     label: 'Canceladas' },
]

const STATUS_TONE: Record<ManutencaoStatus, string> = {
  AGENDADA:      'bg-[var(--paper)] text-[var(--ink-soft)]',
  EM_ANDAMENTO:  'bg-amber-50 text-amber-700',
  CONCLUIDA:     'bg-emerald-50 text-emerald-700',
  CANCELADA:     'bg-rose-50 text-rose-700',
}

function formatDateBR(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatHora(time: string | null) {
  if (!time) return null
  return time.slice(0, 5)  // "09:00:00" → "09:00"
}

function formatRelative(iso: string) {
  const diff = Date.now() - Date.parse(iso)
  const dias = Math.floor(diff / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  return `há ${Math.floor(dias / 365)} anos`
}

export default function ManutencoesListPage() {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'ALL' | ManutencaoStatus>('ALL')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listManutencoes()
      setManutencoes(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const filtradas = manutencoes.filter(m => {
    if (filtroStatus !== 'ALL' && m.status !== filtroStatus) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      return (
        (m.endereco?.toLowerCase().includes(q) ?? false) ||
        (m.cliente?.nome?.toLowerCase().includes(q) ?? false) ||
        (m.observacoes?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  return (
    <>
      <Header
        eyebrow="Manutenções"
        title="Ordens de serviço"
        subtitle="Solicitações e atendimentos pós-entrega"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={carregar} />
            <Link href="/manutencoes/nova">
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova manutenção
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {/* Filtros */}
        <div className="mb-5 inline-flex w-full overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1 sm:w-auto">
          {STATUS_FILTERS.map(f => {
            const isActive = filtroStatus === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroStatus(f.id)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-white text-[var(--ink)] shadow-sm ring-1 ring-inset ring-[var(--line)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Busca */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por problema, endereço ou cliente…"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState hasFiltro={!!busca.trim() || filtroStatus !== 'ALL'} />
        ) : (
          <div className="space-y-2.5">
            {filtradas.map(m => <ManutencaoCard key={m.id} m={m} />)}
          </div>
        )}
      </div>
    </>
  )
}

function ManutencaoCard({ m }: { m: Manutencao }) {
  const dataAg = formatDateBR(m.data_agendada)
  const hora = formatHora(m.hora_inicio)
  return (
    <Link
      href={`/manutencoes/${m.id}`}
      className="group block rounded-2xl border border-[var(--line)] bg-white p-5 transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
          <Wrench className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="min-w-0 flex-1 font-display text-base font-bold leading-tight text-[var(--ink)]">
              {m.cliente?.nome ?? (m.endereco ? `Manutenção · ${m.endereco}` : 'Manutenção')}
            </h3>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
              STATUS_TONE[m.status],
            )}>
              {MANUTENCAO_STATUS_LABEL[m.status]}
            </span>
          </div>

          {/* Endereço aparece abaixo quando cliente está no título */}
          {m.cliente?.nome && m.endereco && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-sm text-[var(--ink-soft)]">
              <MapPin className="h-3.5 w-3.5" /> {m.endereco}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--ink-soft)]">
            {dataAg && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {dataAg}{hora ? ` · ${hora}` : ''}
              </span>
            )}
            {m.responsavel?.nome && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" /> {m.responsavel.nome.split(' ')[0]}
              </span>
            )}
            <span className="ml-auto text-[var(--ink-faint)]">
              <Clock className="mr-1 inline h-3 w-3" />
              Criada {formatRelative(m.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ hasFiltro }: { hasFiltro: boolean }) {
  if (hasFiltro) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-[var(--ink)]">Nada bateu com os filtros</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Tenta limpar a busca ou trocar o status.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Wrench className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-base font-semibold text-[var(--ink)]">Nenhuma manutenção cadastrada</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Crie uma manutenção pra agendar atendimento ou registrar serviço já feito.
      </p>
      <Link href="/manutencoes/nova" className="mt-4 inline-block">
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova manutenção
        </Button>
      </Link>
    </div>
  )
}
