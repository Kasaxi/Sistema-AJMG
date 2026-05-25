'use client'

import { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, MapPin, User, AlertCircle, Calendar } from 'lucide-react'
import type { AgendaItem, AgendaStatus, AgendaPrioridade } from '@/types/agenda'
import { cn } from '@/lib/utils'

interface KanbanViewProps {
  itens: AgendaItem[]
  loading: boolean
  onItemClick: (item: AgendaItem) => void
  /** Drop em outra coluna (ou no fim da mesma) */
  onStatusChange: (id: string, novoStatus: AgendaStatus) => void
  /** Drop em cima de outro card: posiciona o item antes do alvo */
  onReorder: (id: string, alvoId: string) => void
}

const COLUNAS: { status: AgendaStatus; label: string; accent: string }[] = [
  { status: 'PENDENTE',     label: 'A fazer',      accent: 'bg-slate-100 text-slate-700' },
  { status: 'EM_ANDAMENTO', label: 'Em andamento', accent: 'bg-blue-100 text-blue-700' },
  { status: 'CONCLUIDO',    label: 'Concluídas',   accent: 'bg-emerald-100 text-emerald-700' },
]

const PRIORIDADE_DOT: Record<AgendaPrioridade, string> = {
  BAIXA: 'bg-[var(--ink-faint)]',
  MEDIA: 'bg-amber-400',
  ALTA: 'bg-rose-500',
}

function isAtrasada(item: AgendaItem) {
  if (item.status === 'CONCLUIDO' || item.status === 'CANCELADO') return false
  const hoje = new Date().toISOString().slice(0, 10)
  return item.data < hoje
}

