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
} from 'lucide-react'
import { ObraForm } from '@/components/obras/obra-form'
import { GastoForm } from '@/components/compras/gasto-form'
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
  const [pagina, setPagina] = useState(1)
  const PER_PAGE = 50

  // Debounce na busca: 300ms
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 300)
    return () => clearTimeout(t)
  }, [busca])

  // Reset pra página 1 quando muda a busca
  useEffect(() => { setPagina(1) }, [buscaDebounced])

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

  // Carrega só a página de gastos (toda vez que muda página ou busca)
  const carregarGastos = useCallback(async () => {
    const { items, total } = await listGastos({
      obra_id: id,
      search: buscaDebounced || undefined,
      page: pagina,
      per_page: PER_PAGE,
    })
    setGastos(items)
    setGastosTotal(total)
  }, [id, buscaDebounced, pagina])

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
            onAdd={abrirNovoGasto}
            onEdit={editarGasto}
            totalGeral={resumo?.total ?? 0}
          />
        )}
        {aba === 'RESUMO' && resumo && <ResumoTab resumo={resumo} />}
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
  busca, onBuscaChange, onAdd, onEdit, totalGeral,
}: {
  gastos: Gasto[]
  gastosTotal: number       // total de linhas que batem com o filtro
  pagina: number
  perPage: number
  onPaginaChange: (p: number) => void
  busca: string
  onBuscaChange: (v: string) => void
  onAdd: () => void
  onEdit: (g: Gasto) => void
  totalGeral: number        // R$ total da obra (todos os gastos, não só a página)
}) {
  const totalPaginas = Math.max(1, Math.ceil(gastosTotal / perPage))
  const inicio = (pagina - 1) * perPage + 1
  const fim = Math.min(pagina * perPage, gastosTotal)
  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
        <Input
          value={busca}
          onChange={e => onBuscaChange(e.target.value)}
          placeholder="Buscar por descrição, fornecedor, observação…"
          className="h-11 rounded-xl pl-10"
        />
      </div>

      {gastos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
          <p className="font-display text-base font-semibold text-[var(--ink)]">
            {busca ? 'Nada bateu com a busca' : 'Nenhum gasto lançado ainda'}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {busca ? 'Tenta outra palavra-chave.' : 'Comece lançando o primeiro gasto desta obra.'}
          </p>
          {!busca && (
            <Button onClick={onAdd} className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" /> Lançar gasto
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full">
            <thead className="bg-[var(--paper)]">
              <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-2 py-3 text-left">Categoria</th>
                <th className="px-2 py-3 text-right">Qtd</th>
                <th className="px-2 py-3 text-right">Valor unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
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

function ResumoTab({ resumo }: { resumo: ResumoGastosObra }) {
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

      {/* Por mês */}
      {resumo.porMes.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 md:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
            <CalendarDays className="h-4 w-4 text-[var(--ink-soft)]" />
            Gastos por mês
          </h3>
          <div className="flex items-end gap-1.5">
            {(() => {
              const max = Math.max(...resumo.porMes.map(m => m.total)) || 1
              return resumo.porMes.map(m => {
                const h = (m.total / max) * 100
                return (
                  <div key={m.mes} className="flex flex-1 flex-col items-center gap-1.5" title={`${formatMes(m.mes)} — ${formatBRL(m.total)}`}>
                    <div className="flex h-32 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-[var(--brand-bright)] transition-all"
                        style={{ height: `${Math.max(h, 4)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--ink-faint)]">{formatMes(m.mes)}</span>
                  </div>
                )
              })
            })()}
          </div>
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
