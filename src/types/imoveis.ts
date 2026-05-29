export type ImovelStatus =
  | 'DISPONIVEL'
  | 'NEGOCIACAO'
  | 'AGIO'
  | 'PARADO'
  | 'EM_CONSTRUCAO'
  | 'VENDIDO'
  | 'ALUGADA'
  | 'FINALIZADO'

export const IMOVEL_STATUS_LABEL: Record<ImovelStatus, string> = {
  DISPONIVEL:    'Disponível',
  NEGOCIACAO:    'Negociação',
  AGIO:          'Ágio',
  PARADO:        'Parado',
  EM_CONSTRUCAO: 'Em construção',
  VENDIDO:       'Vendido',
  ALUGADA:       'Alugada',
  FINALIZADO:    'P. Finalizado',
}

/** Status disponíveis por tipo de carteira (Novos vs Usados têm conjuntos diferentes). */
export const STATUS_POR_TIPO: Record<'NOVO' | 'USADO', ImovelStatus[]> = {
  NOVO:  ['EM_CONSTRUCAO', 'DISPONIVEL', 'PARADO', 'VENDIDO', 'FINALIZADO'],
  USADO: ['NEGOCIACAO', 'AGIO', 'DISPONIVEL', 'PARADO', 'VENDIDO', 'ALUGADA'],
}

export type ImovelAnexoTipo = 'FOTO' | 'DOCUMENTO' | 'OUTRO'

// ═══════════════════════════════════════════════════════════════
// CARTEIRA (grupo gerenciável)
// ═══════════════════════════════════════════════════════════════

export type CarteiraTipo = 'NOVO' | 'USADO'

export interface ImovelCarteira {
  id: string
  nome: string
  /** Define a apresentação: NOVO destaca Clientes; USADO destaca Chave/Local/Fotos
   *  e libera edição inline de avaliação/vencimento. */
  tipo: CarteiraTipo
  ordem: number
  /** Ordem manual dos grupos (empreendimentos/regiões), por nome normalizado (UPPER). */
  ordem_grupos: string[]
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ImovelCarteiraInput {
  nome: string
  tipo?: CarteiraTipo
  ordem?: number
  ativo?: boolean
}

// ═══════════════════════════════════════════════════════════════
// IMÓVEL
// ═══════════════════════════════════════════════════════════════

export interface Imovel {
  id: string
  carteira_id: string | null
  identificacao: string
  empreendimento: string | null
  idr_matricula: string | null
  status: ImovelStatus
  andamento: string | null
  endereco: string | null
  cidade: string | null
  regiao: string | null
  correspondente: string | null
  avaliacao: number | null
  vencimento_laudo: string | null   // YYYY-MM-DD
  chave_com: string | null
  clientes: string | null
  local: string | null
  observacoes: string | null
  cliente_id: string | null
  vendedor_id: string | null
  obra_id: string | null
  ordem: number
  criado_por: string | null
  created_at: string
  updated_at: string

  // joins opcionais
  carteira?: ImovelCarteira | null
  vendedor?: { id: string; nome: string } | null
  /** Resumo pro indicador no card (id + tipo de cada anexo). */
  anexos?: { id: string; file_type: ImovelAnexoTipo }[]
}

export interface ImovelInput {
  carteira_id?: string | null
  identificacao: string
  empreendimento?: string | null
  idr_matricula?: string | null
  status?: ImovelStatus
  andamento?: string | null
  endereco?: string | null
  cidade?: string | null
  regiao?: string | null
  correspondente?: string | null
  avaliacao?: number | null
  vencimento_laudo?: string | null
  chave_com?: string | null
  clientes?: string | null
  local?: string | null
  observacoes?: string | null
  cliente_id?: string | null
  vendedor_id?: string | null
  obra_id?: string | null
}

export interface ImovelAnexo {
  id: string
  imovel_id: string
  file_path: string
  file_name: string
  file_type: ImovelAnexoTipo
  ordem: number
  size_bytes: number | null
  uploaded_por: string | null
  uploaded_at: string
}
