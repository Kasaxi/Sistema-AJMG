'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, ChevronUp, ChevronDown, Eye, EyeOff, Pencil, Trash2, Loader2,
} from 'lucide-react'
import { CategoriaForm, getIconeCategoria } from '@/components/agenda/categoria-form'
import {
  listCategoriasAgendaComContagem,
  updateCategoriaAgenda,
  deleteCategoriaAgenda,
} from '@/app/actions/agenda-actions'
import { getCurrentProfile } from '@/app/actions/vendas-actions'
import type { CategoriaAgenda } from '@/types/agenda'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'

type CategoriaComContagem = CategoriaAgenda & { total_itens: number }

export default function CategoriasAgendaPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const [categorias, setCategorias] = useState<CategoriaComContagem[]>([])
  const [loading, setLoading] = useState(true)
  const [acessoNegado, setAcessoNegado] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<CategoriaAgenda | null>(null)

  // Track de mutações pendentes (reorder, toggle ativo, delete) por id
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCategoriasAgendaComContagem()
      setCategorias(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getCurrentProfile().then(p => {
      if (p.role !== 'ADMIN') {
        setAcessoNegado(true)
      } else {
        void carregar()
      }
    })
  }, [carregar])

  function abrirNova() {
    setEditando(null)
    setModalOpen(true)
  }

  function abrirEdicao(c: CategoriaAgenda) {
    setEditando(c)
    setModalOpen(true)
  }

  function markPending(id: string, isPending: boolean) {
    setPendingIds(prev => {
      const next = new Set(prev)
      if (isPending) next.add(id); else next.delete(id)
      return next
    })
  }

  async function mover(id: string, delta: -1 | 1) {
    const idx = categorias.findIndex(c => c.id === id)
    if (idx < 0) return
    const j = idx + delta
    if (j < 0 || j >= categorias.length) return
    const a = categorias[idx], b = categorias[j]

    // Optimistic
    const novaLista = [...categorias]
    novaLista[idx] = { ...b, ordem: a.ordem }
    novaLista[j] = { ...a, ordem: b.ordem }
    setCategorias(novaLista.sort((x, y) => x.ordem - y.ordem))

    markPending(a.id, true)
    markPending(b.id, true)
    try {
      await Promise.all([
        updateCategoriaAgenda(a.id, { ordem: b.ordem }),
        updateCategoriaAgenda(b.id, { ordem: a.ordem }),
      ])
    } catch {
      await carregar() // rollback
    } finally {
      markPending(a.id, false)
      markPending(b.id, false)
    }
  }

  async function toggleAtivo(c: CategoriaComContagem) {
    const novo = !c.ativo
    setCategorias(prev => prev.map(x => x.id === c.id ? { ...x, ativo: novo } : x))
    markPending(c.id, true)
    try {
      await updateCategoriaAgenda(c.id, { ativo: novo })
    } catch {
      setCategorias(prev => prev.map(x => x.id === c.id ? { ...x, ativo: c.ativo } : x))
    } finally {
      markPending(c.id, false)
    }
  }

  async function excluir(c: CategoriaComContagem) {
    const description = c.total_itens > 0
      ? `Esta categoria está em uso em ${c.total_itens} tarefa(s). Excluir não apaga as tarefas, mas elas ficarão sem categoria. Continuar?`
      : `Excluir "${c.nome}"?`
    const ok = await confirm({
      title: 'Excluir categoria',
      description,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return

    setCategorias(prev => prev.filter(x => x.id !== c.id))
    startTransition(async () => {
      try {
        await deleteCategoriaAgenda(c.id)
      } catch {
        await carregar()
      }
    })
  }

  if (acessoNegado) {
    return (
      <>
        <Header eyebrow="Configurações" title="Categorias da Agenda" />
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
            <p className="font-display text-base font-semibold text-[var(--ink)]">Acesso restrito</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Apenas administradores podem gerenciar categorias.</p>
            <Button onClick={() => router.push('/agenda')} className="mt-4">Voltar</Button>
          </div>
        </div>
      </>
    )
  }

  const proximaOrdem = categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem)) + 1 : 0

  return (
    <>
      <Header
        eyebrow="Configurações"
        title="Categorias da Agenda"
        subtitle="Edite cor, ícone e ordem das categorias usadas nas tarefas"
        actions={
          <Button onClick={abrirNova} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : categorias.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
            <p className="font-display text-base font-semibold text-[var(--ink)]">Sem categorias</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Crie a primeira pra começar a organizar suas tarefas.</p>
            <Button onClick={abrirNova} className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" /> Criar categoria
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {categorias.map((c, idx) => {
              const Icone = getIconeCategoria(c.icone)
              const isPending = pendingIds.has(c.id)
              const cor = c.cor ?? '#1E3A8A'
              return (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 transition-all',
                    !c.ativo && 'opacity-50',
                    isPending && 'opacity-60',
                  )}
                >
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => mover(c.id, -1)}
                      disabled={idx === 0 || isPending}
                      className="grid h-5 w-5 cursor-pointer place-items-center rounded text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Mover pra cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(c.id, 1)}
                      disabled={idx === categorias.length - 1 || isPending}
                      className="grid h-5 w-5 cursor-pointer place-items-center rounded text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Mover pra baixo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Swatch + ícone */}
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ backgroundColor: `${cor}1A`, color: cor }}
                  >
                    {Icone ? <Icone className="h-5 w-5" /> : (
                      <span className="text-base font-bold">{c.nome.charAt(0).toUpperCase()}</span>
                    )}
                  </span>

                  {/* Nome + contagem */}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-[var(--ink)]">{c.nome}</p>
                    <p className="text-xs text-[var(--ink-soft)]">
                      {c.total_itens === 0 ? 'Nenhuma tarefa' : `${c.total_itens} tarefa${c.total_itens === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-faint)]" />}
                    <button
                      type="button"
                      onClick={() => toggleAtivo(c)}
                      title={c.ativo ? 'Desativar (some do select de tarefas)' : 'Reativar'}
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] transition-all hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                    >
                      {c.ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(c)}
                      title="Editar"
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] transition-all hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(c)}
                      title="Excluir"
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-rose-500 transition-all hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CategoriaForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editando}
        onSaved={carregar}
        proximaOrdem={proximaOrdem}
      />
    </>
  )
}
