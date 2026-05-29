'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { FormError } from '@/components/ui/form-error'
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import { listObras } from '@/app/actions/obras-actions'
import {
  listFornecedores, listUnidadesMedida, listCategoriasCusto, upsertItemCatalogo,
} from '@/app/actions/compras-actions'
import { createCotacao } from '@/app/actions/cotacoes-actions'
import { ItemAutocomplete } from '@/components/compras/item-autocomplete'
import type { Obra } from '@/types/obras'
import type { Fornecedor, UnidadeMedida, CategoriaCusto, CotacaoItemInput } from '@/types/compras'
import { cn } from '@/lib/utils'

interface ItemDraft extends CotacaoItemInput {
  _id: string  // chave local pra map (não vai pro DB)
}

function novoItem(): ItemDraft {
  return {
    _id: crypto.randomUUID(),
    descricao: '',
    quantidade: 1,
    unidade_id: null,
    categoria_id: null,
    observacoes: null,
  }
}

export default function NovaCotacaoPage() {
  const router = useRouter()

  // Catálogos
  const [obras, setObras] = useState<Obra[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [categorias, setCategorias] = useState<CategoriaCusto[]>([])
  const [carregando, setCarregando] = useState(true)

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [obraId, setObraId] = useState<string>('')
  const [prazoResposta, setPrazoResposta] = useState('')
  const [itens, setItens] = useState<ItemDraft[]>([novoItem()])
  const [fornecedorIds, setFornecedorIds] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarCatalogos = useCallback(async () => {
    setCarregando(true)
    try {
      const [o, f, u, c] = await Promise.all([
        listObras(),
        listFornecedores({ ativosApenas: true }),
        listUnidadesMedida(),
        listCategoriasCusto({ ativosApenas: true }),
      ])
      setObras(o); setFornecedores(f); setUnidades(u); setCategorias(c)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregarCatalogos() }, [carregarCatalogos])

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItens(prev => prev.map(it => it._id === id ? { ...it, ...patch } : it))
  }
  function removerItem(id: string) {
    setItens(prev => prev.length === 1 ? prev : prev.filter(it => it._id !== id))
  }
  function adicionarItem() {
    setItens(prev => [...prev, novoItem()])
  }

  function toggleFornecedor(id: string) {
    setFornecedorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function salvar() {
    setErro(null)
    if (!titulo.trim()) { setErro('Título é obrigatório.'); return }
    const itensValidos = itens.filter(it => it.descricao.trim() && it.quantidade > 0)
    if (itensValidos.length === 0) { setErro('Adicione ao menos um item com descrição e quantidade.'); return }
    if (fornecedorIds.length === 0) { setErro('Selecione ao menos um fornecedor.'); return }

    setSalvando(true)
    try {
      const cotacao = await createCotacao({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        obra_id: obraId || null,
        prazo_resposta: prazoResposta || null,
        itens: itensValidos.map((it, i) => ({
          descricao: it.descricao,
          quantidade: it.quantidade,
          unidade_id: it.unidade_id || null,
          categoria_id: it.categoria_id || null,
          observacoes: it.observacoes || null,
          ordem: i,
        })),
        fornecedor_ids: fornecedorIds,
      })

      // Cresce o catálogo com cada item da cotação (não-bloqueante).
      // Falhas individuais são ignoradas — a cotação já foi criada.
      Promise.allSettled(
        itensValidos.map(it => upsertItemCatalogo({
          descricao: it.descricao,
          unidade_padrao_id: it.unidade_id ?? null,
          categoria_padrao_id: it.categoria_id ?? null,
        }))
      ).catch(() => {})

      router.push(`/compras/cotacoes/${cotacao.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao criar a cotação.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <>
        <Header eyebrow="Compras · Orçamentos" title="Nova cotação" />
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-6 sm:px-8">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        eyebrow="Compras · Orçamentos"
        title="Nova cotação"
        subtitle="Defina título, itens e fornecedores. Salva como rascunho — você envia depois."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/compras/cotacoes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <Button onClick={salvar} disabled={salvando} className="px-5">
              {salvando ? 'Salvando…' : 'Salvar rascunho'}
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-8">
        <FormError message={erro} />

        {/* Cabeçalho da cotação */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Pedido</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex.: Material elétrico — QD 70 fase 2"
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="obra">Obra</Label>
              <select
                id="obra"
                value={obraId}
                onChange={e => setObraId(e.target.value)}
                className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
              >
                <option value="">— sem obra (compra geral) —</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}{o.cidade ? ` · ${o.cidade}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="prazo">Prazo de resposta</Label>
              <Input
                id="prazo"
                type="date"
                value={prazoResposta}
                onChange={e => setPrazoResposta(e.target.value)}
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="descricao">Descrição / contexto</Label>
              <textarea
                id="descricao"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Detalhes sobre o que precisa ser cotado, prazos, condições, etc."
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
              />
            </div>
          </div>
        </section>

        {/* Itens sugeridos */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--ink)]">Itens sugeridos</h2>
              <p className="text-xs text-[var(--ink-soft)]">
                Lista de base pro fornecedor. Ele pode adicionar/remover/substituir ao responder.
              </p>
            </div>
            <Button variant="outline" onClick={adicionarItem} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <div className="space-y-3">
            {itens.map((it, idx) => (
              <ItemRow
                key={it._id}
                item={it}
                index={idx}
                unidades={unidades}
                categorias={categorias}
                onChange={(patch) => updateItem(it._id, patch)}
                onRemove={() => removerItem(it._id)}
                disableRemove={itens.length === 1}
              />
            ))}
          </div>
        </section>

        {/* Fornecedores */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--ink)]">Fornecedores convidados</h2>
              <p className="text-xs text-[var(--ink-soft)]">
                Cada fornecedor recebe um link único. Selecione 2 ou mais pra comparar preços.
              </p>
            </div>
            <p className="text-xs font-semibold text-[var(--ink-soft)] tabular-nums">
              {fornecedorIds.length} {fornecedorIds.length === 1 ? 'selecionado' : 'selecionados'}
            </p>
          </div>

          {fornecedores.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--ink-soft)]">
              Sem fornecedores cadastrados.{' '}
              <Link href="/compras/fornecedores" className="font-semibold text-[var(--brand-bright)] underline-offset-2 hover:underline">
                Cadastre um fornecedor
              </Link>
              {' '}primeiro.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {fornecedores.map(f => {
                const checked = fornecedorIds.includes(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleFornecedor(f.id)}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
                      checked
                        ? 'border-[var(--ink)] bg-[var(--brand-tint)]'
                        : 'border-[var(--line)] hover:border-[var(--brand-bright)]/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-all',
                        checked ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-[var(--line)] bg-white',
                      )}
                      aria-hidden
                    >
                      {checked && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5L5 9l4.5-5" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{f.nome}</p>
                      {(f.telefone || f.email) && (
                        <p className="truncate text-xs text-[var(--ink-soft)]">
                          {[f.telefone, f.email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function ItemRow({
  item, index, unidades, categorias, onChange, onRemove, disableRemove,
}: {
  item: ItemDraft
  index: number
  unidades: UnidadeMedida[]
  categorias: CategoriaCusto[]
  onChange: (patch: Partial<ItemDraft>) => void
  onRemove: () => void
  disableRemove: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/40 p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-[var(--ink-soft)] ring-1 ring-inset ring-[var(--line)]">
          {index + 1}
        </span>
        <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-[1fr_100px_100px_120px]">
          <ItemAutocomplete
            value={item.descricao}
            onChange={v => onChange({ descricao: v })}
            onSelect={(s) => onChange({
              descricao: s.descricao,
              unidade_id: s.unidade_padrao_id ?? item.unidade_id,
              categoria_id: s.categoria_padrao_id ?? item.categoria_id,
            })}
            placeholder="Descrição do item"
          />
          <Input
            type="number"
            min="0"
            step="0.001"
            value={item.quantidade}
            onChange={e => onChange({ quantidade: Number(e.target.value) || 0 })}
            placeholder="Qtd"
            className="h-10 rounded-lg tabular-nums"
          />
          <select
            value={item.unidade_id ?? ''}
            onChange={e => onChange({ unidade_id: e.target.value || null })}
            className="h-10 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
          >
            <option value="">Unidade</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.sigla}</option>
            ))}
          </select>
          <select
            value={item.categoria_id ?? ''}
            onChange={e => onChange({ categoria_id: e.target.value || null })}
            className="h-10 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
          >
            <option value="">Categoria</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disableRemove}
          className="mt-1.5 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--ink-faint)]"
          aria-label="Remover item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
