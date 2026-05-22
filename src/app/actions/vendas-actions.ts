'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import type { Cliente, ClienteFilters, Vendedor, EtapaFunil, LeadDistribuicao } from '@/types/vendas'
import type { CurrentProfile } from '@/lib/permissions'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type ResolvedProfile = {
  role: string
  vendedor_id: string | null
  acesso_modulos: string[]
  ativo: boolean
  nome: string
} | null

// Resolve the current user's profile and lazily link it to a vendedor by
// matching e-mail (covers a vendedor created before OR after the account).
async function resolveProfile(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendedor_id, acesso_modulos, ativo, nome')
    .eq('id', user.id)
    .single()

  if (profile && profile.role === 'VENDEDOR' && !profile.vendedor_id && user.email) {
    const { data: v } = await supabase
      .from('vendedores')
      .select('id')
      .ilike('email', user.email)
      .limit(1)
      .maybeSingle()
    if (v?.id) {
      await supabase.from('profiles').update({ vendedor_id: v.id }).eq('id', user.id)
      profile.vendedor_id = v.id
    }
  }

  return { user, profile: profile as ResolvedProfile }
}

// Throws unless the current user is an ADMIN. Required before any action that
// uses the service-role admin client (RLS is bypassed there, so this app-level
// check is the only gate).
async function assertAdmin(supabase: SupabaseServerClient) {
  const { profile } = await resolveProfile(supabase)
  if (profile?.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem executar esta ação.')
  }
}

export async function getCurrentProfile(): Promise<CurrentProfile> {
  const supabase = await createClient()
  const { user, profile } = await resolveProfile(supabase)
  return {
    id: user.id,
    email: user.email ?? null,
    nome: profile?.nome ?? user.email?.split('@')[0] ?? '',
    role: (profile?.role ?? 'COLABORADOR') as CurrentProfile['role'],
    vendedor_id: profile?.vendedor_id ?? null,
    acesso_modulos: profile?.acesso_modulos ?? [],
    ativo: profile?.ativo ?? true,
  }
}

// ─── CLIENTES ───────────────────────────────────────────────────────────────

