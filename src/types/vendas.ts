export type TipoImovel = 'NOVO' | 'USADO' | 'AMBOS'
export type TipoCliente = 'NOVO' | 'ANTIGO'
export type TipoRenda = 'FORMAL' | 'INFORMAL' | 'AMBOS'
export type UserRole = 'ADMIN' | 'VENDEDOR'

export interface Profile {
  id: string
  nome: string
  role: UserRole
  vendedor_id: string | null
  created_at: string
}

export interface Vendedor {
  id: string
  nome: string
  email: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  _count?: { clientes: number }
}

export interface Cliente {
  id: string
  nome: string
  telefone_whatsapp: string
  cpf: string | null
  cidade: string | null
  vendedor_id: string | null
  tipo_imovel: TipoImovel
  tipo_cliente: TipoCliente
  tipo_renda: TipoRenda | null
  status: string
  status_novo: string | null
  status_usado: string | null
  origem: string
  motivo_reprovacao: string | null
  motivo_reprovacao_usado: string | null
  observacoes: string | null
  data_avaliacao: string
  valor_venda: number | null
  tipo_venda: TipoImovel | null
  data_venda: string | null
  valor_simulacao_novo: number | null
  valor_simulacao_usado: number | null
  created_at: string
  updated_at: string
  vendedor?: Pick<Vendedor, 'id' | 'nome'> | null
}

export interface EtapaFunil {
  id: string
  nome: string
  chave: string
  cor: string
  ordem: number
  protegida: boolean
  ativo: boolean
  created_at: string
}

export interface LeadDistribuicao {
  id: string
  vendedor_id: string
  quantidade: number
  data: string
  created_at: string
  vendedor?: Pick<Vendedor, 'id' | 'nome'> | null
}

export interface ClienteFilters {
  search?: string
  status?: string
  vendedor_id?: string
  tipo_imovel?: TipoImovel
  tipo_renda?: TipoRenda
  tipo_cliente?: TipoCliente
  cidade?: string
  mes?: string
  page?: number
  per_page?: number
}

export const STATUS_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  NAO_AVALIADO: 'Não Avaliado',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  CONDICIONADO: 'Condicionado',
  QV_LIBERACAO_REAVALIAR: 'QV/Lib. Reavaliar',
  PRECISA_CARTA_CANCELAMENTO: 'Carta Cancelamento',
  VENDA_FECHADA: 'Venda Fechada',
}

export const REPROVACAO_MOTIVOS = [
  'Renda insuficiente',
  'Score baixo',
  'Nome negativado',
  'Documentação incompleta',
  'Comprometimento de renda',
  'Idade limite',
  'Outro',
]

export const CONDICIONADO_MOTIVOS = [
  'Aguardando documentos',
  'Aguardando comprovante de renda',
  'Aguardando regularização de CPF',
  'Aguardando carta de cancelamento',
  'Outro',
]
