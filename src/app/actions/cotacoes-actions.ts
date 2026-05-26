'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import type {
  Cotacao,
  CotacaoInput,
  CotacaoStatus,
  CotacaoItem,
  CotacaoItemInput,
  CotacaoFornecedor,
  CotacaoResposta,
  CotacaoRespostaInput,
  CotacaoPublicView,
  CotacaoAnexo,
} from '@/types/compras'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

function revalidateCotacoes(id?: string) {
  revalidatePath('/compras/cotacoes')
  if (id) revalidatePath(`/compras/cotacoes/${id}`)
}

// ═══════════════════════════════════════════════════════════════
// QUERIES INTERNAS (ADMIN / COMPRAS)
// ═══════════════════════════════════════════════════════════════

export interface CotacaoListItem extends Cotacao {
  qtd_itens: number
  qtd_fornecedores: number
  qtd_respondidos: number
}

export async function listCotacoes(opts: {
  status?: CotacaoStatus
  obra_id?: string | null
  search?: string
} = {}): Promise<CotacaoListItem[]> {
  const { supabase } = await requireUser()

  let q = supabase
    .from('cotacoes')
    .select(`
      *,
      obra:obras(id, nome, cidade)
    `)
    .order('created_at', { ascending: false })

  if (opts.status)   q = q.eq('status', opts.status)
  if (opts.obra_id !== undefined) {
    if (opts.obra_id === null) q = q.is('obra_id', null)
    else q = q.eq('obra_id', opts.obra_id)
  }
  if (opts.search) q = q.ilike('titulo', `%${opts.search}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const cotacoes = (data ?? []) as unknown as Cotacao[]
  if (cotacoes.length === 0) return []

  const ids = cotacoes.map(c => c.id)

  // Agregações em paralelo
  const [itensRes, fornRes] = await Promise.all([
    supabase.from('cotacao_itens').select('cotacao_id').in('cotacao_id', ids),
    supabase.from('cotacao_fornecedores').select('cotacao_id, status').in('cotacao_id', ids),
  ])

  const itensCount = new Map<string, number>()
  for (const r of itensRes.data ?? []) {
    itensCount.set(r.cotacao_id, (itensCount.get(r.cotacao_id) ?? 0) + 1)
  }
  const fornCount = new Map<string, { total: number; respondidos: number }>()
  for (const r of fornRes.data ?? []) {
    const cur = fornCount.get(r.cotacao_id) ?? { total: 0, respondidos: 0 }
    cur.total += 1
    if (r.status === 'RESPONDIDA') cur.respondidos += 1
    fornCount.set(r.cotacao_id, cur)
  }

  return cotacoes.map(c => ({
    ...c,
    qtd_itens: itensCount.get(c.id) ?? 0,
    qtd_fornecedores: fornCount.get(c.id)?.total ?? 0,
    qtd_respondidos: fornCount.get(c.id)?.respondidos ?? 0,
  }))
}

export interface CotacaoDetail {
  cotacao: Cotacao
  itens: CotacaoItem[]
  envelopes: (CotacaoFornecedor & { respostas: CotacaoResposta[]; anexos: CotacaoAnexo[] })[]
}

export async function getCotacao(id: string): Promise<CotacaoDetail | null> {
  const { supabase } = await requireUser()

  const [cotRes, itensRes, envRes] = await Promise.all([
    supabase.from('cotacoes').select('*, obra:obras(id, nome, cidade)').eq('id', id).maybeSingle(),
    supabase
      .from('cotacao_itens')
      .select('*, unidade:unidades_medida(*), categoria:categorias_custo(*)')
      .eq('cotacao_id', id)
      .order('ordem', { ascending: true }),
    supabase
      .from('cotacao_fornecedores')
      .select('*, fornecedor:fornecedores(*)')
      .eq('cotacao_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (cotRes.error)   throw new Error(cotRes.error.message)
  if (itensRes.error) throw new Error(itensRes.error.message)
  if (envRes.error)   throw new Error(envRes.error.message)
  if (!cotRes.data) return null

  const envelopes = (envRes.data ?? []) as unknown as CotacaoFornecedor[]
  if (envelopes.length === 0) {
    return {
      cotacao: cotRes.data as unknown as Cotacao,
      itens: (itensRes.data ?? []) as unknown as CotacaoItem[],
      envelopes: [],
    }
  }

  const envIds = envelopes.map(e => e.id)
  const [respRes, anexosRes] = await Promise.all([
    supabase
      .from('cotacao_respostas')
      .select('*, unidade:unidades_medida(*)')
      .in('cotacao_fornecedor_id', envIds)
      .order('ordem', { ascending: true }),
    supabase
      .from('cotacao_anexos')
      .select('*')
      .in('cotacao_fornecedor_id', envIds)
      .order('uploaded_at', { ascending: true }),
  ])
  if (respRes.error)   throw new Error(respRes.error.message)
  if (anexosRes.error) throw new Error(anexosRes.error.message)

  const respMap = new Map<string, CotacaoResposta[]>()
  for (const r of (respRes.data ?? []) as unknown as CotacaoResposta[]) {
    const arr = respMap.get(r.cotacao_fornecedor_id) ?? []
    arr.push(r); respMap.set(r.cotacao_fornecedor_id, arr)
  }
  const anexosMap = new Map<string, CotacaoAnexo[]>()
  for (const a of (anexosRes.data ?? []) as unknown as CotacaoAnexo[]) {
    const arr = anexosMap.get(a.cotacao_fornecedor_id) ?? []
    arr.push(a); anexosMap.set(a.cotacao_fornecedor_id, arr)
  }

  return {
    cotacao: cotRes.data as unknown as Cotacao,
    itens: (itensRes.data ?? []) as unknown as CotacaoItem[],
    envelopes: envelopes.map(e => ({
      ...e,
      respostas: respMap.get(e.id) ?? [],
      anexos: anexosMap.get(e.id) ?? [],
    })),
  }
}

// ═══════════════════════════════════════════════════════════════
// MUTAÇÕES INTERNAS (ADMIN)
// ═══════════════════════════════════════════════════════════════

export async function createCotacao(input: CotacaoInput): Promise<Cotacao> {
  const { supabase, user } = await requireUser()

  // 1. Cabeçalho
  const { data: cotacao, error } = await supabase
    .from('cotacoes')
    .insert({
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      obra_id: input.obra_id || null,
      prazo_resposta: input.prazo_resposta || null,
      criado_por: user.id,
      status: 'RASCUNHO',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  // 2. Itens sugeridos
  if (input.itens.length > 0) {
    const { error: itensErr } = await supabase.from('cotacao_itens').insert(
      input.itens.map((it, i) => ({
        cotacao_id: cotacao.id,
        descricao: it.descricao.trim(),
        quantidade: it.quantidade,
        unidade_id: it.unidade_id || null,
        categoria_id: it.categoria_id || null,
        observacoes: it.observacoes?.trim() || null,
        ordem: it.ordem ?? i,
      }))
    )
    if (itensErr) throw new Error(itensErr.message)
  }

  // 3. Envelopes por fornecedor
  if (input.fornecedor_ids.length > 0) {
    const { error: fornErr } = await supabase.from('cotacao_fornecedores').insert(
      input.fornecedor_ids.map(fid => ({
        cotacao_id: cotacao.id,
        fornecedor_id: fid,
      }))
    )
    if (fornErr) throw new Error(fornErr.message)
  }

  revalidateCotacoes()
  return cotacao as Cotacao
}

export async function updateCotacao(id: string, patch: {
  titulo?: string
  descricao?: string | null
  obra_id?: string | null
  prazo_resposta?: string | null
}): Promise<Cotacao> {
  const { supabase } = await requireUser()
  const payload: Record<string, unknown> = {}
  if (patch.titulo !== undefined)         payload.titulo = patch.titulo.trim()
  if (patch.descricao !== undefined)      payload.descricao = patch.descricao?.trim() || null
  if (patch.obra_id !== undefined)        payload.obra_id = patch.obra_id || null
  if (patch.prazo_resposta !== undefined) payload.prazo_resposta = patch.prazo_resposta || null

  const { data, error } = await supabase.from('cotacoes').update(payload).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  revalidateCotacoes(id)
  return data as Cotacao
}

export async function deleteCotacao(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('cotacoes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateCotacoes()
}

export async function setCotacaoStatus(id: string, status: CotacaoStatus): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('cotacoes').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateCotacoes(id)
}

// ── Itens ────────────────────────────────────────────────

export async function addCotacaoItem(cotacaoId: string, item: CotacaoItemInput): Promise<CotacaoItem> {
  const { supabase } = await requireUser()
  // Próxima ordem
  const { data: ultimo } = await supabase
    .from('cotacao_itens')
    .select('ordem')
    .eq('cotacao_id', cotacaoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  const ordem = item.ordem ?? ((ultimo?.ordem ?? -1) + 1)

  const { data, error } = await supabase
    .from('cotacao_itens')
    .insert({
      cotacao_id: cotacaoId,
      descricao: item.descricao.trim(),
      quantidade: item.quantidade,
      unidade_id: item.unidade_id || null,
      categoria_id: item.categoria_id || null,
      observacoes: item.observacoes?.trim() || null,
      ordem,
    })
    .select('*, unidade:unidades_medida(*), categoria:categorias_custo(*)')
    .single()
  if (error) throw new Error(error.message)
  revalidateCotacoes(cotacaoId)
  return data as unknown as CotacaoItem
}

export async function updateCotacaoItem(itemId: string, patch: Partial<CotacaoItemInput>): Promise<void> {
  const { supabase } = await requireUser()
  const payload: Record<string, unknown> = {}
  if (patch.descricao !== undefined)    payload.descricao = patch.descricao.trim()
  if (patch.quantidade !== undefined)   payload.quantidade = patch.quantidade
  if (patch.unidade_id !== undefined)   payload.unidade_id = patch.unidade_id || null
  if (patch.categoria_id !== undefined) payload.categoria_id = patch.categoria_id || null
  if (patch.observacoes !== undefined)  payload.observacoes = patch.observacoes?.trim() || null
  if (patch.ordem !== undefined)        payload.ordem = patch.ordem

  const { data: row, error: rowErr } = await supabase.from('cotacao_itens').select('cotacao_id').eq('id', itemId).maybeSingle()
  if (rowErr) throw new Error(rowErr.message)

  const { error } = await supabase.from('cotacao_itens').update(payload).eq('id', itemId)
  if (error) throw new Error(error.message)
  if (row?.cotacao_id) revalidateCotacoes(row.cotacao_id)
}

export async function removeCotacaoItem(itemId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { data: row } = await supabase.from('cotacao_itens').select('cotacao_id').eq('id', itemId).maybeSingle()
  const { error } = await supabase.from('cotacao_itens').delete().eq('id', itemId)
  if (error) throw new Error(error.message)
  if (row?.cotacao_id) revalidateCotacoes(row.cotacao_id)
}

// ── Envelopes (fornecedores convidados) ────────────────────────────────────────────────

export async function addCotacaoFornecedor(cotacaoId: string, fornecedorId: string): Promise<CotacaoFornecedor> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('cotacao_fornecedores')
    .insert({ cotacao_id: cotacaoId, fornecedor_id: fornecedorId })
    .select('*, fornecedor:fornecedores(*)')
    .single()
  if (error) throw new Error(error.message)
  revalidateCotacoes(cotacaoId)
  return data as unknown as CotacaoFornecedor
}

export async function removeCotacaoFornecedor(envelopeId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { data: row } = await supabase.from('cotacao_fornecedores').select('cotacao_id').eq('id', envelopeId).maybeSingle()
  const { error } = await supabase.from('cotacao_fornecedores').delete().eq('id', envelopeId)
  if (error) throw new Error(error.message)
  if (row?.cotacao_id) revalidateCotacoes(row.cotacao_id)
}

// ── Marcar vencedora ────────────────────────────────────────────────

export async function marcarRespostaVencedora(respostaId: string, vencedora: boolean): Promise<void> {
  const { supabase } = await requireUser()
  const { data: row } = await supabase
    .from('cotacao_respostas')
    .select('cotacao_fornecedor_id, cotacao_fornecedores(cotacao_id)')
    .eq('id', respostaId)
    .maybeSingle()
  const { error } = await supabase.from('cotacao_respostas').update({ vencedora }).eq('id', respostaId)
  if (error) throw new Error(error.message)
  // Tenta achar o cotacao_id pra revalidar
  type RowShape = { cotacao_fornecedores?: { cotacao_id?: string } | { cotacao_id?: string }[] } | null
  const r = row as RowShape
  const cf = Array.isArray(r?.cotacao_fornecedores) ? r?.cotacao_fornecedores[0] : r?.cotacao_fornecedores
  const cotacaoId = cf?.cotacao_id
  if (cotacaoId) revalidateCotacoes(cotacaoId)
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES PÚBLICAS (via token, sem auth) — usam service_role
// ═══════════════════════════════════════════════════════════════

async function resolveEnvelopePorToken(token: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cotacao_fornecedores')
    .select(`
      *,
      fornecedor:fornecedores(*),
      cotacao:cotacoes(*, obra:obras(id, nome, cidade))
    `)
    .eq('token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Cotação não encontrada ou link inválido.')
  return { admin, envelope: data }
}

export async function getCotacaoPublicByToken(token: string): Promise<CotacaoPublicView> {
  const { admin, envelope } = await resolveEnvelopePorToken(token)

  // Marca como ABERTA na primeira visualização (não-bloqueante: ignora erro)
  if (envelope.status === 'PENDENTE') {
    await admin
      .from('cotacao_fornecedores')
      .update({ status: 'ABERTA', aberta_em: new Date().toISOString() })
      .eq('id', envelope.id)
  }

  const [itensRes, respRes, anexosRes, unidadesRes] = await Promise.all([
    admin
      .from('cotacao_itens')
      .select('*, unidade:unidades_medida(*), categoria:categorias_custo(*)')
      .eq('cotacao_id', envelope.cotacao_id)
      .order('ordem', { ascending: true }),
    admin
      .from('cotacao_respostas')
      .select('*, unidade:unidades_medida(*)')
      .eq('cotacao_fornecedor_id', envelope.id)
      .order('ordem', { ascending: true }),
    admin
      .from('cotacao_anexos')
      .select('*')
      .eq('cotacao_fornecedor_id', envelope.id)
      .order('uploaded_at', { ascending: true }),
    admin
      .from('unidades_medida')
      .select('*')
      .order('ordem', { ascending: true }),
  ])
  if (itensRes.error)    throw new Error(itensRes.error.message)
  if (respRes.error)     throw new Error(respRes.error.message)
  if (anexosRes.error)   throw new Error(anexosRes.error.message)
  if (unidadesRes.error) throw new Error(unidadesRes.error.message)

  const cotacao = envelope.cotacao as { id: string; titulo: string; descricao: string | null; status: 'RASCUNHO' | 'ENVIADA' | 'RECEBENDO' | 'FECHADA' | 'CANCELADA'; prazo_resposta: string | null; obra: { nome: string; cidade: string | null } | null }
  const fornecedor = envelope.fornecedor as { nome: string }

  return {
    cotacao: {
      id: cotacao.id,
      titulo: cotacao.titulo,
      descricao: cotacao.descricao,
      status: cotacao.status,
      prazo_resposta: cotacao.prazo_resposta,
      obra: cotacao.obra ? { nome: cotacao.obra.nome, cidade: cotacao.obra.cidade } : null,
    },
    envelope: {
      id: envelope.id,
      token: envelope.token,
      status: envelope.status === 'PENDENTE' ? 'ABERTA' : envelope.status,
      prazo_entrega_dias: envelope.prazo_entrega_dias,
      observacoes_fornecedor: envelope.observacoes_fornecedor,
      respondida_em: envelope.respondida_em,
      fornecedor: { nome: fornecedor.nome },
    },
    itens: (itensRes.data ?? []) as unknown as CotacaoItem[],
    respostas: (respRes.data ?? []) as unknown as CotacaoResposta[],
    anexos: (anexosRes.data ?? []) as unknown as CotacaoAnexo[],
    unidades: (unidadesRes.data ?? []) as unknown as import('@/types/compras').UnidadeMedida[],
  }
}

export async function submitRespostasPublic(input: {
  token: string
  respostas: CotacaoRespostaInput[]
  observacoes_fornecedor?: string | null
  prazo_entrega_dias?: number | null
}): Promise<void> {
  const { admin, envelope } = await resolveEnvelopePorToken(input.token)

  if (envelope.status === 'RESPONDIDA') {
    throw new Error('Esta cotação já foi respondida.')
  }
  const cotStatus = (envelope.cotacao as { status: string }).status
  if (cotStatus === 'FECHADA' || cotStatus === 'CANCELADA') {
    throw new Error(`Esta cotação está ${cotStatus.toLowerCase()} e não aceita mais respostas.`)
  }

  // Apaga respostas antigas e insere as novas (substitui tudo no submit)
  const { error: delErr } = await admin
    .from('cotacao_respostas')
    .delete()
    .eq('cotacao_fornecedor_id', envelope.id)
  if (delErr) throw new Error(delErr.message)

  if (input.respostas.length > 0) {
    const { error: insErr } = await admin.from('cotacao_respostas').insert(
      input.respostas.map((r, i) => ({
        cotacao_fornecedor_id: envelope.id,
        item_id: r.item_id || null,
        descricao: r.descricao.trim(),
        quantidade: r.quantidade,
        unidade_id: r.unidade_id || null,
        preco_unitario: r.preco_unitario,
        observacoes: r.observacoes?.trim() || null,
        ordem: r.ordem ?? i,
      }))
    )
    if (insErr) throw new Error(insErr.message)
  }

  // Atualiza envelope
  const { error: envErr } = await admin
    .from('cotacao_fornecedores')
    .update({
      status: 'RESPONDIDA',
      respondida_em: new Date().toISOString(),
      observacoes_fornecedor: input.observacoes_fornecedor?.trim() || null,
      prazo_entrega_dias: input.prazo_entrega_dias ?? null,
    })
    .eq('id', envelope.id)
  if (envErr) throw new Error(envErr.message)

  // Marca cotação como RECEBENDO se ainda estiver ENVIADA
  if (cotStatus === 'ENVIADA') {
    await admin.from('cotacoes').update({ status: 'RECEBENDO' }).eq('id', envelope.cotacao_id)
  }

  revalidateCotacoes(envelope.cotacao_id)
}

export async function recusarCotacaoPublic(token: string, motivo?: string): Promise<void> {
  const { admin, envelope } = await resolveEnvelopePorToken(token)
  const { error } = await admin
    .from('cotacao_fornecedores')
    .update({
      status: 'RECUSADA',
      respondida_em: new Date().toISOString(),
      observacoes_fornecedor: motivo?.trim() || null,
    })
    .eq('id', envelope.id)
  if (error) throw new Error(error.message)
  revalidateCotacoes(envelope.cotacao_id)
}
