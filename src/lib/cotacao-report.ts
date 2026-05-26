import type { CotacaoDetail } from '@/app/actions/cotacoes-actions'
import type { CotacaoStatus } from '@/types/compras'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtQty = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const fmtDateBR = (iso: string | null) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const SEP = '━━━━━━━━━━━━━━━━━'

const STATUS_DESCR: Record<CotacaoStatus, string> = {
  RASCUNHO:   'em rascunho',
  ENVIADA:    'enviada',
  RECEBENDO:  'recebendo respostas',
  FECHADA:    'fechada',
  CANCELADA:  'cancelada',
}

/**
 * Gera um resumo textual da cotação pronto pra colar no WhatsApp.
 * Usa formatação nativa do WhatsApp (*negrito*, _itálico_) e emojis
 * conservadores. Estrutura com separadores Unicode pra visual.
 */
export function generateWhatsappReport(detail: CotacaoDetail): string {
  const { cotacao, itens, envelopes } = detail
  const respondidos = envelopes.filter(e => e.status === 'RESPONDIDA')
  const pendentes  = envelopes.filter(e => e.status === 'PENDENTE' || e.status === 'ABERTA')
  const recusados  = envelopes.filter(e => e.status === 'RECUSADA')

  const L: string[] = []

  // ── Cabeçalho ────────────────────────────────────────────
  L.push(`*${cotacao.titulo}*`)
  const obraTxt = cotacao.obra ? cotacao.obra.nome : 'compra geral'
  L.push(`📋 Orçamento ${STATUS_DESCR[cotacao.status]} · 🏗️ ${obraTxt}`)
  if (cotacao.prazo_resposta) {
    L.push(`📅 Prazo: ${fmtDateBR(cotacao.prazo_resposta)}`)
  }
  L.push('')
  L.push(SEP)
  L.push('')

  // ── Itens cotados ────────────────────────────────────────
  if (itens.length > 0) {
    L.push(`*Itens cotados (${itens.length})*`)
    L.push('')

    itens.forEach((it, i) => {
      const qty = `${fmtQty(Number(it.quantidade))}${it.unidade?.sigla ? ' ' + it.unidade.sigla : ''}`
      L.push(`${i + 1}. ${it.descricao}  _(${qty})_`)

      let vencedora: { nome: string; preco: number; total: number } | null = null
      const todasRespostas: { nome: string; preco: number }[] = []
      for (const env of respondidos) {
        const r = env.respostas.find(x => x.item_id === it.id)
        if (!r) continue
        const preco = Number(r.preco_unitario)
        todasRespostas.push({ nome: env.fornecedor?.nome ?? 'Fornecedor', preco })
        if (r.vencedora) {
          vencedora = {
            nome: env.fornecedor?.nome ?? 'Fornecedor',
            preco,
            total: Number(r.preco_total),
          }
        }
      }

      if (vencedora) {
        L.push(`   ✅ *${vencedora.nome}* — ${fmtBRL(vencedora.preco)}/un · Total *${fmtBRL(vencedora.total)}*`)
      } else if (todasRespostas.length > 0) {
        L.push(`   ⏳ Sem vencedor definido`)
        for (const r of todasRespostas) {
          L.push(`     • ${r.nome}: ${fmtBRL(r.preco)}/un`)
        }
      } else {
        L.push(`   ⏳ _Sem respostas ainda_`)
      }
      // espaço entre itens (exceto no último)
      if (i < itens.length - 1) L.push('')
    })
    L.push('')
  }

  // ── Extras (propostos pelos fornecedores fora da lista) ─
  const temExtras = respondidos.some(e => e.respostas.some(r => r.item_id === null))
  if (temExtras) {
    L.push(SEP)
    L.push('')
    L.push('*Itens extras propostos*')
    L.push('')
    for (const env of respondidos) {
      const extras = env.respostas.filter(r => r.item_id === null)
      if (extras.length === 0) continue
      L.push(`_Por ${env.fornecedor?.nome ?? 'fornecedor'}:_`)
      for (const r of extras) {
        const tick = r.vencedora ? '✅' : '➕'
        const qty = `${fmtQty(Number(r.quantidade))}${r.unidade?.sigla ? ' ' + r.unidade.sigla : ''}`
        L.push(`${tick} ${r.descricao}  _(${qty})_ — ${fmtBRL(Number(r.preco_unitario))}/un · Total *${fmtBRL(Number(r.preco_total))}*`)
      }
      L.push('')
    }
  }

  // ── Total escolhido (vencedoras) ────────────────────────
  let totalEscolhido = 0
  for (const env of respondidos) {
    for (const r of env.respostas) {
      if (r.vencedora) totalEscolhido += Number(r.preco_total)
    }
  }
  if (totalEscolhido > 0) {
    L.push(SEP)
    L.push('')
    L.push(`💰 *Total escolhido: ${fmtBRL(totalEscolhido)}*`)
    L.push('')
  }

  // ── Propostas recebidas ────────────────────────────────
  if (respondidos.length > 0) {
    L.push(SEP)
    L.push('')
    L.push('*Propostas recebidas*')
    L.push('')

    const totaisRespondidos = respondidos.map(e => ({
      envelope: e,
      total: e.respostas.reduce((s, r) => s + Number(r.preco_total ?? 0), 0),
    }))
    const menorTotal = Math.min(...totaisRespondidos.map(t => t.total))

    for (const { envelope, total } of totaisRespondidos) {
      const isMenor = total === menorTotal && total > 0 && respondidos.length > 1
      const diff = total - menorTotal
      let tag = ''
      if (isMenor) {
        tag = '  _(menor total)_'
      } else if (diff > 0) {
        tag = `  _(+${fmtBRL(diff)})_`
      }
      const dias = envelope.prazo_entrega_dias
      const prazo = dias != null ? `  · entrega ${dias} ${dias === 1 ? 'dia' : 'dias'}` : ''
      L.push(`• ${envelope.fornecedor?.nome ?? '?'} — *${fmtBRL(total)}*${tag}${prazo}`)
    }
    L.push('')
  }

  // ── Pendentes / recusados ───────────────────────────────
  if (pendentes.length > 0 || recusados.length > 0) {
    if (pendentes.length > 0) {
      L.push(`⏳ Aguardando: ${pendentes.map(e => e.fornecedor?.nome).filter(Boolean).join(', ')}`)
    }
    if (recusados.length > 0) {
      L.push(`❌ Recusaram: ${recusados.map(e => e.fornecedor?.nome).filter(Boolean).join(', ')}`)
    }
    L.push('')
  }

  // Remove blank linhas finais excessivas
  while (L.length > 0 && L[L.length - 1] === '') L.pop()

  return L.join('\n')
}