export async function getClientes(filters: ClienteFilters = {}) {
  const supabase = await createClient()
  const { profile } = await resolveProfile(supabase)

  const page = filters.page ?? 1
  const perPage = filters.per_page ?? 50
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from('clientes')
    .select('*, vendedor:vendedores(id, nome)', { count: 'exact' })

  // Role-based filter: vendedor only sees own clients
  if (profile?.role === 'VENDEDOR' && profile.vendedor_id) {
    query = query.eq('vendedor_id', profile.vendedor_id)
  }

  if (filters.search) {
    query = query.or(`nome.ilike.%${filters.search}%,telefone_whatsapp.ilike.%${filters.search}%`)
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.status_novo) query = query.eq('status_novo', filters.status_novo)
  if (filters.status_usado) query = query.eq('status_usado', filters.status_usado)
  if (filters.vendedor_id) query = query.eq('vendedor_id', filters.vendedor_id)
  if (filters.tipo_imovel) query = query.eq('tipo_imovel', filters.tipo_imovel)
  if (filters.tipo_renda) query = query.eq('tipo_renda', filters.tipo_renda)
  if (filters.tipo_cliente) query = query.eq('tipo_cliente', filters.tipo_cliente)
  if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`)
  if (filters.data_inicio) {
    query = query.gte('data_avaliacao', `${filters.data_inicio}T00:00:00`)
  }
  if (filters.data_fim) {
    query = query.lte('data_avaliacao', `${filters.data_fim}T23:59:59`)
  }
  if (filters.mes) {
    const [year, month] = filters.mes.split('-')
    const start = new Date(Number(year), Number(month) - 1, 1).toISOString()
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString()
    query = query.gte('data_avaliacao', start).lte('data_avaliacao', end)
  }

  const { data, count, error } = await query
    .order('data_avaliacao', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)
  return { clientes: data as Cliente[], total: count ?? 0, page, perPage }
}

// Distinct cidades from clientes (filtered by role via RLS).
// Usado para popular o dropdown de filtro de cidade.
export async function getCidades(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('cidade')
    .not('cidade', 'is', null)
    .not('cidade', 'eq', '')
  if (error) throw new Error(error.message)
  const set = new Set<string>()
  for (const row of data ?? []) {
    const c = (row as { cidade: string | null }).cidade?.trim()
    if (c) set.add(c)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function getClienteById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('*, vendedor:vendedores(id, nome)')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as Cliente
}

export async function createCliente(input: Partial<Cliente>) {
  const supabase = await createClient()
  const { profile } = await resolveProfile(supabase)

  let vendedor_id = input.vendedor_id ?? null
  if (profile?.role === 'VENDEDOR') {
    if (!profile.vendedor_id) {
      throw new Error(
        'Sua conta ainda não está vinculada a um vendedor. Peça ao administrador para cadastrar um vendedor com o seu e-mail de login.'
      )
    }
    vendedor_id = profile.vendedor_id // vendedor só cria clientes pra si
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...input, vendedor_id, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/clientes')
  return data as Cliente
}

export async function updateCliente(id: string, input: Partial<Cliente>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/clientes')
  revalidatePath('/vendas/crm')
  return data as Cliente
}

export async function deleteCliente(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/clientes')
}

// ─── VENDEDORES ──────────────────────────────────────────────────────────────

export async function getVendedores(apenasAtivos = false) {
  const supabase = await createClient()
  let query = supabase.from('vendedores').select('*').order('nome')
  if (apenasAtivos) query = query.eq('ativo', true)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as Vendedor[]
}

export async function createVendedor(nome: string, email?: string | null) {
  const supabase = await createClient()
  await assertAdmin(supabase)
  const { data, error } = await supabase
    .from('vendedores')
    .insert({ nome, email: email?.trim() || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/vendedores')
  return data as Vendedor
}

// Cria o vendedor E o usuário de login num passo só (somente ADMIN).
export async function createVendedorComAcesso(nome: string, email: string, password: string) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const cleanNome = nome.trim()
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanNome) throw new Error('Nome é obrigatório.')
  if (!cleanEmail) throw new Error('E-mail é obrigatório para criar o acesso.')
  if (!password || password.length < 6) {
    throw new Error('A senha deve ter ao menos 6 caracteres.')
  }

  // 1. Cria o vendedor primeiro — assim o trigger handle_new_user encontra
  //    o registro por e-mail e já preenche profiles.vendedor_id.
  const { data: vendedor, error: vErr } = await supabase
    .from('vendedores')
    .insert({ nome: cleanNome, email: cleanEmail })
    .select()
    .single()
  if (vErr) {
    if (vErr.code === '23505') throw new Error('Já existe um vendedor com este e-mail.')
    throw new Error(vErr.message)
  }

  // 2. Cria o usuário de login (service role, e-mail já confirmado).
  const admin = createAdminClient()
  const { data: created, error: aErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { nome: cleanNome },
  })

  if (aErr || !created?.user) {
    // Rollback do vendedor para não deixar registro órfão.
    await supabase.from('vendedores').delete().eq('id', vendedor.id)
    const msg = aErr?.message ?? 'Falha ao criar o acesso.'
    if (/already.*(registered|exists)/i.test(msg)) {
      throw new Error('Já existe um usuário de login com este e-mail.')
    }
    throw new Error(msg)
  }

  // 3. Garante o vínculo (idempotente; cobre qualquer timing do trigger).
  await admin.from('profiles').update({ vendedor_id: vendedor.id }).eq('id', created.user.id)

  revalidatePath('/vendas/vendedores')
  return vendedor as Vendedor
}

export async function updateVendedor(id: string, input: Partial<Vendedor>) {
  const supabase = await createClient()
  await assertAdmin(supabase)
  const { data, error } = await supabase
    .from('vendedores')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/vendedores')
  return data as Vendedor
}

export async function deleteVendedor(id: string) {
  const supabase = await createClient()
  await assertAdmin(supabase)
  const { error } = await supabase.from('vendedores').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/vendedores')
}

// ─── ETAPAS FUNIL ────────────────────────────────────────────────────────────

export async function getEtapasFunil() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('etapas_funil')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  if (error) throw new Error(error.message)
  return data as EtapaFunil[]
}

export async function createEtapaFunil(input: Partial<EtapaFunil>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('etapas_funil')
    .insert(input)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/crm')
  return data as EtapaFunil
}

export async function updateEtapaFunil(id: string, input: Partial<EtapaFunil>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('etapas_funil')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/crm')
  return data as EtapaFunil
}

export async function reorderEtapas(ids: string[]) {
  const supabase = await createClient()
  const updates = ids.map((id, index) =>
    supabase.from('etapas_funil').update({ ordem: index + 1 }).eq('id', id)
  )
  await Promise.all(updates)
  revalidatePath('/vendas/crm')
}

// ─── LEAD DISTRIBUIÇÃO ────────────────────────────────────────────────────────

export async function getLeadDistribuicao(vendedor_id?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('lead_distribuicao')
    .select('*, vendedor:vendedores(id, nome)')
    .order('data', { ascending: false })
  if (vendedor_id) query = query.eq('vendedor_id', vendedor_id)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as LeadDistribuicao[]
}

export async function upsertLeadDistribuicao(vendedor_id: string, quantidade: number, data: string) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from('lead_distribuicao')
    .insert({ vendedor_id, quantidade, data })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/vendedores')
  revalidatePath('/vendas/dashboard')
  return result
}

export async function deleteLeadDistribuicao(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('lead_distribuicao').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/vendedores')
  revalidatePath('/vendas/dashboard')
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export interface DashboardFilters {
  vendedor_id?: string
  status_novo?: string
  status_usado?: string
  data_inicio?: string   // YYYY-MM-DD
  data_fim?: string      // YYYY-MM-DD
}

type ClienteSlice = {
  id: string
  vendedor_id: string | null
  status_novo: string | null
  status_usado: string | null
  motivo_reprovacao: string | null
  motivo_reprovacao_usado: string | null
  valor_venda: number | null
  data_venda: string | null
  data_avaliacao: string | null
}

type LeadDistSlice = {
  vendedor_id: string
  quantidade: number
  data: string
}

async function fetchDashboardSlice(
  supabase: SupabaseServerClient,
  filtros: DashboardFilters,
  enforceVendedorId: string | null,
): Promise<{ clientes: ClienteSlice[]; leads: LeadDistSlice[] }> {
  let clientesQ = supabase
    .from('clientes')
    .select('id, vendedor_id, status_novo, status_usado, motivo_reprovacao, motivo_reprovacao_usado, valor_venda, data_venda, data_avaliacao')

  if (enforceVendedorId) clientesQ = clientesQ.eq('vendedor_id', enforceVendedorId)
  if (filtros.vendedor_id) clientesQ = clientesQ.eq('vendedor_id', filtros.vendedor_id)
  if (filtros.status_novo) clientesQ = clientesQ.eq('status_novo', filtros.status_novo)
  if (filtros.status_usado) clientesQ = clientesQ.eq('status_usado', filtros.status_usado)
  if (filtros.data_inicio) clientesQ = clientesQ.gte('data_avaliacao', `${filtros.data_inicio}T00:00:00`)
  if (filtros.data_fim) clientesQ = clientesQ.lte('data_avaliacao', `${filtros.data_fim}T23:59:59`)

  let leadsQ = supabase.from('lead_distribuicao').select('vendedor_id, quantidade, data')
  if (enforceVendedorId) leadsQ = leadsQ.eq('vendedor_id', enforceVendedorId)
  if (filtros.vendedor_id) leadsQ = leadsQ.eq('vendedor_id', filtros.vendedor_id)
  if (filtros.data_inicio) leadsQ = leadsQ.gte('data', `${filtros.data_inicio}T00:00:00`)
  if (filtros.data_fim) leadsQ = leadsQ.lte('data', `${filtros.data_fim}T23:59:59`)

  const [{ data: clientes, error: cErr }, { data: leads, error: lErr }] = await Promise.all([clientesQ, leadsQ])
  if (cErr) throw new Error(cErr.message)
  if (lErr) throw new Error(lErr.message)

  return {
    clientes: (clientes ?? []) as ClienteSlice[],
    leads: (leads ?? []) as LeadDistSlice[],
  }
}

function aggregateDashboard(clientes: ClienteSlice[], leads: LeadDistSlice[]) {
  const leads_enviados = leads.reduce((s, l) => s + (l.quantidade ?? 0), 0)
  const total_avaliacoes = clientes.filter(c =>
    (c.status_novo && c.status_novo !== 'NAO_AVALIADO') ||
    (c.status_usado && c.status_usado !== 'NAO_AVALIADO')
  ).length
  const vendas_fechadas = clientes.filter(c => c.valor_venda != null && c.data_venda != null).length
  const aprovados = clientes.filter(c => c.status_novo === 'APROVADO' || c.status_usado === 'APROVADO').length
  const condicionados = clientes.filter(c => c.status_novo === 'CONDICIONADO' || c.status_usado === 'CONDICIONADO').length
  const reprovados = clientes.filter(c => c.status_novo === 'REPROVADO' || c.status_usado === 'REPROVADO').length

  return { leads_enviados, total_avaliacoes, vendas_fechadas, aprovados, condicionados, reprovados }
}

// Categorias usadas tanto na lista "Status dos Leads" quanto nos breakdowns.
const STATUS_CATEGORIAS = [
  'REPROVADO', 'CONDICIONADO', 'APROVADO', 'DESISTENCIA', 'VENDA_FECHADA',
  'QV_LIBERACAO_REAVALIAR', 'PRECISA_CARTA_CANCELAMENTO', 'EM_ANALISE', 'TOKEN',
] as const

export async function getDashboardData(filtros: DashboardFilters = {}) {
  const supabase = await createClient()
  const { profile } = await resolveProfile(supabase)
  const enforce = profile?.role === 'VENDEDOR' ? (profile.vendedor_id ?? null) : null

  const { clientes, leads } = await fetchDashboardSlice(supabase, filtros, enforce)
  const current = aggregateDashboard(clientes, leads)

  // Tendência vs período anterior (mesma janela imediatamente antes).
  const prevWindow = previousPeriod(filtros.data_inicio, filtros.data_fim)
  let previous: ReturnType<typeof aggregateDashboard> | null = null
  if (prevWindow) {
    const slice = await fetchDashboardSlice(
      supabase,
      { ...filtros, data_inicio: prevWindow.data_inicio, data_fim: prevWindow.data_fim },
      enforce,
    )
    previous = aggregateDashboard(slice.clientes, slice.leads)
  }

  // Taxas derivadas (% mostradas nos KPIs)
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0
  const taxas = {
    conversao_aval: pct(current.total_avaliacoes, current.leads_enviados),     // Leads → Aval
    conversao_venda: pct(current.vendas_fechadas, current.total_avaliacoes),   // Aval → Venda
    qualificacao: pct(current.aprovados, current.total_avaliacoes),
    condicionamento: pct(current.condicionados, current.total_avaliacoes),
    perda: pct(current.reprovados, current.total_avaliacoes),
  }

  // Performance por vendedor: avaliações feitas (clientes com algum status != NAO_AVALIADO)
  // e leads recebidos (sum quantidade da lead_distribuicao no período).
  const { data: vendsRaw } = await supabase.from('vendedores').select('id, nome').eq('ativo', true)
  const vendedoresAtivos = (vendsRaw ?? []) as Array<{ id: string; nome: string }>
  const performance_vendedores = vendedoresAtivos.map(v => {
    const avaliacoes = clientes.filter(c =>
      c.vendedor_id === v.id &&
      ((c.status_novo && c.status_novo !== 'NAO_AVALIADO') || (c.status_usado && c.status_usado !== 'NAO_AVALIADO'))
    ).length
    const leads_recebidos = leads
      .filter(l => l.vendedor_id === v.id)
      .reduce((s, l) => s + (l.quantidade ?? 0), 0)
    return { vendedor_id: v.id, nome: v.nome, avaliacoes, leads_recebidos }
  }).filter(p => p.avaliacoes > 0 || p.leads_recebidos > 0)
    .sort((a, b) => b.avaliacoes - a.avaliacoes)

  // Status dos Leads: total (qualquer dos dois) + breakdown por coluna.
  const status_leads = STATUS_CATEGORIAS.map(s => {
    const novo = clientes.filter(c => c.status_novo === s).length
    const usado = clientes.filter(c => c.status_usado === s).length
    const total = clientes.filter(c => c.status_novo === s || c.status_usado === s).length
    return { status: s, total, novo, usado }
  }).filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)

  // Evolução diária: avaliações por dia (clientes.data_avaliacao) + leads por dia (lead_distribuicao.data).
  type DayBucket = { data: string; avaliacoes: number; leads: number }
  const dayMap = new Map<string, DayBucket>()
  const ensureDay = (d: string) => {
    if (!dayMap.has(d)) dayMap.set(d, { data: d, avaliacoes: 0, leads: 0 })
    return dayMap.get(d)!
  }
  for (const c of clientes) {
    if (!c.data_avaliacao) continue
    const d = c.data_avaliacao.slice(0, 10)
    ensureDay(d).avaliacoes++
  }
  for (const l of leads) {
    if (!l.data) continue
    const d = l.data.slice(0, 10)
    ensureDay(d).leads += l.quantidade ?? 0
  }
  const evolucao_diaria = [...dayMap.values()].sort((a, b) => a.data.localeCompare(b.data))

  // Análise de Motivos — Reprovação e Condicionamento, com breakdown NOVO/USADO.
  function motivosDe(filterStatus: string) {
    const map = new Map<string, { motivo: string; total: number; novo: number; usado: number; clienteIds: Set<string> }>()
    const get = (m: string) => {
      if (!map.has(m)) map.set(m, { motivo: m, total: 0, novo: 0, usado: 0, clienteIds: new Set() })
      return map.get(m)!
    }
    for (const c of clientes) {
      const isNovoMatch = c.status_novo === filterStatus && c.motivo_reprovacao
      const isUsadoMatch = c.status_usado === filterStatus && c.motivo_reprovacao_usado
      if (isNovoMatch) {
        const r = get(c.motivo_reprovacao!)
        r.novo++
        r.clienteIds.add(c.id)
      }
      if (isUsadoMatch) {
        const r = get(c.motivo_reprovacao_usado!)
        r.usado++
        r.clienteIds.add(c.id)
      }
    }
    return [...map.values()]
      .map(r => ({ motivo: r.motivo, total: r.clienteIds.size, novo: r.novo, usado: r.usado }))
      .sort((a, b) => b.total - a.total)
  }
  const motivos_reprovacao = motivosDe('REPROVADO')
  const motivos_condicionamento = motivosDe('CONDICIONADO')

  return {
    ...current,
    taxas,
    previous,
    performance_vendedores,
    status_leads,
    evolucao_diaria,
    motivos_reprovacao,
    motivos_condicionamento,
  }
}

// ─── FINANCEIRO DE VENDAS ─────────────────────────────────────────────────────
// Uma "venda" é um cliente com status='VENDA_FECHADA' + valor_venda + data_venda preenchidos.

export interface VendaFiltros {
  vendedor_id?: string
  tipo_venda?: 'NOVO' | 'USADO' | 'AMBOS'
  data_inicio?: string
  data_fim?: string
}

type VendaRow = {
  id: string
  nome: string
  vendedor_id: string | null
  tipo_venda: 'NOVO' | 'USADO' | 'AMBOS' | null
  valor_venda: number | null
  data_venda: string | null
  vendedor: { id: string; nome: string } | null
}

async function fetchVendasRows(
  supabase: SupabaseServerClient,
  filtros: VendaFiltros,
  enforceVendedorId: string | null,
): Promise<VendaRow[]> {
  let query = supabase
    .from('clientes')
    .select('id, nome, vendedor_id, tipo_venda, valor_venda, data_venda, vendedor:vendedores(id, nome)')
    .not('valor_venda', 'is', null)
    .not('data_venda', 'is', null)
    .order('data_venda', { ascending: false })

  if (enforceVendedorId) query = query.eq('vendedor_id', enforceVendedorId)
  if (filtros.vendedor_id) query = query.eq('vendedor_id', filtros.vendedor_id)
  if (filtros.tipo_venda) query = query.eq('tipo_venda', filtros.tipo_venda)
  if (filtros.data_inicio) query = query.gte('data_venda', `${filtros.data_inicio}T00:00:00`)
  if (filtros.data_fim) query = query.lte('data_venda', `${filtros.data_fim}T23:59:59`)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VendaRow[]
}

function aggregate(vendas: VendaRow[]) {
  const faturamento_total = vendas.reduce((s, v) => s + Number(v.valor_venda ?? 0), 0)
  const vendas_realizadas = vendas.length
  const ticket_medio = vendas_realizadas > 0 ? faturamento_total / vendas_realizadas : 0
  return { faturamento_total, vendas_realizadas, ticket_medio }
}

// Computa o "período anterior" com a mesma duração do range filtrado.
// Ex: 01/03 a 30/04 (60 dias) → 30/12 a 28/02. Retorna null se o range
// não estiver completo (sem comparação possível).
function previousPeriod(data_inicio?: string, data_fim?: string): { data_inicio: string; data_fim: string } | null {
  if (!data_inicio || !data_fim) return null
  const start = new Date(`${data_inicio}T00:00:00Z`)
  const end = new Date(`${data_fim}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const durationMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000) // dia anterior ao início
  const prevStart = new Date(prevEnd.getTime() - durationMs)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { data_inicio: fmt(prevStart), data_fim: fmt(prevEnd) }
}

