'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type {
  Imovel,
  ImovelInput,
  ImovelStatus,
  ImovelCarteira,
  ImovelCarteiraInput,
  ImovelAnexo,
  ImovelAnexoTipo,
} from '@/types/imoveis'

const ANEXO_BUCKET = 'imovel-anexos'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

const IMOVEL_SELECT = `
  *,
  carteira:imovel_carteiras(*),
  vendedor:vendedores(id, nome),
  anexos:imovel_anexos(id, file_type)
`

// ═══════════════════════════════════════════════════════════════
// CARTEIRAS
// ═══════════════════════════════════════════════════════════════

export async function listCarteiras(opts: { ativasApenas?: boolean } = {}): Promise<ImovelCarteira[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('imovel_carteiras').select('*').order('ordem', { ascending: true })
  if (opts.ativasApenas) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ImovelCarteira[]
}

export async function createCarteira(input: ImovelCarteiraInput): Promise<ImovelCarteira> {
  const { supabase } = await requireUser()
  const nome = input.nome.trim()
  if (!nome) throw new Error('Nome da carteira é obrigatório.')

  // Próxima ordem
  const { data: ultima } = await supabase
    .from('imovel_carteiras').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
  const ordem = input.ordem ?? ((ultima?.ordem ?? 0) + 1)

  const { data, error } = await supabase
    .from('imovel_carteiras')
    .insert({ nome, tipo: input.tipo ?? 'USADO', ordem, ativo: input.ativo ?? true })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
  return data as ImovelCarteira
}

export async function updateCarteira(id: string, patch: Partial<ImovelCarteiraInput>): Promise<ImovelCarteira> {
  const { supabase } = await requireUser()
  const payload: Record<string, unknown> = {}
  if (patch.nome !== undefined)  payload.nome = patch.nome.trim()
  if (patch.tipo !== undefined)  payload.tipo = patch.tipo
  if (patch.ordem !== undefined) payload.ordem = patch.ordem
  if (patch.ativo !== undefined) payload.ativo = patch.ativo
  const { data, error } = await supabase
    .from('imovel_carteiras').update(payload).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
  return data as ImovelCarteira
}

export async function deleteCarteira(id: string): Promise<void> {
  const { supabase } = await requireUser()
  // Imóveis da carteira ficam com carteira_id NULL (ON DELETE SET NULL no schema).
  const { error } = await supabase.from('imovel_carteiras').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
}

// ═══════════════════════════════════════════════════════════════
// IMÓVEIS
// ═══════════════════════════════════════════════════════════════

export interface ImoveisFilters {
  carteira_id?: string
  status?: ImovelStatus
  /** Quando true, traz só FINALIZADO (aba Finalizados, cruza carteiras). */
  finalizados?: boolean
  search?: string
}

