'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Plus, Pencil, Trash2, Copy, Check, MessageCircle, Send, X as XIcon,
  AlertCircle, CalendarDays, MapPin, FileText, Share2, Printer, RotateCcw, ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { RefreshButton } from '@/components/ui/refresh-button'
import { generateWhatsappReport } from '@/lib/cotacao-report'
import { WhatsappPickerDialog } from '@/components/cotacoes/whatsapp-picker-dialog'
import {
  getCotacao,
  addCotacaoItem,
  updateCotacaoItem,
  removeCotacaoItem,
  addCotacaoFornecedor,
  removeCotacaoFornecedor,
  setCotacaoStatus,
  deleteCotacao,
  type CotacaoDetail,
} from '@/app/actions/cotacoes-actions'
import { MapaComparativo } from '@/components/cotacoes/mapa-comparativo'
import { listFornecedores, listUnidadesMedida, listCategoriasCusto, upsertItemCatalogo } from '@/app/actions/compras-actions'
import { ItemAutocomplete } from '@/components/compras/item-autocomplete'
import type {
  Fornecedor, UnidadeMedida, CategoriaCusto, CotacaoStatus, CotacaoFornecedorStatus,
} from '@/types/compras'
import { COTACAO_STATUS_LABEL, COTACAO_FORNECEDOR_STATUS_LABEL } from '@/types/compras'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<CotacaoStatus, string> = {
  RASCUNHO:   'bg-[var(--paper)] text-[var(--ink-soft)]',
  ENVIADA:    'bg-[var(--brand-tint)] text-[var(--brand-bright)]',
  RECEBENDO:  'bg-amber-50 text-amber-700',
  FECHADA:    'bg-emerald-50 text-emerald-700',
  CANCELADA:  'bg-rose-50 text-rose-700',
}

const ENVELOPE_TONE: Record<CotacaoFornecedorStatus, string> = {
  PENDENTE:   'bg-[var(--paper)] text-[var(--ink-soft)]',
  ABERTA:     'bg-amber-50 text-amber-700',
  RESPONDIDA: 'bg-emerald-50 text-emerald-700',
  RECUSADA:   'bg-rose-50 text-rose-700',
}

