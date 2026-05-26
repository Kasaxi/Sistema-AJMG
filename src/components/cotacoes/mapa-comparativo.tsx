'use client'

import { useState, useEffect } from 'react'
import { Check, Trophy, Sparkles, MessageSquare } from 'lucide-react'
import { marcarRespostaVencedora } from '@/app/actions/cotacoes-actions'
import type { CotacaoDetail } from '@/app/actions/cotacoes-actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface MapaProps {
  itens: CotacaoDetail['itens']
  envelopes: CotacaoDetail['envelopes']
  podeMarcar: boolean   // false quando cotação tá FECHADA ou CANCELADA
  podeFechar: boolean
  onFechar: () => Promise<void>
  onMudou: () => Promise<void>
  setErro: (msg: string | null) => void
}

export function MapaComparativo({ itens, envelopes, podeMarcar, podeFechar, onFechar, onMudou, setErro }: MapaProps) {
  const [fechando, setFechando] = useState(false)
  // Local optimistic copy: clique no toggle atualiza local imediatamente,
  // depois o server action persiste e o parent revalida em background.
  // Resincroniza quando o prop muda (após o refresh do parent).
  const [envelopesLocal, setEnvelopesLocal] = useState(envelopes)
  useEffect(() => { setEnvelopesLocal(envelopes) }, [envelopes])

  const respondidos = envelopesLocal.filter(e => e.status === 'RESPONDIDA')
  const [toggling, setToggling] = useState<string | null>(null)

  if (respondidos.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
          <Trophy className="h-5 w-5" />
        </span>
        <p className="mt-3 font-display text-base font-semibold text-[var(--ink)]">
          Aguardando respostas
        </p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          O comparativo aparece quando ao menos um fornecedor enviar a proposta.
        </p>
      </section>
    )
  }

  // ── Normaliza dados pra tabela ───────────────────────────
  // 1. Linhas dos itens sugeridos (uma por item da cotacao)
  // 2. Linhas extras: cada resposta com item_id=null vira sua linha própria,
  //    aparece só na coluna do fornecedor que a propôs

  type SuggestedRow = {
    kind: 'suggested'
    key: string
    item: CotacaoDetail['itens'][number]
    // celula por envelope.id → resposta (ou null se fornecedor não cotou esse item)
    cells: Map<string, CotacaoDetail['envelopes'][number]['respostas'][number] | null>
  }
  type ExtraRow = {
    kind: 'extra'
    key: string
    envelopeId: string
    fornecedorNome: string
    resposta: CotacaoDetail['envelopes'][number]['respostas'][number]
  }
  type Row = SuggestedRow | ExtraRow

  const suggestedRows: SuggestedRow[] = itens.map(item => {
    const cells = new Map<string, CotacaoDetail['envelopes'][number]['respostas'][number] | null>()
    for (const env of respondidos) {
      const resp = env.respostas.find(r => r.item_id === item.id) ?? null
      cells.set(env.id, resp)
    }
    return { kind: 'suggested', key: `item:${item.id}`, item, cells }
  })

  const extraRows: ExtraRow[] = []
  for (const env of respondidos) {
    for (const r of env.respostas) {
      if (r.item_id === null) {
        extraRows.push({
          kind: 'extra',
          key: `extra:${r.id}`,
          envelopeId: env.id,
          fornecedorNome: env.fornecedor?.nome ?? 'Fornecedor',
          resposta: r,
        })
      }
    }
  }

  const rows: Row[] = [...suggestedRows, ...extraRows]

  // ── Totais por envelope (soma de TODAS as respostas, sugeridas + extras) ───
  const totaisPorEnvelope = new Map<string, number>()
  for (const env of respondidos) {
    let soma = 0
    for (const r of env.respostas) {
      soma += Number(r.preco_total ?? 0)
    }
    totaisPorEnvelope.set(env.id, soma)
  }
  const menorTotal = Math.min(...[...totaisPorEnvelope.values()])

  // ── Toggle vencedora (otimista + radio-por-linha) ───────
  // Quando marca um vencedor num item sugerido, auto-desliga
  // outros vencedores do MESMO item (radio por linha).
  // Para extras (item_id=null), cada linha é independente.
  async function toggle(respostaId: string, atual: boolean) {
    const novo = !atual

    // Acha o item_id desta resposta
    let item_id: string | null | undefined
    for (const env of envelopesLocal) {
      const r = env.respostas.find(x => x.id === respostaId)
      if (r) { item_id = r.item_id; break }
    }

    // Outros vencedores da mesma linha (item_id) que precisam ser desligados
    const desligar: string[] = []
    if (novo && item_id) {
      for (const env of envelopesLocal) {
        for (const r of env.respostas) {
          if (r.item_id === item_id && r.id !== respostaId && r.vencedora) {
            desligar.push(r.id)
          }
        }
      }
    }

    // 1. Optimistic: aplica todas as mudanças locais juntas
    setEnvelopesLocal(prev => prev.map(env => ({
      ...env,
      respostas: env.respostas.map(r => {
        if (r.id === respostaId) return { ...r, vencedora: novo }
        if (desligar.includes(r.id)) return { ...r, vencedora: false }
        return r
      }),
    })))

    setToggling(respostaId)
    setErro(null)
    try {
      // 2. Persiste no servidor (em paralelo)
      await Promise.all([
        marcarRespostaVencedora(respostaId, novo),
        ...desligar.map(id => marcarRespostaVencedora(id, false)),
      ])
      // 3. Revalidação silenciosa pra alinhar com o servidor
      await onMudou()
    } catch (e) {
      // Reverte tudo
      setEnvelopesLocal(prev => prev.map(env => ({
        ...env,
        respostas: env.respostas.map(r => {
          if (r.id === respostaId) return { ...r, vencedora: atual }
          if (desligar.includes(r.id)) return { ...r, vencedora: true }
          return r
        }),
      })))
      setErro(e instanceof Error ? e.message : 'Falhou ao marcar.')
    } finally {
      setToggling(null)
    }
  }

  async function fecharCotacao() {
    setFechando(true)
    try { await onFechar() } finally { setFechando(false) }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
            <Trophy className="h-4 w-4 text-[var(--brand-bright)]" />
            Comparativo de respostas
          </h2>
          <p className="text-xs text-[var(--ink-soft)]">
            {!podeMarcar
              ? `${respondidos.length} ${respondidos.length === 1 ? 'fornecedor respondeu' : 'fornecedores responderam'}. Cotação fechada — vencedoras travadas.`
              : respondidos.length === 1
              ? '1 fornecedor respondeu. Clique no preço pra marcar vencedora.'
              : `${respondidos.length} fornecedores responderam. Menor preço por linha em destaque. Clique pra marcar vencedora.`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[640px]">
          <thead className="bg-[var(--paper)]">
            <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              <th className="w-[280px] px-3 py-2.5 text-left">Item</th>
              {respondidos.map(env => (
                <th
                  key={env.id}
                  className="px-3 py-2.5 text-right"
                  style={{ minWidth: 160 }}
                >
                  <p className="truncate text-[11px] font-bold text-[var(--ink)] normal-case tracking-normal">
                    {env.fornecedor?.nome ?? 'Fornecedor'}
                  </p>
                  {env.prazo_entrega_dias != null && (
                    <p className="mt-0.5 text-[9px] font-semibold tracking-[0.1em] text-[var(--ink-faint)]">
                      Entrega: {env.prazo_entrega_dias} {env.prazo_entrega_dias === 1 ? 'dia' : 'dias'}
                    </p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              if (row.kind === 'suggested') {
                // Cells dos sugeridos
                const precos = [...row.cells.values()]
                  .filter((r): r is NonNullable<typeof r> => r != null && Number(r.preco_unitario) > 0)
                  .map(r => Number(r.preco_unitario))
                // Só destaca "menor preço" quando há comparação real (2+ preços)
                const menorPreco = precos.length > 1 ? Math.min(...precos) : null

                return (
                  <tr key={row.key} className="border-t border-[var(--line)]">
                    <td className="px-3 py-3 align-top">
                      <p className="text-sm font-semibold text-[var(--ink)]">{row.item.descricao}</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-soft)] tabular-nums">
                        {Number(row.item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        {row.item.unidade?.sigla && ` ${row.item.unidade.sigla}`}
                      </p>
                    </td>
                    {respondidos.map(env => {
                      const r = row.cells.get(env.id)
                      return (
                        <td key={env.id} className="px-3 py-3 text-right align-top">
                          <CellResposta
                            resposta={r}
                            menorPreco={menorPreco}
                            isToggling={r ? toggling === r.id : false}
                            onToggle={r && podeMarcar ? () => toggle(r.id, r.vencedora) : undefined}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              } else {
                // Linha de extra — só aparece numa coluna
                return (
                  <tr key={row.key} className="border-t border-[var(--line)] bg-[var(--brand-tint)]/15">
                    <td className="px-3 py-3 align-top">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
                        <Sparkles className="h-3 w-3 text-[var(--brand-bright)]" />
                        {row.resposta.descricao}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ink-soft)] tabular-nums">
                        {Number(row.resposta.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        {row.resposta.unidade?.sigla && ` ${row.resposta.unidade.sigla}`}
                        {' · extra de '}
                        <span className="font-semibold">{row.fornecedorNome}</span>
                      </p>
                    </td>
                    {respondidos.map(env => (
                      <td key={env.id} className="px-3 py-3 text-right align-top">
                        {env.id === row.envelopeId ? (
                          <CellResposta
                            resposta={row.resposta}
                            menorPreco={null}
                            isToggling={toggling === row.resposta.id}
                            onToggle={podeMarcar ? () => toggle(row.resposta.id, row.resposta.vencedora) : undefined}
                          />
                        ) : (
                          <span className="text-xs text-[var(--ink-faint)]">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              }
            })}
          </tbody>
          <tfoot className="bg-[var(--paper)]">
            <tr>
              <td className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Total proposto
              </td>
              {respondidos.map(env => {
                const t = totaisPorEnvelope.get(env.id) ?? 0
                const isMenor = respondidos.length > 1 && t === menorTotal && t > 0
                return (
                  <td
                    key={env.id}
                    className={cn(
                      'px-3 py-3 text-right font-display text-base font-bold tabular-nums',
                      isMenor ? 'text-emerald-700' : 'text-[var(--ink)]',
                    )}
                  >
                    {formatBRL(t)}
                    {isMenor && (
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-600">
                        Menor total
                      </p>
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Observações por fornecedor */}
      {respondidos.some(e => e.observacoes_fornecedor) && (
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
          {respondidos
            .filter(e => e.observacoes_fornecedor)
            .map(e => (
              <div key={e.id} className="flex gap-2.5 rounded-xl bg-[var(--paper)]/50 p-3 text-xs">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--ink)]">{e.fornecedor?.nome}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[var(--ink-soft)]">
                    {e.observacoes_fornecedor}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* CTA de fechar cotação */}
      {podeFechar && (() => {
        const itensComVencedor = new Set<string>()
        let extrasMarcados = 0
        for (const env of envelopesLocal) {
          for (const r of env.respostas) {
            if (!r.vencedora) continue
            if (r.item_id) itensComVencedor.add(r.item_id)
            else extrasMarcados++
          }
        }
        const totalItens = itens.length
        const decididos = itensComVencedor.size
        const completos = totalItens > 0 && decididos === totalItens
        return (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5 print:hidden">
            <div className="min-w-0">
              <p className={cn(
                'inline-flex items-center gap-1.5 text-sm font-semibold',
                completos ? 'text-emerald-700' : decididos > 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]',
              )}>
                {completos && <Check className="h-3.5 w-3.5" />}
                {decididos} de {totalItens} {totalItens === 1 ? 'item' : 'itens'} com vencedora definida
                {extrasMarcados > 0 && (
                  <span className="text-[var(--ink-soft)] font-normal">
                    {' '}· {extrasMarcados} {extrasMarcados === 1 ? 'extra marcado' : 'extras marcados'}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                {completos
                  ? 'Tudo definido. Pode fechar pra registrar as escolhas.'
                  : decididos > 0
                  ? 'Faltam itens sem vencedora — você ainda pode fechar assim.'
                  : 'Marque os vencedores acima ou feche sem definir.'}
              </p>
            </div>
            <Button
              onClick={fecharCotacao}
              disabled={fechando}
              className="gap-1.5 px-5"
            >
              <Check className="h-4 w-4" />
              {fechando ? 'Fechando…' : 'Fechar cotação'}
            </Button>
          </div>
        )
      })()}
    </section>
  )
}

function CellResposta({
  resposta, menorPreco, isToggling, onToggle,
}: {
  resposta: CotacaoDetail['envelopes'][number]['respostas'][number] | null | undefined
  menorPreco: number | null
  isToggling: boolean
  onToggle?: () => void
}) {
  if (!resposta) {
    return <span className="text-xs text-[var(--ink-faint)]">—</span>
  }
  const preco = Number(resposta.preco_unitario)
  const total = Number(resposta.preco_total ?? 0)
  const isMenor = menorPreco != null && preco === menorPreco && preco > 0
  const vencedora = resposta.vencedora
  const interativo = !!onToggle

  const innerContent = (
    <>
      <p className={cn(
        'text-sm font-semibold tabular-nums',
        vencedora ? 'text-emerald-700' : isMenor ? 'text-emerald-700' : 'text-[var(--ink)]',
      )}>
        {formatBRL(preco)}
      </p>
      <p className="text-[10px] font-semibold tabular-nums text-[var(--ink-soft)]">
        Total {formatBRL(total)}
      </p>
      {vencedora ? (
        <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          <Check className="h-2.5 w-2.5" /> Vencedora
        </span>
      ) : isMenor ? (
        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-600 opacity-70 group-hover:opacity-100">
          Menor preço
        </span>
      ) : interativo ? (
        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-transparent group-hover:text-[var(--ink-faint)]">
          Marcar
        </span>
      ) : null}
    </>
  )

  // Quando não interativo (cotação fechada): renderiza como div, sem hover/cursor/disabled
  if (!interativo) {
    return (
      <div
        className={cn(
          'inline-flex w-full flex-col items-end rounded-lg px-2.5 py-1.5 text-right',
          vencedora && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300',
        )}
      >
        {innerContent}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isToggling}
      aria-pressed={vencedora}
      className={cn(
        'group inline-flex w-full cursor-pointer flex-col items-end rounded-lg px-2.5 py-1.5 text-right transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40 disabled:cursor-not-allowed disabled:opacity-60',
        vencedora
          ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300'
          : isMenor
          ? 'hover:bg-emerald-50/50'
          : 'hover:bg-[var(--paper)]',
      )}
    >
      {innerContent}
    </button>
  )
}