export async function listImoveis(filters: ImoveisFilters = {}): Promise<Imovel[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('imoveis').select(IMOVEL_SELECT)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false })

  if (filters.finalizados) {
    q = q.eq('status', 'FINALIZADO')
  } else {
    if (filters.carteira_id) q = q.eq('carteira_id', filters.carteira_id)
    if (filters.status)      q = q.eq('status', filters.status)
  }
  if (filters.search?.trim()) {
    const safe = filters.search.replace(/[%_]/g, '\\$&')
    q = q.or(`identificacao.ilike.%${safe}%,empreendimento.ilike.%${safe}%,idr_matricula.ilike.%${safe}%,endereco.ilike.%${safe}%,andamento.ilike.%${safe}%,clientes.ilike.%${safe}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Imovel[]
}

export async function getImovel(id: string): Promise<Imovel | null> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('imoveis').select(IMOVEL_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as Imovel) ?? null
}

/** Contagem por carteira, pra badges das abas. */
export async function getImoveisCounts(): Promise<{ porCarteira: Record<string, number> }> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.from('imoveis').select('carteira_id')
  if (error) throw new Error(error.message)
  const porCarteira: Record<string, number> = {}
  for (const row of (data ?? []) as { carteira_id: string | null }[]) {
    if (row.carteira_id) porCarteira[row.carteira_id] = (porCarteira[row.carteira_id] ?? 0) + 1
  }
  return { porCarteira }
}

function imovelPayload(input: Partial<ImovelInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (input.carteira_id !== undefined)      p.carteira_id = input.carteira_id || null
  if (input.identificacao !== undefined)    p.identificacao = input.identificacao.trim()
  if (input.empreendimento !== undefined)   p.empreendimento = input.empreendimento?.trim() || null
  if (input.idr_matricula !== undefined)    p.idr_matricula = input.idr_matricula?.trim() || null
  if (input.status !== undefined)           p.status = input.status
  if (input.andamento !== undefined)        p.andamento = input.andamento?.trim() || null
  if (input.endereco !== undefined)         p.endereco = input.endereco?.trim() || null
  if (input.cidade !== undefined)           p.cidade = input.cidade?.trim() || null
  if (input.regiao !== undefined)           p.regiao = input.regiao?.trim() || null
  if (input.correspondente !== undefined)   p.correspondente = input.correspondente?.trim() || null
  if (input.avaliacao !== undefined)        p.avaliacao = input.avaliacao ?? null
  if (input.vencimento_laudo !== undefined) p.vencimento_laudo = input.vencimento_laudo || null
  if (input.chave_com !== undefined)        p.chave_com = input.chave_com?.trim() || null
  if (input.clientes !== undefined)         p.clientes = input.clientes?.trim() || null
  if (input.local !== undefined)            p.local = input.local?.trim() || null
  if (input.observacoes !== undefined)      p.observacoes = input.observacoes?.trim() || null
  if (input.cliente_id !== undefined)       p.cliente_id = input.cliente_id || null
  if (input.vendedor_id !== undefined)      p.vendedor_id = input.vendedor_id || null
  if (input.obra_id !== undefined)          p.obra_id = input.obra_id || null
  return p
}

export async function createImovel(input: ImovelInput): Promise<Imovel> {
  const { supabase, user } = await requireUser()
  if (!input.identificacao?.trim()) throw new Error('Identificação é obrigatória.')
  const { data, error } = await supabase
    .from('imoveis')
    .insert({ ...imovelPayload(input), status: input.status ?? 'DISPONIVEL', criado_por: user.id })
    .select(IMOVEL_SELECT)
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
  return data as unknown as Imovel
}

export async function updateImovel(id: string, patch: Partial<ImovelInput>): Promise<Imovel> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('imoveis').update(imovelPayload(patch)).eq('id', id).select(IMOVEL_SELECT).single()
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
  return data as unknown as Imovel
}

export async function setImovelStatus(id: string, status: ImovelStatus): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('imoveis').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
}

export async function deleteImovel(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('imoveis').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
}

// ═══════════════════════════════════════════════════════════════
// ORDENAÇÃO MANUAL
// ═══════════════════════════════════════════════════════════════

/** Salva a ordem dos imóveis (ids na sequência desejada → ordem 0..n). */
export async function reordenarImoveis(idsEmOrdem: string[]): Promise<void> {
  const { supabase } = await requireUser()
  await Promise.all(
    idsEmOrdem.map((id, i) => supabase.from('imoveis').update({ ordem: i }).eq('id', id))
  )
  revalidatePath('/imoveis')
}

/** Salva a ordem dos grupos (empreendimentos/regiões) de uma carteira. */
export async function reordenarGruposCarteira(carteiraId: string, gruposEmOrdem: string[]): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('imovel_carteiras')
    .update({ ordem_grupos: gruposEmOrdem.map(g => g.toUpperCase()) })
    .eq('id', carteiraId)
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
}

// ═══════════════════════════════════════════════════════════════
// ANEXOS (fotos e documentos)
// ═══════════════════════════════════════════════════════════════

/** Lista anexos de um imóvel já com signed URL (pra exibir thumb/abrir). */
export async function listImovelAnexos(imovelId: string): Promise<(ImovelAnexo & { url: string })[]> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('imovel_anexos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('ordem', { ascending: true })
    .order('uploaded_at', { ascending: true })
  if (error) throw new Error(error.message)
  const anexos = (data ?? []) as ImovelAnexo[]
  return Promise.all(anexos.map(async a => {
    const { data: s } = await supabase.storage.from(ANEXO_BUCKET).createSignedUrl(a.file_path, 3600)
    return { ...a, url: s?.signedUrl ?? '' }
  }))
}

/** Gera signed upload URL pro browser subir o anexo direto (sem passar pela função). */
export async function criarUploadUrlImovelAnexo(input: {
  imovelId: string
  fileName: string
}): Promise<{ bucket: string; path: string; token: string }> {
  const { supabase } = await requireUser()
  if (!input.imovelId) throw new Error('imovelId ausente.')
  const sanitized = input.fileName.replace(/[^\w.\-]/g, '_').slice(0, 80)
  const path = `${input.imovelId}/${Date.now()}-${sanitized}`
  const { data, error } = await supabase.storage.from(ANEXO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message ?? 'Falha ao preparar upload.')
  return { bucket: ANEXO_BUCKET, path: data.path, token: data.token }
}

export async function registrarImovelAnexo(input: {
  imovelId: string
  path: string
  fileName: string
  fileType: ImovelAnexoTipo
  sizeBytes: number
}): Promise<ImovelAnexo> {
  const { supabase, user } = await requireUser()
  const { data, error } = await supabase
    .from('imovel_anexos')
    .insert({
      imovel_id: input.imovelId,
      file_path: input.path,
      file_name: input.fileName,
      file_type: input.fileType,
      size_bytes: input.sizeBytes,
      uploaded_por: user.id,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
  return data as ImovelAnexo
}

export async function removerImovelAnexo(anexoId: string): Promise<void> {
  const { supabase } = await requireUser()
  const { data: anexo } = await supabase
    .from('imovel_anexos').select('file_path').eq('id', anexoId).maybeSingle()
  if (anexo?.file_path) {
    await supabase.storage.from(ANEXO_BUCKET).remove([anexo.file_path as string])
  }
  const { error } = await supabase.from('imovel_anexos').delete().eq('id', anexoId)
  if (error) throw new Error(error.message)
  revalidatePath('/imoveis')
}
