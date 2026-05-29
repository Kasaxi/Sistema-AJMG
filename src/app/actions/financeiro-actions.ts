'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type {
  LancamentoComRelacoes, LancamentoInput, LancamentoFiltros,
  FinanceiroResumo, FinanceiroCategoria, FinanceiroCategoriaInput,
  CentroCusto, CentroCustoInput,
} from '@/types/financeiro'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

function revalidate() {
  revalidatePath('/financeiro')
}

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

// Limites do mês 'YYYY-MM' (default: mês atual), em 'YYYY-MM-DD'.
function intervaloMes(mes?: string): { inicio: string; fim: string } {
  const base = mes ? new Date(`${mes}-01T00:00:00`) : new Date()
  const ano = base.getFullYear()
  const m = base.getMonth()
  const inicio = new Date(ano, m, 1)
  const fim = new Date(ano, m + 1, 0)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { inicio: fmt(inicio), fim: fmt(fim) }
}

// Soma N de uma unidade a uma data 'YYYY-MM-DD' (pra recorrência).
function somarIntervalo(dataISO: string, n: number, unidade: 'SEMANAL' | 'MENSAL' | 'ANUAL'): string {
  const d = new Date(`${dataISO}T00:00:00`)
  if (unidade === 'SEMANAL') d.setDate(d.getDate() + n * 7)
  else if (unidade === 'MENSAL') d.setMonth(d.getMonth() + n)
  else d.setFullYear(d.getFullYear() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SELECT_RELACOES = `
  *,
  financeiro_categorias(nome, grupo_dre),
  financeiro_centros_custo(nome, grupo),
  autor:profiles!created_by(nome)
`

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapLancamento(row: any): LancamentoComRelacoes {
  const autor = Array.isArray(row.autor) ? row.autor[0] : row.autor
  return {
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: Number(row.valor ?? 0),
    status: row.status,
    categoria_id: row.categoria_id,
    centro_custo_id: row.centro_custo_id,
    data_competencia: row.data_competencia,
    data_vencimento: row.data_vencimento,
    data_pagamento: row.data_pagamento,
    origem: row.origem,
    observacoes: row.observacoes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    categoria_nome: row.financeiro_categorias?.nome ?? null,
    categoria_grupo_dre: row.financeiro_categorias?.grupo_dre ?? null,
    centro_custo_nome: row.financeiro_centros_custo?.nome ?? null,
    centro_custo_grupo: row.financeiro_centros_custo?.grupo ?? null,
    autor_nome: autor?.nome ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Lançamentos ─────────────────────────────────────────────

export async function listLancamentos(filtros: LancamentoFiltros = {}): Promise<LancamentoComRelacoes[]> {
  const { supabase } = await requireUser()
  let q = supabase
    .from('financeiro_lancamentos')
    .select(SELECT_RELACOES)
    .order('data_vencimento', { ascending: false })
    .order('created_at', { ascending: false })

  const { inicio, fim } = intervaloMes(filtros.mes)
  q = q.gte('data_vencimento', inicio).lte('data_vencimento', fim)

  if (filtros.aba === 'RECEBER') q = q.eq('tipo', 'ENTRADA')
  if (filtros.aba === 'PAGAR') q = q.eq('tipo', 'SAIDA')
  if (filtros.categoriaId) q = q.eq('categoria_id', filtros.categoriaId)
  if (filtros.centroCustoId) q = q.eq('centro_custo_id', filtros.centroCustoId)
  if (filtros.autorId) q = q.eq('created_by', filtros.autorId)
  if (filtros.status) q = q.eq('status', filtros.status)
  if (filtros.busca?.trim()) q = q.ilike('descricao', `%${filtros.busca.trim()}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapLancamento)
}

export async function getResumo(mes?: string): Promise<FinanceiroResumo> {
  const { supabase } = await requireUser()
  const { inicio, fim } = intervaloMes(mes)

  const [mesRes, vencidoRes] = await Promise.all([
    supabase
      .from('financeiro_lancamentos')
      .select('tipo, valor, status')
      .neq('status', 'CANCELADO')
      .gte('data_vencimento', inicio)
      .lte('data_vencimento', fim),
    supabase
      .from('financeiro_lancamentos')
      .select('valor')
      .eq('status', 'PENDENTE')
      .lt('data_vencimento', hoje()),
  ])

  if (mesRes.error) throw new Error(mesRes.error.message)
  if (vencidoRes.error) throw new Error(vencidoRes.error.message)

  let entradaPaga = 0, saidaPaga = 0, entradaPend = 0, saidaPend = 0
  for (const r of mesRes.data ?? []) {
    const v = Number(r.valor ?? 0)
    if (r.tipo === 'ENTRADA') {
      if (r.status === 'PAGO') entradaPaga += v; else entradaPend += v
    } else {
      if (r.status === 'PAGO') saidaPaga += v; else saidaPend += v
    }
  }

  const totalVencido = (vencidoRes.data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0)

  return {
    saldoRealizado: entradaPaga - saidaPaga,
    saldoPrevisto: (entradaPaga + entradaPend) - (saidaPaga + saidaPend),
    totalReceber: entradaPend,
    totalPagar: saidaPend,
    totalVencido,
    countVencido: (vencidoRes.data ?? []).length,
  }
}

export async function createLancamento(input: LancamentoInput): Promise<void> {
  const { supabase, user } = await requireUser()

  const base = {
    tipo: input.tipo,
    descricao: input.descricao.trim(),
    valor: input.valor,
    categoria_id: input.categoria_id || null,
    centro_custo_id: input.centro_custo_id || null,
    observacoes: input.observacoes?.trim() || null,
    origem: 'manual' as const,
    created_by: user.id,
  }

  const recorrencia = input.recorrencia ?? 'NENHUMA'
  const parcelas = recorrencia === 'NENHUMA' ? 1 : Math.max(1, Math.min(input.parcelas ?? 1, 120))

  const rows = Array.from({ length: parcelas }, (_, i) => {
    const venc = i === 0 ? input.data_vencimento : somarIntervalo(input.data_vencimento, i, recorrencia as 'SEMANAL' | 'MENSAL' | 'ANUAL')
    const comp = i === 0 ? input.data_competencia : somarIntervalo(input.data_competencia, i, recorrencia as 'SEMANAL' | 'MENSAL' | 'ANUAL')
    // "Já pago" só vale pra parcela única / primeira; futuras nascem pendentes.
    const status = i === 0 ? (input.status ?? 'PENDENTE') : 'PENDENTE'
    return {
      ...base,
      descricao: parcelas > 1 ? `${base.descricao} (${i + 1}/${parcelas})` : base.descricao,
      data_competencia: comp,
      data_vencimento: venc,
      status,
      data_pagamento: status === 'PAGO' ? venc : null,
    }
  })

  const { error } = await supabase.from('financeiro_lancamentos').insert(rows)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateLancamento(id: string, input: Partial<LancamentoInput>): Promise<void> {
  const { supabase } = await requireUser()
  const patch: Record<string, unknown> = {}
  if (input.tipo !== undefined) patch.tipo = input.tipo
  if (input.descricao !== undefined) patch.descricao = input.descricao.trim()
  if (input.valor !== undefined) patch.valor = input.valor
  if (input.status !== undefined) patch.status = input.status
  if (input.categoria_id !== undefined) patch.categoria_id = input.categoria_id || null
  if (input.centro_custo_id !== undefined) patch.centro_custo_id = input.centro_custo_id || null
  if (input.data_competencia !== undefined) patch.data_competencia = input.data_competencia
  if (input.data_vencimento !== undefined) patch.data_vencimento = input.data_vencimento
  if (input.observacoes !== undefined) patch.observacoes = input.observacoes?.trim() || null
  if (input.status === 'PAGO') patch.data_pagamento = hoje()
  if (input.status === 'PENDENTE' || input.status === 'CANCELADO') patch.data_pagamento = null

  const { error } = await supabase.from('financeiro_lancamentos').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteLancamento(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('financeiro_lancamentos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

// Dar baixa = confirmar que entrou/saiu do caixa (PENDENTE -> PAGO).
export async function darBaixa(id: string, pago: boolean): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('financeiro_lancamentos')
    .update({ status: pago ? 'PAGO' : 'PENDENTE', data_pagamento: pago ? hoje() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function darBaixaEmLote(ids: string[], pago: boolean): Promise<void> {
  if (!ids.length) return
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('financeiro_lancamentos')
    .update({ status: pago ? 'PAGO' : 'PENDENTE', data_pagamento: pago ? hoje() : null })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteEmLote(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { supabase } = await requireUser()
  const { error } = await supabase.from('financeiro_lancamentos').delete().in('id', ids)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── Centros de custo ────────────────────────────────────────

export async function listCentrosCusto(opts: { incluirInativos?: boolean } = {}): Promise<CentroCusto[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('financeiro_centros_custo').select('*').order('grupo', { nullsFirst: true }).order('ordem').order('nome')
  if (!opts.incluirInativos) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CentroCusto[]
}

export async function createCentroCusto(input: CentroCustoInput): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('financeiro_centros_custo').insert({
    nome: input.nome.trim(),
    grupo: input.grupo?.trim() || null,
    tipo: input.tipo,
    obra_id: input.tipo === 'OBRA' ? (input.obra_id || null) : null,
    imovel_id: input.tipo === 'IMOVEL' ? (input.imovel_id || null) : null,
    ativo: input.ativo ?? true,
  })
  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateCentroCusto(id: string, input: Partial<CentroCustoInput>): Promise<void> {
  const { supabase } = await requireUser()
  const patch: Record<string, unknown> = {}
  if (input.nome !== undefined) patch.nome = input.nome.trim()
  if (input.grupo !== undefined) patch.grupo = input.grupo?.trim() || null
  if (input.tipo !== undefined) {
    patch.tipo = input.tipo
    patch.obra_id = input.tipo === 'OBRA' ? (input.obra_id || null) : null
    patch.imovel_id = input.tipo === 'IMOVEL' ? (input.imovel_id || null) : null
  } else {
    if (input.obra_id !== undefined) patch.obra_id = input.obra_id || null
    if (input.imovel_id !== undefined) patch.imovel_id = input.imovel_id || null
  }
  if (input.ativo !== undefined) patch.ativo = input.ativo
  const { error } = await supabase.from('financeiro_centros_custo').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteCentroCusto(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('financeiro_centros_custo').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── Apoio: obras/imóveis pra vincular centros, autores pra filtro ──

export async function listObrasParaSelect(): Promise<{ id: string; nome: string }[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from('obras').select('id, nome').order('nome')
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; nome: string }[]
}

export async function listImoveisParaSelect(): Promise<{ id: string; nome: string }[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from('imoveis').select('id, identificacao').order('identificacao')
  if (error) throw new Error(error.message)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({ id: r.id, nome: r.identificacao }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function listAutores(): Promise<{ id: string; nome: string }[]> {
  const { supabase } = await requireUser()
  // Distintos quem já lançou algo (pra popular o filtro "quem lançou").
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('created_by, autor:profiles!created_by(nome)')
    .not('created_by', 'is', null)
  if (error) throw new Error(error.message)
  const map = new Map<string, string>()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  for (const r of (data ?? []) as any[]) {
    const autor = Array.isArray(r.autor) ? r.autor[0] : r.autor
    if (r.created_by && !map.has(r.created_by)) map.set(r.created_by, autor?.nome ?? '—')
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
}

// ── Categorias ──────────────────────────────────────────────

export async function listCategorias(opts: { incluirInativas?: boolean } = {}): Promise<FinanceiroCategoria[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('financeiro_categorias').select('*').order('ordem').order('nome')
  if (!opts.incluirInativas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as FinanceiroCategoria[]
}

export async function createCategoria(input: FinanceiroCategoriaInput): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('financeiro_categorias').insert({
    nome: input.nome.trim(),
    tipo: input.tipo,
    grupo_dre: input.grupo_dre ?? null,
    ativo: input.ativo ?? true,
  })
  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateCategoria(id: string, input: Partial<FinanceiroCategoriaInput>): Promise<void> {
  const { supabase } = await requireUser()
  const patch: Record<string, unknown> = {}
  if (input.nome !== undefined) patch.nome = input.nome.trim()
  if (input.tipo !== undefined) patch.tipo = input.tipo
  if (input.grupo_dre !== undefined) patch.grupo_dre = input.grupo_dre ?? null
  if (input.ativo !== undefined) patch.ativo = input.ativo
  const { error } = await supabase.from('financeiro_categorias').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function deleteCategoria(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('financeiro_categorias').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
