'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import type {
  ClientePosVenda,
  Manutencao,
  OrdemServico,
  OrdemServicoStatus,
  OrdemServicoPublicaInput,
  OrdemServicoAnexo,
  OrdemAnexoTipo,
} from '@/types/manutencoes'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]/g, '_').slice(0, 80)
}

const ORDEM_SELECT = `
  *,
  cliente:clientes_pos_venda(*),
  anexos:ordem_servico_anexos(*)
`

// ═══════════════════════════════════════════════════════════════
// AÇÕES INTERNAS (ADMIN/MANUTENCAO)
// ═══════════════════════════════════════════════════════════════

export interface OrdensServicoFilters {
  status?: OrdemServicoStatus
}

export async function listOrdensServico(
  filters: OrdensServicoFilters = {}
): Promise<OrdemServico[]> {
  const { supabase } = await requireUser()
  let q = supabase
    .from('ordens_servico')
    .select(ORDEM_SELECT)
    .order('created_at', { ascending: false })
  if (filters.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as OrdemServico[]
}

export async function getOrdemServico(id: string): Promise<OrdemServico | null> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('ordens_servico')
    .select(ORDEM_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as OrdemServico) ?? null
}

export async function countSolicitacoesPendentes(): Promise<number> {
  const { supabase } = await requireUser()
  const { count, error } = await supabase
    .from('ordens_servico')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDENTE')
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Aceita uma O.S. → cria manutenção vinculada e vincula cliente.
 * Se a O.S. não tem cliente_id, cria cliente_pos_venda novo a partir
 * dos dados de identificação.
 */
export async function aceitarOrdemServico(
  ordemId: string,
  opcoes: {
    data_agendada?: string | null
    hora_inicio?: string | null
    responsavel_id?: string | null
  } = {},
): Promise<Manutencao> {
  const { supabase, user } = await requireUser()

  // 1. Busca a ordem
  const { data: ordem, error: ordemErr } = await supabase
    .from('ordens_servico')
    .select('*, cliente:clientes_pos_venda(*)')
    .eq('id', ordemId)
    .maybeSingle()
  if (ordemErr) throw new Error(ordemErr.message)
  if (!ordem) throw new Error('Solicitação não encontrada.')
  if (ordem.status !== 'PENDENTE') throw new Error('Essa solicitação já foi decidida.')

  // 2. Garante cliente_pos_venda — usa o vinculado ou cria novo
  let clienteId = ordem.cliente_id as string | null
  if (!clienteId) {
    const { data: novoCliente, error: cliErr } = await supabase
      .from('clientes_pos_venda')
      .insert({
        nome: (ordem.nome_solicitante as string).trim(),
        telefone: ordem.telefone || null,
        email: ordem.email || null,
        cpf_cnpj: ordem.cpf_cnpj || null,
        criado_por: user.id,
      })
      .select('id')
      .single()
    if (cliErr) throw new Error(`Falha ao criar cliente: ${cliErr.message}`)
    clienteId = novoCliente.id as string
  }

  // 3. Cria a manutenção (1 item inicial com a descrição da solicitação)
  const { data: m, error: mErr } = await supabase
    .from('manutencoes')
    .insert({
      cliente_id: clienteId,
      endereco: ordem.endereco || null,
      data_agendada: opcoes.data_agendada || null,
      hora_inicio: opcoes.hora_inicio || null,
      responsavel_id: opcoes.responsavel_id || null,
      observacoes: `Originada da solicitação ${ordemId.slice(0, 8)}.`,
      criado_por: user.id,
    })
    .select('*')
    .single()
  if (mErr) throw new Error(`Falha ao criar manutenção: ${mErr.message}`)

  // Item inicial com a descrição original
  await supabase.from('manutencao_itens').insert({
    manutencao_id: m.id,
    descricao: (ordem.descricao as string).trim(),
    status: 'PENDENTE',
    ordem: 0,
  })

  // 4. Marca a ordem como aceita
  await supabase
    .from('ordens_servico')
    .update({
      status: 'ACEITA',
      manutencao_id: m.id,
      cliente_id: clienteId,
      decidida_em: new Date().toISOString(),
      decidida_por: user.id,
    })
    .eq('id', ordemId)

  // 5. Copia anexos da O.S. pro bucket de manutenção (move o file_path)
  //    Idempotente — falhas individuais não bloqueiam aceitação.
  const { data: anexos } = await supabase
    .from('ordem_servico_anexos')
    .select('*')
    .eq('ordem_id', ordemId)
  if (anexos && anexos.length > 0) {
    const admin = createAdminClient()
    for (const an of anexos as { id: string; file_path: string; file_name: string; file_type: string; size_bytes: number | null }[]) {
      try {
        // Lê do bucket público
        const { data: blob, error: dlErr } = await admin.storage
          .from('ordem-servico-anexos')
          .download(an.file_path)
        if (dlErr || !blob) continue

        // Re-upload no bucket de manutenção
        const novoPath = `${m.id}/${Date.now()}-${an.file_name.replace(/[^\w.\-]/g, '_').slice(0, 80)}`
        const { error: upErr } = await admin.storage
          .from('manutencao-anexos')
          .upload(novoPath, await blob.arrayBuffer(), {
            contentType: blob.type || 'application/octet-stream',
            upsert: false,
          })
        if (upErr) continue

        // Cria registro em manutencao_anexos (geral, sem item_id)
        const tipoMap: Record<string, string> = {
          FOTO: 'FOTO_ANTES',
          VIDEO: 'OUTRO',
          DOCUMENTO: 'DOCUMENTO',
          OUTRO: 'OUTRO',
        }
        await supabase.from('manutencao_anexos').insert({
          manutencao_id: m.id,
          item_id: null,
          file_path: novoPath,
          file_name: an.file_name,
          file_type: tipoMap[an.file_type] ?? 'OUTRO',
          size_bytes: an.size_bytes,
          uploaded_por: user.id,
        })
      } catch (e) {
        console.error('[ordens] Falha ao copiar anexo:', e)
      }
    }
  }

  revalidatePath('/manutencoes')
  revalidatePath('/manutencoes/solicitacoes')
  return m as Manutencao
}

export async function recusarOrdemServico(
  ordemId: string,
  motivo?: string | null,
): Promise<void> {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from('ordens_servico')
    .update({
      status: 'RECUSADA',
      motivo_recusa: motivo?.trim() || null,
      decidida_em: new Date().toISOString(),
      decidida_por: user.id,
    })
    .eq('id', ordemId)
    .eq('status', 'PENDENTE')
  if (error) throw new Error(error.message)
  revalidatePath('/manutencoes/solicitacoes')
}

export async function getOrdemAnexoSignedUrl(
  anexoId: string,
  expiresSeconds = 600,
): Promise<string> {
  const { supabase } = await requireUser()
  const { data: anexo } = await supabase
    .from('ordem_servico_anexos')
    .select('file_path')
    .eq('id', anexoId)
    .maybeSingle()
  if (!anexo) throw new Error('Anexo não encontrado.')
  const { data, error } = await supabase.storage
    .from('ordem-servico-anexos')
    .createSignedUrl(anexo.file_path as string, expiresSeconds)
  if (error || !data) throw new Error(error?.message ?? 'Falha ao gerar URL.')
  return data.signedUrl
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES PÚBLICAS (sem auth — usam service_role server-side)
// ═══════════════════════════════════════════════════════════════

export interface PortalView {
  cliente: ClientePosVenda
  manutencoes: Manutencao[]
  ordens: OrdemServico[]
}

/**
 * Busca cliente_pos_venda pelo CPF/CNPJ (normalizado a só dígitos).
 * Usado na landing /manutencao pra "login" simples por documento.
 * Retorna o token pra redirecionar pro portal. Sem OTP — CPF basta.
 */
export async function findClienteByCpf(
  cpf: string,
): Promise<{ token: string } | null> {
  const digits = (cpf ?? '').replace(/\D/g, '')
  if (digits.length < 11) return null   // CPF tem 11, CNPJ 14
  const admin = createAdminClient()
  // Compara também ignorando formatação no banco — backfill antigo pode ter pontos
  const { data, error } = await admin
    .from('clientes_pos_venda')
    .select('token, cpf_cnpj')
    .not('cpf_cnpj', 'is', null)
  if (error) throw new Error(error.message)
  const match = (data ?? []).find(r => {
    const stored = (r.cpf_cnpj as string).replace(/\D/g, '')
    return stored === digits
  })
  if (!match) return null
  return { token: match.token as string }
}

export async function getPortalByToken(token: string): Promise<PortalView> {
  if (!token || token.length < 10) throw new Error('Token inválido.')
  const admin = createAdminClient()

  const { data: cliente, error: clErr } = await admin
    .from('clientes_pos_venda')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (clErr) throw new Error(clErr.message)
  if (!cliente) throw new Error('Portal não encontrado — verifique o link.')

  const [mRes, oRes] = await Promise.all([
    admin
      .from('manutencoes')
      .select('*, responsavel:profiles!responsavel_id(id, nome)')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false }),
    admin
      .from('ordens_servico')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false }),
  ])
  if (mRes.error) throw new Error(mRes.error.message)
  if (oRes.error) throw new Error(oRes.error.message)

  return {
    cliente: cliente as unknown as ClientePosVenda,
    manutencoes: (mRes.data ?? []) as unknown as Manutencao[],
    ordens: (oRes.data ?? []) as unknown as OrdemServico[],
  }
}

