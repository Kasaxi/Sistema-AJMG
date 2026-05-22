'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type {
  AgendaItem,
  AgendaItemInput,
  AgendaFilters,
  AgendaRecorrencia,
  AgendaStatus,
  CategoriaAgenda,
  Subtarefa,
  AgendaHistorico,
  AgendaAnexo,
  AnexoTipo,
} from '@/types/agenda'

const SELECT_ITEM = `
  *,
  categoria:categorias_agenda(id, nome, cor, icone, ordem, ativo, created_at, updated_at),
  criador:profiles!agenda_itens_criado_por_fkey(id, nome),
  atribuido:profiles!agenda_itens_atribuido_para_fkey(id, nome),
  subtarefas(*),
  anexos:agenda_anexos(*)
`

function revalidateAgenda() {
  revalidatePath('/agenda')
  revalidatePath('/agenda/tarefas')
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

// ═══════════════════════════════════════════════════════════════
// ITENS (núcleo)
// ═══════════════════════════════════════════════════════════════

export async function listAgendaItens(filters: AgendaFilters = {}): Promise<AgendaItem[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('agenda_itens').select(SELECT_ITEM)

  if (filters.search) {
    q = q.or(`titulo.ilike.%${filters.search}%,descricao.ilike.%${filters.search}%`)
  }
  if (filters.status) {
    q = Array.isArray(filters.status) ? q.in('status', filters.status) : q.eq('status', filters.status)
  }
  if (filters.prioridade) {
    q = Array.isArray(filters.prioridade) ? q.in('prioridade', filters.prioridade) : q.eq('prioridade', filters.prioridade)
  }
  if (filters.categoria_id) q = q.eq('categoria_id', filters.categoria_id)
  if (filters.atribuido_para) q = q.eq('atribuido_para', filters.atribuido_para)
  if (filters.tipo) q = q.eq('tipo', filters.tipo)
  if (filters.data_inicio) q = q.gte('data', filters.data_inicio)
  if (filters.data_fim) q = q.lte('data', filters.data_fim)

  q = q.order('data', { ascending: true })
       .order('hora_inicio', { ascending: true, nullsFirst: false })
       .order('ordem', { ascending: true })

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgendaItem[]
}

export async function getAgendaItem(id: string): Promise<AgendaItem | null> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('agenda_itens')
    .select(SELECT_ITEM)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as AgendaItem) ?? null
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

// Expande presets em datas concretas, partindo da data inicial até recorrencia_ate.
// Limite de segurança: 365 instâncias.
function expandRecorrencia(dataInicial: string, recorrencia: AgendaRecorrencia, recorrenciaAte: string | null): string[] {
  if (recorrencia === 'NENHUMA' || !recorrenciaAte) return [dataInicial]
  const datas: string[] = [dataInicial]
  let atual = dataInicial
  const limite = 365

  while (datas.length < limite) {
    let proxima: string
    switch (recorrencia) {
      case 'DIARIA':    proxima = addDays(atual, 1); break
      case 'SEMANAL':   proxima = addDays(atual, 7); break
      case 'QUINZENAL': proxima = addDays(atual, 15); break
      case 'MENSAL':    proxima = addMonths(atual, 1); break
      case 'ANUAL':     proxima = addMonths(atual, 12); break
      default:          return datas
    }
    if (proxima > recorrenciaAte) break
    datas.push(proxima)
    atual = proxima
  }
  return datas
}

export async function createAgendaItem(input: AgendaItemInput): Promise<AgendaItem> {
  const { supabase, user } = await requireUser()

  const recorrencia = input.recorrencia ?? 'NENHUMA'
  const datas = expandRecorrencia(input.data, recorrencia, input.recorrencia_ate ?? null)

  // Cria o "pai" (primeira instância) com os dados de recorrência.
  const baseRow = {
    tipo: input.tipo,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    data: datas[0],
    hora_inicio: input.hora_inicio ?? null,
    hora_fim: input.hora_fim ?? null,
    prioridade: input.prioridade ?? 'MEDIA',
    status: input.status ?? 'PENDENTE',
    categoria_id: input.categoria_id ?? null,
    local: input.local ?? null,
    observacoes: input.observacoes ?? null,
    criado_por: user.id,
    atribuido_para: input.atribuido_para ?? null,
    cliente_id: input.cliente_id ?? null,
    obra_id: input.obra_id ?? null,
    recorrencia,
    recorrencia_ate: input.recorrencia_ate ?? null,
  }

  const { data: pai, error: ePai } = await supabase
    .from('agenda_itens')
    .insert(baseRow)
    .select(SELECT_ITEM)
    .single()
  if (ePai) throw new Error(ePai.message)

  // Cria instâncias filhas (se houver recorrência) — sem repetir a recorrência.
  if (datas.length > 1) {
    const filhas = datas.slice(1).map(data => ({
      ...baseRow,
      data,
      recorrencia: 'NENHUMA' as const,
      recorrencia_ate: null,
      recorrencia_pai_id: (pai as { id: string }).id,
    }))
    const { error: eFilhas } = await supabase.from('agenda_itens').insert(filhas)
    if (eFilhas) throw new Error(eFilhas.message)
  }

  revalidateAgenda()
  return pai as unknown as AgendaItem
}

