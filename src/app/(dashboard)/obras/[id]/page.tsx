'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Plus, Search, Pencil, Hammer, MapPin, CalendarDays, Wallet,
  ClipboardList, BarChart3, Building2, Tag, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, SlidersHorizontal, X,
} from 'lucide-react'
import { RefreshButton } from '@/components/ui/refresh-button'
import { ObraForm } from '@/components/obras/obra-form'
import { GastoForm } from '@/components/compras/gasto-form'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { getObra } from '@/app/actions/obras-actions'
import {
  listGastos, listCategoriasCusto, listUnidadesMedida, listFornecedores,
  getResumoGastosObra,
  type ResumoGastosObra,
} from '@/app/actions/compras-actions'
import type { Obra } from '@/types/obras'
import { OBRA_STATUS_LABELS } from '@/types/obras'
import type {
  Gasto, CategoriaCusto, UnidadeMedida, Fornecedor,
  GastoSortColumn, SortDirection,
} from '@/types/compras'
import { cn } from '@/lib/utils'

type Aba = 'GASTOS' | 'RESUMO' | 'DADOS'

const ABAS: { id: Aba; label: string; icon: React.ElementType }[] = [
  { id: 'GASTOS', label: 'Gastos',  icon: ClipboardList },
  { id: 'RESUMO', label: 'Resumo',  icon: BarChart3 },
  { id: 'DADOS',  label: 'Dados',   icon: Hammer },
]

