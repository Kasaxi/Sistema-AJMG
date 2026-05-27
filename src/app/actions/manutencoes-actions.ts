'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type {
  Manutencao,
  ManutencaoInput,
  ManutencaoStatus,
  ManutencaoItem,
  ManutencaoItemInput,
  ManutencaoItemStatus,
  ManutencaoAnexo,
  ClientePosVenda,
  ClientePosVendaInput,
  TipoManutencao,
} from '@/types/manutencoes'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

function revalidateManutencoes(id?: string) {
  revalidatePath('/manutencoes')
  if (id) revalidatePath(`/manutencoes/${id}`)
}

const MANUTENCAO_SELECT = `
  *,
  cliente:clientes_pos_venda(*),
  responsavel:profiles!responsavel_id(id, nome)
`

// ═══════════════════════════════════════════════════════════════
// PROFILES ATIVOS COM ACESSO A MANUTENÇÃO
// ═══════════════════════════════════════════════════════════════

export async function listProfilesAtivosComManutencao(): Promise<{ id: string; nome: string }[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, role, acesso_modulos, ativo')
    .eq('ativo', true)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter(p =>
      p.role === 'ADMIN' ||
      (p.role === 'COLABORADOR' && Array.isArray(p.acesso_modulos) && (p.acesso_modulos as string[]).includes('MANUTENCAO'))
    )
    .map(p => ({ id: p.id as string, nome: p.nome as string }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

// ═══════════════════════════════════════════════════════════════
// TIPOS DE MANUTENÇÃO
// ═══════════════════════════════════════════════════════════════

export async function listTiposManutencao(opts: { ativosApenas?: boolean } = {}): Promise<TipoManutencao[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('tipos_manutencao').select('*').order('ordem', { ascending: true })
  if (opts.ativosApenas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TipoManutencao[]
}

// ═══════════════════════════════════════════════════════════════
// CLIENTES PÓS-VENDA
// ═══════════════════════════════════════════════════════════════

export async function listClientesPosVenda(opts: { search?: string } = {}): Promise<ClientePosVenda[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('clientes_pos_venda').select('*').order('nome', { ascending: true })
  if (opts.search?.trim()) {
    const safe = opts.search.replace(/[%_]/g, '\\$&')
    q = q.or(`nome.ilike.%${safe}%,telefone.ilike.%${safe}%,cpf_cnpj.ilike.%${safe}%`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientePosVenda[]
}

export async function searchClientesPosVenda(query: string, limit = 8): Promise<ClientePosVenda[]> {
  const { supabase } = await requireUser()
  const q = query.trim()
  if (!q) return []
  const safe = q.replace(/[%_]/g, '\\$&')
  const { data, error } = await supabase
    .from('clientes_pos_venda')
    .select('*')
    .or(`nome.ilike.%${safe}%,telefone.ilike.%${safe}%,cpf_cnpj.ilike.%${safe}%`)
    .order('nome', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientePosVenda[]
}

export async function createClientePosVenda(input: ClientePosVendaInput): Promise<ClientePosVenda> {
  const { supabase, user } = await requireUser()
  const nome = input.nome.trim()
  if (!nome) throw new Error('Nome é obrigatório.')
  const { data, error } = await supabase
    .from('clientes_pos_venda')
    .insert({
      nome,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      cpf_cnpj: input.cpf_cnpj?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      criado_por: user.id,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidateManutencoes()
  return data as ClientePosVenda
}

export async function updateClientePosVenda(id: string, patch: Partial<ClientePosVendaInput>): Promise<ClientePosVenda> {
  const { supabase } = await requireUser()
  const payload: Record<string, unknown> = {}
  if (patch.nome !== undefined)         payload.nome = patch.nome.trim()
  if (patch.telefone !== undefined)     payload.telefone = patch.telefone?.trim() || null
  if (patch.email !== undefined)        payload.email = patch.email?.trim() || null
  if (patch.cpf_cnpj !== undefined)     payload.cpf_cnpj = patch.cpf_cnpj?.trim() || null
  if (patch.observacoes !== undefined)  payload.observacoes = patch.observacoes?.trim() || null

  const { data, error } = await supabase
    .from('clientes_pos_venda').update(payload).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  revalidateManutencoes()
  return data as ClientePosVenda
}

// ═══════════════════════════════════════════════════════════════
// MANUTENÇÕES — list / get
// ═══════════════════════════════════════════════════════════════

export interface ManutencoesFilters {
  status?: ManutencaoStatus
  responsavel_id?: string
  cliente_id?: string
  search?: string
}

export async function listManutencoes(filters: ManutencoesFilters = {}): Promise<Manutencao[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('manutencoes').select(MANUTENCAO_SELECT).order('created_at', { ascending: false })

  if (filters.status)         q = q.eq('status', filters.status)
  if (filters.responsavel_id) q = q.eq('responsavel_id', filters.responsavel_id)
  if (filters.cliente_id)     q = q.eq('cliente_id', filters.cliente_id)
  if (filters.search?.trim()) {
    const safe = filters.search.replace(/[%_]/g, '\\$&')
    q = q.or(`endereco.ilike.%${safe}%,observacoes.ilike.%${safe}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Manutencao[]
}

export async function getManutencao(id: string): Promise<Manutencao | null> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('manutencoes')
    .select(MANUTENCAO_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as Manutencao) ?? null
}

// ═══════════════════════════════════════════════════════════════
// MANUTENÇÕES — mutações
// ═══════════════════════════════════════════════════════════════

export async function createManutencao(input: ManutencaoInput): Promise<Manutencao> {
  const { supabase, user } = await requireUser()

  const itensValidos = (input.itens ?? []).filter(i => i.descricao.trim())
  if (itensValidos.length === 0) {
    throw new Error('Adicione ao menos um item descrevendo o problema.')
  }

  const { data: m, error } = await supabase
    .from('manutencoes')
    .insert({
      cliente_id: input.cliente_id || null,
      endereco: input.endereco?.trim() || null,
      data_agendada: input.data_agendada || null,
      hora_inicio: input.hora_inicio || null,
      responsavel_id: input.responsavel_id || null,
      observacoes: input.observacoes?.trim() || null,
      criado_por: user.id,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  // Insere itens iniciais (cada um com seu tipo)
  const rows = itensValidos.map((it, i) => ({
    manutencao_id: m.id,
    tipo_id: it.tipo_id || null,
    descricao: it.descricao.trim(),
    status: it.status ?? 'PENDENTE',
    observacoes: it.observacoes?.trim() || null,
    ordem: it.ordem ?? i,
  }))
  const { error: itensErr } = await supabase.from('manutencao_itens').insert(rows)
  if (itensErr) console.error('[manutencoes] Falhou ao inserir itens iniciais:', itensErr.message)

  // Integração opcional com Agenda
  if (input.criar_na_agenda && input.data_agendada && input.responsavel_id) {
    try {
      const { data: catAgenda } = await supabase
        .from('categorias_agenda')
        .select('id')
        .ilike('nome', 'Manutenção')
        .maybeSingle()

      // Deriva título e descrição dos itens
      const primeiroItemTxt = itensValidos[0]?.descricao.trim() || ''
      const tituloDerivado = primeiroItemTxt
        ? (itensValidos.length > 1
            ? `${primeiroItemTxt.slice(0, 60)} +${itensValidos.length - 1}`
            : primeiroItemTxt.slice(0, 80))
        : 'Manutenção'
      const descricaoDerivada = itensValidos.length > 0
        ? itensValidos.map(i => `• ${i.descricao}`).join('\n')
        : 'Manutenção agendada.'
      const localDerivado = input.endereco?.trim() || null

      // Cria item de agenda chamando server action correlata (mantém recorrência etc).
      const { createAgendaItem } = await import('@/app/actions/agenda-actions')
      const agendaItem = await createAgendaItem({
        tipo: 'TAREFA',
        titulo: tituloDerivado,
        descricao: descricaoDerivada,
        data: input.data_agendada,
        hora_inicio: input.hora_inicio || null,
        atribuido_para: input.responsavel_id,
        categoria_id: catAgenda?.id ?? null,
        local: localDerivado,
        prioridade: 'MEDIA',
        status: 'PENDENTE',
      })

      // Vincula manutenção ao item de agenda
      await supabase
        .from('manutencoes')
        .update({ agenda_item_id: agendaItem.id })
        .eq('id', m.id)
    } catch (err) {
      // Falha na integração não deve quebrar a criação da manutenção
      console.error('[manutencoes] Falhou ao criar item de agenda:', err)
    }
  }

  revalidateManutencoes()
  return m as Manutencao
}

export async function updateManutencao(id: string, patch: Partial<ManutencaoInput>): Promise<Manutencao> {
  const { supabase } = await requireUser()
  const payload: Record<string, unknown> = {}
  if (patch.cliente_id !== undefined)      payload.cliente_id = patch.cliente_id || null
  if (patch.endereco !== undefined)        payload.endereco = patch.endereco?.trim() || null
  if (patch.data_agendada !== undefined)   payload.data_agendada = patch.data_agendada || null
  if (patch.hora_inicio !== undefined)     payload.hora_inicio = patch.hora_inicio || null
  if (patch.responsavel_id !== undefined)  payload.responsavel_id = patch.responsavel_id || null
  if (patch.observacoes !== undefined)     payload.observacoes = patch.observacoes?.trim() || null

  const { data, error } = await supabase
    .from('manutencoes').update(payload).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  revalidateManutencoes(id)
  return data as Manutencao
}

export async function setManutencaoStatus(id: string, status: ManutencaoStatus): Promise<void> {
  const { supabase } = await requireUser()

  const payload: Record<string, unknown> = { status }
  if (status === 'CONCLUIDA') payload.data_concluida = new Date().toISOString().slice(0, 10)

  const { data: row, error } = await supabase
    .from('manutencoes').update(payload).eq('id', id)
    .select('agenda_item_id').single()
  if (error) throw new Error(error.message)

  // Sincroniza status com a agenda quando aplicável.
  if (row?.agenda_item_id && (status === 'CONCLUIDA' || status === 'CANCELADA')) {
    try {
      const { updateAgendaItemStatus } = await import('@/app/actions/agenda-actions')
      await updateAgendaItemStatus(
        row.agenda_item_id,
        status === 'CONCLUIDA' ? 'CONCLUIDO' : 'CANCELADO',
      )
    } catch (err) {
      console.error('[manutencoes] Falhou sync de status com agenda:', err)
    }
  }

  revalidateManutencoes(id)
}

export async function deleteManutencao(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('manutencoes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateManutencoes()
}

// ═══════════════════════════════════════════════════════════════
// ITENS DA MANUTENÇÃO
// ═══════════════════════════════════════════════════════════════

export async function listManutencaoItens(manutencaoId: string): Promise<ManutencaoItem[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('manutencao_itens')
    .select('*, tipo:tipos_manutencao(*)')
    .eq('manutencao_id', manutencaoId)
    .order('ordem', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ManutencaoItem[]
}

export async function addManutencaoItem(manutencaoId: string, input: ManutencaoItemInput): Promise<ManutencaoItem> {
  const { supabase } = await requireUser()
  if (!input.descricao.trim()) throw new Error('Descrição obrigatória.')

  // Próxima ordem
  const { data: ultimo } = await supabase
    .from('manutencao_itens')
    .select('ordem')
    .eq('manutencao_id', manutencaoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  const ordem = input.ordem ?? ((ultimo?.ordem ?? -1) + 1)

  const { data, error } = await supabase
    .from('manutencao_itens')
    .insert({
      manutencao_id: manutencaoId,
      tipo_id: input.tipo_id || null,
      descricao: input.descricao.trim(),
      status: input.status ?? 'PENDENTE',
      observacoes: input.observacoes?.trim() || null,
      ordem,
    })
    .select('*, tipo:tipos_manutencao(*)')
    .single()
  if (error) throw new Error(error.message)
  revalidateManutencoes(manutencaoId)
  return data as unknown as ManutencaoItem
}

export async function updateManutencaoItem(itemId: string, patch: Partial<ManutencaoItemInput>): Promise<void> {
  const { supabase } = await requireUser()
  const payload: Record<string, unknown> = {}
  if (patch.descricao !== undefined)    payload.descricao = patch.descricao.trim()
  if (patch.tipo_id !== undefined)      payload.tipo_id = patch.tipo_id || null
  if (patch.status !== undefined)       payload.status = patch.status
  if (patch.observacoes !== undefined)  payload.observacoes = patch.observacoes?.trim() || null
  if (patch.ordem !== undefined)        payload.ordem = patch.ordem

  const { data: row } = await supabase
    .from('manutencao_itens').select('manutencao_id').eq('id', itemId).maybeSingle()
  const { error } = await supabase.from('manutencao_itens').update(payload).eq('id', itemId)
  if (error) throw new Error(error.message)
  if (row?.manutencao_id) revalidateManutencoes(row.manutencao_id)
}

export async function setItemStatus(itemId: string, status: ManutencaoItemStatus): Promise<void> {
  await updateManutencaoItem(itemId, { status })
}

export async function removeManutencaoItem(itemId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { data: row } = await supabase
    .from('manutencao_itens').select('manutencao_id').eq('id', itemId).maybeSingle()
  const { error } = await supabase.from('manutencao_itens').delete().eq('id', itemId)
  if (error) throw new Error(error.message)
  if (row?.manutencao_id) revalidateManutencoes(row.manutencao_id)
}

// ═══════════════════════════════════════════════════════════════
// ANEXOS
// ═══════════════════════════════════════════════════════════════

export async function listManutencaoAnexos(
  manutencaoId: string,
  opts: { item_id?: string | null } = {},
): Promise<ManutencaoAnexo[]> {
  const { supabase } = await requireUser()
  let q = supabase
    .from('manutencao_anexos')
    .select('*')
    .eq('manutencao_id', manutencaoId)
    .order('uploaded_at', { ascending: false })
  // Filtro opcional por item: null explícito = só anexos gerais; string = de item
  if (opts.item_id === null) q = q.is('item_id', null)
  else if (opts.item_id)     q = q.eq('item_id', opts.item_id)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ManutencaoAnexo[]
}

export async function uploadManutencaoAnexo(formData: FormData): Promise<ManutencaoAnexo> {
  const { supabase, user } = await requireUser()
  const manutencaoId = String(formData.get('manutencao_id') ?? '')
  const itemIdRaw = String(formData.get('item_id') ?? '')
  const itemId = itemIdRaw || null
  const tipo = (String(formData.get('file_type') ?? 'OUTRO')) as ManutencaoAnexo['file_type']
  const legenda = String(formData.get('legenda') ?? '').trim() || null
  const file = formData.get('file')

  if (!manutencaoId) throw new Error('manutencao_id ausente.')
  if (!(file instanceof File)) throw new Error('Arquivo ausente.')
  if (file.size > 100 * 1024 * 1024) throw new Error('Arquivo maior que 100 MB.')

  const arrayBuffer = await file.arrayBuffer()
  const sanitized = file.name.replace(/[^\w.\-]/g, '_').slice(0, 80)
  // Path inclui item_id quando vinculado a item específico
  const path = itemId
    ? `${manutencaoId}/${itemId}/${Date.now()}-${sanitized}`
    : `${manutencaoId}/${Date.now()}-${sanitized}`

  const { error: upErr } = await supabase.storage
    .from('manutencao-anexos')
    .upload(path, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (upErr) throw new Error(`Falha no upload: ${upErr.message}`)

  const { data, error } = await supabase
    .from('manutencao_anexos')
    .insert({
      manutencao_id: manutencaoId,
      item_id: itemId,
      file_path: path,
      file_name: file.name,
      file_type: tipo,
      legenda,
      size_bytes: file.size,
      uploaded_por: user.id,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  revalidateManutencoes(manutencaoId)
  return data as ManutencaoAnexo
}

export async function removerManutencaoAnexo(anexoId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { data: anexo } = await supabase
    .from('manutencao_anexos').select('manutencao_id, file_path').eq('id', anexoId).maybeSingle()
  if (!anexo) throw new Error('Anexo não encontrado.')

  await supabase.storage.from('manutencao-anexos').remove([anexo.file_path])
  const { error } = await supabase.from('manutencao_anexos').delete().eq('id', anexoId)
  if (error) throw new Error(error.message)
  revalidateManutencoes(anexo.manutencao_id)
}

export async function getAnexoSignedUrl(anexoId: string, expiresSeconds = 600): Promise<string> {
  const { supabase } = await requireUser()
  const { data: anexo } = await supabase
    .from('manutencao_anexos').select('file_path').eq('id', anexoId).maybeSingle()
  if (!anexo) throw new Error('Anexo não encontrado.')
  const { data, error } = await supabase.storage
    .from('manutencao-anexos')
    .createSignedUrl(anexo.file_path, expiresSeconds)
  if (error || !data) throw new Error(error?.message ?? 'Falha ao gerar URL.')
  return data.signedUrl
}
