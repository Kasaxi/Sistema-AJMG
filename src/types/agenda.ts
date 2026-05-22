export type AgendaTipo = 'TAREFA' | 'AGENDAMENTO'
export type AgendaPrioridade = 'BAIXA' | 'MEDIA' | 'ALTA'
export type AgendaStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO'
export type AgendaRecorrencia = 'NENHUMA' | 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'ANUAL'
export type AnexoTipo = 'FOTO' | 'VIDEO' | 'DOCUMENTO'

export type ModuloApp =
  | 'AGENDA' | 'OBRAS' | 'COMPRAS' | 'RH' | 'FINANCEIRO' | 'COBRANCA' | 'VENDAS'

export interface CategoriaAgenda {
  id: string
  nome: string
  cor: string | null
  icone: string | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ProfileBasico {
  id: string
  nome: string
}

export interface Subtarefa {
  id: string
  item_id: string
  titulo: string
  concluida: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export interface AgendaAnexo {
  id: string
  item_id: string
  tipo: AnexoTipo
  nome: string
  storage_path: string
  mime_type: string | null
  tamanho_bytes: number | null
  enviado_por: string | null
  created_at: string
}

export interface AgendaItem {
  id: string
  tipo: AgendaTipo
  titulo: string
  descricao: string | null
  data: string                // YYYY-MM-DD
  hora_inicio: string | null  // HH:mm:ss
  hora_fim: string | null
  prioridade: AgendaPrioridade
  status: AgendaStatus
  categoria_id: string | null
  local: string | null
  observacoes: string | null
  criado_por: string
  atribuido_para: string | null
  cliente_id: string | null
  obra_id: string | null
  recorrencia: AgendaRecorrencia
  recorrencia_ate: string | null
  recorrencia_pai_id: string | null
  ordem: number
  created_at: string
  updated_at: string

  // joins opcionais
  categoria?: CategoriaAgenda | null
  criador?: ProfileBasico | null
  atribuido?: ProfileBasico | null
  subtarefas?: Subtarefa[]
  anexos?: AgendaAnexo[]
}

export interface AgendaHistorico {
  id: string
  item_id: string
  campo_alterado: string
  valor_anterior: string | null
  valor_novo: string | null
  mudado_por: string | null
  mudado_em: string
  // join
  autor?: ProfileBasico | null
}

export interface AgendaFilters {
  search?: string
  status?: AgendaStatus | AgendaStatus[]
  prioridade?: AgendaPrioridade | AgendaPrioridade[]
  categoria_id?: string
  atribuido_para?: string
  data_inicio?: string  // YYYY-MM-DD
  data_fim?: string
  tipo?: AgendaTipo
}

export interface AgendaItemInput {
  tipo: AgendaTipo
  titulo: string
  descricao?: string | null
  data: string
  hora_inicio?: string | null
  hora_fim?: string | null
  prioridade?: AgendaPrioridade
  status?: AgendaStatus
  categoria_id?: string | null
  local?: string | null
  observacoes?: string | null
  atribuido_para?: string | null
  cliente_id?: string | null
  obra_id?: string | null
  recorrencia?: AgendaRecorrencia
  recorrencia_ate?: string | null
}

// Labels para UI
export const PRIORIDADE_LABELS: Record<AgendaPrioridade, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
}

export const STATUS_LABELS: Record<AgendaStatus, string> = {
  PENDENTE: 'A Fazer',
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Concluída',
  CANCELADO: 'Cancelada',
}

export const RECORRENCIA_LABELS: Record<AgendaRecorrencia, string> = {
  NENHUMA: 'Não se repete',
  DIARIA: 'Todo dia',
  SEMANAL: 'Toda semana',
  QUINZENAL: 'A cada 15 dias',
  MENSAL: 'Todo mês',
  ANUAL: 'Todo ano',
}

export const TIPO_LABELS: Record<AgendaTipo, string> = {
  TAREFA: 'Tarefa',
  AGENDAMENTO: 'Agendamento',
}
