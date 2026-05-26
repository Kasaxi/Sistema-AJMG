'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, FileText, MapPin } from 'lucide-react'
import { listCotacoes, type CotacaoListItem } from '@/app/actions/cotacoes-actions'
import type { CotacaoStatus } from '@/types/compras'
import { COTACAO_STATUS_LABEL } from '@/types/compras'
import { cn } from '@/lib/utils'

const STATUS_FILTERS: { id: 'ALL' | CotacaoStatus; label: string }[] = [
  { id: 'ALL',        label: 'Todas' },
  { id: 'RASCUNHO',   label: 'Rascunho' },
  { id: 'ENVIADA',    label: 'Enviadas' },
  { id: 'RECEBENDO',  label: 'Recebendo' },
  { id: 'FECHADA',    label: 'Fechadas' },
]

const STATUS_TONE: Record<CotacaoStatus, string> = {
  RASCUNHO:   'bg-[var(--paper)] text-[var(--ink-soft)]',
  ENVIADA:    'bg-[var(--brand-tint)] text-[var(--brand-bright)]',
  RECEBENDO:  'bg-amber-50 text-amber-700',
  FECHADA:    'bg-emerald-50 text-emerald-700',
  CANCELADA:  'bg-rose-50 text-rose-700',
}

function formatDateBR(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatRelative(iso: string) {
  const diff = Date.now() - Date.parse(iso)
  const dias = Math.floor(diff / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(dias / 365)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

export default function CotacoesListPage() {
  const [cotacoes, setCotacoes] = useState<CotacaoListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'ALL' | CotacaoStatus>('ALL')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCotacoes()
      setCotacoes(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const filtradas = cotacoes.filter(c => {
    if (filtroStatus !== 'ALL' && c.status !== filtroStatus) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      return (
        c.titulo.toLowerCase().includes(q) ||
        (c.obra?.nome?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  return (
    <>
      <Header
        eyebrow="Compras"
        title="Orçamentos"
        subtitle="Pedidos de cotação enviados pros fornecedores"
        actions={
          <Link href="/compras/cotacoes/nova">
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova cotação
            </Button>
          </Link>
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
            placeholder="Buscar por título ou obra…"
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
            {filtradas.map(c => (
              <CotacaoCard key={c.id} cotacao={c} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function CotacaoCard({ cotacao }: { cotacao: CotacaoListItem }) {
  const obra = cotacao.obra
  const prazo = formatDateBR(cotacao.prazo_resposta)
  return (
    <Link
      href={`/compras/cotacoes/${cotacao.id}`}
      className="group block rounded-2xl border border-[var(--line)] bg-white p-5 transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
          <FileText className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="min-w-0 flex-1 font-display text-base font-bold leading-tight text-[var(--ink)]">
              {cotacao.titulo}
            </h3>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
              STATUS_TONE[cotacao.status],
            )}>
              {COTACAO_STATUS_LABEL[cotacao.status]}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--ink-soft)]">
            {obra ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {obra.nome}
              </span>
            ) : (
              <span className="text-[var(--ink-faint)]">Sem obra vinculada</span>
            )}
            <span>·</span>
            <span>Criada {formatRelative(cotacao.created_at)}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <Stat label="Itens"        value={cotacao.qtd_itens} />
            <Stat label="Fornecedores" value={cotacao.qtd_fornecedores} />
            <Stat
              label="Respondidos"
              value={`${cotacao.qtd_respondidos}/${cotacao.qtd_fornecedores}`}
              highlight={cotacao.qtd_respondidos > 0}
            />
            {prazo && (
              <Stat label="Prazo" value={prazo} />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{label}</span>
      <span className={cn(
        'font-semibold tabular-nums',
        highlight ? 'text-[var(--brand-bright)]' : 'text-[var(--ink)]',
      )}>{value}</span>
    </span>
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
        <FileText className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-base font-semibold text-[var(--ink)]">Nenhuma cotação criada ainda</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Crie um pedido de orçamento, adicione itens e mande pros fornecedores.
      </p>
      <Link href="/compras/cotacoes/nova" className="mt-4 inline-block">
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova cotação
        </Button>
      </Link>
    </div>
  )
}