/**
 * Cria uma O.S. pública. Quando token presente, vincula ao cliente.
 * Retorna o id da ordem pra permitir o upload de anexos no fluxo seguinte.
 */
export async function criarOrdemServicoPublica(
  input: OrdemServicoPublicaInput,
): Promise<{ id: string }> {
  if (!input.nome_solicitante?.trim()) throw new Error('Informe seu nome.')
  if (!input.descricao?.trim()) throw new Error('Descreva o problema.')

  const admin = createAdminClient()

  let clienteId: string | null = null
  let origem: 'PORTAL' | 'PUBLICA' = 'PUBLICA'

  if (input.token) {
    const { data: cliente } = await admin
      .from('clientes_pos_venda')
      .select('id')
      .eq('token', input.token)
      .maybeSingle()
    if (cliente) {
      clienteId = cliente.id as string
      origem = 'PORTAL'
    }
  }

  const { data, error } = await admin
    .from('ordens_servico')
    .insert({
      cliente_id: clienteId,
      nome_solicitante: input.nome_solicitante.trim(),
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      cpf_cnpj: input.cpf_cnpj?.trim() || null,
      endereco: input.endereco?.trim() || null,
      descricao: input.descricao.trim(),
      origem,
      status: 'PENDENTE',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/manutencoes/solicitacoes')
  return { id: data.id as string }
}

/**
 * Upload público de anexo vinculado a uma O.S. Validação: o caller precisa
 * passar o id da ordem que acabou de criar. Sem checagem extra — o pior caso
 * é alguém anexar lixo numa O.S. PENDENTE conhecida (acesso interno só após
 * aceite, anexos podem ser auditados ou descartados).
 *
 * Upload direto: o browser sobe o arquivo no Supabase via signed URL (sem
 * passar pela função). Aqui só geramos a permissão e, depois, registramos.
 */
export async function criarUploadUrlOrdemAnexo(input: {
  ordemId: string
  fileName: string
}): Promise<{ bucket: string; path: string; token: string }> {
  if (!input.ordemId) throw new Error('ordem_id ausente.')
  const admin = createAdminClient()

  const { data: ordem } = await admin
    .from('ordens_servico')
    .select('id, status')
    .eq('id', input.ordemId)
    .maybeSingle()
  if (!ordem) throw new Error('Solicitação não encontrada.')
  if (ordem.status !== 'PENDENTE') throw new Error('Solicitação já foi decidida — não aceita mais anexos.')

  const sanitized = sanitizeFileName(input.fileName)
  const path = `${input.ordemId}/${Date.now()}-${sanitized}`
  const { data, error } = await admin.storage
    .from('ordem-servico-anexos')
    .createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message ?? 'Falha ao preparar upload.')
  return { bucket: 'ordem-servico-anexos', path: data.path, token: data.token }
}

export async function registrarOrdemAnexo(input: {
  ordemId: string
  path: string
  fileName: string
  fileType: OrdemAnexoTipo
  sizeBytes: number
}): Promise<OrdemServicoAnexo> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ordem_servico_anexos')
    .insert({
      ordem_id: input.ordemId,
      file_path: input.path,
      file_name: input.fileName,
      file_type: input.fileType,
      size_bytes: input.sizeBytes,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as OrdemServicoAnexo
}
