export type ManutencaoStatus =
  | 'AGENDADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'

export type ManutencaoItemStatus = 'PENDENTE' | 'RESOLVIDO'

export const MANUTENCAO_ITEM_STATUS_LABEL: Record<ManutencaoItemStatus, string> = {
  PENDENTE:  'Pendente',
  RESOLVIDO: 'Resolvido',
}

export type AnexoManutencaoTipo =
  | 'FOTO_ANTES'
  | 'FOTO_DEPOIS'
  | 'NOTA_FISCAL'
  | 'DOCUMENTO'
  | 'OUTRO'

export const MANUTENCAO_STATUS_LABEL: Record<ManutencaoStatus, string> = {
  AGENDADA:     'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA:    'Concluída',
  CANCELADA:    'Cancelada',
}

export const ANEXO_TIPO_LABEL: Record<AnexoManutencaoTipo, string> = {
  FOTO_ANTES:   'Foto antes',
  FOTO_DEPOIS:  'Foto depois',
  NOTA_FISCAL:  'Nota fiscal',
  DOCUMENTO:    'Documento',
  OUTRO:        'Outro',
}

// ═══════════════════════════════════════════════════════════════
// TIPOS DE MANUTENÇÃO (taxonomia)
// ═══════════════════════════════════════════════════════════════

export interface TipoManutencao {
  id: string
  nome: string
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════════════════════
// CLIENTE PÓS-VENDA
// ═══════════════════════════════════════════════════════════════

export interface ClientePosVenda {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  cpf_cnpj: string | null
  observacoes: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface ClientePosVendaInput {
  nome: string
  telefone?: string | null
  email?: string | null
  cpf_cnpj?: string | null
  observacoes?: string | null
}

// ═══════════════════════════════════════════════════════════════
// MANUTENÇÃO
// ═══════════════════════════════════════════════════════════════

export interface Manutencao {
  id: string
  cliente_id: string | null
  endereco: string | null
  status: ManutencaoStatus
  data_agendada: string | null    // YYYY-MM-DD
  hora_inicio: string | null      // HH:MM:SS
  data_concluida: string | null
  responsavel_id: string | null
  observacoes: string | null
  agenda_item_id: string | null
  criado_por: string | null
  created_at: string
  updated_at: string

  // joins opcionais
  cliente?: ClientePosVenda | null
  responsavel?: { id: string; nome: string } | null
}

export interface ManutencaoItem {
  id: string
  manutencao_id: string
  tipo_id: string | null
  descricao: string
  status: ManutencaoItemStatus
  observacoes: string | null
  ordem: number
  created_at: string
  updated_at: string
  // join opcional
  tipo?: TipoManutencao | null
}

export interface ManutencaoItemInput {
  descricao: string
  tipo_id?: string | null
  status?: ManutencaoItemStatus
  observacoes?: string | null
  ordem?: number
}

export interface ManutencaoInput {
  cliente_id?: string | null
  endereco?: string | null
  data_agendada?: string | null
  hora_inicio?: string | null
  responsavel_id?: string | null
  observacoes?: string | null
  /** Lista de itens específicos (situações). Cada um com seu tipo. */
  itens?: ManutencaoItemInput[]
  /** Se true, cria item correspondente na Agenda. */
  criar_na_agenda?: boolean
}

// ═══════════════════════════════════════════════════════════════
// ANEXOS
// ═══════════════════════════════════════════════════════════════

export interface ManutencaoAnexo {
  id: string
  manutencao_id: string
  /** Opcional — quando preenchido, o anexo pertence a um item específico
   *  (foto da torneira); quando null, é geral da manutenção (foto da fachada). */
  item_id: string | null
  file_path: string
  file_name: string
  file_type: AnexoManutencaoTipo
  legenda: string | null
  size_bytes: number | null
  uploaded_por: string | null
  uploaded_at: string
}