export async function updateAgendaItem(id: string, input: Partial<AgendaItemInput>): Promise<AgendaItem> {
  const { supabase } = await requireUser()
  // Recorrência não é editável por update no MVP (precisaria expandir/deletar instâncias).
  const { recorrencia: _r, recorrencia_ate: _ra, ...editable } = input
  void _r; void _ra

  const { data, error } = await supabase
    .from('agenda_itens')
    .update(editable)
    .eq('id', id)
    .select(SELECT_ITEM)
    .single()
  if (error) throw new Error(error.message)
  revalidateAgenda()
  return data as unknown as AgendaItem
}

export async function updateAgendaItemStatus(id: string, status: AgendaStatus): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('agenda_itens').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAgenda()
}

export async function updateAgendaItemOrdem(updates: { id: string; ordem: number; status?: AgendaStatus }[]): Promise<void> {
  const { supabase } = await requireUser()
  for (const u of updates) {
    const patch: { ordem: number; status?: AgendaStatus } = { ordem: u.ordem }
    if (u.status) patch.status = u.status
    const { error } = await supabase.from('agenda_itens').update(patch).eq('id', u.id)
    if (error) throw new Error(error.message)
  }
  revalidateAgenda()
}

export async function deleteAgendaItem(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('agenda_itens').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAgenda()
}

// ═══════════════════════════════════════════════════════════════
// SUBTAREFAS (checklist)
// ═══════════════════════════════════════════════════════════════

export async function addSubtarefa(itemId: string, titulo: string): Promise<Subtarefa> {
  const { supabase } = await requireUser()

  const { data: existentes } = await supabase
    .from('subtarefas')
    .select('ordem')
    .eq('item_id', itemId)
    .order('ordem', { ascending: false })
    .limit(1)
  const proximaOrdem = (existentes?.[0]?.ordem ?? -1) + 1

  const { data, error } = await supabase
    .from('subtarefas')
    .insert({ item_id: itemId, titulo, ordem: proximaOrdem })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidateAgenda()
  return data as Subtarefa
}

export async function toggleSubtarefa(id: string, concluida: boolean): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('subtarefas').update({ concluida }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAgenda()
}

