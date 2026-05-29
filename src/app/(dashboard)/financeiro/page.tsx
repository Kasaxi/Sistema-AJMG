'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshButton } from '@/components/ui/refresh-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus, Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft,
  Wallet, Clock, CalendarDays, Check, Hammer, Trash2, X,
} from 'lucide-react'
import {
  listLancamentos, listCategorias, listCentrosCusto, listAutores,
  darBaixa, darBaixaEmLote, deleteEmLote,
} from '@/app/actions/financeiro-actions'
import type {
  LancamentoComRelacoes, FinanceiroCategoria, LancamentoStatus, CentroCusto,
} from '@/types/financeiro'
import { LancamentoForm } from '@/components/financeiro/lancamento-form'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, cn } from '@/lib/utils'

type Aba = 'TODOS' | 'RECEBER' | 'PAGAR'

const ABAS: { id: Aba; label: string }[] = [
  { id: 'TODOS', label: 'Visão geral' },
  { id: 'RECEBER', label: 'A receber' },
  { id: 'PAGAR', label: 'A pagar' },
]

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function deslocarMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function statusLabel(l: LancamentoComRelacoes): string {
  if (l.status === 'CANCELADO') return 'Cancelado'
  if (l.status === 'PAGO') return l.tipo === 'ENTRADA' ? 'Recebido' : 'Pago'
  return 'Pendente'
}

function isVencido(l: LancamentoComRelacoes): boolean {
  if (l.status !== 'PENDENTE') return false
  return l.data_vencimento < new Date().toISOString().split('T')[0]
}

const NONE = '__all__'

const ITEMS_STATUS: Record<string, string> = {
  [NONE]: 'Todos status', PENDENTE: 'Pendente', PAGO: 'Pago/Recebido', CANCELADO: 'Cancelado',
}

// Grid compartilhado entre cabeçalho e linhas (mantém colunas alinhadas):
// checkbox | descrição | categoria | centro de custo | valor | ação
const GRID_LINHA = 'grid grid-cols-[24px_minmax(170px,2fr)_minmax(120px,1fr)_minmax(160px,1.4fr)_minmax(130px,auto)_36px] items-center gap-3'

