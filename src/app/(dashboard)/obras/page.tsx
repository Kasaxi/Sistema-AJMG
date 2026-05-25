'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, MapPin, CalendarDays, Wallet, Hammer } from 'lucide-react'
import { ObraForm } from '@/components/obras/obra-form'
import { listObras } from '@/app/actions/obras-actions'
import type { Obra, ObraStatus } from '@/types/obras'
import { OBRA_STATUS_LABELS } from '@/types/obras'
import { cn } from '@/lib/utils'

// Cores por status — alinhadas com o DESIGN.md (paleta restrita)
const STATUS_STYLE: Record<ObraStatus, string> = {
  PLANEJAMENTO: 'bg-[var(--paper)] text-[var(--ink-soft)]',
  EM_ANDAMENTO: 'bg-[var(--brand-tint)] text-[var(--brand-bright)]',
  PAUSADA:      'bg-amber-50 text-amber-700',
  CONCLUIDA:    'bg-emerald-50 text-emerald-700',
}

const STATUS_FILTERS: { id: 'ALL' | ObraStatus; label: string }[] = [
  { id: 'ALL',          label: 'Todas' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento' },
  { id: 'PLANEJAMENTO', label: 'Planejamento' },
  { id: 'PAUSADA',      label: 'Pausadas' },
  { id: 'CONCLUIDA',    label: 'Concluídas' },
]

function formatBRL(n: number | null) {
  if (n == null) return null
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ObrasPage() {
  const router = useRouter()
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'ALL' | ObraStatus>('ALL')

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Obra | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listObras()
      setObras(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const filtradas = obras.filter(o => {
    if (filtroStatus !== 'ALL' && o.status !== filtroStatus) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      return (
        o.nome.toLowerCase().includes(q) ||
        (o.cidade?.toLowerCase().includes(q) ?? false) ||
        (o.endereco?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  function abrirNova() {
    setEditando(null)
    setModalOpen(true)
  }

  function abrirDetalhe(o: Obra) {
    router.push(`/obras/${o.id}`)
  }

  return (
    <>
      <Header
        eyebrow="Construtora"
        title="Obras"
        subtitle="Empreendimentos e canteiros da AJMG"
        actions={
          <Button onClick={abrirNova} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova obra
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {/* Filtros de status */}
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
            placeholder="Buscar por nome, cidade ou endereço…"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState onCreate={abrirNova} hasBusca={!!busca.trim() || filtroStatus !== 'ALL'} />
        ) : (
          <div className="space-y-2.5">
            {filtradas.map(o => (
              <ObraCard key={o.id} obra={o} onClick={abrirDetalhe} />
            ))}
          </div>
        )}
      </div>

      <ObraForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editando}
        onSaved={carregar}
      />
    </>
  )
}

function ObraCard({ obra, onClick }: { obra: Obra; onClick: (o: Obra) => void }) {
  const inicio = formatDate(obra.data_inicio)
  const previsao = formatDate(obra.data_previsao_entrega)
  const orcamento = formatBRL(obra.orcamento_previsto)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(obra)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(obra)
        }
      }}
      className="group w-full cursor-pointer rounded-2xl border border-[var(--line)] bg-white p-4 text-left transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
          <Hammer className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="min-w-0 flex-1 font-display text-base font-bold leading-tight text-[var(--ink)]">
              {obra.nome}
            </h3>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
              STATUS_STYLE[obra.status],
            )}>
              {OBRA_STATUS_LABELS[obra.status]}
            </span>
          </div>

          {(obra.endereco || obra.cidade) && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--ink-soft)]">
              <MapPin className="h-3.5 w-3.5" />
              {[obra.endereco, obra.cidade].filter(Boolean).join(' — ')}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--ink-soft)]">
            {inicio && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Início {inicio}
              </span>
            )}
            {previsao && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Entrega {previsao}
              </span>
            )}
            {orcamento && (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink)]">
                <Wallet className="h-3 w-3 text-[var(--ink-soft)]" /> {orcamento}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onCreate, hasBusca }: { onCreate: () => void; hasBusca: boolean }) {
  if (hasBusca) {
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
        <Hammer className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-base font-semibold text-[var(--ink)]">Nenhuma obra cadastrada</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Cadastre o primeiro empreendimento. Compras, RH e Financeiro vão se conectar a ele.
      </p>
      <Button onClick={onCreate} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" /> Cadastrar obra
      </Button>
    </div>
  )
}
