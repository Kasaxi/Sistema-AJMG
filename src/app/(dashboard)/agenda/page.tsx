'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Plus, CalendarRange, CalendarDays, LayoutGrid, ListChecks } from 'lucide-react'
import { TaskModal } from '@/components/agenda/task-modal'
import { MesView } from '@/components/agenda/views/mes-view'
import { KanbanView } from '@/components/agenda/views/kanban-view'
import { SemanaView } from '@/components/agenda/views/semana-view'
import { ListaView } from '@/components/agenda/views/lista-view'
import { FiltroUsuario, EU, TODOS } from '@/components/agenda/filtro-usuario'
import type { AgendaItem, AgendaStatus, CategoriaAgenda } from '@/types/agenda'
import {
  listAgendaItens, listCategoriasAgenda, listProfilesAtivosComAgenda,
  updateAgendaItemStatus, updateAgendaItemOrdem,
} from '@/app/actions/agenda-actions'
import { getCurrentProfile } from '@/app/actions/vendas-actions'
import type { CurrentProfile } from '@/lib/permissions'
import { cn } from '@/lib/utils'

type View = 'KANBAN' | 'MES' | 'SEMANA' | 'LISTA'

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'KANBAN', label: 'Kanban', icon: LayoutGrid },
  { id: 'MES',    label: 'Mês',    icon: CalendarDays },
  { id: 'SEMANA', label: 'Semana', icon: CalendarRange },
  { id: 'LISTA',  label: 'Lista',  icon: ListChecks },
]

function inicioFimMes(year: number, month: number) {
  const inicio = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const ultimoDia = new Date(year, month + 1, 0).getDate()
  const fim = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}

function inicioFimSemana(ref: Date) {
  const dia = ref.getDay()
  const offsetSegunda = dia === 0 ? -6 : 1 - dia
  const inicio = new Date(ref)
  inicio.setDate(ref.getDate() + offsetSegunda)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    refDate: inicio,
  }
}