export default function FinanceiroPage() {
  const confirm = useConfirm()
  const toast = useToast()

  const [mes, setMes] = useState(mesAtual())
  const [aba, setAba] = useState<Aba>('TODOS')
  const [lancamentos, setLancamentos] = useState<LancamentoComRelacoes[]>([])
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([])
  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [autores, setAutores] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros client-side
  const [busca, setBusca] = useState('')
  const [fCategoria, setFCategoria] = useState(NONE)
  const [fCentro, setFCentro] = useState(NONE)
  const [fAutor, setFAutor] = useState(NONE)
  const [fStatus, setFStatus] = useState<LancamentoStatus | typeof NONE>(NONE)

  // Seleção em lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  // Modal
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<LancamentoComRelacoes | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const lancs = await listLancamentos({ mes, aba })
      setLancamentos(lancs)
      setSelecionados(new Set())
    } finally {
      setLoading(false)
    }
  }, [mes, aba])

  useEffect(() => { void carregar() }, [carregar])

  // Catálogos (uma vez)
  useEffect(() => {
    void Promise.all([listCategorias(), listCentrosCusto(), listAutores()])
      .then(([c, ce, a]) => { setCategorias(c); setCentros(ce); setAutores(a) })
      .catch(() => {})
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lancamentos.filter(l => {
      if (fCategoria !== NONE && l.categoria_id !== fCategoria) return false
      if (fCentro !== NONE && l.centro_custo_id !== fCentro) return false
      if (fAutor !== NONE && l.created_by !== fAutor) return false
      if (fStatus !== NONE && l.status !== fStatus) return false
      if (q) {
        return (
          l.descricao.toLowerCase().includes(q) ||
          (l.categoria_nome?.toLowerCase().includes(q) ?? false) ||
          (l.centro_custo_nome?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [lancamentos, busca, fCategoria, fCentro, fAutor, fStatus])

  // Agrupa por data de vencimento (já vem ordenado desc)
  const grupos = useMemo(() => {
    const map = new Map<string, LancamentoComRelacoes[]>()
    for (const l of filtrados) {
      const arr = map.get(l.data_vencimento) ?? []
      arr.push(l)
      map.set(l.data_vencimento, arr)
    }
    return [...map.entries()]
  }, [filtrados])

  const temFiltro = busca.trim() !== '' || fCategoria !== NONE || fCentro !== NONE || fAutor !== NONE || fStatus !== NONE

  // KPIs calculados da lista FILTRADA (reagem aos filtros). Cancelados fora.
  const kpis = useMemo(() => {
    let entradas = 0, saidas = 0, saidasPrevistas = 0
    for (const l of filtrados) {
      if (l.status === 'CANCELADO') continue
      if (l.tipo === 'ENTRADA') {
        if (l.status === 'PAGO') entradas += l.valor
      } else {
        if (l.status === 'PAGO') saidas += l.valor
        else saidasPrevistas += l.valor
      }
    }
    return { entradas, saidas, saldo: entradas - saidas, saidasPrevistas }
  }, [filtrados])

  // Mapas valor→label pros filtros (Base UI Select.Value mostra o label via `items`)
  const itemsCategoria = useMemo(
    () => ({ [NONE]: 'Todas categorias', ...Object.fromEntries(categorias.map(c => [c.id, c.nome])) }),
    [categorias],
  )
  const itemsCentro = useMemo(
    () => ({ [NONE]: 'Todos centros', ...Object.fromEntries(centros.map(c => [c.id, c.grupo ? `${c.grupo} › ${c.nome}` : c.nome])) }),
    [centros],
  )

  function abrirNovo() { setEditando(null); setFormOpen(true) }
  function abrirEdicao(l: LancamentoComRelacoes) { setEditando(l); setFormOpen(true) }

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function baixaRapida(l: LancamentoComRelacoes) {
    const novo = l.status !== 'PAGO'
    try {
      await darBaixa(l.id, novo)
      toast.success(novo ? 'Baixa dada' : 'Baixa desfeita')
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao dar baixa')
    }
  }

  async function baixaLote() {
    const ids = [...selecionados]
    try {
      await darBaixaEmLote(ids, true)
      toast.success(`${ids.length} lançamento(s) baixado(s)`)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na baixa em lote')
    }
  }

  async function excluirLote() {
    const ids = [...selecionados]
    const ok = await confirm({
      title: 'Excluir lançamentos',
      description: `Excluir ${ids.length} lançamento(s) selecionado(s)? Não pode ser desfeito.`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteEmLote(ids)
      toast.success(`${ids.length} lançamento(s) excluído(s)`)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir')
    }
  }

  return (
    <>
      <Header
        eyebrow="Financeiro"
        title="Lançamentos"
        subtitle="Entradas e saídas do caixa da empresa"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={carregar} />
            <Button className="gap-1.5" onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Novo lançamento
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {/* Navegação de mês (com seletor de calendário) */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
            <button onClick={() => setMes(m => deslocarMes(m, -1))} aria-label="Mês anterior"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 transition-colors hover:bg-[var(--paper)]">
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-bright)]" />
              <span className="min-w-[120px] text-center text-sm font-semibold capitalize text-[var(--ink)]">{rotuloMes(mes)}</span>
              <input
                type="month"
                value={mes}
                onChange={e => { if (e.target.value) setMes(e.target.value) }}
                aria-label="Selecionar mês"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <button onClick={() => setMes(m => deslocarMes(m, 1))} aria-label="Próximo mês"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {mes !== mesAtual() && (
            <Button variant="ghost" size="sm" onClick={() => setMes(mesAtual())}>Voltar ao mês atual</Button>
          )}
        </div>

        {/* KPIs — reagem aos filtros (calculados da lista filtrada) */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={Wallet} label="Saldo" value={kpis.saldo} loading={loading}
            tone={kpis.saldo >= 0 ? 'positive' : 'danger'} hint="Entradas − saídas confirmadas" />
          <KpiCard icon={ArrowUpRight} label="Entradas" value={kpis.entradas} loading={loading}
            tone="positive" hint="Recebidas no período" />
          <KpiCard icon={ArrowDownLeft} label="Saídas" value={kpis.saidas} loading={loading}
            tone="danger" hint="Pagas no período" />
          <KpiCard icon={Clock} label="Saídas previstas" value={kpis.saidasPrevistas} loading={loading}
            tone="warning" hint="A pagar (pendentes)" />
        </div>

        {/* Abas */}
        <div className="mb-4 inline-flex w-full overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1 sm:w-auto">
          {ABAS.map(a => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={cn(
                'inline-flex cursor-pointer items-center whitespace-nowrap rounded-xl px-4 py-1.5 text-sm font-semibold transition-all',
                aba === a.id ? 'bg-white text-[var(--ink)] shadow-sm ring-1 ring-inset ring-[var(--line)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
              )}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar descrição, categoria ou obra…" className="h-10 rounded-xl pl-10" />
          </div>
          <Select items={itemsCategoria} value={fCategoria} onValueChange={(v) => setFCategoria(v ?? NONE)}>
            <SelectTrigger className="h-10 min-w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todas categorias</SelectItem>
              {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select items={itemsCentro} value={fCentro} onValueChange={(v) => setFCentro(v ?? NONE)}>
            <SelectTrigger className="h-10 min-w-[150px]"><SelectValue placeholder="Centro de custo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todos centros</SelectItem>
              {centros.map(c => <SelectItem key={c.id} value={c.id}>{c.grupo ? `${c.grupo} › ${c.nome}` : c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select items={ITEMS_STATUS} value={fStatus} onValueChange={(v) => setFStatus(v as LancamentoStatus | typeof NONE)}>
            <SelectTrigger className="h-10 min-w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todos status</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="PAGO">Pago/Recebido</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : filtrados.length === 0 ? (
          <EmptyState hasFiltro={temFiltro} onNovo={abrirNovo} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
            <div className="min-w-[820px]">
              {/* Cabeçalho de colunas */}
              <div className={cn(GRID_LINHA, 'border-b border-[var(--line)] bg-[var(--paper)]/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]')}>
                <span />
                <span>Descrição</span>
                <span>Categoria</span>
                <span>Centro de custo</span>
                <span className="text-right">Valor</span>
                <span />
              </div>
              {grupos.map(([data, itens]) => {
                const liquido = itens.reduce((s, l) => s + (l.tipo === 'ENTRADA' ? l.valor : -l.valor), 0)
                return (
                  <div key={data}>
                    <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/60 px-4 py-2">
                      <span className="text-sm font-semibold capitalize text-[var(--ink-soft)]">{formatDataLonga(data)}</span>
                      <span className={cn('text-sm font-semibold tabular-nums', liquido >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        {liquido >= 0 ? '+' : '−'} {formatCurrency(Math.abs(liquido))}
                      </span>
                    </div>
                    {itens.map(l => (
                      <LinhaLancamento
                        key={l.id} l={l}
                        selecionado={selecionados.has(l.id)}
                        onToggleSel={() => toggleSel(l.id)}
                        onEditar={() => abrirEdicao(l)}
                        onBaixa={() => baixaRapida(l)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 shadow-lg shadow-black/10 ring-1 ring-black/5">
          <span className="text-sm font-semibold text-[var(--ink)]">{selecionados.size} selecionado(s)</span>
          <Button size="sm" onClick={baixaLote} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Dar baixa</Button>
          <Button size="sm" variant="destructive" onClick={excluirLote} className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          <button onClick={() => setSelecionados(new Set())} aria-label="Limpar seleção" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] hover:bg-[var(--paper)] hover:text-[var(--ink)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <LancamentoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editando}
        categorias={categorias}
        centros={centros}
        onSaved={carregar}
      />
    </>
  )
}

function KpiCard({ icon: Icon, label, value, loading, tone, hint }: {
  icon: React.ElementType; label: string; value?: number; loading: boolean
  tone: 'brand' | 'neutral' | 'positive' | 'danger' | 'warning'; hint?: string
}) {
  const toneCls = {
    brand: 'text-[var(--brand-bright)] bg-[var(--brand-tint)]',
    neutral: 'text-[var(--ink-soft)] bg-[var(--paper)]',
    positive: 'text-emerald-700 bg-emerald-50',
    danger: 'text-rose-700 bg-rose-50',
    warning: 'text-amber-700 bg-amber-50',
  }[tone]
  const valueCls = {
    brand: 'text-[var(--ink)]',
    neutral: 'text-[var(--ink)]',
    positive: 'text-emerald-700',
    danger: 'text-rose-700',
    warning: 'text-amber-700',
  }[tone]
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', toneCls)}><Icon className="h-3.5 w-3.5" strokeWidth={2.4} /></span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-28 rounded" />
      ) : (
        <p className={cn('mt-2.5 font-display text-xl font-bold tabular-nums', valueCls)}>
          {formatCurrency(value ?? 0)}
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-[var(--ink-faint)]">{hint}</p>}
    </div>
  )
}

function LinhaLancamento({ l, selecionado, onToggleSel, onEditar, onBaixa }: {
  l: LancamentoComRelacoes; selecionado: boolean
  onToggleSel: () => void; onEditar: () => void; onBaixa: () => void
}) {
  const entrada = l.tipo === 'ENTRADA'
  const vencido = isVencido(l)
  const cancelado = l.status === 'CANCELADO'
  return (
    <div className={cn(
      GRID_LINHA,
      'group border-b border-[var(--line)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--paper)]/50',
      selecionado && 'bg-[var(--brand-tint)]/40',
    )}>
      {/* checkbox */}
      <input type="checkbox" checked={selecionado} onChange={onToggleSel}
        className="h-4 w-4 cursor-pointer rounded border-[var(--line)] accent-[var(--brand-bright)]" />

      {/* descrição (com ícone de tipo + autor) */}
      <button onClick={onEditar} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left">
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg',
          entrada ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
          {entrada ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className={cn('block truncate text-[15px] font-semibold text-[var(--ink)]', cancelado && 'text-[var(--ink-faint)] line-through')}>{l.descricao}</span>
          {l.autor_nome && <span className="block truncate text-xs text-[var(--ink-faint)]">por {l.autor_nome.split(' ')[0]}</span>}
        </span>
      </button>

      {/* categoria */}
      <span className="truncate text-sm text-[var(--ink-soft)]">{l.categoria_nome ?? '—'}</span>

      {/* centro de custo */}
      <span className="min-w-0">
        {l.centro_custo_nome ? (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-medium text-[var(--brand-bright)]">
            <Hammer className="h-3 w-3 shrink-0" />
            <span className="truncate">{l.centro_custo_grupo ? `${l.centro_custo_grupo} › ${l.centro_custo_nome}` : l.centro_custo_nome}</span>
          </span>
        ) : <span className="text-sm text-[var(--ink-faint)]">—</span>}
      </span>

      {/* valor + status */}
      <span className="text-right">
        <span className={cn('block text-base font-bold tabular-nums', entrada ? 'text-emerald-700' : 'text-rose-700')}>
          {entrada ? '+' : '−'} {formatCurrency(l.valor)}
        </span>
        <span className={cn(
          'inline-block rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
          cancelado ? 'bg-[var(--paper)] text-[var(--ink-faint)]'
            : l.status === 'PAGO' ? 'bg-emerald-50 text-emerald-700'
            : vencido ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
        )}>
          {vencido ? 'Vencido' : statusLabel(l)}
        </span>
      </span>

      {/* ação: dar baixa */}
      {!cancelado ? (
        <button onClick={onBaixa} title={l.status === 'PAGO' ? 'Desfazer baixa' : 'Dar baixa'}
          className={cn(
            'grid h-8 w-8 cursor-pointer place-items-center rounded-lg border transition-colors',
            l.status === 'PAGO'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-[var(--line)] text-[var(--ink-faint)] hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
          )}>
          <Check className="h-4 w-4" />
        </button>
      ) : <span />}
    </div>
  )
}

function EmptyState({ hasFiltro, onNovo }: { hasFiltro: boolean; onNovo: () => void }) {
  if (hasFiltro) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-[var(--ink)]">Nada bateu com os filtros</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Tenta limpar a busca ou trocar o período.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]"><Wallet className="h-6 w-6" /></span>
      <p className="mt-4 font-display text-base font-semibold text-[var(--ink)]">Nenhum lançamento neste mês</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Registre a primeira entrada ou saída do caixa.</p>
      <Button className="mt-4 gap-1.5" onClick={onNovo}><Plus className="h-4 w-4" /> Novo lançamento</Button>
    </div>
  )
}
