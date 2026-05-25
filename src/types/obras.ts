export type ObraStatus = 'PLANEJAMENTO' | 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA'

export interface Obra {
  id: string
  nome: string
  endereco: string | null
  cidade: string | null
  status: ObraStatus
  data_inicio: string | null
  data_previsao_entrega: string | null
  orcamento_previsto: number | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface ObraInput {
  nome: string
  endereco?: string | null
  cidade?: string | null
  status?: ObraStatus
  data_inicio?: string | null
  data_previsao_entrega?: string | null
  orcamento_previsto?: number | null
  observacoes?: string | null
}

export const OBRA_STATUS_LABELS: Record<ObraStatus, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADA: 'Pausada',
  CONCLUIDA: 'Concluída',
}
