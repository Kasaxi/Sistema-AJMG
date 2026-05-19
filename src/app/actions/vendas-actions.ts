'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import type { Cliente, ClienteFilters, Vendedor, EtapaFunil, LeadDistribuicao } from '@/types/vendas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type ResolvedProfile = { role: string; vendedor_id: string | null } | null

// Resolve the current user's profile and lazily link it to a vendedor by
// matching e-mail (covers a vendedor created before OR after the account).
async function resolveProfile(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendedor_id')
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

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { user, profile } = await resolveProfile(supabase)
  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR',
    vendedor_id: profile?.vendedor_id ?? null,
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
  if (filters.status) query = query.eq('status_novo', filters.status)
  if (filters.vendedor_id) query = query.eq('vendedor_id', filters.vendedor_id)
  if (filters.tipo_imovel) query = query.eq('tipo_imovel', filters.tipo_imovel)
  if (filters.tipo_renda) query = query.eq('tipo_renda', filters.tipo_renda)
  if (filters.tipo_cliente) query = query.eq('tipo_cliente', filters.tipo_cliente)
  if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`)
  if (filters.mes) {
    const [year, month] = filters.mes.split('-')
    const start = new Date(Number(year), Number(month) - 1, 1).toISOString()
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString()
    query = query.gte('data_avaliacao', start).lte('data_avaliacao', end)
  }

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)
  return { clientes: data as Cliente[], total: count ?? 0, page, perPage }
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
    .upsert({ vendedor_id, quantidade, data }, { onConflict: 'vendedor_id,data' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/vendas/vendedores')
  return result
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export async function getDashboardData(mes?: string) {
  const supabase = await createClient()
  const { profile } = await resolveProfile(supabase)

  let baseQuery = supabase.from('clientes').select('*')
  if (profile?.role === 'VENDEDOR' && profile.vendedor_id) {
    baseQuery = baseQuery.eq('vendedor_id', profile.vendedor_id)
  }

  if (mes) {
    const [year, month] = mes.split('-')
    const start = new Date(Number(year), Number(month) - 1, 1).toISOString()
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString()
    baseQuery = baseQuery.gte('data_avaliacao', start).lte('data_avaliacao', end)
  }

  const { data: clientes } = await baseQuery
  const { data: vendedores } = await supabase.from('vendedores').select('id, nome').eq('ativo', true)

  const total = clientes?.length ?? 0
  const aprovados = clientes?.filter(c => c.status_novo === 'APROVADO').length ?? 0
  const reprovados = clientes?.filter(c => c.status_novo === 'REPROVADO').length ?? 0
  const condicionados = clientes?.filter(c => c.status_novo === 'CONDICIONADO').length ?? 0
  const vendasFechadas = clientes?.filter(c => c.status_novo === 'VENDA_FECHADA').length ?? 0
  const valorTotalVendas = clientes
    ?.filter(c => c.valor_venda)
    .reduce((acc, c) => acc + (c.valor_venda ?? 0), 0) ?? 0

  const byVendedor = vendedores?.map(v => ({
    vendedor: v.nome,
    total: clientes?.filter(c => c.vendedor_id === v.id).length ?? 0,
    aprovados: clientes?.filter(c => c.vendedor_id === v.id && c.status_novo === 'APROVADO').length ?? 0,
  })) ?? []

  const byTipoImovel = {
    novo: clientes?.filter(c => c.tipo_imovel === 'NOVO').length ?? 0,
    usado: clientes?.filter(c => c.tipo_imovel === 'USADO').length ?? 0,
    ambos: clientes?.filter(c => c.tipo_imovel === 'AMBOS').length ?? 0,
  }

  const motivosReprovacao = clientes
    ?.filter(c => c.motivo_reprovacao)
    .reduce((acc: Record<string, number>, c) => {
      const motivo = c.motivo_reprovacao!
      acc[motivo] = (acc[motivo] ?? 0) + 1
      return acc
    }, {}) ?? {}

  const taxaConversao = total > 0 ? Math.round((vendasFechadas / total) * 100) : 0

  return {
    total,
    aprovados,
    reprovados,
    condicionados,
    vendasFechadas,
    valorTotalVendas,
    byVendedor,
    byTipoImovel,
    motivosReprovacao,
    taxaConversao,
  }
}
