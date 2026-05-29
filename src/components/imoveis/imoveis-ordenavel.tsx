'use client'

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical } from 'lucide-react'
import { ImovelCard } from './imovel-card'
import type { Imovel, CarteiraTipo, ImovelStatus } from '@/types/imoveis'
import { IMOVEL_STATUS_LABEL } from '@/types/imoveis'
import { cn } from '@/lib/utils'

const STATUS_PILL: Record<ImovelStatus, string> = {
  DISPONIVEL:    'bg-emerald-50 text-emerald-700',
  NEGOCIACAO:    'bg-amber-50 text-amber-700',
  AGIO:          'bg-teal-50 text-teal-700',
  PARADO:        'bg-rose-50 text-rose-700',
  EM_CONSTRUCAO: 'bg-amber-50 text-amber-700',
  VENDIDO:       'bg-[var(--brand-tint)] text-[var(--brand-bright)]',
  ALUGADA:       'bg-purple-50 text-purple-700',
  FINALIZADO:    'bg-violet-50 text-violet-700',
}

export interface Grupo { chave: string; itens: Imovel[] }

interface Props {
  grupos: Grupo[]
  variant: CarteiraTipo
  colapsados: Set<string>
  onToggleGrupo: (chave: string) => void
  onReordenarGrupos: (chavesEmOrdem: string[]) => void
  onReordenarImoveis: (idsEmOrdem: string[]) => void
  onEditarTudo: (im: Imovel) => void
  onPatched: (id: string, patch: Partial<Imovel>) => void
}

export function ImoveisOrdenavel({
  grupos, variant, colapsados, onToggleGrupo,
  onReordenarGrupos, onReordenarImoveis, onEditarTudo, onPatched,
}: Props) {
  // Pequena distância antes de ativar o drag → cliques de edição não viram arraste
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleGruposDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = grupos.findIndex(g => g.chave === active.id)
    const newIndex = grupos.findIndex(g => g.chave === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReordenarGrupos(arrayMove(grupos, oldIndex, newIndex).map(g => g.chave))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGruposDragEnd}>
      <SortableContext items={grupos.map(g => g.chave)} strategy={verticalListSortingStrategy}>
        <div className="space-y-5">
          {grupos.map(grupo => (
            <GrupoSortavel
              key={grupo.chave}
              grupo={grupo}
              variant={variant}
              colapsado={colapsados.has(grupo.chave)}
              onToggle={() => onToggleGrupo(grupo.chave)}
              onReordenarImoveis={onReordenarImoveis}
              onEditarTudo={onEditarTudo}
              onPatched={onPatched}
              sensors={sensors}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function GrupoSortavel({
  grupo, variant, colapsado, onToggle, onReordenarImoveis, onEditarTudo, onPatched, sensors,
}: {
  grupo: Grupo
  variant: CarteiraTipo
  colapsado: boolean
  onToggle: () => void
  onReordenarImoveis: (ids: string[]) => void
  onEditarTudo: (im: Imovel) => void
  onPatched: (id: string, patch: Partial<Imovel>) => void
  sensors: ReturnType<typeof useSensors>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: grupo.chave })
  const style = { transform: CSS.Transform.toString(transform), transition }

  // Resumo por status do grupo (ordenado por quantidade)
  const porStatus = Object.entries(
    grupo.itens.reduce<Record<string, number>>((acc, im) => {
      acc[im.status] = (acc[im.status] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1]) as [ImovelStatus, number][]

  function handleImoveisDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = grupo.itens.map(i => i.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReordenarImoveis(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <section ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-60')}>
      <div className="mb-2 flex items-center gap-1.5 rounded-xl px-1 py-1">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar grupo"
          className="grid h-7 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left"
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform', colapsado && '-rotate-90')} />
          <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--brand-bright)]" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[var(--ink)]">{grupo.chave}</h3>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand-tint)] px-1.5 text-[10px] font-bold tabular-nums text-[var(--brand-bright)]">
            {grupo.itens.length}
          </span>
          {/* Resumo por status */}
          <span className="ml-1 flex flex-wrap items-center gap-1">
            {porStatus.map(([s, n]) => (
              <span key={s} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_PILL[s])}>
                {n} {IMOVEL_STATUS_LABEL[s]}
              </span>
            ))}
          </span>
        </button>
      </div>

      {!colapsado && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleImoveisDragEnd}>
          <SortableContext items={grupo.itens.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2.5">
              {grupo.itens.map(im => (
                <ImovelSortavel
                  key={im.id}
                  imovel={im}
                  variant={variant}
                  onEditarTudo={onEditarTudo}
                  onPatched={onPatched}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

function ImovelSortavel({
  imovel, variant, onEditarTudo, onPatched,
}: {
  imovel: Imovel
  variant: CarteiraTipo
  onEditarTudo: (im: Imovel) => void
  onPatched: (id: string, patch: Partial<Imovel>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: imovel.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li ref={setNodeRef} style={style} className={cn('flex items-stretch gap-1.5', isDragging && 'z-10 opacity-60')}>
      <button
        {...attributes}
        {...listeners}
        aria-label="Arrastar imóvel"
        className="grid w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <ImovelCard imovel={imovel} variant={variant} onEditarTudo={onEditarTudo} onPatched={onPatched} />
      </div>
    </li>
  )
}
