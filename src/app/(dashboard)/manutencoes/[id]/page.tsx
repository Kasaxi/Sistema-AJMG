'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshButton } from '@/components/ui/refresh-button'
import {
  ArrowLeft, AlertCircle, MapPin, User, CalendarDays, Clock,
  Play, Check, X as XIcon, RotateCcw, Plus, Trash2, Circle, DollarSign, Pencil,
} from 'lucide-react'
import {
  getManutencao, setManutencaoStatus, deleteManutencao,
  listManutencaoItens, addManutencaoItem, setItemStatus, removeManutencaoItem,
  listTiposManutencao,
} from '@/app/actions/manutencoes-actions'
import {
  listGastos, listCategoriasCusto, listUnidadesMedida, listFornecedores,
} from '@/app/actions/compras-actions'
import type { Manutencao, ManutencaoStatus, ManutencaoItem, TipoManutencao } from '@/types/manutencoes'
import type { Gasto, CategoriaCusto, UnidadeMedida, Fornecedor } from '@/types/compras'
import { AnexosItem } from '@/components/manutencoes/anexos-item'
import { SharePortalButton } from '@/components/manutencoes/share-portal-button'
import { GastoForm } from '@/components/compras/gasto-form'
import { MANUTENCAO_STATUS_LABEL } from '@/types/manutencoes'
import { cn } from '@/lib/utils'

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_TONE: Record<ManutencaoStatus, string> = {
  AGENDADA:      'bg-[var(--paper)] text-[var(--ink-soft)]',
  EM_ANDAMENTO:  'bg-amber-50 text-amber-700',
  CONCLUIDA:     'bg-emerald-50 text-emerald-700',
  CANCELADA:     'bg-rose-50 text-rose-700',
}

