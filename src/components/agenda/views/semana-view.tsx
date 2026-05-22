'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin } from 'lucide-react'
import type { AgendaItem, AgendaPrioridade } from '@/types/agenda'
import { cn } from '@/lib/utils'

interface SemanaViewProps {
  referencia: Date
  onReferenciaChange: (d: Date) => void
  itens: AgendaItem[]
  loading: boolean
  onItemClick: (item: AgendaItem) => void
  onDayClick: (data: string) => void
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const PRIORIDADE_DOT: Record<AgendaPrioridade, string> = {
  BAIXA: 'bg-[var(--ink-faint)]',
  MEDIA: 'bg-amber-400',
  ALTA: 'bg-rose-500',
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function inicioSemana(ref: Date): Date {
  const dia = ref.getDay() // 0=Dom, 1=Seg
  const offsetSeg = dia === 0 ? -6 : 1 - dia
  const inicio = new Date(ref)
  inicio.setDate(ref.getDate() + offsetSeg)
  return inicio
}

export function SemanaView({ referencia, onReferenciaChange, itens, loading, onItemClick, onDayClick }: SemanaViewProps) {
  const hojeIso = isoDate(new Date())

  const dias = useMemo(() => {
    const inicio = inicioSemana(referencia)
    const out = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      out.push({ date: d, iso: isoDate(d), isToday: isoDate(d) === hojeIso })
    }
    return out
  }, [referencia, hojeIso])

  const itensPorDia = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const i of itens) {
      const arr = map.get(i.data) ?? []
      arr.push(i)
      map.set(i.data, arr)
    }
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
    const novo = new Date(referencia)
    novo.setDate(referencia.getDate() + delta * 7)
    onReferenciaChange(novo)
  }

  function hoje() {
    onReferenciaChange(new Date())
  }

  const inicio = dias[0].date
  const fim = dias[6].date
  const rotulo = inicio.getMonth() === fim.getMonth()
    ? `${inicio.getDate()} – ${fim.getDate()} de ${MESES_CURTOS[inicio.getMonth()]} ${inicio.getFullYear()}`
    : `${inicio.getDate()} ${MESES_CURTOS[inicio.getMonth()]} – ${fim.getDate()} ${MESES_CURTOS[fim.getMonth()]} ${fim.getFullYear()}`

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">{rotulo}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={hoje}>Hoje</Button>
          <Button variant="ghost" size="icon" onClick={() => navegar(-1)} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navegar(1)} aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid 7 colunas */}
      {loading ? (
        <div className="grid grid-cols-1 gap-px bg-[var(--line)] md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-none bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px bg-[var(--line)] md:grid-cols-7">
          {dias.map((dia, idx) => {
            const items = itensPorDia.get(dia.iso) ?? []
            return (
              <div
                key={dia.iso}
                className={cn(
                  'flex min-h-[16rem] flex-col bg-white',
                  dia.isToday && 'bg-[var(--brand-tint)]/20',
                )}
              >
                <button
                  type="button"
                  onClick={() => onDayClick(dia.iso)}
                  className="group flex items-center justify-between border-b border-[var(--line)] px-3 py-2 text-left"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-faint)]">{DIAS[idx]}</p>
                    <p className={cn(
                      'mt-0.5 font-display text-lg font-bold leading-none',
                      dia.isToday ? 'text-[var(--brand-bright)]' : 'text-[var(--ink)]',
                    )}>
                      {dia.date.getDate()}
                    </p>
                  </div>
                  <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                </button>
                <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                  {items.length === 0 ? (
                    <p className="px-1 pt-2 text-[11px] text-[var(--ink-faint)]">—</p>
                  ) : (
                    items.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onItemClick(item)}
                        className={cn(
                          'cursor-pointer rounded-lg border border-[var(--line)] bg-white p-2 text-left transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm',
                          item.status === 'CONCLUIDO' && 'opacity-50',
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', PRIORIDADE_DOT[item.prioridade])} />
                          <h4 className={cn(
                            'flex-1 text-[12px] font-semibold leading-tight text-[var(--ink)]',
                            item.status === 'CONCLUIDO' && 'line-through',
                          )}>
                            {item.titulo}
                          </h4>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[var(--ink-soft)]">
                          {item.hora_inicio && (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> {item.hora_inicio.slice(0, 5)}
                            </span>
                          )}
                          {item.local && (
                            <span className="inline-flex items-center gap-0.5 truncate">
                              <MapPin className="h-2.5 w-2.5" /> {item.local}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
