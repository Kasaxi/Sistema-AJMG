'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type {
  Fornecedor, FornecedorInput,
  UnidadeMedida,
  CategoriaCusto,
  Gasto, GastoInput, GastoFilters,
} from '@/types/compras'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

const GASTO_SELECT = `
  *,
  categoria:categorias_custo(id, nome, cor, icone, ordem, ativo, created_at, updated_at),
  fornecedor:fornecedores(id, nome, telefone, email, cnpj_cpf, observacoes, ativo, created_at, updated_at),
  unidade:unidades_medida(id, sigla, nome, ordem, created_at)
`

// ═══════════════════════════════════════════════════════════════
// FORNECEDORES
// ═══════════════════════════════════════════════════════════════

export async function listFornecedores(opts: { ativosApenas?: boolean } = {}): Promise<Fornecedor[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('fornecedores').select('*').order('nome', { ascending: true })
  if (opts.ativosApenas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Fornecedor[]
}

/** Lista fornecedores com contagem e valor total dos gastos vinculados. */
export async function listFornecedoresComResumo(): Promise<(Fornecedor & {
  total_gastos: number
  qtd_lancamentos: number
})[]> {
  const { supabase } = await requireUser()
  const [fornRes, gastosRes] = await Promise.all([
    supabase.from('fornecedores').select('*').order('nome', { ascending: true }),
    supabase.from('gastos').select('fornecedor_id, valor_total'),
  ])
  if (fornRes.error) throw new Error(fornRes.error.message)
  if (gastosRes.error) throw new Error(gastosRes.error.message)

  type GastoSlice = { fornecedor_id: string | null; valor_total: number | null }
  const stats = new Map<string, { total: number; qtd: number }>()
  for (const g of (gastosRes.data ?? []) as GastoSlice[]) {
    if (!g.fornecedor_id) continue
    const cur = stats.get(g.fornecedor_id) ?? { total: 0, qtd: 0 }
    cur.total += Number(g.valor_total ?? 0)
    cur.qtd += 1
    stats.set(g.fornecedor_id, cur)
  }

  return (fornRes.data ?? []).map(f => {
    const s = stats.get(f.id as string) ?? { total: 0, qtd: 0 }
    return { ...(f as Fornecedor), total_gastos: s.total, qtd_lancamentos: s.qtd }
  })
}

export async function createFornecedor(input: FornecedorInput): Promise<Fornecedor> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('fornecedores')
    .insert({
      nome: input.nome.trim(),
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      cnpj_cpf: input.cnpj_cpf?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      ativo: input.ativo ?? true,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  return data as Fornecedor
}

export async function updateFornecedor(id: string, patch: Partial<FornecedorInput>): Promise<Fornecedor> {
  const { supabase } = await requireUser()
  const allowed: Partial<FornecedorInput> = {}
  if (patch.nome !== undefined)        allowed.nome = patch.nome.trim()
  if (patch.telefone !== undefined)    allowed.telefone = patch.telefone?.trim() || null
  if (patch.email !== undefined)       allowed.email = patch.email?.trim() || null
  if (patch.cnpj_cpf !== undefined)    allowed.cnpj_cpf = patch.cnpj_cpf?.trim() || null
  if (patch.observacoes !== undefined) allowed.observacoes = patch.observacoes?.trim() || null
  if (patch.ativo !== undefined)       allowed.ativo = patch.ativo

  const { data, error } = await supabase
    .from('fornecedores')
    .update(allowed)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  return data as Fornecedor
}

export async function deleteFornecedor(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('fornecedores').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
}

// ═══════════════════════════════════════════════════════════════
// UNIDADES + CATEGORIAS (leitura ampla, edição admin via UI separada)
// ═══════════════════════════════════════════════════════════════

export async function listUnidadesMedida(): Promise<UnidadeMedida[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('unidades_medida')
    .select('*')
    .order('ordem', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as UnidadeMedida[]
}

export async function listCategoriasCusto(opts: { ativosApenas?: boolean } = {}): Promise<CategoriaCusto[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('categorias_custo').select('*').order('ordem', { ascending: true })
  if (opts.ativosApenas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoriaCusto[]
}

// ═══════════════════════════════════════════════════════════════
// GASTOS
// ═══════════════════════════════════════════════════════════════

export async function listGastos(
  filters: GastoFilters & { page?: number; per_page?: number } = {}
): Promise<{ items: Gasto[]; total: number }> {
  const { supabase } = await requireUser()
  const perPage = filters.per_page ?? 50
  const page = filters.page ?? 1
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let q = supabase.from('gastos').select(GASTO_SELECT, { count: 'exact' })

  if (filters.obra_id)       q = q.eq('obra_id', filters.obra_id)
  if (filters.categoria_ids && filters.categoria_ids.length > 0) {
    q = q.in('categoria_id', filters.categoria_ids)
  }
  if (filters.fornecedor_id) q = q.eq('fornecedor_id', filters.fornecedor_id)
  if (filters.data_inicio)   q = q.gte('data', filters.data_inicio)
  if (filters.data_fim)      q = q.lte('data', filters.data_fim)
  if (filters.search) {
    q = q.or(`descricao.ilike.%${filters.search}%,observacoes.ilike.%${filters.search}%`)
  }

  const sortBy = filters.sort_by ?? 'data'
  const sortDir = filters.sort_dir ?? 'desc'
  q = q.order(sortBy, { ascending: sortDir === 'asc' })
  // Tiebreakers estáveis pra paginação consistente
  if (sortBy !== 'data') q = q.order('data', { ascending: false })
  q = q.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await q
  if (error) throw new Error(error.message)
  return {
    items: (data ?? []) as unknown as Gasto[],
    total: count ?? 0,
  }
}

export async function createGasto(input: GastoInput): Promise<Gasto> {
  const { supabase, user } = await requireUser()
  const row = {
    obra_id: input.obra_id,
    descricao: input.descricao.trim(),
    item_catalogo_id: input.item_catalogo_id ?? null,
    categoria_id: input.categoria_id,
    fornecedor_id: input.fornecedor_id ?? null,
    quantidade: input.quantidade,
    unidade_id: input.unidade_id,
    valor_unitario: input.valor_unitario,
    data: input.data,
    observacoes: input.observacoes?.trim() || null,
    criado_por: user.id,
  }
  const { data, error } = await supabase
    .from('gastos')
    .insert(row)
    .select(GASTO_SELECT)
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/obras/${input.obra_id}`)
  return data as unknown as Gasto
}

export async function updateGasto(id: string, patch: Partial<GastoInput>): Promise<Gasto> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('gastos')
    .update(patch)
    .eq('id', id)
    .select(GASTO_SELECT)
    .single()
  if (error) throw new Error(error.message)
  if (patch.obra_id) revalidatePath(`/obras/${patch.obra_id}`)
  return data as unknown as Gasto
}

export async function deleteGasto(id: string, obraId?: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (obraId) revalidatePath(`/obras/${obraId}`)
}

// ═══════════════════════════════════════════════════════════════
// AGREGAÇÕES (dashboard)
// ═══════════════════════════════════════════════════════════════

export interface ResumoGastosObra {
  total: number
  totalLancamentos: number
  porCategoria: { categoria_id: string; nome: string; cor: string | null; total: number; count: number }[]
  porMes: { mes: string; total: number }[]
  porMesCategoria: {
    mes: string
    total: number
    categorias: { categoria_id: string; nome: string; cor: string | null; total: number; count: number }[]
  }[]
  topFornecedores: { fornecedor_id: string; nome: string; total: number; count: number }[]
}

export async function getResumoGastosObra(obraId: string): Promise<ResumoGastosObra> {
  const { supabase } = await requireUser()
  const { data: gastos, error } = await supabase
    .from('gastos')
    .select(`
      valor_total, data,
      categoria_id, fornecedor_id,
      categoria:categorias_custo(id, nome, cor),
      fornecedor:fornecedores(id, nome)
    `)
    .eq('obra_id', obraId)
  if (error) throw new Error(error.message)

  type Row = {
    valor_total: number
    data: string
    categoria_id: string
    fornecedor_id: string | null
    categoria?: { id: string; nome: string; cor: string | null } | null
    fornecedor?: { id: string; nome: string } | null
  }
  const rows = (gastos ?? []) as unknown as Row[]

  let total = 0
  const catMap = new Map<string, { categoria_id: string; nome: string; cor: string | null; total: number; count: number }>()
  const mesMap = new Map<string, number>()
  const fornMap = new Map<string, { fornecedor_id: string; nome: string; total: number; count: number }>()
  // mes → categoria_id → agregado
  const mesCatMap = new Map<string, Map<string, { categoria_id: string; nome: string; cor: string | null; total: number; count: number }>>()

  for (const r of rows) {
    const v = Number(r.valor_total) || 0
    total += v
    const mes = r.data.slice(0, 7)
    // categoria (geral)
    if (r.categoria) {
      const cur = catMap.get(r.categoria_id) ?? {
        categoria_id: r.categoria_id, nome: r.categoria.nome, cor: r.categoria.cor, total: 0, count: 0,
      }
      cur.total += v; cur.count += 1
      catMap.set(r.categoria_id, cur)
      // categoria por mês
      if (!mesCatMap.has(mes)) mesCatMap.set(mes, new Map())
      const catMapDoMes = mesCatMap.get(mes)!
      const curMc = catMapDoMes.get(r.categoria_id) ?? {
        categoria_id: r.categoria_id, nome: r.categoria.nome, cor: r.categoria.cor, total: 0, count: 0,
      }
      curMc.total += v; curMc.count += 1
      catMapDoMes.set(r.categoria_id, curMc)
    }
    // mês (YYYY-MM)
    mesMap.set(mes, (mesMap.get(mes) ?? 0) + v)
    // fornecedor
    if (r.fornecedor_id && r.fornecedor) {
      const cur = fornMap.get(r.fornecedor_id) ?? {
        fornecedor_id: r.fornecedor_id, nome: r.fornecedor.nome, total: 0, count: 0,
      }
      cur.total += v; cur.count += 1
      fornMap.set(r.fornecedor_id, cur)
    }
  }

  const porMesCategoria = [...mesCatMap.entries()]
    .map(([mes, m]) => ({
      mes,
      total: mesMap.get(mes) ?? 0,
      categorias: [...m.values()].sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  return {
    total,
    totalLancamentos: rows.length,
    porCategoria: [...catMap.values()].sort((a, b) => b.total - a.total),
    porMes: [...mesMap.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes)),
    porMesCategoria,
    topFornecedores: [...fornMap.values()].sort((a, b) => b.total - a.total).slice(0, 10),
  }
}
