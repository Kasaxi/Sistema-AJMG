'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users } from 'lucide-react'

export const TODOS = '__all__'
export const EU = '__self__'

interface FiltroUsuarioProps {
  value: string           // EU | TODOS | <profile_id>
  onChange: (v: string) => void
  pessoas: { id: string; nome: string }[]
  euNome: string          // ex.: "Nilson"
}

export function FiltroUsuario({ value, onChange, pessoas, euNome }: FiltroUsuarioProps) {
  // Lista outras pessoas (exclui o próprio usuário — que vira "Minhas")
  // Aqui assumimos que `pessoas` já vem sem o user atual; a página garante isso.
  return (
    <Select value={value} onValueChange={v => onChange(v ?? EU)}>
      <SelectTrigger
        className="h-9 rounded-xl border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)]"
      >
        <Users className="h-4 w-4 shrink-0 text-[var(--ink-faint)]" />
        <SelectValue>
          {(v: string | null) => {
            if (!v || v === EU) return `Minhas (${euNome})`
            if (v === TODOS) return 'Todas'
            const p = pessoas.find(x => x.id === v)
            return p?.nome ?? 'Filtrar'
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EU}>Minhas ({euNome})</SelectItem>
        {pessoas.map(p => (
          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
        ))}
        <SelectItem value={TODOS}>Todas (equipe)</SelectItem>
      </SelectContent>
    </Select>
  )
}