export async function getVendasFinanceiro(filtros: VendaFiltros = {}) {
  const supabase = await createClient()
  const { profile } = await resolveProfile(supabase)
  // Vendedor só vê suas próprias vendas; admin vê tudo.
  const enforce = profile?.role === 'VENDEDOR' ? (profile.vendedor_id ?? null) : null

  const vendas = await fetchVendasRows(supabase, filtros, enforce)
  const current = aggregate(vendas)

  // Tendência vs período anterior — só calcula quando há range completo no filtro.
  const prevWindow = previousPeriod(filtros.data_inicio, filtros.data_fim)
  let previous: { faturamento_total: number; vendas_realizadas: number; ticket_medio: number } | null = null
  if (prevWindow) {
    const prevVendas = await fetchVendasRows(
      supabase,
      { ...filtros, data_inicio: prevWindow.data_inicio, data_fim: prevWindow.data_fim },
      enforce,
    )
    previous = aggregate(prevVendas)
  }

  const faturamento_por_tipo = {
    novo: vendas.filter(v => v.tipo_venda === 'NOVO').reduce((s, v) => s + Number(v.valor_venda ?? 0), 0),
    usado: vendas.filter(v => v.tipo_venda === 'USADO').reduce((s, v) => s + Number(v.valor_venda ?? 0), 0),
    ambos: vendas.filter(v => v.tipo_venda === 'AMBOS').reduce((s, v) => s + Number(v.valor_venda ?? 0), 0),
  }
  const count_por_tipo = {
    novo: vendas.filter(v => v.tipo_venda === 'NOVO').length,
    usado: vendas.filter(v => v.tipo_venda === 'USADO').length,
    ambos: vendas.filter(v => v.tipo_venda === 'AMBOS').length,
  }

  // Ranking de vendedores (apenas com pelo menos uma venda)
  const ranking_map = new Map<string, { vendedor_id: string; nome: string; novo: number; usado: number; total: number; vendas: number }>()
  for (const v of vendas) {
    if (!v.vendedor) continue
    const key = v.vendedor.id
    if (!ranking_map.has(key)) {
      ranking_map.set(key, { vendedor_id: key, nome: v.vendedor.nome, novo: 0, usado: 0, total: 0, vendas: 0 })
    }
    const r = ranking_map.get(key)!
    const valor = Number(v.valor_venda ?? 0)
    if (v.tipo_venda === 'NOVO') r.novo += valor
    if (v.tipo_venda === 'USADO') r.usado += valor
    if (v.tipo_venda === 'AMBOS') { r.novo += valor / 2; r.usado += valor / 2 }
    r.total += valor
    r.vendas += 1
  }
  const ranking = [...ranking_map.values()].sort((a, b) => b.total - a.total)

  return {
    faturamento_total: current.faturamento_total,
    vendas_realizadas: current.vendas_realizadas,
    ticket_medio: current.ticket_medio,
    faturamento_por_tipo,
    count_por_tipo,
    ranking,
    vendas,
    previous, // null se não há range completo no filtro
  }
}

// Marca um cliente existente como VENDA_FECHADA preenchendo tipo/valor/data.
export async function lancarVenda(input: {
  cliente_id: string
  tipo_venda: 'NOVO' | 'USADO' | 'AMBOS'
  valor_venda: number
  data_venda: string // YYYY-MM-DD
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes')
    .update({
      status: 'VENDA_FECHADA',
      tipo_venda: input.tipo_venda,
      valor_venda: input.valor_venda,
      data_venda: `${input.data_venda}T12:00:00`,
    })
    .eq('id', input.cliente_id)
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/financeiro')
  revalidatePath('/vendas/clientes')
}
