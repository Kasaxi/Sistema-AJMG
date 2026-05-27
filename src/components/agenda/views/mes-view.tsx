'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { AgendaItem } from '@/types/agenda'
import { cn } from '@/lib/utils'

interface MesViewProps {
  referencia: Date
  onReferenciaChange: (d: Date) => void
  itens: AgendaItem[]
  loading: boolean
  onItemClick: (item: AgendaItem) => void
  onDayClick: (data: string) => void
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MesView({ referencia, onReferenciaChange, itens, loading, onItemClick, onDayClick }: MesViewProps) {
  const year = referencia.getFullYear()
  const month = referencia.getMonth()
  const hojeIso = isoDate(new Date())

  // Constrói o grid de 6 semanas (42 células) começando no domingo
  const grid = useMemo(() => {
    const cells: { date: Date; iso: string; inMonth: boolean; isToday: boolean }[] = []
    const primeiroDoMes = new Date(year, month, 1)
    const start = new Date(primeiroDoMes)
    start.setDate(start.getDate() - start.getDay())
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push({
        date: d,
        iso: isoDate(d),
        inMonth: d.getMonth() === month,
        isToday: isoDate(d) === hojeIso,
      })
    }
    return cells
  }, [year, month, hojeIso])

  const itensPorDia = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const i of itens) {
      const arr = map.get(i.data) ?? []
      arr.push(i)
      map.set(i.data, arr)
    }
    // Ordena por hora (com hora primeiro) dentro do dia
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ha = a.hora_inicio ?? 'zz'
        const hb = b.hora_inicio ?? 'zz'
        if (ha !== hb) return ha < hb ? -1 : 1
        return a.titulo.localeCompare(b.titulo)
      })
    }
    return map
  }, [itens])

  function navegar(delta: number) {
    onReferenciaChange(new Date(year, month + delta, 1))
  }

  function hoje() {
    onReferenciaChange(new Date())
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white">
      {/* Toolbar do mês */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">
          {MESES[month]} <span className="font-normal text-[var(--ink-soft)]">{year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={hoje}>Hoje</Button>
          <Button variant="ghost" size="icon" onClick={() => navegar(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navegar(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Header dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--paper)]">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
            {d}
          </div>
        ))}
      </div>

      {/* Grid 6x7 */}
      {loading ? (
        <div className="grid grid-cols-7 grid-rows-6 gap-px bg-[var(--line)]">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 grid-rows-6 gap-px bg-[var(--line)]">
          {grid.map((cell, idx) => {
            const items = itensPorDia.get(cell.iso) ?? []
            const overflow = items.length - 3
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onDayClick(cell.iso)}
                className={cn(
                  // Hover da célula só "acende" quando o cursor NÃO está sobre um item filho
                  'group relative flex h-28 cursor-pointer flex-col gap-1 bg-white p-1.5 text-left transition-colors',
                  'hover:bg-[var(--paper)] has-[.agenda-item:hover]:bg-white',
                  !cell.inMonth && 'bg-[var(--paper)]/30 text-[var(--ink-faint)]',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      cell.isToday
                        ? 'bg-[var(--brand-bright)] text-white'
                        : cell.inMonth
                          ? 'text-[var(--ink)]'
                          : 'text-[var(--ink-faint)]',
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                  {/* Indicador "criar novo" — visível só quando hover na área vazia da célula */}
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-md bg-[var(--ink)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white opacity-0 transition-opacity',
                      'group-hover:opacity-90 group-has-[.agenda-item:hover]:opacity-0',
                    )}
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={3} /> Novo
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {items.slice(0, 3).map(item => (
                    <span
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); onItemClick(item) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onItemClick(item)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'agenda-item cursor-pointer truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ring-1 ring-inset ring-transparent transition-all',
                        'hover:shadow-sm hover:brightness-95 hover:ring-current/30',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
                        item.status === 'CONCLUIDO' && 'line-through opacity-50',
                      )}
                      style={{
                        backgroundColor: item.categoria?.cor ? `${item.categoria.cor}22` : 'var(--brand-tint)',
                        color: item.categoria?.cor ?? 'var(--brand-bright)',
                      }}
                    >
                      {item.hora_inicio && (
                        <span className="mr-1 font-semibold">{item.hora_inicio.slice(0, 5)}</span>
                      )}
                      {item.titulo}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1.5 text-[10px] font-semibold text-[var(--ink-soft)]">
                      +{overflow} mais
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
