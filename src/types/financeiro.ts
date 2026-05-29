export type LancamentoTipo = 'ENTRADA' | 'SAIDA'
export type LancamentoStatus = 'PENDENTE' | 'PAGO' | 'CANCELADO'
export type LancamentoOrigem = 'manual' | 'import'

export type GrupoDRE =
  | 'RECEITA_BRUTA' | 'DEDUCOES' | 'CUSTO_DIRETO' | 'DESPESA_OPERACIONAL'
  | 'RESULTADO_FINANCEIRO' | 'INVESTIMENTOS' | 'OUTROS' | 'NAO_RELATORIO'
  | 'ATIVO' | 'PASSIVO' | 'PATRIMONIO_LIQUIDO'

export interface FinanceiroCategoria {
  id: string
  nome: string
  tipo: LancamentoTipo
  grupo_dre: GrupoDRE | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface FinanceiroCategoriaInput {
  nome: string
  tipo: LancamentoTipo
  grupo_dre?: GrupoDRE | null
  ativo?: boolean
}

export type CentroCustoTipo = 'OBRA' | 'IMOVEL' | 'AVULSO'

export interface CentroCusto {
  id: string
  nome: string
  grupo: string | null
  tipo: CentroCustoTipo
  obra_id: string | null
  imovel_id: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export interface CentroCustoInput {
  nome: string
  grupo?: string | null
  tipo: CentroCustoTipo
  obra_id?: string | null
  imovel_id?: string | null
  ativo?: boolean
}

export const CENTRO_CUSTO_TIPO_LABELS: Record<CentroCustoTipo, string> = {
  OBRA: 'Obra',
  IMOVEL: 'Imóvel',
  AVULSO: 'Avulso',
}

export interface Lancamento {
  id: string
  tipo: LancamentoTipo
  descricao: string
  valor: number
  status: LancamentoStatus
  categoria_id: string | null
  centro_custo_id: string | null
  data_competencia: string
  data_vencimento: string
  data_pagamento: string | null
  origem: LancamentoOrigem
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Lançamento com relações resolvidas (categoria, centro de custo, autor) pra exibição.
export interface LancamentoComRelacoes extends Lancamento {
  categoria_nome: string | null
  categoria_grupo_dre: GrupoDRE | null
  centro_custo_nome: string | null
  centro_custo_grupo: string | null
  autor_nome: string | null
}

export interface LancamentoInput {
  tipo: LancamentoTipo
  descricao: string
  valor: number
  status?: LancamentoStatus
  categoria_id?: string | null
  centro_custo_id?: string | null
  data_competencia: string
  data_vencimento: string
  observacoes?: string | null
  // Recorrência (gera N parcelas mensais/semanais/anuais a partir do vencimento)
  recorrencia?: 'NENHUMA' | 'SEMANAL' | 'MENSAL' | 'ANUAL'
  parcelas?: number
}

export interface LancamentoFiltros {
  aba?: 'TODOS' | 'RECEBER' | 'PAGAR'
  busca?: string
  categoriaId?: string | null
  centroCustoId?: string | null
  autorId?: string | null
  status?: LancamentoStatus | null
  mes?: string // 'YYYY-MM'
}

// KPIs do período selecionado.
export interface FinanceiroResumo {
  saldoRealizado: number      // entradas PAGAS - saídas PAGAS
  saldoPrevisto: number       // inclui pendentes
  totalReceber: number        // entradas PENDENTES
  totalPagar: number          // saídas PENDENTES
  totalVencido: number        // pendentes com vencimento < hoje (módulo)
  countVencido: number
}

export const LANCAMENTO_STATUS_LABELS: Record<LancamentoStatus, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

export const GRUPO_DRE_LABELS: Record<GrupoDRE, string> = {
  RECEITA_BRUTA: 'Receita bruta',
  DEDUCOES: 'Deduções',
  CUSTO_DIRETO: 'Custo direto',
  DESPESA_OPERACIONAL: 'Despesa operacional',
  RESULTADO_FINANCEIRO: 'Resultado financeiro',
  INVESTIMENTOS: 'Investimentos',
  OUTROS: 'Outros',
  NAO_RELATORIO: 'Fora do relatório',
  ATIVO: 'Ativo',
  PASSIVO: 'Passivo',
  PATRIMONIO_LIQUIDO: 'Patrimônio líquido',
}