function formatDateBR(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function buildPublicUrl(token: string) {
  if (typeof window === 'undefined') return `/cotacao/${token}`
  return `${window.location.origin}/cotacao/${token}`
}

function buildWhatsappUrl(telefone: string | null, mensagem: string) {
  const cleaned = (telefone ?? '').replace(/\D/g, '')
  const numero = cleaned.length >= 10
    ? (cleaned.length === 10 || cleaned.length === 11 ? `55${cleaned}` : cleaned)
    : ''
  // Com número: web.whatsapp.com abre direto na conversa.
  // Sem número: fallback pro wa.me genérico (picker de contato).
  if (numero) {
    return `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensagem)}`
  }
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}

export default function CotacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [detail, setDetail] = useState<CotacaoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Catálogos pra add item / add fornecedor
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [categorias, setCategorias] = useState<CategoriaCusto[]>([])
  const [todosFornecedores, setTodosFornecedores] = useState<Fornecedor[]>([])

  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null)
  const [whatsappOpen, setWhatsappOpen] = useState(false)

  // Revalidação silenciosa: refetch os dados sem mostrar skeleton.
  // Usar em qualquer ação pós-render que muda dados (toggle vencedora,
  // add/remove item, add/remove fornecedor, etc).
  const refresh = useCallback(async () => {
    setErro(null)
    try {
      const [d, u, c, f] = await Promise.all([
        getCotacao(id),
        listUnidadesMedida(),
        listCategoriasCusto({ ativosApenas: true }),
        listFornecedores({ ativosApenas: true }),
      ])
      if (!d) { router.replace('/compras/cotacoes'); return }
      setDetail(d); setUnidades(u); setCategorias(c); setTodosFornecedores(f)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar.')
    }
  }, [id, router])

  // Carga inicial: liga skeleton, depois chama refresh silencioso.
  const carregar = useCallback(async () => {
    setLoading(true)
    await refresh()
    setLoading(false)
  }, [refresh])

  useEffect(() => { void carregar() }, [carregar])

  async function comAcao<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
    setAcaoEmAndamento(nome); setErro(null)
    try {
      const r = await fn()
      await refresh()   // silencioso — não pisca skeleton
      return r
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Falhou: ${nome}`)
      return null
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  if (loading) {
    return (
      <>
        <Header eyebrow="Compras · Orçamentos" title="Carregando…" />
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 sm:px-8">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </>
    )
  }
  if (!detail) return null
  const { cotacao, itens, envelopes } = detail

  const podeEditar = cotacao.status === 'RASCUNHO' || cotacao.status === 'ENVIADA' || cotacao.status === 'RECEBENDO'
  const podeEnviar = cotacao.status === 'RASCUNHO' && itens.length > 0 && envelopes.length > 0
  const podeFechar = cotacao.status === 'ENVIADA' || cotacao.status === 'RECEBENDO'
  const podeCancelar = cotacao.status !== 'FECHADA' && cotacao.status !== 'CANCELADA'
  const podeReabrir = cotacao.status === 'FECHADA' || cotacao.status === 'CANCELADA'
  const temRespondidas = envelopes.some(e => e.status === 'RESPONDIDA')

  function imprimir() {
    window.print()
  }

  return (
    <>
      <Header
        eyebrow={`Compras · Orçamento · ${COTACAO_STATUS_LABEL[cotacao.status]}`}
        title={cotacao.titulo}
        subtitle={
          cotacao.obra
            ? [cotacao.obra.nome, cotacao.obra.cidade].filter(Boolean).join(' — ')
            : 'Sem obra vinculada (compra geral)'
        }
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Link
              href="/compras/cotacoes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              <ArrowLeft className="h-4 w-4" /> Orçamentos
            </Link>
            <RefreshButton onRefresh={refresh} />
            {podeEnviar && (
              <Button
                onClick={() => comAcao('enviar', () => setCotacaoStatus(cotacao.id, 'ENVIADA'))}
                disabled={!!acaoEmAndamento}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" /> Marcar como enviada
              </Button>
            )}
            {podeFechar && (
              <Button
                variant="outline"
                onClick={() => comAcao('fechar', () => setCotacaoStatus(cotacao.id, 'FECHADA'))}
                disabled={!!acaoEmAndamento}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" /> Fechar cotação
              </Button>
            )}
            {podeReabrir && (
              <Button
                variant="outline"
                onClick={() => comAcao('reabrir', () => setCotacaoStatus(cotacao.id, temRespondidas ? 'RECEBENDO' : 'ENVIADA'))}
                disabled={!!acaoEmAndamento}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reabrir cotação
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  onClick={() => setWhatsappOpen(true)}
                  className="cursor-pointer gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar no WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={imprimir}
                  className="cursor-pointer gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / Salvar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8">
        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Status + meta */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
              STATUS_TONE[cotacao.status],
            )}>
              {COTACAO_STATUS_LABEL[cotacao.status]}
            </span>
            {cotacao.obra && (
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-soft)]">
                <MapPin className="h-3.5 w-3.5" /> {cotacao.obra.nome}
              </span>
            )}
            {cotacao.prazo_resposta && (
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-soft)]">
                <CalendarDays className="h-3.5 w-3.5" /> Prazo {formatDateBR(cotacao.prazo_resposta)}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-3 text-xs text-[var(--ink-faint)] print:hidden">
              {podeCancelar && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Cancelar esta cotação? Fornecedores que ainda não responderam não poderão mais responder.')) {
                      void comAcao('cancelar', () => setCotacaoStatus(cotacao.id, 'CANCELADA'))
                    }
                  }}
                  className="cursor-pointer underline-offset-2 hover:text-rose-600 hover:underline"
                >
                  Cancelar cotação
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Apagar esta cotação? Esta ação não pode ser desfeita.')) {
                    void (async () => {
                      try {
                        await deleteCotacao(cotacao.id)
                        router.push('/compras/cotacoes')
                      } catch (e) {
                        setErro(e instanceof Error ? e.message : 'Falhou.')
                      }
                    })()
                  }
                }}
                className="cursor-pointer underline-offset-2 hover:text-rose-600 hover:underline"
              >
                Apagar
              </button>
            </span>
          </div>
          {cotacao.descricao && (
            <p className="mt-4 whitespace-pre-line text-sm text-[var(--ink-soft)]">{cotacao.descricao}</p>
          )}
        </section>

        {/* Itens */}
        <ItensSection
          cotacaoId={cotacao.id}
          itens={itens}
          unidades={unidades}
          categorias={categorias}
          podeEditar={podeEditar}
          onMudou={refresh}
          setErro={setErro}
        />

        {/* Fornecedores convidados */}
        <FornecedoresSection
          cotacao={cotacao}
          envelopes={envelopes}
          todosFornecedores={todosFornecedores}
          podeEditar={podeEditar}
          onMudou={refresh}
          setErro={setErro}
        />

        {/* Mapa comparativo (aparece quando há ao menos 1 resposta) */}
        <MapaComparativo
          itens={itens}
          envelopes={envelopes}
          podeMarcar={podeEditar}
          podeFechar={podeFechar}
          onFechar={async () => {
            await comAcao('fechar', () => setCotacaoStatus(cotacao.id, 'FECHADA'))
          }}
          onMudou={refresh}
          setErro={setErro}
        />
      </div>

      <WhatsappPickerDialog
        open={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
        mensagem={generateWhatsappReport(detail)}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: ITENS
// ═══════════════════════════════════════════════════════════════

function ItensSection({
  cotacaoId, itens, unidades, categorias, podeEditar, onMudou, setErro,
}: {
  cotacaoId: string
  itens: CotacaoDetail['itens']
  unidades: UnidadeMedida[]
  categorias: CategoriaCusto[]
  podeEditar: boolean
  onMudou: () => Promise<void>
  setErro: (s: string | null) => void
}) {
  const [adicionando, setAdicionando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">Itens pedidos</h2>
          <p className="text-xs text-[var(--ink-soft)]">
            Lista de base que o fornecedor vê. Ele pode adicionar/substituir ao responder.
          </p>
        </div>
        {podeEditar && !adicionando && (
          <Button variant="outline" onClick={() => setAdicionando(true)} className="gap-1.5 print:hidden">
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        )}
      </div>

      {adicionando && (
        <NovoItemInline
          cotacaoId={cotacaoId}
          unidades={unidades}
          categorias={categorias}
          onSalvo={async () => { setAdicionando(false); await onMudou() }}
          onCancelar={() => setAdicionando(false)}
          setErro={setErro}
        />
      )}

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--ink-soft)]">
          Sem itens ainda. Adicione ao menos um pra que o fornecedor saiba o que cotar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[560px]">
            <thead className="bg-[var(--paper)]">
              <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                <th className="w-10 px-3 py-2.5 text-left">#</th>
                <th className="px-3 py-2.5 text-left">Descrição</th>
                <th className="px-2 py-2.5 text-right">Qtd</th>
                <th className="px-2 py-2.5 text-left">Unidade</th>
                <th className="px-2 py-2.5 text-left">Categoria</th>
                {podeEditar && <th className="w-10 px-2 py-2.5 print:hidden" />}
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                editandoId === it.id ? (
                  <EditarItemInlineRow
                    key={it.id}
                    item={it}
                    unidades={unidades}
                    categorias={categorias}
                    onSalvo={async () => { setEditandoId(null); await onMudou() }}
                    onCancelar={() => setEditandoId(null)}
                    setErro={setErro}
                  />
                ) : (
                  <tr key={it.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2.5 text-sm font-semibold text-[var(--ink-faint)] tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-sm text-[var(--ink)]">{it.descricao}</td>
                    <td className="px-2 py-2.5 text-right text-sm text-[var(--ink)] tabular-nums">
                      {Number(it.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-2 py-2.5 text-sm text-[var(--ink-soft)]">
                      {it.unidade?.sigla ?? '—'}
                    </td>
                    <td className="px-2 py-2.5">
                      {it.categoria ? (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: it.categoria.cor ? `${it.categoria.cor}1A` : 'var(--brand-tint)',
                            color: it.categoria.cor ?? 'var(--brand-bright)',
                          }}
                        >
                          {it.categoria.nome}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--ink-faint)]">—</span>
                      )}
                    </td>
                    {podeEditar && (
                      <td className="px-2 py-2.5 text-right print:hidden">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setEditandoId(it.id)}
                            className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-[var(--brand-tint)] hover:text-[var(--brand-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
                            aria-label="Editar item"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Remover "${it.descricao}"?`)) return
                              try {
                                await removeCotacaoItem(it.id)
                                await onMudou()
                              } catch (e) {
                                setErro(e instanceof Error ? e.message : 'Falhou.')
                              }
                            }}
                            className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NovoItemInline({
  cotacaoId, unidades, categorias, onSalvo, onCancelar, setErro,
}: {
  cotacaoId: string
  unidades: UnidadeMedida[]
  categorias: CategoriaCusto[]
  onSalvo: () => Promise<void>
  onCancelar: () => void
  setErro: (s: string | null) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [unidadeId, setUnidadeId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!descricao.trim() || quantidade <= 0) {
      setErro('Descrição e quantidade são obrigatórios.')
      return
    }
    setSalvando(true)
    try {
      await addCotacaoItem(cotacaoId, {
        descricao: descricao.trim(),
        quantidade,
        unidade_id: unidadeId || null,
        categoria_id: categoriaId || null,
      })
      // Cresce o catálogo (não-bloqueante)
      void upsertItemCatalogo({
        descricao: descricao.trim(),
        unidade_padrao_id: unidadeId || null,
        categoria_padrao_id: categoriaId || null,
      }).catch(() => {})
      await onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/30 p-3.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_100px_100px_120px_auto]">
        <ItemAutocomplete
          value={descricao}
          onChange={setDescricao}
          onSelect={(s) => {
            setDescricao(s.descricao)
            if (s.unidade_padrao_id) setUnidadeId(s.unidade_padrao_id)
            if (s.categoria_padrao_id) setCategoriaId(s.categoria_padrao_id)
          }}
          placeholder="Descrição"
          autoFocus
        />
        <Input type="number" min="0" step="0.001" value={quantidade} onChange={e => setQuantidade(Number(e.target.value) || 0)} placeholder="Qtd" className="h-10 rounded-lg tabular-nums" />
        <select value={unidadeId} onChange={e => setUnidadeId(e.target.value)} className="h-10 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm">
          <option value="">Unidade</option>
          {unidades.map(u => <option key={u.id} value={u.id}>{u.sigla}</option>)}
        </select>
        <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="h-10 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm">
          <option value="">Categoria</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <Button onClick={salvar} disabled={salvando} className="h-10 px-3">
            {salvando ? '…' : 'Adicionar'}
          </Button>
          <button
            type="button"
            onClick={onCancelar}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            aria-label="Cancelar"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function EditarItemInlineRow({
  item, unidades, categorias, onSalvo, onCancelar, setErro,
}: {
  item: CotacaoDetail['itens'][number]
  unidades: UnidadeMedida[]
  categorias: CategoriaCusto[]
  onSalvo: () => Promise<void>
  onCancelar: () => void
  setErro: (s: string | null) => void
}) {
  const [descricao, setDescricao] = useState(item.descricao)
  const [quantidade, setQuantidade] = useState<number>(Number(item.quantidade))
  const [unidadeId, setUnidadeId] = useState(item.unidade_id ?? '')
  const [categoriaId, setCategoriaId] = useState(item.categoria_id ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!descricao.trim() || quantidade <= 0) {
      setErro('Descrição e quantidade são obrigatórios.')
      return
    }
    setSalvando(true)
    try {
      await updateCotacaoItem(item.id, {
        descricao: descricao.trim(),
        quantidade,
        unidade_id: unidadeId || null,
        categoria_id: categoriaId || null,
      })
      await onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <tr className="border-t border-[var(--brand-bright)]/30 bg-[var(--brand-tint)]/20">
      <td colSpan={6} className="p-2.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_90px_90px_140px_auto]">
          <ItemAutocomplete
            value={descricao}
            onChange={setDescricao}
            onSelect={(s) => {
              setDescricao(s.descricao)
              if (s.unidade_padrao_id) setUnidadeId(s.unidade_padrao_id)
              if (s.categoria_padrao_id) setCategoriaId(s.categoria_padrao_id)
            }}
            placeholder="Descrição"
            autoFocus
          />
          <Input
            type="number"
            min="0"
            step="0.001"
            value={quantidade}
            onChange={e => setQuantidade(Number(e.target.value) || 0)}
            placeholder="Qtd"
            className="h-9 rounded-lg tabular-nums"
          />
          <select
            value={unidadeId}
            onChange={e => setUnidadeId(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
          >
            <option value="">Unidade</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.sigla}</option>)}
          </select>
          <select
            value={categoriaId}
            onChange={e => setCategoriaId(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
          >
            <option value="">Categoria</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <Button onClick={salvar} disabled={salvando} className="h-9 px-3">
              {salvando ? '…' : 'Salvar'}
            </Button>
            <button
              type="button"
              onClick={onCancelar}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-white hover:text-[var(--ink)]"
              aria-label="Cancelar"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: FORNECEDORES (envelopes)
// ═══════════════════════════════════════════════════════════════

function FornecedoresSection({
  cotacao, envelopes, todosFornecedores, podeEditar, onMudou, setErro,
}: {
  cotacao: CotacaoDetail['cotacao']
  envelopes: CotacaoDetail['envelopes']
  todosFornecedores: Fornecedor[]
  podeEditar: boolean
  onMudou: () => Promise<void>
  setErro: (s: string | null) => void
}) {
  const [adicionandoOpen, setAdicionandoOpen] = useState(false)
  const jaConvidados = new Set(envelopes.map(e => e.fornecedor_id))
  const disponiveis = todosFornecedores.filter(f => !jaConvidados.has(f.id))

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">Fornecedores convidados</h2>
          <p className="text-xs text-[var(--ink-soft)]">
            Cada um tem um link único de resposta. Copie ou abra no WhatsApp.
          </p>
        </div>
        {podeEditar && (
          <Button variant="outline" onClick={() => setAdicionandoOpen(v => !v)} className="gap-1.5 print:hidden">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        )}
      </div>

      {adicionandoOpen && podeEditar && (
        <div className="mb-4 rounded-xl border border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/30 p-3.5">
          {disponiveis.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">Todos os fornecedores ativos já estão convidados.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {disponiveis.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={async () => {
                    try {
                      await addCotacaoFornecedor(cotacao.id, f.id)
                      setAdicionandoOpen(false)
                      await onMudou()
                    } catch (e) {
                      setErro(e instanceof Error ? e.message : 'Falhou.')
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-sm transition-all hover:border-[var(--brand-bright)]/40"
                >
                  <Plus className="h-3.5 w-3.5 text-[var(--brand-bright)]" />
                  <span className="truncate font-semibold text-[var(--ink)]">{f.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {envelopes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--ink-soft)]">
          Nenhum fornecedor convidado. Adicione ao menos um pra gerar links.
        </p>
      ) : (
        <div className="space-y-2.5">
          {envelopes.map(env => (
            <EnvelopeRow
              key={env.id}
              envelope={env}
              cotacaoTitulo={cotacao.titulo}
              obraNome={cotacao.obra?.nome ?? null}
              podeEditar={podeEditar}
              onMudou={onMudou}
              setErro={setErro}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function EnvelopeRow({
  envelope, cotacaoTitulo, obraNome, podeEditar, onMudou, setErro,
}: {
  envelope: CotacaoDetail['envelopes'][number]
  cotacaoTitulo: string
  obraNome: string | null
  podeEditar: boolean
  onMudou: () => Promise<void>
  setErro: (s: string | null) => void
}) {
  const [copiado, setCopiado] = useState(false)
  const url = buildPublicUrl(envelope.token)
  const mensagem = [
    `Olá! Solicito orçamento: *${cotacaoTitulo}*.`,
    obraNome ? `Obra: ${obraNome}.` : null,
    `Acesse o link pra ver os itens e responder:`,
    url,
  ].filter(Boolean).join('\n')
  const whatsappUrl = buildWhatsappUrl(envelope.fornecedor?.telefone ?? null, mensagem)

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('Não consegui copiar pra área de transferência.')
    }
  }

  const respondida = envelope.status === 'RESPONDIDA'
  const totalResposta = envelope.respostas.reduce((s, r) => s + Number(r.preco_total ?? 0), 0)

  return (
    <div className="rounded-xl border border-[var(--line)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-[var(--ink)]">
              {envelope.fornecedor?.nome ?? '(fornecedor removido)'}
            </p>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              ENVELOPE_TONE[envelope.status],
            )}>
              {COTACAO_FORNECEDOR_STATUS_LABEL[envelope.status]}
            </span>
          </div>
          {(envelope.fornecedor?.telefone || envelope.fornecedor?.email) && (
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
              {[envelope.fornecedor.telefone, envelope.fornecedor.email].filter(Boolean).join(' · ')}
            </p>
          )}
          {respondida && (
            <div className="mt-2 text-xs text-[var(--ink-soft)]">
              {envelope.respostas.length} {envelope.respostas.length === 1 ? 'item respondido' : 'itens respondidos'}
              {totalResposta > 0 && (
                <> · Total <span className="font-bold text-[var(--ink)]">
                  {totalResposta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span></>
              )}
              {envelope.prazo_entrega_dias != null && (
                <> · Entrega em {envelope.prazo_entrega_dias} {envelope.prazo_entrega_dias === 1 ? 'dia' : 'dias'}</>
              )}
            </div>
          )}
        </div>

        {podeEditar && !respondida && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Remover ${envelope.fornecedor?.nome ?? 'este fornecedor'} da cotação?`)) return
              try {
                await removeCotacaoFornecedor(envelope.id)
                await onMudou()
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Falhou.')
              }
            }}
            className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 print:hidden"
            aria-label="Remover fornecedor"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Link + ações */}
      <div className="mt-3 flex flex-wrap items-stretch gap-2 print:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)]/50 px-3 py-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
          <code className="truncate text-xs text-[var(--ink-soft)]">{url}</code>
        </div>
        <button
          type="button"
          onClick={copiarLink}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--ink)] transition-all hover:border-[var(--brand-bright)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
        >
          {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
      </div>
    </div>
  )
}
