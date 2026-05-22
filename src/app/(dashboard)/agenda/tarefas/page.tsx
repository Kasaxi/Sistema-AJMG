'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, CalendarDays, AlertCircle, Clock, CheckCheck } from 'lucide-react'
import { TaskCard } from '@/components/agenda/task-card'
import { TaskModal } from '@/components/agenda/task-modal'
import { FiltroUsuario, EU, TODOS } from '@/components/agenda/filtro-usuario'
import type { AgendaItem, AgendaStatus, CategoriaAgenda } from '@/types/agenda'
import {
  getItensHoje, getItensAtrasados, getItensProximos, getItensConcluidos,
  listCategoriasAgenda, listProfilesAtivosComAgenda,
  updateAgendaItemStatus,
} from '@/app/actions/agenda-actions'
import { getCurrentProfile } from '@/app/actions/vendas-actions'
import type { CurrentProfile } from '@/lib/permissions'
import { cn } from '@/lib/utils'

type Aba = 'HOJE' | 'ATRASADAS' | 'PROXIMOS' | 'CONCLUIDAS'

const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'HOJE',       label: 'Hoje',          icon: CalendarDays },
  { id: 'ATRASADAS',  label: 'Atrasadas',     icon: AlertCircle },
  { id: 'PROXIMOS',   label: 'Próximos dias', icon: Clock },
  { id: 'CONCLUIDAS', label: 'Concluídas',    icon: CheckCheck },
]