function formatDateBR(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function formatHora(time: string | null) {
  if (!time) return null
  return time.slice(0, 5)
}

export default function ManutencaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [m, setM] = useState<Manutencao | null>(null)
  const [itens, setItens] = useState<ManutencaoItem[]>([])
  const [tipos, setTipos] = useState<TipoManutencao[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [categorias, setCategorias] = useState<CategoriaCusto[]>([])
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [gastoModalOpen, setGastoModalOpen] = useState(false)
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [acao, setAcao] = useState<string | null>(null)

  // Silent refresh (não pisca skeleton em updates pós-ação)
  const refresh = useCallback(async () => {
    setErro(null)
    try {
      const [data, lista, ts, gs, cats, unis, forns] = await Promise.all([
        getManutencao(id),
        listManutencaoItens(id),
        listTiposManutencao({ ativosApenas: true }),
        listGastos({ manutencao_id: id, per_page: 200 }),
        listCategoriasCusto(),
        listUnidadesMedida(),
        listFornecedores(),
      ])
      if (!data) { router.replace('/manutencoes'); return }
      setM(data)
      setItens(lista)
      setTipos(ts)
      setGastos(gs.items)
      setCategorias(cats)
      setUnidades(unis)
      setFornecedores(forns)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar.')
    }
  }, [id, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    await refresh()
    setLoading(false)
  }, [refresh])

  useEffect(() => { void carregar() }, [carregar])

  async function comAcao<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
    setAcao(nome); setErro(null)
    try {
      const r = await fn()
      await refresh()
      return r
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Falhou: ${nome}`)
      return null
    } finally {
      setAcao(null)
    }
  }

  if (loading) {
    return (
      <>
        <Header eyebrow="Manutenção" title="Carregando…" />
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-8">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </>
    )
  }
  if (!m) return null

  const dataAg = formatDateBR(m.data_agendada)
  const hora = formatHora(m.hora_inicio)
  const dataCon = formatDateBR(m.data_concluida)

  return (
    <>
      <Header
        eyebrow="Manutenção"
        title={m.cliente?.nome ?? (m.endereco ?? 'Manutenção')}
        subtitle={m.cliente?.nome && m.endereco ? m.endereco : (m.cliente?.nome ? 'Sem endereço' : 'Sem cliente identificado')}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link
              href="/manutencoes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              <ArrowLeft className="h-4 w-4" /> Manutenções
            </Link>
            {m.cliente?.token && <SharePortalButton token={m.cliente.token} />}
            <RefreshButton onRefresh={refresh} />
          </div>
        }
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-8">
        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Status + transições */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
              STATUS_TONE[m.status],
            )}>
              {MANUTENCAO_STATUS_LABEL[m.status]}
            </span>
            {m.agenda_item_id && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]">
                <CalendarDays className="h-3 w-3" /> Sincronizada com Agenda
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-3 text-xs text-[var(--ink-faint)] print:hidden">
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Apagar essa manutenção? Não pode ser desfeito.')) return
                  void (async () => {
                    try {
                      await deleteManutencao(m.id)
                      router.push('/manutencoes')
                    } catch (e) {
                      setErro(e instanceof Error ? e.message : 'Falhou.')
                    }
                  })()
                }}
                className="cursor-pointer underline-offset-2 hover:text-rose-600 hover:underline"
              >
                Apagar
              </button>
            </span>
          </div>

          {/* Ações de transição */}
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {m.status === 'AGENDADA' && (
              <>
                <Button
                  onClick={() => comAcao('iniciar', () => setManutencaoStatus(m.id, 'EM_ANDAMENTO'))}
                  disabled={!!acao}
                  className="gap-1.5"
                >
                  <Play className="h-4 w-4" /> Iniciar atendimento
                </Button>
                <Button
                  variant="outline"
                  onClick={() => comAcao('cancelar', () => setManutencaoStatus(m.id, 'CANCELADA'))}
                  disabled={!!acao}
                  className="gap-1.5"
                >
                  <XIcon className="h-4 w-4" /> Cancelar
                </Button>
              </>
            )}
            {m.status === 'EM_ANDAMENTO' && (
              <>
                <Button
                  onClick={() => comAcao('concluir', () => setManutencaoStatus(m.id, 'CONCLUIDA'))}
                  disabled={!!acao}
                  className="gap-1.5"
                >
                  <Check className="h-4 w-4" /> Concluir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => comAcao('cancelar', () => setManutencaoStatus(m.id, 'CANCELADA'))}
                  disabled={!!acao}
                  className="gap-1.5"
                >
                  <XIcon className="h-4 w-4" /> Cancelar
                </Button>
              </>
            )}
            {(m.status === 'CONCLUIDA' || m.status === 'CANCELADA') && (
              <Button
                variant="outline"
                onClick={() => comAcao('reabrir', () => setManutencaoStatus(m.id, 'EM_ANDAMENTO'))}
                disabled={!!acao}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reabrir
              </Button>
            )}
          </div>
        </section>

        {/* Informações */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Informações</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field icon={User} label="Cliente" value={m.cliente?.nome ?? '—'} />
            <Field icon={MapPin} label="Endereço" value={m.endereco ?? '—'} />
            <Field icon={User} label="Responsável" value={m.responsavel?.nome ?? '—'} />
            <Field icon={CalendarDays} label="Data agendada" value={dataAg ?? '—'} />
            <Field icon={Clock} label="Hora" value={hora ?? '—'} />
            {dataCon && (
              <Field icon={Check} label="Concluída em" value={dataCon} />
            )}
          </dl>
          {m.observacoes && (
            <div className="mt-5 border-t border-[var(--line)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Observações</p>
              <p className="mt-2 whitespace-pre-line text-sm text-[var(--ink)]">{m.observacoes}</p>
            </div>
          )}
        </section>

        {/* Itens / situações */}
        <ItensSection
          manutencaoId={m.id}
          itens={itens}
          tipos={tipos}
          onMudou={refresh}
          setErro={setErro}
          podeEditar={m.status !== 'CANCELADA'}
        />

        {/* Lançamento de gastos vinculados */}
        <GastosSection
          gastos={gastos}
          podeEditar={m.status !== 'CANCELADA'}
          onAdd={() => { setGastoEditando(null); setGastoModalOpen(true) }}
          onEdit={(g) => { setGastoEditando(g); setGastoModalOpen(true) }}
        />
      </div>

      <GastoForm
        open={gastoModalOpen}
        onClose={() => setGastoModalOpen(false)}
        manutencaoId={m.id}
        initialData={gastoEditando}
        categorias={categorias}
        unidades={unidades}
        fornecedores={fornecedores}
        onSaved={() => { void refresh() }}
      />
    </>
  )
}

function GastosSection({
  gastos, podeEditar, onAdd, onEdit,
}: {
  gastos: Gasto[]
  podeEditar: boolean
  onAdd: () => void
  onEdit: (g: Gasto) => void
}) {
  const total = gastos.reduce((acc, g) => acc + Number(g.valor_total), 0)

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">Gastos</h2>
          <p className="text-xs text-[var(--ink-soft)]">
            {gastos.length === 0
              ? 'Nenhum gasto lançado.'
              : `${gastos.length} lançamento${gastos.length > 1 ? 's' : ''} · ${formatBRL(total)}`}
          </p>
        </div>
        {podeEditar && (
          <Button onClick={onAdd} variant="outline" className="gap-1.5 print:hidden">
            <Plus className="h-4 w-4" /> Lançar gasto
          </Button>
        )}
      </div>

      {gastos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)]/30 px-4 py-8 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-white text-[var(--ink-soft)]">
            <DollarSign className="h-4 w-4" />
          </span>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Materiais, mão de obra ou notas fiscais vinculados a essa O.S. aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {gastos.map(g => (
            <li
              key={g.id}
              className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 transition-colors hover:border-[var(--brand-bright)]/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">{g.descricao}</p>
                  {g.categoria?.nome && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: g.categoria.cor ? `${g.categoria.cor}20` : 'var(--brand-tint)',
                        color: g.categoria.cor ?? 'var(--brand-bright)',
                      }}
                    >
                      {g.categoria.nome}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                  {formatDateBR(g.data)}
                  {g.fornecedor?.nome && <> · {g.fornecedor.nome}</>}
                  {' · '}
                  {Number(g.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {g.unidade?.sigla ?? ''}
                  {' × '}
                  {formatBRL(Number(g.valor_unitario))}
                </p>
              </div>
              <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
                {formatBRL(Number(g.valor_total))}
              </span>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => onEdit(g)}
                  className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] opacity-0 transition-all hover:bg-[var(--paper)] hover:text-[var(--ink)] group-hover:opacity-100 print:hidden"
                  aria-label="Editar gasto"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ItensSection({
  manutencaoId, itens, tipos, onMudou, setErro, podeEditar,
}: {
  manutencaoId: string
  itens: ManutencaoItem[]
  tipos: TipoManutencao[]
  onMudou: () => Promise<void>
  setErro: (s: string | null) => void
  podeEditar: boolean
}) {
  const [adicionando, setAdicionando] = useState(false)
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novoTipoId, setNovoTipoId] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function adicionar() {
    if (!novaDescricao.trim()) return
    setSalvando(true); setErro(null)
    try {
      await addManutencaoItem(manutencaoId, {
        descricao: novaDescricao,
        tipo_id: novoTipoId || null,
      })
      setNovaDescricao('')
      setNovoTipoId('')
      setAdicionando(false)
      await onMudou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou.')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleStatus(item: ManutencaoItem) {
    const novo = item.status === 'PENDENTE' ? 'RESOLVIDO' : 'PENDENTE'
    setTogglingId(item.id); setErro(null)
    try {
      await setItemStatus(item.id, novo)
      await onMudou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou.')
    } finally {
      setTogglingId(null)
    }
  }

  async function remover(item: ManutencaoItem) {
    if (!confirm(`Remover "${item.descricao}"?`)) return
    setErro(null)
    try {
      await removeManutencaoItem(item.id)
      await onMudou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou.')
    }
  }

  const pendentes = itens.filter(i => i.status === 'PENDENTE').length
  const resolvidos = itens.filter(i => i.status === 'RESOLVIDO').length

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">
            Itens / situações
          </h2>
          <p className="text-xs text-[var(--ink-soft)]">
            {itens.length === 0 ? 'Nenhum item ainda.' : (
              <>
                {resolvidos} de {itens.length} resolvidos{pendentes > 0 ? ` · ${pendentes} pendente${pendentes > 1 ? 's' : ''}` : ''}
              </>
            )}
          </p>
        </div>
        {podeEditar && !adicionando && (
          <Button variant="outline" onClick={() => setAdicionando(true)} className="gap-1.5 print:hidden">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        )}
      </div>

      {adicionando && podeEditar && (
        <div className="mb-3 rounded-xl border border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/30 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto_auto] sm:items-center">
            <input
              value={novaDescricao}
              onChange={e => setNovaDescricao(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void adicionar() }}
              placeholder="Descreva a situação"
              className="h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
              autoFocus
            />
            <select
              value={novoTipoId}
              onChange={e => setNovoTipoId(e.target.value)}
              className="h-10 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
            >
              <option value="">— tipo —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <Button onClick={adicionar} disabled={salvando} className="h-10 px-3">
              {salvando ? '…' : 'Adicionar'}
            </Button>
            <button
              type="button"
              onClick={() => { setAdicionando(false); setNovaDescricao(''); setNovoTipoId('') }}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
              aria-label="Cancelar"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--ink-soft)]">
          Sem itens. Use "Adicionar" pra cadastrar cada situação separadamente.
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map(it => {
            const resolvido = it.status === 'RESOLVIDO'
            return (
              <li
                key={it.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                  resolvido
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-[var(--line)] bg-white',
                )}
              >
                <button
                  type="button"
                  onClick={() => podeEditar && toggleStatus(it)}
                  disabled={!podeEditar || togglingId === it.id}
                  aria-label={resolvido ? 'Marcar pendente' : 'Marcar resolvido'}
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all',
                    resolvido
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-[var(--line)] hover:border-[var(--brand-bright)]',
                    podeEditar ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  {resolvido ? <Check className="h-3 w-3" strokeWidth={3} /> : <Circle className="h-3 w-3 opacity-0" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className={cn(
                      'text-sm text-[var(--ink)]',
                      resolvido && 'line-through text-[var(--ink-soft)]',
                    )}>
                      {it.descricao}
                    </p>
                    {it.tipo?.nome && (
                      <span className="inline-flex items-center rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-bright)]">
                        {it.tipo.nome}
                      </span>
                    )}
                  </div>
                  {it.observacoes && (
                    <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{it.observacoes}</p>
                  )}
                  <AnexosItem manutencaoId={manutencaoId} itemId={it.id} podeEditar={podeEditar} />
                </div>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => remover(it)}
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 print:hidden"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</dd>
    </div>
  )
}
