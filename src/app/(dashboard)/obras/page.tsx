'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search } from 'lucide-react'
import { ObraForm } from '@/components/obras/obra-form'
import { listObrasComResumo } from '@/app/actions/obras-actions'
import type { Obra, ObraComResumo, ObraStatus } from '@/types/obras'
import { cn } from '@/lib/utils'

const STATUS_FILTERS: { id: 'ALL' | ObraStatus; label: string }[] = [
  { id: 'ALL',          label: 'Todas' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento' },
  { id: 'PLANEJAMENTO', label: 'Planejamento' },
  { id: 'PAUSADA',      label: 'Pausadas' },
  { id: 'CONCLUIDA',    label: 'Concluídas' },
]

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatMesAno(iso: string) {
  const [y, m] = iso.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO)
  const end = Date.parse(endISO)
  return Math.floor((end - start) / 86_400_000)
}

// "QD 55" → { sigla: "QD", numero: "55" }
// "QD 151 — Parque Alvorada I" → { sigla: "QD", numero: "151" }
// "Casa do João" → { sigla: "OBRA", numero: "CJ" }
function parseIdentidade(nome: string): { sigla: string; numero: string } {
  const m = nome.match(/^([A-Za-zÀ-ú]{1,6})\s+(\d{1,4})/)
  if (m) return { sigla: m[1].toUpperCase(), numero: m[2] }
  const palavras = nome.trim().split(/\s+/).slice(0, 2)
  const iniciais = palavras.map(p => p[0]).join('').toUpperCase()
  return { sigla: 'OBRA', numero: iniciais || '??' }
}

