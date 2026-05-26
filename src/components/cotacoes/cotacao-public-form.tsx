'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, Trash2, Send, X as XIcon, Check, CalendarDays, MapPin, AlertCircle,
} from 'lucide-react'
import { submitRespostasPublic, recusarCotacaoPublic } from '@/app/actions/cotacoes-actions'
import type { CotacaoPublicView, UnidadeMedida } from '@/types/compras'
import { cn } from '@/lib/utils'

interface Row {
  _id: string
  item_id: string | null   // se vier de um item sugerido
  descricao: string
  quantidade: number
  unidade_id: string | null
  preco_unitario: string   // string enquanto digita
  observacoes: string
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateBR(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function rowFromItem(it: CotacaoPublicView['itens'][number]): Row {
  return {
    _id: crypto.randomUUID(),
    item_id: it.id,
    descricao: it.descricao,
    quantidade: Number(it.quantidade),
    unidade_id: it.unidade_id,
    preco_unitario: '',
    observacoes: '',
  }
}

function rowFromResposta(r: CotacaoPublicView['respostas'][number]): Row {
  return {
    _id: crypto.randomUUID(),
    item_id: r.item_id,
    descricao: r.descricao,
    quantidade: Number(r.quantidade),
    unidade_id: r.unidade_id,
    preco_unitario: String(r.preco_unitario),
    observacoes: r.observacoes ?? '',
  }
}

function novoExtra(): Row {
  return {
    _id: crypto.randomUUID(),
    item_id: null,
    descricao: '',
    quantidade: 1,
    unidade_id: null,
    preco_unitario: '',
    observacoes: '',
  }
}

export function CotacaoPublicForm({ initialView }: { initialView: CotacaoPublicView }) {
  const router = useRouter()
  const { cotacao, envelope, itens, respostas, unidades } = initialView

  // Inicializa rows: se já respondeu, usa respostas; senão, usa itens sugeridos
  const respostasIniciais = respostas.length > 0
    ? respostas.map(rowFromResposta)
    : itens.map(rowFromItem)

  const [rows, setRows] = useState<Row[]>(respostasIniciais)
  const [observacoes, setObservacoes] = useState(envelope.observacoes_fornecedor ?? '')
  const [prazoEntrega, setPrazoEntrega] = useState<string>(envelope.prazo_entrega_dias?.toString() ?? '')
  const [enviando, setEnviando] = useState(false)
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoRecusa, setConfirmandoRecusa] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')

  const jaRespondeu = envelope.status === 'RESPONDIDA'

  function updateRow(id: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, ...patch } : r))
  }
  function removerRow(id: string) {
    setRows(prev => prev.filter(r => r._id !== id))
  }
  function adicionarExtra() {
    setRows(prev => [...prev, novoExtra()])
  }

  function totalGeral(): number {
    return rows.reduce((s, r) => {
      const p = Number(r.preco_unitario.replace(',', '.'))
      if (!Number.isFinite(p)) return s
      return s + p * (Number(r.quantidade) || 0)
    }, 0)
  }

  async function enviar() {
    setErro(null)

    const rowsComPreco = rows.filter(r => {
      const p = Number(r.preco_unitario.replace(',', '.'))
      return r.descricao.trim() && Number.isFinite(p) && p > 0
    })
    if (rowsComPreco.length === 0) {
      setErro('Preencha o preço de ao menos um item antes de enviar.')
      return
    }

    setEnviando(true)
    try {
      await submitRespostasPublic({
        token: envelope.token,
        respostas: rowsComPreco.map((r, i) => ({
          item_id: r.item_id,
          descricao: r.descricao.trim(),
          quantidade: r.quantidade,
          unidade_id: r.unidade_id,
          preco_unitario: Number(r.preco_unitario.replace(',', '.')),
          observacoes: r.observacoes.trim() || null,
          ordem: i,
        })),
        observacoes_fornecedor: observacoes.trim() || null,
        prazo_entrega_dias: prazoEntrega ? Number(prazoEntrega) : null,
      })
      setEnviadoComSucesso(true)
      // Recarrega a página pra refletir o novo status
      setTimeout(() => router.refresh(), 1500)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  async function recusar() {
    setErro(null)
    setEnviando(true)
    try {
      await recusarCotacaoPublic(envelope.token, motivoRecusa.trim() || undefined)
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou.')
      setEnviando(false)
    }
  }

  // Tela de sucesso pós-envio
  if (enviadoComSucesso || (jaRespondeu && !erro)) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold text-[var(--ink)]">
            {enviadoComSucesso ? 'Resposta enviada!' : 'Resposta já registrada'}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Obrigado, <span className="font-semibold">{envelope.fornecedor.nome}</span>. A AJMG vai
            analisar sua proposta. {envelope.respondida_em && `Enviada em ${new Date(envelope.respondida_em).toLocaleDateString('pt-BR')}.`}
          </p>
          {!enviadoComSucesso && (
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-4 cursor-pointer text-xs font-semibold text-[var(--brand-bright)] underline-offset-2 hover:underline"
            >
              Atualizar proposta enviada
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho da cotação */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-bright)]">
          Olá, {envelope.fornecedor.nome}
        </p>
        <h1 className="mt-1 font-display text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">
          {cotacao.titulo}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--ink-soft)]">
          {cotacao.obra && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {cotacao.obra.nome}
              {cotacao.obra.cidade && ` · ${cotacao.obra.cidade}`}
            </span>
          )}
          {cotacao.prazo_resposta && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Prazo de resposta: {formatDateBR(cotacao.prazo_resposta)}
            </span>
          )}
        </div>
        {cotacao.descricao && (
          <p className="mt-4 whitespace-pre-line border-t border-[var(--line)] pt-4 text-sm text-[var(--ink-soft)]">
            {cotacao.descricao}
          </p>
        )}
      </section>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Itens */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--ink)]">Itens pra cotar</h2>
            <p className="text-xs text-[var(--ink-soft)]">
              Preencha o preço unitário de cada item. Adicione itens extras se precisar substituir ou complementar.
            </p>
          </div>
          <Button variant="outline" onClick={adicionarExtra} className="gap-1.5">
            <Plus className="h-4 w-4" /> Item extra
          </Button>
        </div>

        <div className="space-y-2.5">
          {rows.map((row, idx) => (
            <RespostaRow
              key={row._id}
              row={row}
              index={idx + 1}
              unidades={unidades}
              onChange={(patch) => updateRow(row._id, patch)}
              onRemove={() => removerRow(row._id)}
            />
          ))}
        </div>

        {rows.length > 0 && (
          <div className="mt-4 flex items-baseline justify-end gap-3 border-t border-[var(--line)] pt-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Total proposto
            </span>
            <span className="font-display text-lg font-bold text-[var(--ink)] tabular-nums">
              {formatBRL(totalGeral())}
            </span>
          </div>
        )}
      </section>

      {/* Observações + prazo */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Sua proposta</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <Label htmlFor="prazo-entrega">Prazo de entrega (dias)</Label>
            <Input
              id="prazo-entrega"
              type="number"
              min="0"
              value={prazoEntrega}
              onChange={e => setPrazoEntrega(e.target.value)}
              placeholder="Ex.: 7"
              className="mt-1.5 h-11 rounded-xl tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor="obs">Observações gerais</Label>
            <textarea
              id="obs"
              rows={3}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Condições de pagamento, validade da proposta, etc."
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
            />
          </div>
        </div>
      </section>

      {/* Ações */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setConfirmandoRecusa(true)}
          className="cursor-pointer text-sm font-semibold text-[var(--ink-soft)] underline-offset-2 transition-colors hover:text-rose-600 hover:underline"
        >
          Não tenho interesse
        </button>
        <Button onClick={enviar} disabled={enviando} className="gap-1.5 px-6">
          <Send className="h-4 w-4" />
          {enviando ? 'Enviando…' : 'Enviar proposta'}
        </Button>
      </section>

      <p className="text-center text-xs text-[var(--ink-faint)]">
        AJMG Construtora · Pedido de Orçamento via link único
      </p>

      {/* Modal de recusa */}
      {confirmandoRecusa && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setConfirmandoRecusa(false)}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-display text-base font-bold text-[var(--ink)]">Recusar este orçamento?</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Deixe um motivo (opcional) pra ajudar a AJMG.
            </p>
            <textarea
              rows={3}
              value={motivoRecusa}
              onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Ex.: Sem estoque, prazo curto, fora da região…"
              className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoRecusa(false)}
                className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Voltar
              </button>
              <Button
                onClick={recusar}
                disabled={enviando}
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                {enviando ? 'Enviando…' : 'Confirmar recusa'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RespostaRow({
  row, index, unidades, onChange, onRemove,
}: {
  row: Row
  index: number
  unidades: UnidadeMedida[]
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
}) {
  const preco = Number(row.preco_unitario.replace(',', '.'))
  const total = Number.isFinite(preco) && preco > 0 ? preco * (Number(row.quantidade) || 0) : null
  const isExtra = row.item_id === null

  return (
    <div className={cn(
      'rounded-xl border p-3.5',
      isExtra
        ? 'border-[var(--brand-bright)]/30 bg-[var(--brand-tint)]/20'
        : 'border-[var(--line)] bg-[var(--paper)]/40',
    )}>
      <div className="flex items-start gap-3">
        <span className={cn(
          'mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ring-1 ring-inset',
          isExtra
            ? 'bg-[var(--brand-bright)] text-white ring-[var(--brand-bright)]'
            : 'bg-white text-[var(--ink-soft)] ring-[var(--line)]',
        )}>
          {isExtra ? '+' : index}
        </span>

        <div className="min-w-0 flex-1 space-y-2.5">
          {/* Linha 1: descrição (read-only pra sugeridos, editável pra extras) */}
          {isExtra ? (
            <Input
              value={row.descricao}
              onChange={e => onChange({ descricao: e.target.value })}
              placeholder="Descreva o item adicional"
              className="h-10 rounded-lg"
            />
          ) : (
            <p className="text-sm font-semibold text-[var(--ink)]">{row.descricao}</p>
          )}

          {/* Linha 2: qtd, unidade, preço unit., total */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[90px_90px_140px_1fr]">
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Qtd</p>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={row.quantidade}
                onChange={e => onChange({ quantidade: Number(e.target.value) || 0 })}
                disabled={!isExtra}
                className="h-9 rounded-lg tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Unid.</p>
              {isExtra ? (
                <select
                  value={row.unidade_id ?? ''}
                  onChange={e => onChange({ unidade_id: e.target.value || null })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
                >
                  <option value="">—</option>
                  {unidades.map(u => <option key={u.id} value={u.id}>{u.sigla}</option>)}
                </select>
              ) : (
                <Input
                  value={unidades.find(u => u.id === row.unidade_id)?.sigla ?? '—'}
                  disabled
                  className="h-9 rounded-lg disabled:cursor-not-allowed disabled:opacity-60"
                />
              )}
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Preço unit. (R$)</p>
              <Input
                type="text"
                inputMode="decimal"
                value={row.preco_unitario}
                onChange={e => onChange({ preco_unitario: e.target.value })}
                placeholder="0,00"
                className="h-9 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Total</p>
              <p className="h-9 truncate rounded-lg bg-white px-2.5 py-2 text-sm font-semibold tabular-nums text-[var(--ink)] ring-1 ring-inset ring-[var(--line)]">
                {total != null ? formatBRL(total) : '—'}
              </p>
            </div>
          </div>

          {/* Linha 3: observação opcional */}
          <Input
            value={row.observacoes}
            onChange={e => onChange({ observacoes: e.target.value })}
            placeholder="Observação do item (opcional) — marca, modelo, validade…"
            className="h-9 rounded-lg text-xs"
          />
        </div>

        {isExtra && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600"
            aria-label="Remover item extra"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
