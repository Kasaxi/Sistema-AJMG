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
  obra_id: string
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

export interface GastoInput {
  obra_id: string
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

export interface GastoFilters {
  obra_id?: string
  categoria_id?: string
  fornecedor_id?: string
  data_inicio?: string
  data_fim?: string
  search?: string
}