function formatDataCurta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function KanbanView({ itens, loading, onItemClick, onStatusChange, onReorder }: KanbanViewProps) {
  const [dragOverCol, setDragOverCol] = useState<AgendaStatus | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null)  // card sobre o qual está hover

  // Agrupa por status (filtra cancelados pra não poluir)
  const porStatus = useMemo(() => {
    const map: Record<AgendaStatus, AgendaItem[]> = {
      PENDENTE: [], EM_ANDAMENTO: [], CONCLUIDO: [], CANCELADO: [],
    }
    for (const i of itens) {
      if (map[i.status]) map[i.status].push(i)
    }
    // Ordena por `ordem` (controlada pelo usuário via drag) e fallback pela data
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => {
        if (a.ordem !== b.ordem) return a.ordem - b.ordem
        return a.data.localeCompare(b.data)
      })
    }
    return map
  }, [itens])

  function clearDragState() {
    setDraggingId(null)
    setDragOverCol(null)
    setDropBeforeId(null)
  }

  function onDragStart(e: React.DragEvent, item: AgendaItem) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
    // Adia o "esconder card original" pro próximo tick, senão o navegador
    // não consegue capturar a preview do drag (e o card "some" antes de aparecer).
    setTimeout(() => setDraggingId(item.id), 0)
  }

  function onDragEnd() {
    clearDragState()
  }

  function onColumnDragOver(e: React.DragEvent, status: AgendaStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== status) setDragOverCol(status)
  }

  function onColumnDragLeave(status: AgendaStatus) {
    if (dragOverCol === status) setDragOverCol(null)
  }

  // Drop em uma COLUNA (não em card): muda status (vai pro fim)
  function onColumnDrop(e: React.DragEvent, novoStatus: AgendaStatus) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    clearDragState()
    if (!id) return
    const item = itens.find(i => i.id === id)
    if (!item) return
    if (item.status !== novoStatus) {
      onStatusChange(id, novoStatus)
    }
  }

  // Drop em CIMA de um card: posiciona antes dele (reorder ou cross-column)
  function onCardDrop(e: React.DragEvent, alvo: AgendaItem) {
    e.preventDefault()
    e.stopPropagation()
    const id = e.dataTransfer.getData('text/plain')
    clearDragState()
    if (!id || id === alvo.id) return
    const movido = itens.find(i => i.id === id)
    if (!movido) return
    // Se mudou de status, atualiza primeiro
    if (movido.status !== alvo.status) {
      onStatusChange(id, alvo.status)
    }
    onReorder(id, alvo.id)
  }

  function onCardDragOver(e: React.DragEvent, alvo: AgendaItem) {
    if (!draggingId || draggingId === alvo.id) return
    e.preventDefault()
    e.stopPropagation()
    setDropBeforeId(alvo.id)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUNAS.map(c => (
          <div key={c.status} className="space-y-2">
            <Skeleton className="h-9 w-full rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUNAS.map(col => {
        const items = porStatus[col.status]
        const isOver = dragOverCol === col.status
        return (
          <div
            key={col.status}
            onDragOver={(e) => onColumnDragOver(e, col.status)}
            onDragLeave={() => onColumnDragLeave(col.status)}
            onDrop={(e) => onColumnDrop(e, col.status)}
            className={cn(
              'flex min-h-[24rem] flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper)]/40 p-2 transition-all',
              isOver && 'border-[var(--brand-bright)] bg-[var(--brand-tint)]/40 ring-2 ring-[var(--brand-bright)]/30',
            )}
          >
            <div className="flex items-center justify-between px-2 pb-3 pt-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[var(--ink)]">
                  {col.label}
                </h3>
                <span className={cn('inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold', col.accent)}>
                  {items.length}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {items.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-white/40 p-6 text-center text-xs text-[var(--ink-faint)]">
                  Arraste tarefas pra cá
                </div>
              ) : (
                items.map(item => (
                  <div key={item.id}>
                    {/* indicador de drop ANTES deste card */}
                    {dropBeforeId === item.id && draggingId && draggingId !== item.id && (
                      <div className="mb-2 h-1 rounded-full bg-[var(--brand-bright)]" />
                    )}
                    <KanbanCard
                      item={item}
                      onClick={onItemClick}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      isDragging={draggingId === item.id}
                      onDragOver={onCardDragOver}
                      onDrop={onCardDrop}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KanbanCardProps {
  item: AgendaItem
  onClick: (item: AgendaItem) => void
  onDragStart: (e: React.DragEvent, item: AgendaItem) => void
  onDragEnd: () => void
  isDragging: boolean
  onDragOver: (e: React.DragEvent, item: AgendaItem) => void
  onDrop: (e: React.DragEvent, item: AgendaItem) => void
}

function KanbanCard({ item, onClick, onDragStart, onDragEnd, isDragging, onDragOver, onDrop }: KanbanCardProps) {
  const atrasada = isAtrasada(item)
  const concluida = item.status === 'CONCLUIDO'

  // Enquanto draggando, vira placeholder com a mesma altura do card (h-44 = 11rem).
  if (isDragging) {
    return <div className="h-44 rounded-xl border-2 border-dashed border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/30" />
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, item)}
      onDrop={(e) => onDrop(e, item)}
      onClick={() => onClick(item)}
      className={cn(
        'group flex h-44 cursor-grab flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white p-3 transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm active:cursor-grabbing',
        concluida && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full', PRIORIDADE_DOT[item.prioridade])} />
        <h4 className={cn('line-clamp-2 flex-1 text-[17px] font-semibold leading-snug text-[var(--ink)]', concluida && 'line-through')}>
          {item.titulo}
        </h4>
      </div>

      {item.descricao && (
        <p className="mt-2 line-clamp-2 whitespace-pre-line pl-5 text-[14px] leading-snug text-[var(--ink-soft)]">
          {item.descricao}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-[13px]">
        <span className="inline-flex items-center gap-1 text-[var(--ink-soft)]">
          <Calendar className="h-3 w-3" /> {formatDataCurta(item.data)}
        </span>
        {item.hora_inicio && (
          <span className="inline-flex items-center gap-1 text-[var(--ink-soft)]">
            <Clock className="h-3 w-3" /> {item.hora_inicio.slice(0, 5)}
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
        {atrasada && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[12px] font-semibold text-rose-700">
            <AlertCircle className="h-3 w-3" /> Atrasada
          </span>
        )}
      </div>

      {item.categoria?.nome && (
        <span
          className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: item.categoria.cor ? `${item.categoria.cor}1A` : 'var(--brand-tint)',
            color: item.categoria.cor ?? 'var(--brand-bright)',
          }}
        >
          {item.categoria.nome}
        </span>
      )}
    </div>
  )
}
