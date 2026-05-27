export interface Fornecedor {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  cnpj_cpf: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface UnidadeMedida {
  id: string
  sigla: string
  nome: string
  ordem: number
  created_at: string
}

export interface CategoriaCusto {
  id: string
  nome: string
  cor: string | null
  icone: string | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ItemCatalogo {
  id: string
  descricao: string
  unidade_padrao_id: string | null
  categoria_padrao_id: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Gasto {
  id: string
  /** XOR com manutencao_id — gasto pertence a obra OU manutenção. */
  obra_id: string | null
  manutencao_id: string | null
  descricao: string
  item_catalogo_id: string | null
  categoria_id: string
  fornecedor_id: string | null
  quantidade: number
  unidade_id: string
  valor_unitario: number
  valor_total: number  // generated
  data: string         // YYYY-MM-DD
  observacoes: string | null
  criado_por: string | null
  created_at: string
  updated_at: string

  // joins opcionais
  categoria?: CategoriaCusto | null
  fornecedor?: Fornecedor | null
  unidade?: UnidadeMedida | null
}

/** Exatamente um entre obra_id e manutencao_id deve estar preenchido (CHECK XOR no DB). */
export interface GastoInput {
  obra_id?: string | null
  manutencao_id?: string | null
  descricao: string
  categoria_id: string
  unidade_id: string
  quantidade: number
  valor_unitario: number
  data: string
  fornecedor_id?: string | null
  item_catalogo_id?: string | null
  observacoes?: string | null
}

export interface FornecedorInput {
  nome: string
  telefone?: string | null
  email?: string | null
  cnpj_cpf?: string | null
  observacoes?: string | null
  ativo?: boolean
}

export type GastoSortColumn = 'data' | 'descricao' | 'quantidade' | 'valor_unitario' | 'valor_total'
export type SortDirection = 'asc' | 'desc'

// ═══════════════════════════════════════════════════════════════
// COTAÇÕES (RFQ)
// ═══════════════════════════════════════════════════════════════

export type CotacaoStatus = 'RASCUNHO' | 'ENVIADA' | 'RECEBENDO' | 'FECHADA' | 'CANCELADA'
export type CotacaoFornecedorStatus = 'PENDENTE' | 'ABERTA' | 'RESPONDIDA' | 'RECUSADA'
export type AnexoTipo = 'PDF' | 'IMAGEM' | 'EXCEL' | 'OUTRO'
export type AnexoParsedStatus = 'PENDENTE' | 'PROCESSANDO' | 'OK' | 'FALHA' | 'PULADO'

export const COTACAO_STATUS_LABEL: Record<CotacaoStatus, string> = {
  RASCUNHO:   'Rascunho',
  ENVIADA:    'Enviada',
  RECEBENDO:  'Recebendo',
  FECHADA:    'Fechada',
  CANCELADA:  'Cancelada',
}

export const COTACAO_FORNECEDOR_STATUS_LABEL: Record<CotacaoFornecedorStatus, string> = {
  PENDENTE:   'Pendente',
  ABERTA:     'Visualizada',
  RESPONDIDA: 'Respondida',
  RECUSADA:   'Recusada',
}

export interface Cotacao {
  id: string
  obra_id: string | null
  titulo: string
  descricao: string | null
  status: CotacaoStatus
  prazo_resposta: string | null      // YYYY-MM-DD
  criado_por: string | null
  created_at: string
  updated_at: string
  // joins opcionais
  obra?: { id: string; nome: string; cidade: string | null } | null
}

export interface CotacaoItem {
  id: string
  cotacao_id: string
  descricao: string
  quantidade: number
  unidade_id: string | null
  categoria_id: string | null
  observacoes: string | null
  ordem: number
  created_at: string
  unidade?: UnidadeMedida | null
  categoria?: CategoriaCusto | null
}

export interface CotacaoItemInput {
  descricao: string
  quantidade: number
  unidade_id?: string | null
  categoria_id?: string | null
  observacoes?: string | null
  ordem?: number
}

export interface CotacaoInput {
  titulo: string
  descricao?: string | null
  obra_id?: string | null
  prazo_resposta?: string | null
  itens: CotacaoItemInput[]
  fornecedor_ids: string[]
}

export interface CotacaoFornecedor {
  id: string
  cotacao_id: string
  fornecedor_id: string
  token: string
  status: CotacaoFornecedorStatus
  prazo_entrega_dias: number | null
  observacoes_fornecedor: string | null
  aberta_em: string | null
  respondida_em: string | null
  created_at: string
  updated_at: string
  fornecedor?: Fornecedor | null
}

export interface CotacaoResposta {
  id: string
  cotacao_fornecedor_id: string
  item_id: string | null       // null = item extra adicionado pelo fornecedor
  descricao: string
  quantidade: number
  unidade_id: string | null
  preco_unitario: number
  preco_total: number          // generated
  observacoes: string | null
  vencedora: boolean
  ordem: number
  created_at: string
  updated_at: string
  unidade?: UnidadeMedida | null
}

export interface CotacaoRespostaInput {
  item_id?: string | null
  descricao: string
  quantidade: number
  unidade_id?: string | null
  preco_unitario: number
  observacoes?: string | null
  ordem?: number
}

export interface CotacaoAnexo {
  id: string
  cotacao_fornecedor_id: string
  file_path: string
  file_name: string
  file_type: AnexoTipo
  size_bytes: number | null
  parsed_status: AnexoParsedStatus
  parsed_data: {
    items?: Array<{ descricao: string; quantidade?: number; unidade?: string; preco_unitario?: number; observacoes?: string }>
    observacoes_gerais?: string
    prazo_entrega_dias?: number
  } | null
  parsed_error: string | null
  uploaded_at: string
}

// Visão pública (o que o fornecedor enxerga ao abrir /cotacao/[token])
export interface CotacaoPublicView {
  cotacao: Pick<Cotacao, 'id' | 'titulo' | 'descricao' | 'status' | 'prazo_resposta'> & {
    obra: { nome: string; cidade: string | null } | null
  }
  envelope: Pick<CotacaoFornecedor, 'id' | 'token' | 'status' | 'prazo_entrega_dias' | 'observacoes_fornecedor' | 'respondida_em'> & {
    fornecedor: { nome: string }
  }
  itens: CotacaoItem[]
  respostas: CotacaoResposta[]
  anexos: CotacaoAnexo[]
  unidades: UnidadeMedida[]
}

export interface GastoFilters {
  obra_id?: string
  manutencao_id?: string
  categoria_ids?: string[]
  fornecedor_id?: string
  data_inicio?: string
  data_fim?: string
  search?: string
  sort_by?: GastoSortColumn
  sort_dir?: SortDirection
}
