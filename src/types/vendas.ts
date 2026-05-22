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
  // CRM funnel stage (clientes.status) — usado em outras partes; não exposto nos filtros da lista
  status?: string
  // Avaliação por tipo de imóvel
  status_novo?: string
  status_usado?: string
  vendedor_id?: string
  tipo_imovel?: TipoImovel
  tipo_renda?: TipoRenda
  tipo_cliente?: TipoCliente
  cidade?: string
  // Range em data_avaliacao (YYYY-MM-DD)
  data_inicio?: string
  data_fim?: string
  mes?: string
  page?: number
  per_page?: number
}

// Etapas do funil de CRM (clientes.status) — pipeline de vendas.
// Mantemos um superset para tolerar valores legados que aparecem nos dados.
export const STATUS_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  CONTATO_INICIAL: 'Contato Inicial',
  DOCUMENTACAO: 'Documentação',
  AVALIACAO: 'Avaliação',
  SIMULACAO: 'Simulação',
  VISITA: 'Visita',
  ASSINATURA_DOCS: 'Assinatura Docs',
  CONFORMIDADE: 'Conformidade',
  VENDA_FECHADA: 'Venda Fechada',
}

// Status de AVALIAÇÃO por tipo de imóvel (clientes.status_novo / clientes.status_usado).
// Domínio DIFERENTE do CRM acima — não misturar. Os dois conjuntos compartilham algumas
// palavras (Aprovado, Reprovado, etc) mas representam conceitos distintos.
export const AVALIACAO_LABELS: Record<string, string> = {
  NAO_AVALIADO: 'Não Avaliado',
  EM_ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  CONDICIONADO: 'Condicionado',
  QV_LIBERACAO_REAVALIAR: 'QV/Lib. Reavaliar',
  PRECISA_CARTA_CANCELAMENTO: 'Carta Cancelamento',
  VENDA_FECHADA: 'Venda Fechada',
  DESISTENCIA: 'Desistência',
  TOKEN: 'Token',
}

export const REPROVACAO_MOTIVOS = [
  'Rating mínimo não obtido (verificar manual)',
  'Margem financeira comprometida (Caixa/outros bancos)',
  'Margem comprometida + restrição externa',
  'Outro (especificar nas observações)',
]

export const CONDICIONADO_MOTIVOS = [
  'Dívidas baixadas como Prejuízo (SCR)',
  'Margem insuficiente (recomendar adequação)',
  'Pendência interna (procurar agência)',
  'Outro (especificar nas observações)',
]