export default function TarefasPage() {
  const [aba, setAba] = useState<Aba>('HOJE')
  // Mantemos as 4 listas em estado pra troca de aba ser instantânea (sem refetch)
  const [listas, setListas] = useState<Record<Aba, AgendaItem[]>>({
    HOJE: [], ATRASADAS: [], PROXIMOS: [], CONCLUIDAS: [],
  })
  const itens = listas[aba]

  const [categorias, setCategorias] = useState<CategoriaAgenda[]>([])
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [filtroUsuario, setFiltroUsuario] = useState<string>(EU) // EU | TODOS | profile_id

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<AgendaItem | null>(null)

  // Itens com toggle pendente (optimistic)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const counts = {
    HOJE: listas.HOJE.length,
    ATRASADAS: listas.ATRASADAS.length,
    PROXIMOS: listas.PROXIMOS.length,
    CONCLUIDAS: listas.CONCLUIDAS.length,
  }

  // Mapeia filtro → parametro da query
  const paraUsuario = filtroUsuario === TODOS ? 'ALL' : filtroUsuario === EU ? undefined : filtroUsuario

  // Carrega o perfil + dropdowns uma vez
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

  // Recarrega as 4 listas — chamado no mount e quando o filtro de usuário muda
  const recarregar = useCallback(async () => {
    setLoading(true)
    try {
      const opts = { paraUsuario }
      const [hoje, atrasadas, proximos, concluidas] = await Promise.all([
        getItensHoje(opts),
        getItensAtrasados(opts),
        getItensProximos(30, opts),
        getItensConcluidos(200, opts),
      ])
      setListas({ HOJE: hoje, ATRASADAS: atrasadas, PROXIMOS: proximos, CONCLUIDAS: concluidas })
    } finally {
      setLoading(false)
    }
  }, [paraUsuario])

  useEffect(() => { void recarregar() }, [recarregar])

  // Pessoas que aparecem no filtro: todos exceto o próprio user
  const pessoasFiltro = pessoas.filter(p => p.id !== profile?.id)

  function abrirNovo() {
    setEditando(null)
    setModalOpen(true)
  }

  function abrirEdicao(item: AgendaItem) {
    setEditando(item)
    setModalOpen(true)
  }

  async function handleToggleStatus(item: AgendaItem) {
    const novoStatus: AgendaStatus = item.status === 'CONCLUIDO' ? 'PENDENTE' : 'CONCLUIDO'
    const atualizado: AgendaItem = { ...item, status: novoStatus }

    // 1) Optimistic update: move o item entre as abas certas
    setListas(prev => {
      // Tira o item de todas as listas
      const semItem = (l: AgendaItem[]) => l.filter(i => i.id !== item.id)
      const hoje = semItem(prev.HOJE)
      const atrasadas = semItem(prev.ATRASADAS)
      const proximos = semItem(prev.PROXIMOS)
      const concluidas = semItem(prev.CONCLUIDAS)

      // Coloca nas listas certas baseado no novo status e data
      const hojeIso = new Date().toISOString().slice(0, 10)
      if (novoStatus === 'CONCLUIDO') {
        concluidas.unshift(atualizado)
      } else if (atualizado.data === hojeIso) {
        hoje.unshift(atualizado)
      } else if (atualizado.data < hojeIso) {
        atrasadas.push(atualizado)
      } else {
        proximos.push(atualizado)
      }
      return { HOJE: hoje, ATRASADAS: atrasadas, PROXIMOS: proximos, CONCLUIDAS: concluidas }
    })
    setTogglingIds(prev => new Set(prev).add(item.id))

    // 2) Persist no server
    try {
      await updateAgendaItemStatus(item.id, novoStatus)
    } catch (err) {
      console.error(err)
      // Rollback: recarrega tudo
      await recarregar()
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const filtrados = busca.trim()
    ? itens.filter(i =>
        i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        (i.descricao?.toLowerCase().includes(busca.toLowerCase()) ?? false)
      )
    : itens

  return (
    <>
      <Header
        eyebrow="Agenda"
        title="Tarefas"
        subtitle="Acompanhe e organize o que precisa ser feito"
        actions={
          <div className="flex items-center gap-2">
            {profile?.role === 'ADMIN' && (
              <FiltroUsuario
                value={filtroUsuario}
                onChange={setFiltroUsuario}
                pessoas={pessoasFiltro}
                euNome={profile.nome.split(' ')[0]}
              />
            )}
            <Button onClick={abrirNovo} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">

        {/* Abas */}
        <div className="mb-5 inline-flex w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1 sm:w-auto">
          {ABAS.map(a => {
            const isActive = aba === a.id
            const Icon = a.icon
            const count = counts[a.id]
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={cn(
                  'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all sm:flex-none',
                  isActive
                    ? 'bg-white text-[var(--ink)] shadow-sm ring-1 ring-inset ring-[var(--line)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {a.label}
                {count > 0 && (
                  <span className={cn(
                    'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                    isActive
                      ? a.id === 'ATRASADAS'  ? 'bg-rose-100 text-rose-700'
                      : a.id === 'CONCLUIDAS' ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-[var(--brand-tint)] text-[var(--brand-bright)]'
                      : 'bg-white text-[var(--ink-soft)]',
                  )}>
                    {count}
                  </span>
                )}
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
            placeholder="Buscar nas tarefas…"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState aba={aba} busca={busca} onCreate={abrirNovo} />
        ) : (
          <div className="space-y-2.5">
            {filtrados.map(item => (
              <TaskCard
                key={item.id}
                item={item}
                onClick={abrirEdicao}
                onToggleStatus={handleToggleStatus}
                pending={togglingIds.has(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editando}
        categorias={categorias}
        pessoas={pessoas}
        onSaved={recarregar}
      />
    </>
  )
}

function EmptyState({ aba, busca, onCreate }: { aba: Aba; busca: string; onCreate: () => void }) {
  if (busca) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-[var(--ink)]">Nenhum resultado</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Tente buscar com outra palavra.</p>
      </div>
    )
  }
  const msgs: Record<Aba, { titulo: string; sub: string }> = {
    HOJE:       { titulo: 'Tudo certo por hoje',        sub: 'Nenhuma tarefa marcada pra hoje. Que tal já planejar a próxima?' },
    ATRASADAS:  { titulo: 'Nada em atraso',             sub: 'Você está em dia com tudo. Bom trabalho.' },
    PROXIMOS:   { titulo: 'Sem nada nos próximos dias', sub: 'Crie uma tarefa pra organizar o que vem por aí.' },
    CONCLUIDAS: { titulo: 'Sem tarefas concluídas',     sub: 'Conforme você for marcando como feita, aparecem aqui.' },
  }
  const m = msgs[aba]
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-[var(--ink)]">{m.titulo}</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">{m.sub}</p>
      <Button onClick={onCreate} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" /> Criar tarefa
      </Button>
    </div>
  )
}