export default function ObrasPage() {
  const router = useRouter()
  const [obras, setObras] = useState<ObraComResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'ALL' | ObraStatus>('ALL')

  const [modalOpen, setModalOpen] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listObrasComResumo()
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

  // No filtro "Todas", separamos: ativas em cards, concluídas em lista compacta.
  // No filtro "Concluídas", todas viram cards completos (são o assunto da tela).
  const cardsList =
    filtroStatus === 'ALL' ? filtradas.filter(o => o.status !== 'CONCLUIDA') : filtradas
  const concluidasCompactas =
    filtroStatus === 'ALL' ? filtradas.filter(o => o.status === 'CONCLUIDA') : []

  function abrirNova() { setModalOpen(true) }
  function abrirDetalhe(o: Obra) { router.push(`/obras/${o.id}`) }

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

        {/* Cards principais */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : cardsList.length === 0 && concluidasCompactas.length === 0 ? (
          <EmptyState onCreate={abrirNova} hasBusca={!!busca.trim() || filtroStatus !== 'ALL'} />
        ) : (
          <>
            {cardsList.length > 0 && (
              <div className="space-y-3">
                {cardsList.map(o => (
                  <ObraCard key={o.id} obra={o} onClick={abrirDetalhe} />
                ))}
              </div>
            )}

            {concluidasCompactas.length > 0 && (
              <div className={cn(cardsList.length > 0 && 'mt-10')}>
                <div className="mb-3 flex items-center gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                    Concluídas
                  </p>
                  <div className="h-px flex-1 bg-[var(--line)]" />
                </div>
                <div className="space-y-1.5">
                  {concluidasCompactas.map(o => (
                    <ConcluidaRow key={o.id} obra={o} onClick={abrirDetalhe} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ObraForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={null}
        onSaved={carregar}
      />
    </>
  )
}

function ObraCard({ obra, onClick }: { obra: ObraComResumo; onClick: (o: Obra) => void }) {
  const ident = parseIdentidade(obra.nome)
  const today = todayISO()

  const diasExecucao =
    obra.data_inicio && obra.status === 'EM_ANDAMENTO'
      ? Math.max(0, daysBetween(obra.data_inicio, today))
      : null

  // Barra de progresso: tempo decorrido vs prazo (quando ambos existem).
  let pct: number | null = null
  if (obra.status === 'CONCLUIDA') {
    pct = 100
  } else if (obra.data_inicio && obra.data_previsao_entrega) {
    const totalDias = daysBetween(obra.data_inicio, obra.data_previsao_entrega)
    const decorridos = daysBetween(obra.data_inicio, today)
    if (totalDias > 0) pct = Math.max(0, Math.min(100, (decorridos / totalDias) * 100))
  }

  const eyebrowText =
    obra.status === 'EM_ANDAMENTO' && diasExecucao != null
      ? `Em andamento · ${diasExecucao} ${diasExecucao === 1 ? 'dia' : 'dias'} em execução`
      : obra.status === 'EM_ANDAMENTO'
      ? 'Em andamento'
      : obra.status === 'PLANEJAMENTO'
      ? 'Em planejamento'
      : obra.status === 'PAUSADA'
      ? 'Pausada'
      : null

  const datasFmt =
    obra.data_inicio && obra.data_previsao_entrega
      ? `${formatMesAno(obra.data_inicio)}  →  ${formatMesAno(obra.data_previsao_entrega)}`
      : obra.data_inicio
      ? `Início ${formatDateBR(obra.data_inicio)} · sem entrega definida`
      : obra.data_previsao_entrega
      ? `Entrega prevista ${formatDateBR(obra.data_previsao_entrega)}`
      : 'Datas não definidas'

  const local = [obra.endereco, obra.cidade].filter(Boolean).join(' · ')
  const gastoLabel = obra.status === 'CONCLUIDA' ? 'Gasto total' : 'Gasto até agora'

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
      className="group cursor-pointer rounded-2xl border border-[var(--line)] bg-white p-5 transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40 sm:p-6"
    >
      {eyebrowText && (
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-bright)]">
          {eyebrowText}
        </p>
      )}

      <div className="flex items-start gap-5 sm:gap-7">
        {/* Identidade (esquerda) */}
        <div className="shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            {ident.sigla}
          </p>
          <p className="font-display text-[2rem] font-extrabold leading-none tracking-tight text-[var(--ink)]">
            {ident.numero}
          </p>
        </div>

        {/* Conteúdo (centro) */}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-[var(--ink)]">
            {obra.nome}
          </h3>
          {local && (
            <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{local}</p>
          )}
          <p className="mt-2.5 text-sm text-[var(--ink-soft)]">{datasFmt}</p>
        </div>

        {/* Financeiro (direita) — só aparece se houver dado */}
        {obra.totalGasto > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              {gastoLabel}
            </p>
            <p className="font-display text-lg font-bold leading-tight text-[var(--ink)]">
              {formatBRL(obra.totalGasto)}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              {obra.numCompras} {obra.numCompras === 1 ? 'compra' : 'compras'}
            </p>
          </div>
        )}
      </div>

      {/* Barra de progresso (hairline-first) */}
      {pct != null && (
        <div className="mt-5 h-0.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--ink)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function ConcluidaRow({ obra, onClick }: { obra: ObraComResumo; onClick: (o: Obra) => void }) {
  const local = obra.cidade ?? obra.endereco
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
      className="group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3 transition-all hover:border-[var(--brand-bright)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">
          {obra.nome}
          {local && <span className="font-normal text-[var(--ink-soft)]"> · {local}</span>}
        </p>
      </div>
      <p className="shrink-0 text-xs text-[var(--ink-soft)]">
        {obra.totalGasto > 0
          ? `${formatBRL(obra.totalGasto)} · ${obra.numCompras} ${obra.numCompras === 1 ? 'compra' : 'compras'}`
          : 'sem compras'}
      </p>
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
      <p className="font-display text-base font-semibold text-[var(--ink)]">Nenhuma obra cadastrada</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Cadastre o primeiro empreendimento. Compras, RH e Financeiro vão se conectar a ele.
      </p>
      <Button onClick={onCreate} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" /> Cadastrar obra
      </Button>
    </div>
  )
}
