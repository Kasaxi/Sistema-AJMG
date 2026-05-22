// Permissões de módulo (espelha public.user_has_module() do banco).
// Mantido fora de arquivos 'use server' porque essas funções precisam ser
// chamáveis no client sem virar server action.

export type AppRole = 'ADMIN' | 'VENDEDOR' | 'COLABORADOR'

export type AppModulo =
  | 'AGENDA' | 'OBRAS' | 'COMPRAS' | 'RH' | 'FINANCEIRO' | 'COBRANCA' | 'VENDAS'

export interface CurrentProfile {
  id: string
  email: string | null
  nome: string
  role: AppRole
  vendedor_id: string | null
  acesso_modulos: string[]
  ativo: boolean
}

export function profileHasModule(profile: CurrentProfile, modulo: AppModulo | string): boolean {
  if (!profile.ativo) return false
  if (profile.role === 'ADMIN') return true
  if (profile.role === 'VENDEDOR') return modulo === 'VENDAS'
  return profile.acesso_modulos.includes(modulo)
}
