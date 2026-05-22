'use client'

import { Check, Clock, MapPin, User, AlertCircle, Loader2, Paperclip } from 'lucide-react'
import type { AgendaItem, AgendaStatus, AgendaPrioridade } from '@/types/agenda'
import { getIconeCategoria } from '@/components/agenda/categoria-form'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  item: AgendaItem
  onClick: (item: AgendaItem) => void
  onToggleStatus: (item: AgendaItem) => void
  pending?: boolean
}

const PRIORIDADE_DOT: Record<AgendaPrioridade, string> = {
  BAIXA: 'bg-[var(--ink-faint)]',
  MEDIA: 'bg-amber-400',
  ALTA: 'bg-rose-500',
}

const STATUS_BADGE: Record<AgendaStatus, { label: string; cls: string }> = {
  PENDENTE:    { label: 'A fazer',      cls: 'bg-[var(--paper)] text-[var(--ink-soft)]' },
  EM_ANDAMENTO:{ label: 'Em andamento', cls: 'bg-blue-50 text-blue-700' },
  CONCLUIDO:   { label: 'Concluída',    cls: 'bg-emerald-50 text-emerald-700' },
  CANCELADO:   { label: 'Cancelada',    cls: 'bg-rose-50 text-rose-700' },
}

function formatHora(hi: string | null, hf: string | null) {
  if (!hi) return null
  const ini = hi.slice(0, 5)
  if (!hf) return ini
  return `${ini} - ${hf.slice(0, 5)}`
}

function isAtrasada(item: AgendaItem) {
  if (item.status === 'CONCLUIDO' || item.status === 'CANCELADO') return false
  const hoje = new Date().toISOString().slice(0, 10)
  return item.data < hoje
}

export function TaskCard({ item, onClick, onToggleStatus, pending }: TaskCardProps) {
  const concluida = item.status === 'CONCLUIDO'
  const cancelada = item.status === 'CANCELADO'
  const atrasada = isAtrasada(item)
  const hora = formatHora(item.hora_inicio, item.hora_fim)

  const totalSub = item.subtarefas?.length ?? 0
  const feitasSub = item.subtarefas?.filter(s => s.concluida).length ?? 0

  return (
    <button
      onClick={() => onClick(item)}
      className={cn(
        'group w-full cursor-pointer rounded-2xl border border-[var(--line)] bg-white p-4 text-left transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm',
        (concluida || cancelada) && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Check toggle */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleStatus(item) }}
          disabled={pending}
          aria-label={concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-all',
            concluida
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-[var(--line)] bg-white hover:border-[var(--brand-bright)]',
            pending && 'opacity-50',
          )}
        >
          {pending
            ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={3} />
            : concluida && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', PRIORIDADE_DOT[item.prioridade])} />
            <h3
              className={cn(
                'min-w-0 flex-1 font-display text-[15px] font-semibold leading-tight text-[var(--ink)]',
                concluida && 'line-through',
              )}
            >
              {item.titulo}
            </h3>
            {atrasada && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                <AlertCircle className="h-2.5 w-2.5" /> Atrasada
              </span>
            )}
          </div>

          {item.descricao && (
            <p className="mt-1.5 line-clamp-2 text-sm text-[var(--ink-soft)] whitespace-pre-line">{item.descricao}</p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            {hora && (
              <span className="inline-flex items-center gap-1 text-[var(--ink-soft)]">
                <Clock className="h-3 w-3" /> {hora}
              </span>
            )}
            {item.local && (
              <span className="inline-flex items-center gap-1 truncate text-[var(--ink-soft)]">
                <MapPin className="h-3 w-3" /> {item.local}
              </span>
            )}
            {item.atribuido?.nome && (
              <span className="inline-flex items-center gap-1 text-[var(--ink-soft)]">
                <User className="h-3 w-3" /> {item.atribuido.nome}
              </span>
            )}
            {item.categoria?.nome && (() => {
              const CatIcon = getIconeCategoria(item.categoria.icone ?? null)
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: item.categoria.cor ? `${item.categoria.cor}1A` : 'var(--brand-tint)',
                    color: item.categoria.cor ?? 'var(--brand-bright)',
                  }}
                >
                  {CatIcon && <CatIcon className="h-2.5 w-2.5" />}
                  {item.categoria.nome}
                </span>
              )
            })()}
            {(item.anexos?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[var(--ink-soft)]">
                <Paperclip className="h-3 w-3" /> {item.anexos!.length}
              </span>
            )}
            {totalSub > 0 && (
              <span className="text-[var(--ink-soft)]">
                {feitasSub}/{totalSub} subtarefas
              </span>
            )}
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_BADGE[item.status].cls)}>
              {STATUS_BADGE[item.status].label}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