function formatBRL(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatMes(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[Number(m) - 1]}/${y.slice(2)}`
}

// Constrói path SVG com curvas Bezier cúbicas suaves entre pontos (Catmull-Rom style).
// tension entre 0 (lines retas) e ~0.5 (curvas mais redondas); 0.2-0.25 é equilibrado.
function buildSmoothPath(pontos: { x: number; y: number }[], tension = 0.22): string {
  if (pontos.length === 0) return ''
  if (pontos.length === 1) return `M ${pontos[0].x},${pontos[0].y}`
  let d = `M ${pontos[0].x},${pontos[0].y}`
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

// Valor curto pra labels de gráfico ("R$ 39,6 mil", "R$ 1,2 mi")
function formatBRLcurto(n: number): string {
  if (n === 0) return 'R$ 0'
  if (n < 1000) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  }
  if (n < 1_000_000) {
    const v = (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `R$ ${v} mil`
  }
  const v = (n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return `R$ ${v} mi`
}


export default function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [aba, setAba] = useState<Aba>('GASTOS')
  const [obra, setObra] = useState<Obra | null>(null)
  const [loading, setLoading] = useState(true)

  const [gastos, setGastos] = useState<Gasto[]>([])
  const [gastosTotal, setGastosTotal] = useState(0)
  const [categorias, setCategorias] = useState<CategoriaCusto[]>([])
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [resumo, setResumo] = useState<ResumoGastosObra | null>(null)

  const [obraModalOpen, setObraModalOpen] = useState(false)
  const [gastoModalOpen, setGastoModalOpen] = useState(false)
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [filtroCategoriasIds, setFiltroCategoriasIds] = useState<string[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState<string | null>(null)
  const [filtroDataFim, setFiltroDataFim] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<GastoSortColumn>('data')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [pagina, setPagina] = useState(1)
  const PER_PAGE = 50

  // Debounce na busca: 300ms
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 300)
    return () => clearTimeout(t)
  }, [busca])

  // Reset pra página 1 quando muda a busca, filtros ou ordenação
  // (filtroCategoriasIds.join() serializa o array pra dependência estável)
  const filtroCategoriasKey = filtroCategoriasIds.join(',')
  useEffect(() => { setPagina(1) }, [buscaDebounced, filtroCategoriasKey, filtroDataInicio, filtroDataFim, sortColumn, sortDir])

  // Carrega tudo: obra, catálogos, resumo (uma vez no mount + após salvar)
  const carregarTudo = useCallback(async () => {
    setLoading(true)
    try {
      const [o, c, u, f, r] = await Promise.all([
        getObra(id),
        listCategoriasCusto({ ativosApenas: true }),
        listUnidadesMedida(),
        listFornecedores({ ativosApenas: true }),
        getResumoGastosObra(id),
      ])
      if (!o) {
        router.replace('/obras')
        return
      }
      setObra(o)
      setCategorias(c)
      setUnidades(u)
      setFornecedores(f)
      setResumo(r)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  // Carrega só a página de gastos (toda vez que muda página, busca ou filtros)
  const carregarGastos = useCallback(async () => {
    const { items, total } = await listGastos({
      obra_id: id,
      search: buscaDebounced || undefined,
      categoria_ids: filtroCategoriasIds.length > 0 ? filtroCategoriasIds : undefined,
      data_inicio: filtroDataInicio ?? undefined,
      data_fim: filtroDataFim ?? undefined,
      sort_by: sortColumn,
      sort_dir: sortDir,
      page: pagina,
      per_page: PER_PAGE,
    })
    setGastos(items)
    setGastosTotal(total)
  }, [id, buscaDebounced, filtroCategoriasKey, filtroDataInicio, filtroDataFim, sortColumn, sortDir, pagina]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recarrega tudo após salvar
  const recarregar = useCallback(async () => {
    await Promise.all([carregarTudo(), carregarGastos()])
  }, [carregarTudo, carregarGastos])

  useEffect(() => { void carregarTudo() }, [carregarTudo])
  useEffect(() => { void carregarGastos() }, [carregarGastos])

  function abrirNovoGasto() {
    setGastoEditando(null)
    setGastoModalOpen(true)
  }

  function editarGasto(g: Gasto) {
    setGastoEditando(g)
    setGastoModalOpen(true)
  }

  function handleSort(column: GastoSortColumn) {
    if (sortColumn === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      // Texto default asc (A→Z), numérico/data default desc (maior primeiro)
      setSortDir(column === 'descricao' ? 'asc' : 'desc')
    }
  }

  if (loading) {
    return (
      <>
        <Header eyebrow="Obra" title="Carregando…" />
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </>
    )
  }
  if (!obra) return null

  return (
    <>
      <Header
        eyebrow={OBRA_STATUS_LABELS[obra.status]}
        title={obra.nome}
        subtitle={[obra.endereco, obra.cidade].filter(Boolean).join(' — ') || 'Sem endereço cadastrado'}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/obras"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              <ArrowLeft className="h-4 w-4" /> Obras
            </Link>
            <RefreshButton onRefresh={recarregar} />
            <Button variant="outline" onClick={() => setObraModalOpen(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Editar obra
            </Button>
            {aba === 'GASTOS' && (
              <Button onClick={abrirNovoGasto} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo gasto
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {/* Tabs */}
        <div className="mb-5 inline-flex overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1">
          {ABAS.map(a => {
            const isActive = aba === a.id
            const Icon = a.icon
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-white text-[var(--ink)] shadow-sm ring-1 ring-inset ring-[var(--line)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {a.label}
              </button>
            )
          })}
        </div>

        {/* Resumo header (KPIs sempre visíveis) */}
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiCard label="Total gasto"  valor={formatBRL(resumo?.total)} />
          <KpiCard label="Lançamentos"  valor={String(resumo?.totalLancamentos ?? 0)} />
          <KpiCard label="Orçamento"    valor={formatBRL(obra.orcamento_previsto)} />
          <KpiCard
            label="Saldo"
            valor={obra.orcamento_previsto != null && resumo
              ? formatBRL(obra.orcamento_previsto - resumo.total)
              : '—'}
            tone={obra.orcamento_previsto != null && resumo && resumo.total > obra.orcamento_previsto ? 'warn' : 'default'}
          />
        </div>

        {/* Conteúdo da aba */}
        {aba === 'GASTOS' && (
          <GastosTab
            gastos={gastos}
            gastosTotal={gastosTotal}
            pagina={pagina}
            perPage={PER_PAGE}
            onPaginaChange={setPagina}
            busca={busca}
            onBuscaChange={setBusca}
            filtroCategoriasIds={filtroCategoriasIds}
            onFiltroCategoriasChange={setFiltroCategoriasIds}
            filtroDataInicio={filtroDataInicio}
            filtroDataFim={filtroDataFim}
            onFiltroDataChange={(inicio, fim) => {
              setFiltroDataInicio(inicio)
              setFiltroDataFim(fim)
            }}
            sortColumn={sortColumn}
            sortDir={sortDir}
            onSort={handleSort}
            categoriasDisponiveis={resumo?.porCategoria ?? []}
            onAdd={abrirNovoGasto}
            onEdit={editarGasto}
            totalGeral={resumo?.total ?? 0}
          />
        )}
        {aba === 'RESUMO' && resumo && <ResumoTab resumo={resumo} orcamentoPrevisto={obra.orcamento_previsto} />}
        {aba === 'DADOS' && <DadosTab obra={obra} />}
      </div>

      <ObraForm
        open={obraModalOpen}
        onClose={() => setObraModalOpen(false)}
        initialData={obra}
        onSaved={recarregar}
      />

      <GastoForm
        open={gastoModalOpen}
        onClose={() => setGastoModalOpen(false)}
        obraId={id}
        initialData={gastoEditando}
        categorias={categorias}
        unidades={unidades}
        fornecedores={fornecedores}
        onSaved={recarregar}
      />
    </>
  )
}

function KpiCard({ label, valor, tone }: { label: string; valor: string; tone?: 'default' | 'warn' }) {
  return (
    <div className={cn(
      'rounded-2xl border bg-white p-3.5',
      tone === 'warn' ? 'border-rose-200 bg-rose-50/40' : 'border-[var(--line)]'
    )}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{label}</p>
      <p className={cn(
        'mt-1 font-display text-lg font-bold leading-tight',
        tone === 'warn' ? 'text-rose-700' : 'text-[var(--ink)]',
      )}>
        {valor}
      </p>
    </div>
  )
}

function GastosTab({
  gastos, gastosTotal, pagina, perPage, onPaginaChange,
  busca, onBuscaChange,
  filtroCategoriasIds, onFiltroCategoriasChange,
  filtroDataInicio, filtroDataFim, onFiltroDataChange,
  sortColumn, sortDir, onSort,
  categoriasDisponiveis,
  onAdd, onEdit, totalGeral,
}: {
  gastos: Gasto[]
  gastosTotal: number       // total de linhas que batem com o filtro
  pagina: number
  perPage: number
  onPaginaChange: (p: number) => void
  busca: string
  onBuscaChange: (v: string) => void
  filtroCategoriasIds: string[]
  onFiltroCategoriasChange: (ids: string[]) => void
  filtroDataInicio: string | null
  filtroDataFim: string | null
  onFiltroDataChange: (inicio: string | null, fim: string | null) => void
  sortColumn: GastoSortColumn
  sortDir: SortDirection
  onSort: (column: GastoSortColumn) => void
  categoriasDisponiveis: { categoria_id: string; nome: string; cor: string | null; count: number }[]
  onAdd: () => void
  onEdit: (g: Gasto) => void
  totalGeral: number        // R$ total da obra (todos os gastos, não só a página)
}) {
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const filtroPeriodoAtivo = !!(filtroDataInicio || filtroDataFim)
  const filtrosAtivos = filtroCategoriasIds.length + (filtroPeriodoAtivo ? 1 : 0)
  const categoriasSelecionadas = categoriasDisponiveis.filter(c =>
    filtroCategoriasIds.includes(c.categoria_id)
  )
  const totalPaginas = Math.max(1, Math.ceil(gastosTotal / perPage))
  const inicio = (pagina - 1) * perPage + 1
  const fim = Math.min(pagina * perPage, gastosTotal)
  return (
    <>
      {/* Linha de busca + botão Filtros */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
          <Input
            value={busca}
            onChange={e => onBuscaChange(e.target.value)}
            placeholder="Buscar por descrição ou observação…"
            className="h-11 rounded-xl pl-10"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltrosOpen(true)}
          className={cn(
            'inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
            filtrosAtivos > 0
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)]',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {filtrosAtivos > 0 && (
            <span className="inline-grid h-5 min-w-[20px] place-items-center rounded-full bg-[var(--ink)] px-1.5 text-[10px] font-bold text-white">
              {filtrosAtivos}
            </span>
          )}
        </button>
      </div>

      {/* Chips de filtros ativos */}
      {filtrosAtivos > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {categoriasSelecionadas.map(c => (
            <FilterChip
              key={c.categoria_id}
              cor={c.cor}
              label={c.nome}
              onRemove={() =>
                onFiltroCategoriasChange(filtroCategoriasIds.filter(id => id !== c.categoria_id))
              }
            />
          ))}
          {filtroPeriodoAtivo && (
            <FilterChip
              label={formatPeriodoChip(filtroDataInicio, filtroDataFim)}
              onRemove={() => onFiltroDataChange(null, null)}
            />
          )}
          <button
            type="button"
            onClick={() => {
              onFiltroCategoriasChange([])
              onFiltroDataChange(null, null)
            }}
            className="cursor-pointer text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Sheet de filtros */}
      <FiltrosSheet
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        filtroCategoriasIds={filtroCategoriasIds}
        onApply={(ids, inicio, fim) => {
          onFiltroCategoriasChange(ids)
          onFiltroDataChange(inicio, fim)
          setFiltrosOpen(false)
        }}
        filtroDataInicio={filtroDataInicio}
        filtroDataFim={filtroDataFim}
        categoriasDisponiveis={categoriasDisponiveis}
      />


      {gastos.length === 0 ? (
        (() => {
          const temFiltroAtivo = !!busca || filtrosAtivos > 0
          return (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
              <p className="font-display text-base font-semibold text-[var(--ink)]">
                {temFiltroAtivo ? 'Nada bateu com os filtros' : 'Nenhum gasto lançado ainda'}
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {temFiltroAtivo ? 'Tenta limpar a busca ou trocar os filtros.' : 'Comece lançando o primeiro gasto desta obra.'}
              </p>
              {!temFiltroAtivo && (
                <Button onClick={onAdd} className="mt-4 gap-1.5">
                  <Plus className="h-4 w-4" /> Lançar gasto
                </Button>
              )}
            </div>
          )
        })()
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full min-w-[680px]">
            <thead className="bg-[var(--paper)]">
              <tr>
                <SortableHeader label="Data"         column="data"           align="left"  className="px-4" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                <SortableHeader label="Descrição"    column="descricao"      align="left"  className="px-4" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Categoria</th>
                <SortableHeader label="Qtd"          column="quantidade"     align="right" className="px-2" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                <SortableHeader label="Valor unit."  column="valor_unitario" align="right" className="px-2" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                <SortableHeader label="Total"        column="valor_total"    align="right" className="px-4" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr
                  key={g.id}
                  onClick={() => onEdit(g)}
                  className="cursor-pointer border-t border-[var(--line)] transition-colors hover:bg-[var(--paper)]"
                >
                  <td className="px-4 py-3 text-sm text-[var(--ink-soft)] whitespace-nowrap">
                    {formatDate(g.data)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--ink)] text-sm leading-tight">{g.descricao}</p>
                    {g.fornecedor?.nome && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]">
                        <Building2 className="h-3 w-3" /> {g.fornecedor.nome}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {g.categoria && (
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: g.categoria.cor ? `${g.categoria.cor}1A` : 'var(--brand-tint)',
                          color: g.categoria.cor ?? 'var(--brand-bright)',
                        }}
                      >
                        {g.categoria.nome}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right text-sm text-[var(--ink-soft)] whitespace-nowrap">
                    {Number(g.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                    <span className="text-xs text-[var(--ink-faint)]">{g.unidade?.sigla ?? ''}</span>
                  </td>
                  <td className="px-2 py-3 text-right text-sm text-[var(--ink-soft)] whitespace-nowrap">
                    {formatBRL(Number(g.valor_unitario))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--ink)] whitespace-nowrap">
                    {formatBRL(Number(g.valor_total))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[var(--paper)]">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Total da obra ({gastosTotal} {gastosTotal === 1 ? 'lançamento' : 'lançamentos'})
                </td>
                <td className="px-4 py-3 text-right font-display text-base font-bold text-[var(--ink)] whitespace-nowrap">
                  {formatBRL(totalGeral)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--paper)]/40 px-4 py-3">
              <p className="text-xs text-[var(--ink-soft)]">
                Mostrando <span className="font-semibold text-[var(--ink)]">{inicio}–{fim}</span> de{' '}
                <span className="font-semibold text-[var(--ink)]">{gastosTotal}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPaginaChange(pagina - 1)}
                  disabled={pagina <= 1}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-semibold text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span className="px-2 text-xs font-semibold text-[var(--ink)]">
                  {pagina} / {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => onPaginaChange(pagina + 1)}
                  disabled={pagina >= totalPaginas}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-semibold text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próximo
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function ResumoTab({ resumo, orcamentoPrevisto }: { resumo: ResumoGastosObra; orcamentoPrevisto: number | null }) {
  if (resumo.totalLancamentos === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-[var(--ink)]">Sem dados ainda</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Lance gastos pra ver o resumo aqui.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Por categoria */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
          <Tag className="h-4 w-4 text-[var(--ink-soft)]" />
          Por categoria
        </h3>
        <div className="space-y-3">
          {resumo.porCategoria.map(c => {
            const pct = resumo.total > 0 ? (c.total / resumo.total) * 100 : 0
            return (
              <div key={c.categoria_id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-[var(--ink)]">{c.nome}</span>
                  <span className="font-semibold text-[var(--ink)]">{formatBRL(c.total)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--paper)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: c.cor ?? 'var(--brand-bright)',
                    }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                  {c.count} {c.count === 1 ? 'lançamento' : 'lançamentos'} · {pct.toFixed(1)}%
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top fornecedores */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
          <Building2 className="h-4 w-4 text-[var(--ink-soft)]" />
          Top fornecedores
        </h3>
        {resumo.topFornecedores.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">Nenhum fornecedor associado a gastos ainda.</p>
        ) : (
          <div className="space-y-2.5">
            {resumo.topFornecedores.map((f, i) => (
              <div key={f.fornecedor_id} className="flex items-baseline justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--paper)] text-[10px] font-bold text-[var(--ink-soft)]">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-[var(--ink)]">{f.nome}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold text-[var(--ink)]">{formatBRL(f.total)}</span>
                  <span className="text-xs text-[var(--ink-faint)]">{f.count} compras</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Por mês + breakdown do mês */}
      {resumo.porMes.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6 md:col-span-2">
          <GastosPorMesChart
            porMes={resumo.porMes}
            orcamentoPrevisto={orcamentoPrevisto}
          />
        </div>
      )}
    </div>
  )
}

function DadosTab({ obra }: { obra: Obra }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Nome" value={obra.nome} />
        <Field label="Status" value={OBRA_STATUS_LABELS[obra.status]} />
        <Field label="Endereço" value={obra.endereco ?? '—'} icon={MapPin} />
        <Field label="Cidade" value={obra.cidade ?? '—'} />
        <Field label="Início" value={formatDate(obra.data_inicio) ?? '—'} icon={CalendarDays} />
        <Field label="Previsão de entrega" value={formatDate(obra.data_previsao_entrega) ?? '—'} icon={CalendarDays} />
        <Field
          label="Orçamento previsto"
          value={obra.orcamento_previsto != null ? formatBRL(obra.orcamento_previsto) : '—'}
          icon={Wallet}
        />
      </dl>
      {obra.observacoes && (
        <div className="mt-6 border-t border-[var(--line)] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Observações</p>
          <p className="mt-2 whitespace-pre-line text-sm text-[var(--ink)]">{obra.observacoes}</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</dd>
    </div>
  )
}

function GastosPorMesChart({
  porMes, orcamentoPrevisto,
}: {
  porMes: { mes: string; total: number }[]
  orcamentoPrevisto: number | null
}) {
  const max = Math.max(...porMes.map(m => m.total)) || 1
  const [selectedMes, setSelectedMes] = useState<string | null>(null)

  function toggleMes(mes: string) {
    setSelectedMes(prev => prev === mes ? null : mes)
  }

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
      {/* Esquerda: barras (click pra selecionar) */}
      <div>
        <h3 className="mb-5 flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
          <CalendarDays className="h-4 w-4 text-[var(--ink-soft)]" />
          Gastos por mês
        </h3>
        <div className="flex items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
          {porMes.map(m => {
            const h = (m.total / max) * 100
            const isSelected = selectedMes === m.mes
            const algumSelecionado = selectedMes !== null
            return (
              <button
                key={m.mes}
                type="button"
                onClick={() => toggleMes(m.mes)}
                aria-pressed={isSelected}
                className="group flex min-w-[64px] flex-1 shrink-0 cursor-pointer flex-col items-stretch focus:outline-none sm:min-w-[80px]"
                aria-label={`${formatMes(m.mes)}: ${formatBRL(m.total)}. ${isSelected ? 'Selecionado, clique pra limpar' : 'Clique pra detalhar'}`}
              >
                <p
                  className={cn(
                    'mb-2 text-center text-[11px] font-semibold tabular-nums transition-colors duration-200',
                    isSelected ? 'text-[var(--ink)]'
                      : algumSelecionado ? 'text-[var(--ink-faint)]'
                      : 'text-[var(--ink-soft)]',
                  )}
                >
                  {formatBRLcurto(m.total)}
                </p>

                <div className="flex h-40 items-end">
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-all duration-200 ease-out',
                      isSelected
                        ? 'bg-[var(--ink)] shadow-[0_1px_3px_rgba(11,16,32,0.08)]'
                        : algumSelecionado
                        ? 'bg-[var(--ink)]/10 group-hover:bg-[var(--ink)]/25'
                        : 'bg-[var(--ink)]/20 group-hover:bg-[var(--ink)]/35',
                    )}
                    style={{ height: `${Math.max(h, 4)}%` }}
                  />
                </div>

                <div className="mt-0 border-t border-[var(--line)] pt-2">
                  <p
                    className={cn(
                      'text-center text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-200',
                      isSelected ? 'text-[var(--ink)]'
                        : algumSelecionado ? 'text-[var(--ink-faint)]'
                        : 'text-[var(--ink-soft)]',
                    )}
                  >
                    {formatMes(m.mes)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Direita: acumulado vs orçamento (compartilha selectedMes com as barras) */}
      <div className="md:border-l md:border-[var(--line)] md:pl-8">
        <AcumuladoChart
          porMes={porMes}
          orcamentoPrevisto={orcamentoPrevisto}
          selectedMes={selectedMes}
          onSelectMes={setSelectedMes}
        />
      </div>
    </div>
  )
}

function AcumuladoChart({
  porMes, orcamentoPrevisto, selectedMes, onSelectMes,
}: {
  porMes: { mes: string; total: number }[]
  orcamentoPrevisto: number | null
  selectedMes: string | null
  onSelectMes: (mes: string | null) => void
}) {
  // Acumulado mês a mês
  const acumulado: { mes: string; valor: number }[] = []
  let soma = 0
  for (const m of porMes) {
    soma += m.total
    acumulado.push({ mes: m.mes, valor: soma })
  }
  const n = acumulado.length
  const maxAcumulado = acumulado[n - 1]?.valor ?? 0
  const escala = Math.max(maxAcumulado, orcamentoPrevisto ?? 0) * 1.12 || 1

  // Pontos em coordenadas viewBox 0..100 (centro do slice de cada mês)
  const pontos = acumulado.map((d, i) => ({
    mes: d.mes,
    valor: d.valor,
    x: ((i + 0.5) / Math.max(n, 1)) * 100,
    y: 100 - (d.valor / escala) * 100,
  }))

  const metaY = orcamentoPrevisto ? 100 - (orcamentoPrevisto / escala) * 100 : null
  const lastPoint = pontos[n - 1] ?? null

  // Curva suave: bezier cúbica entre pontos (Catmull-Rom estilo)
  const linhaSuave = buildSmoothPath(pontos, 0.22)
  const areaSuave = linhaSuave && pontos.length > 1
    ? `${linhaSuave} L ${pontos[n - 1].x},100 L ${pontos[0].x},100 Z`
    : ''
  const selectedPoint = selectedMes ? pontos.find(p => p.mes === selectedMes) ?? null : null
  const displayPoint = selectedPoint ?? lastPoint
  const displayValor = displayPoint?.valor ?? 0
  const pctOrcamento = orcamentoPrevisto && orcamentoPrevisto > 0
    ? (displayValor / orcamentoPrevisto) * 100
    : null
  const acima = pctOrcamento != null && pctOrcamento > 100

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-bright)]">
            {selectedMes ? `${formatMes(selectedMes)} · Acumulado` : 'Acumulado da obra'}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <p className={cn(
              'font-display text-lg font-bold',
              acima ? 'text-rose-700' : 'text-[var(--ink)]',
            )}>
              {formatBRL(displayValor)}
            </p>
            {pctOrcamento != null ? (
              <p className={cn(
                'text-xs',
                acima ? 'font-semibold text-rose-700' : 'text-[var(--ink-soft)]',
              )}>
                {pctOrcamento.toFixed(1)}% do orçamento{acima && ' · acima do previsto'}
              </p>
            ) : (
              <p className="text-xs text-[var(--ink-soft)]">sem orçamento previsto</p>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[var(--ink-faint)]">
            {selectedMes
              ? 'Clique no mês de novo pra limpar.'
              : 'Clique num mês pra ver o acumulado naquele ponto.'}
          </p>
        </div>
        {selectedMes && (
          <button
            type="button"
            onClick={() => onSelectMes(null)}
            className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
            aria-label="Limpar mês selecionado"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Área do gráfico */}
      <div className="relative h-40">
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="acumulado-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Linha-meta (orçamento) */}
          {metaY != null && metaY >= 0 && metaY <= 100 && (
            <line
              x1="0" y1={metaY} x2="100" y2={metaY}
              stroke={acima ? 'rgb(225, 29, 72)' : 'var(--ink-faint)'}
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Área suave com gradiente abaixo da curva */}
          {areaSuave && (
            <path d={areaSuave} fill="url(#acumulado-fill)" />
          )}

          {/* Linha do acumulado (curva suave) */}
          {linhaSuave && pontos.length > 1 && (
            <path
              d={linhaSuave}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Guia vertical no mês selecionado */}
          {selectedPoint && (
            <line
              x1={selectedPoint.x} y1={selectedPoint.y}
              x2={selectedPoint.x} y2="100"
              stroke="var(--ink)"
              strokeWidth="1"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Label da meta */}
        {metaY != null && metaY >= 0 && metaY <= 100 && orcamentoPrevisto != null && (
          <div
            className={cn(
              'absolute right-0 -translate-y-1/2 rounded bg-white px-1 text-[9px] font-bold uppercase tracking-[0.12em]',
              acima ? 'text-rose-700' : 'text-[var(--ink-faint)]',
            )}
            style={{ top: `${metaY}%` }}
          >
            Meta · {formatBRLcurto(orcamentoPrevisto)}
          </div>
        )}

        {/* Pontos */}
        {pontos.map(p => {
          const isSelected = p.mes === selectedMes
          const isLast = !selectedMes && p.mes === lastPoint?.mes
          return (
            <div
              key={p.mes}
              aria-hidden
              className={cn(
                'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200',
                isSelected
                  ? 'h-3 w-3 bg-[var(--ink)] ring-4 ring-[var(--ink)]/15'
                  : isLast
                  ? 'h-2.5 w-2.5 bg-[var(--ink)] ring-2 ring-[var(--ink)]/10'
                  : 'h-1.5 w-1.5 bg-[var(--ink)]/55',
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          )
        })}

        {/* Zonas clicáveis (uma por mês, ocupam altura total) */}
        <div className="absolute inset-0 flex">
          {porMes.map(m => (
            <button
              key={m.mes}
              type="button"
              onClick={() => onSelectMes(selectedMes === m.mes ? null : m.mes)}
              aria-pressed={selectedMes === m.mes}
              aria-label={`Acumulado em ${formatMes(m.mes)}`}
              className="flex-1 cursor-pointer focus:outline-none focus-visible:bg-[var(--brand-bright)]/5"
            />
          ))}
        </div>
      </div>

      {/* Labels do eixo X */}
      <div className="mt-2 flex border-t border-[var(--line)] pt-2">
        {porMes.map(m => {
          const isSelected = selectedMes === m.mes
          const algumSel = selectedMes !== null
          return (
            <p
              key={m.mes}
              className={cn(
                'flex-1 text-center text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-200',
                isSelected ? 'text-[var(--ink)]'
                  : algumSel ? 'text-[var(--ink-faint)]'
                  : 'text-[var(--ink-soft)]',
              )}
            >
              {formatMes(m.mes)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function SortableHeader({
  label, column, align, className,
  sortColumn, sortDir, onSort,
}: {
  label: string
  column: GastoSortColumn
  align: 'left' | 'right'
  className?: string
  sortColumn: GastoSortColumn
  sortDir: SortDirection
  onSort: (column: GastoSortColumn) => void
}) {
  const active = sortColumn === column
  const Icon = sortDir === 'asc' ? ChevronUp : ChevronDown
  return (
    <th className={cn('py-3', align === 'right' ? 'text-right' : 'text-left', className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 rounded-sm text-[10px] font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
          active
            ? 'text-[var(--ink)]'
            : 'text-[var(--ink-faint)] hover:text-[var(--ink-soft)]',
        )}
      >
        {align === 'right' && active && <Icon className="h-3 w-3" />}
        {label}
        {align === 'left' && active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  )
}

function FilterChip({ label, cor, onRemove }: { label: string; cor?: string | null; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white py-1 pl-2.5 pr-1 text-xs font-semibold text-[var(--ink)]"
    >
      {cor && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      )}
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function FiltrosSheet({
  open, onClose, onApply,
  filtroCategoriasIds, filtroDataInicio, filtroDataFim,
  categoriasDisponiveis,
}: {
  open: boolean
  onClose: () => void
  onApply: (ids: string[], dataInicio: string | null, dataFim: string | null) => void
  filtroCategoriasIds: string[]
  filtroDataInicio: string | null
  filtroDataFim: string | null
  categoriasDisponiveis: { categoria_id: string; nome: string; cor: string | null; count: number }[]
}) {
  // Draft state: rascunho local, só commita no Aplicar
  const [draftIds, setDraftIds] = useState<string[]>(filtroCategoriasIds)
  const [draftInicio, setDraftInicio] = useState<string>(filtroDataInicio ?? '')
  const [draftFim, setDraftFim] = useState<string>(filtroDataFim ?? '')

  // Reseta o rascunho toda vez que o sheet abre (caso o usuário tenha removido chips fora)
  useEffect(() => {
    if (open) {
      setDraftIds(filtroCategoriasIds)
      setDraftInicio(filtroDataInicio ?? '')
      setDraftFim(filtroDataFim ?? '')
    }
  }, [open, filtroCategoriasIds, filtroDataInicio, filtroDataFim])

  function toggleCategoria(id: string) {
    setDraftIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function aplicar() {
    onApply(draftIds, draftInicio || null, draftFim || null)
  }

  function limparTudo() {
    setDraftIds([])
    setDraftInicio('')
    setDraftFim('')
  }

  const rangeInvalido = !!(draftInicio && draftFim && draftInicio > draftFim)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-white p-0 sm:max-w-md">
        <SheetHeader className="border-b border-[var(--line)] px-6 py-5">
          <SheetTitle className="font-display text-lg font-bold text-[var(--ink)]">
            Filtros
          </SheetTitle>
          <p className="text-sm text-[var(--ink-soft)]">
            Selecione categorias e período. Aplique pra ver o resultado.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Categorias (multi) */}
          <section>
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Categorias
              </p>
              {draftIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftIds([])}
                  className="cursor-pointer text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="mt-3 space-y-1">
              {categoriasDisponiveis.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--ink-soft)]">
                  Sem gastos lançados ainda.
                </p>
              ) : (
                categoriasDisponiveis.map(c => (
                  <CategoriaCheckbox
                    key={c.categoria_id}
                    label={c.nome}
                    hint={`${c.count} ${c.count === 1 ? 'lançamento' : 'lançamentos'}`}
                    cor={c.cor}
                    checked={draftIds.includes(c.categoria_id)}
                    onToggle={() => toggleCategoria(c.categoria_id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Período por data */}
          <section className="mt-7">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Período
              </p>
              {(draftInicio || draftFim) && (
                <button
                  type="button"
                  onClick={() => { setDraftInicio(''); setDraftFim('') }}
                  className="cursor-pointer text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  De
                </span>
                <Input
                  type="date"
                  value={draftInicio}
                  max={draftFim || undefined}
                  onChange={e => setDraftInicio(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Até
                </span>
                <Input
                  type="date"
                  value={draftFim}
                  min={draftInicio || undefined}
                  onChange={e => setDraftFim(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </label>
            </div>
            {rangeInvalido && (
              <p className="mt-2 text-xs font-semibold text-rose-700">
                A data inicial é depois da data final.
              </p>
            )}
          </section>
        </div>

        <SheetFooter className="flex flex-row items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--paper)]/40 px-6 py-4">
          <button
            type="button"
            onClick={limparTudo}
            className="cursor-pointer text-sm font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline"
          >
            Limpar tudo
          </button>
          <Button onClick={aplicar} disabled={rangeInvalido} className="px-5">
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function CategoriaCheckbox({
  label, hint, cor, checked, onToggle,
}: {
  label: string
  hint?: string
  cor: string | null
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
        checked
          ? 'bg-[var(--brand-tint)] text-[var(--ink)]'
          : 'hover:bg-[var(--paper)] text-[var(--ink-soft)] hover:text-[var(--ink)]',
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-2.5">
        {/* Checkbox visual (sem nativo: square + check) */}
        <span
          className={cn(
            'grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-all',
            checked
              ? 'border-[var(--ink)] bg-[var(--ink)]'
              : 'border-[var(--line)] bg-white',
          )}
          aria-hidden
        >
          {checked && (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.5L5 9l4.5-5" />
            </svg>
          )}
        </span>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cor ?? 'var(--line)' }}
          aria-hidden
        />
        <span className={cn('truncate text-sm', checked ? 'font-semibold' : 'font-medium')}>
          {label}
        </span>
      </span>
      {hint && (
        <span className="shrink-0 text-xs text-[var(--ink-faint)]">{hint}</span>
      )}
    </button>
  )
}

function formatPeriodoChip(inicio: string | null, fim: string | null): string {
  if (inicio && fim) {
    const [yi, mi, di] = inicio.split('-')
    const [yf, mf, df] = fim.split('-')
    return `${di}/${mi}/${yi} → ${df}/${mf}/${yf}`
  }
  if (inicio) {
    const [y, m, d] = inicio.split('-')
    return `Desde ${d}/${m}/${y}`
  }
  if (fim) {
    const [y, m, d] = fim.split('-')
    return `Até ${d}/${m}/${y}`
  }
  return ''
}