export default function AgendaPage() {
  const [view, setView] = useState<View>('KANBAN')
  const [referencia, setReferencia] = useState(() => new Date())  // âncora do mês/semana
  const [itens, setItens] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState<CategoriaAgenda[]>([])
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([])
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [filtroUsuario, setFiltroUsuario] = useState<string>(EU)

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<AgendaItem | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()

  // Filtra por usuário (no client, já que listAgendaItens não tem o parâmetro paraUsuario ainda)
  const filtroParaClient = (i: AgendaItem): boolean => {
    if (filtroUsuario === TODOS) return true
    const id = filtroUsuario === EU ? profile?.id : filtroUsuario
    if (!id) return true
    return i.criado_por === id || i.atribuido_para === id
  }

  // Bootstrap (uma vez)
  useEffect(() => {
    Promise.all([
      listCategoriasAgenda({ ativosApenas: true }),
      listProfilesAtivosComAgenda(),
      getCurrentProfile(),
    ]).then(([cats, pess, prof]) => {
      setCategorias(cats)
      setPessoas(pess)
      setProfile(prof)
    })
  }, [])

  // Recarrega itens baseado em view + referencia + apenasMinhas
  const recarregar = useCallback(async () => {
    setLoading(true)
    try {
      const year = referencia.getFullYear()
      const month = referencia.getMonth()
      let inicio: string, fim: string

      if (view === 'KANBAN') {
        // Kanban mostra tarefas abertas (pendente / em andamento) + atrasadas, sem janela de data fixa.
        // Pegamos um range generoso: 90 dias antes até 365 dias depois.
        const ref = new Date()
        const ini = new Date(ref); ini.setDate(ref.getDate() - 90)
        const fimD = new Date(ref); fimD.setDate(ref.getDate() + 365)
        inicio = ini.toISOString().slice(0, 10)
        fim = fimD.toISOString().slice(0, 10)
      } else if (view === 'SEMANA') {
        const r = inicioFimSemana(referencia)
        inicio = r.inicio
        fim = r.fim
      } else {
        // Mês: pega o mês INTEIRO + alguns dias do mês anterior/seguinte (pro grid 6x7)
        const ini = new Date(year, month, 1)
        ini.setDate(ini.getDate() - ini.getDay()) // back to Sunday
        const fimD = new Date(year, month + 1, 0)
        fimD.setDate(fimD.getDate() + (6 - fimD.getDay()))
        inicio = ini.toISOString().slice(0, 10)
        fim = fimD.toISOString().slice(0, 10)
      }

      const result = await listAgendaItens({
        data_inicio: inicio,
        data_fim: fim,
      })
      setItens(result.filter(filtroParaClient))
    } finally {
      setLoading(false)
    }
  // filtroParaClient depende de profile e filtroUsuario; recarrega quando mudam
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, referencia, filtroUsuario, profile])

  useEffect(() => { void recarregar() }, [recarregar])

  function abrirNovo(data?: string) {
    setEditando(null)
    setDefaultDate(data)
    setModalOpen(true)
  }

  function abrirEdicao(item: AgendaItem) {
    setEditando(item)
    setDefaultDate(undefined)
    setModalOpen(true)
  }

  // Optimistic update: muda status localmente e persiste, sem refetch (sem piscar).
  async function handleStatusChange(id: string, novoStatus: AgendaStatus) {
    const original = itens.find(i => i.id === id)
    if (!original) return
    setItens(prev => prev.map(i => i.id === id ? { ...i, status: novoStatus } : i))
    try {
      await updateAgendaItemStatus(id, novoStatus)
    } catch (err) {
      console.error('Falha mudando status:', err)
      // Rollback
      setItens(prev => prev.map(i => i.id === id ? { ...i, status: original.status } : i))
    }
  }

  /** Move o `id` pra logo ANTES de `alvoId` (na coluna do alvo).
   *  Otimisticamente recalcula `ordem` de todos da coluna alvo. */
  async function handleReorder(id: string, alvoId: string) {
    const movido = itens.find(i => i.id === id)
    const alvo = itens.find(i => i.id === alvoId)
    if (!movido || !alvo) return

    // Considera status do alvo (cross-column reorder)
    const statusFinal = alvo.status
    const colunaAtual = itens
      .filter(i => i.status === statusFinal && i.id !== id)
      .sort((a, b) => a.ordem - b.ordem)
    const idxAlvo = colunaAtual.findIndex(i => i.id === alvoId)
    if (idxAlvo < 0) return

    const novaColuna = [
      ...colunaAtual.slice(0, idxAlvo),
      { ...movido, status: statusFinal },
      ...colunaAtual.slice(idxAlvo),
    ]
    // Renumera 0..N e atualiza state
    const updates = novaColuna.map((it, idx) => ({ id: it.id, ordem: idx }))
    setItens(prev => prev.map(it => {
      const u = updates.find(x => x.id === it.id)
      if (!u) return it
      return { ...it, ordem: u.ordem, status: it.id === id ? statusFinal : it.status }
    }))

    try {
      await updateAgendaItemOrdem(updates)
    } catch (err) {
      console.error('Falha reordenando:', err)
      await recarregar()
    }
  }

  return (
    <>
      <Header
        eyebrow="Agenda"
        title="Visão geral"
        subtitle="Tarefas e agendamentos"
        actions={
          <div className="flex items-center gap-2">
            {profile?.role === 'ADMIN' && (
              <FiltroUsuario
                value={filtroUsuario}
                onChange={setFiltroUsuario}
                pessoas={pessoas.filter(p => p.id !== profile.id)}
                euNome={profile.nome.split(' ')[0]}
              />
            )}
            <Button onClick={() => abrirNovo()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {/* Tabs de view */}
        <div className="mb-5 inline-flex overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1">
          {VIEWS.map(v => {
            const isActive = view === v.id
            const Icon = v.icon
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-white text-[var(--ink)] shadow-sm ring-1 ring-inset ring-[var(--line)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {v.label}
              </button>
            )
          })}
        </div>

        {view === 'MES' && (
          <MesView
            referencia={referencia}
            onReferenciaChange={setReferencia}
            itens={itens}
            loading={loading}
            onItemClick={abrirEdicao}
            onDayClick={abrirNovo}
          />
        )}
        {view === 'SEMANA' && (
          <SemanaView
            referencia={referencia}
            onReferenciaChange={setReferencia}
            itens={itens}
            loading={loading}
            onItemClick={abrirEdicao}
            onDayClick={abrirNovo}
          />
        )}
        {view === 'KANBAN' && (
          <KanbanView
            itens={itens}
            loading={loading}
            onItemClick={abrirEdicao}
            onStatusChange={handleStatusChange}
            onReorder={handleReorder}
          />
        )}
        {view === 'LISTA' && (
          <ListaView
            paraUsuario={filtroUsuario === TODOS ? 'ALL' : filtroUsuario === EU ? undefined : filtroUsuario}
            onItemClick={abrirEdicao}
          />
        )}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editando}
        categorias={categorias}
        pessoas={pessoas}
        defaultDate={defaultDate}
        onSaved={recarregar}
      />
    </>
  )
}