export async function updateSubtarefa(id: string, titulo: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('subtarefas').update({ titulo }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAgenda()
}

export async function deleteSubtarefa(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('subtarefas').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAgenda()
}

// ═══════════════════════════════════════════════════════════════
// CATEGORIAS (admin)
// ═══════════════════════════════════════════════════════════════

export async function listCategoriasAgenda(opts: { ativosApenas?: boolean } = {}): Promise<CategoriaAgenda[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('categorias_agenda').select('*').order('ordem', { ascending: true })
  if (opts.ativosApenas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoriaAgenda[]
}

/** Lista categorias com contagem de itens vinculados (pra UI de gestão). */
export async function listCategoriasAgendaComContagem(): Promise<(CategoriaAgenda & { total_itens: number })[]> {
  const { supabase } = await requireUser()
  const { data: cats, error } = await supabase
    .from('categorias_agenda')
    .select('*')
    .order('ordem', { ascending: true })
  if (error) throw new Error(error.message)

  // Conta itens por categoria
  const { data: itens } = await supabase.from('agenda_itens').select('categoria_id')
  const counts = new Map<string, number>()
  for (const i of itens ?? []) {
    if (!i.categoria_id) continue
    counts.set(i.categoria_id, (counts.get(i.categoria_id) ?? 0) + 1)
  }

  return (cats ?? []).map(c => ({ ...(c as CategoriaAgenda), total_itens: counts.get(c.id) ?? 0 }))
}

export async function createCategoriaAgenda(input: { nome: string; cor?: string | null; icone?: string | null; ordem?: number }): Promise<CategoriaAgenda> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('categorias_agenda')
    .insert({
      nome: input.nome,
      cor: input.cor ?? null,
      icone: input.icone ?? null,
      ordem: input.ordem ?? 0,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/categorias-agenda')
  revalidateAgenda()
  return data as CategoriaAgenda
}

export async function updateCategoriaAgenda(id: string, patch: Partial<CategoriaAgenda>): Promise<void> {
  const { supabase } = await requireUser()
  const allowed: Partial<CategoriaAgenda> = {}
  if (patch.nome !== undefined) allowed.nome = patch.nome
  if (patch.cor !== undefined) allowed.cor = patch.cor
  if (patch.icone !== undefined) allowed.icone = patch.icone
  if (patch.ordem !== undefined) allowed.ordem = patch.ordem
  if (patch.ativo !== undefined) allowed.ativo = patch.ativo

  const { error } = await supabase.from('categorias_agenda').update(allowed).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/categorias-agenda')
  revalidateAgenda()
}

export async function deleteCategoriaAgenda(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('categorias_agenda').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/categorias-agenda')
  revalidateAgenda()
}

// ═══════════════════════════════════════════════════════════════
// HISTÓRICO
// ═══════════════════════════════════════════════════════════════

export async function listHistoricoItem(itemId: string): Promise<AgendaHistorico[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('agenda_historico')
    .select('*, autor:profiles!agenda_historico_mudado_por_fkey(id, nome)')
    .eq('item_id', itemId)
    .order('mudado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgendaHistorico[]
}

// ═══════════════════════════════════════════════════════════════
// ANEXOS (Supabase Storage)
// ═══════════════════════════════════════════════════════════════

const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50 MB

function detectarTipo(mime: string | null): AnexoTipo {
  if (!mime) return 'DOCUMENTO'
  if (mime.startsWith('image/')) return 'FOTO'
  if (mime.startsWith('video/')) return 'VIDEO'
  return 'DOCUMENTO'
}

function safeFileName(name: string): string {
  const ts = Date.now()
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  return `${ts}_${clean}`
}

/** Faz upload de UM arquivo pro bucket e registra em `agenda_anexos`. */
export async function uploadAgendaAnexo(itemId: string, formData: FormData): Promise<AgendaAnexo> {
  const { supabase, user } = await requireUser()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('Arquivo ausente')

  const tipo = detectarTipo(file.type)
  if (tipo === 'VIDEO' && file.size > MAX_VIDEO_BYTES) {
    throw new Error('Vídeo maior que 50 MB')
  }

  const fileName = safeFileName(file.name)
  const storagePath = `${itemId}/${fileName}`

  const { error: upErr } = await supabase.storage
    .from('agenda-anexos')
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (upErr) throw new Error(`Upload falhou: ${upErr.message}`)

  const { data, error } = await supabase
    .from('agenda_anexos')
    .insert({
      item_id: itemId,
      tipo,
      nome: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
      enviado_por: user.id,
    })
    .select('*')
    .single()

  if (error) {
    // Limpa o blob órfão se o insert falhou (ex.: trigger de limite de 20)
    await supabase.storage.from('agenda-anexos').remove([storagePath]).catch(() => {})
    throw new Error(error.message)
  }

  revalidateAgenda()
  return data as AgendaAnexo
}

export async function deleteAgendaAnexo(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { data: anexo, error: eGet } = await supabase
    .from('agenda_anexos')
    .select('storage_path')
    .eq('id', id)
    .single()
  if (eGet) throw new Error(eGet.message)

  // Remove blob primeiro; se falhar, ainda removemos o registro (não há valor em órfão na fila).
  await supabase.storage.from('agenda-anexos').remove([(anexo as { storage_path: string }).storage_path]).catch(() => {})

  const { error } = await supabase.from('agenda_anexos').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidateAgenda()
}

/** Gera URL assinada (60 min) pra exibir/baixar um anexo. */
export async function getAnexoSignedUrl(storagePath: string): Promise<string> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.storage
    .from('agenda-anexos')
    .createSignedUrl(storagePath, 60 * 60)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ═══════════════════════════════════════════════════════════════
// QUERIES DAS VIEWS (Hoje / Atrasadas / Próximos / Semana / Mês)
// ═══════════════════════════════════════════════════════════════

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Filtra por usuário (criado_por OU atribuido_para):
 *   - paraUsuario === undefined → SELF (current user)
 *   - paraUsuario === 'ALL'     → não filtra
 *   - paraUsuario === <uuid>    → filtra por esse profile
 */
type FiltroUsuario = string | 'ALL' | undefined
function aplicarFiltroUsuario<T>(query: T, currentUserId: string, paraUsuario: FiltroUsuario): T {
  if (paraUsuario === 'ALL') return query
  const id = paraUsuario ?? currentUserId
  // @ts-expect-error supabase query builder shape
  return query.or(`criado_por.eq.${id},atribuido_para.eq.${id}`)
}

export async function getItensHoje(opts: { paraUsuario?: FiltroUsuario } = {}): Promise<AgendaItem[]> {
  const { supabase, user } = await requireUser()
  let q = supabase.from('agenda_itens').select(SELECT_ITEM)
    .eq('data', hojeISO())
  q = aplicarFiltroUsuario(q, user.id, opts.paraUsuario)
  q = q.order('hora_inicio', { ascending: true, nullsFirst: false }).order('ordem', { ascending: true })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgendaItem[]
}

export async function getItensAtrasados(opts: { paraUsuario?: FiltroUsuario } = {}): Promise<AgendaItem[]> {
  const { supabase, user } = await requireUser()
  let q = supabase.from('agenda_itens').select(SELECT_ITEM)
    .lt('data', hojeISO())
    .not('status', 'in', '(CONCLUIDO,CANCELADO)')
  q = aplicarFiltroUsuario(q, user.id, opts.paraUsuario)
  q = q.order('data', { ascending: true })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgendaItem[]
}

export async function getItensProximos(diasAFrente = 30, opts: { paraUsuario?: FiltroUsuario } = {}): Promise<AgendaItem[]> {
  const hoje = hojeISO()
  const limite = addDays(hoje, diasAFrente)
  const { supabase, user } = await requireUser()
  let q = supabase.from('agenda_itens').select(SELECT_ITEM)
    .gt('data', hoje)
    .lte('data', limite)
  q = aplicarFiltroUsuario(q, user.id, opts.paraUsuario)
  q = q.order('data', { ascending: true })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgendaItem[]
}

/** Tarefas/agendamentos já concluídos, ordenados por data desc (mais recentes primeiro). */
export async function getItensConcluidos(limit = 200, opts: { paraUsuario?: FiltroUsuario } = {}): Promise<AgendaItem[]> {
  const { supabase, user } = await requireUser()
  let q = supabase.from('agenda_itens').select(SELECT_ITEM)
    .eq('status', 'CONCLUIDO')
  q = aplicarFiltroUsuario(q, user.id, opts.paraUsuario)
  q = q.order('data', { ascending: false }).limit(limit)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AgendaItem[]
}

/** Recupera itens de um mês inteiro pra view de calendário. month no formato YYYY-MM. */
export async function getItensDoMes(month: string): Promise<AgendaItem[]> {
  const [y, m] = month.split('-').map(Number)
  const inicio = `${y}-${String(m).padStart(2, '0')}-01`
  const ultimoDia = new Date(y, m, 0).getDate()
  const fim = `${y}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return listAgendaItens({ data_inicio: inicio, data_fim: fim })
}

/** Recupera os itens da semana corrente (segunda a domingo). */
export async function getItensDaSemana(): Promise<AgendaItem[]> {
  const hoje = new Date()
  const diaSemana = hoje.getDay() // 0=dom, 1=seg...
  const offsetSegunda = diaSemana === 0 ? -6 : 1 - diaSemana
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() + offsetSegunda)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  return listAgendaItens({
    data_inicio: inicio.toISOString().slice(0, 10),
    data_fim: fim.toISOString().slice(0, 10),
  })
}

// ═══════════════════════════════════════════════════════════════
// PROFILES (lista pra "atribuir a quem")
// ═══════════════════════════════════════════════════════════════

export async function listProfilesAtivosComAgenda(): Promise<{ id: string; nome: string }[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, role, acesso_modulos, ativo')
    .eq('ativo', true)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter(p =>
      p.role === 'ADMIN' ||
      (p.role === 'COLABORADOR' && Array.isArray(p.acesso_modulos) && (p.acesso_modulos as string[]).includes('AGENDA'))
    )
    .map(p => ({ id: p.id as string, nome: p.nome as string }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
