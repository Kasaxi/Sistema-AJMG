'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Search, Building2, Phone, Mail, EyeOff,
} from 'lucide-react'
import { RefreshButton } from '@/components/ui/refresh-button'
import { FornecedorForm } from '@/components/compras/fornecedor-form'
import { listFornecedoresComResumo } from '@/app/actions/compras-actions'
import type { Fornecedor } from '@/types/compras'
import { cn } from '@/lib/utils'

type FornecedorComResumo = Fornecedor & { total_gastos: number; qtd_lancamentos: number }

type Filtro = 'TODOS' | 'ATIVOS' | 'INATIVOS'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'TODOS',    label: 'Todos' },
  { id: 'ATIVOS',   label: 'Ativos' },
  { id: 'INATIVOS', label: 'Inativos' },
]

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<FornecedorComResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('ATIVOS')

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Fornecedor | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listFornecedoresComResumo()
      setFornecedores(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const filtrados = fornecedores.filter(f => {
    if (filtro === 'ATIVOS' && !f.ativo) return false
    if (filtro === 'INATIVOS' && f.ativo) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      return (
        f.nome.toLowerCase().includes(q) ||
        (f.telefone?.toLowerCase().includes(q) ?? false) ||
        (f.email?.toLowerCase().includes(q) ?? false) ||
        (f.cnpj_cpf?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  function abrirNovo() {
    setEditando(null)
    setModalOpen(true)
  }

  function abrirEdicao(f: Fornecedor) {
    setEditando(f)
    setModalOpen(true)
  }

  // Resumo agregado
  const totalAtivos = fornecedores.filter(f => f.ativo).length
  const totalCompras = fornecedores.reduce((s, f) => s + f.total_gastos, 0)

  return (
    <>
      <Header
        eyebrow="Construtora"
        title="Fornecedores"
        subtitle={`${totalAtivos} ativos · ${formatBRL(totalCompras)} em compras totais`}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={carregar} />
            <Button onClick={abrirNovo} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo fornecedor
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {/* Filtros */}
        <div className="mb-5 inline-flex rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1">
          {FILTROS.map(f => {
            const isActive = filtro === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-white text-[var(--ink)] shadow-sm ring-1 ring-inset ring-[var(--line)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Busca */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone, email, CNPJ/CPF…"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState onCreate={abrirNovo} hasBusca={!!busca.trim() || filtro !== 'TODOS'} />
        ) : (
          <div className="space-y-2.5">
            {filtrados.map(f => (
              <FornecedorCard key={f.id} fornecedor={f} onClick={abrirEdicao} />
            ))}
          </div>
        )}
      </div>

      <FornecedorForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editando}
        onSaved={carregar}
      />
    </>
  )
}

function FornecedorCard({ fornecedor, onClick }: { fornecedor: FornecedorComResumo; onClick: (f: Fornecedor) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(fornecedor)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(fornecedor)
        }
      }}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 text-left transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
        !fornecedor.ativo && 'opacity-60',
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Building2 className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="min-w-0 flex-1 font-display text-base font-bold leading-tight text-[var(--ink)]">
            {fornecedor.nome}
          </h3>
          {!fornecedor.ativo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
              <EyeOff className="h-2.5 w-2.5" /> Inativo
            </span>
          )}
        </div>

        {(fornecedor.telefone || fornecedor.email || fornecedor.cnpj_cpf) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-soft)]">
            {fornecedor.telefone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {fornecedor.telefone}
              </span>
            )}
            {fornecedor.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> {fornecedor.email}
              </span>
            )}
            {fornecedor.cnpj_cpf && (
              <span className="text-[var(--ink-faint)]">{fornecedor.cnpj_cpf}</span>
            )}
          </div>
        )}

        {fornecedor.qtd_lancamentos > 0 && (
          <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg bg-[var(--paper)] px-2.5 py-1 text-xs">
            <span className="font-semibold text-[var(--ink)]">
              {formatBRL(fornecedor.total_gastos)}
            </span>
            <span className="text-[var(--ink-faint)]">·</span>
            <span className="text-[var(--ink-soft)]">
              {fornecedor.qtd_lancamentos} {fornecedor.qtd_lancamentos === 1 ? 'compra' : 'compras'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onCreate, hasBusca }: { onCreate: () => void; hasBusca: boolean }) {
  if (hasBusca) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-[var(--ink)]">Nenhum fornecedor com esse filtro</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Tenta limpar a busca ou trocar pra "Todos".</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Building2 className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-base font-semibold text-[var(--ink)]">Nenhum fornecedor cadastrado</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Comece cadastrando seus fornecedores recorrentes (Multilit, Polimix, etc).<br />
        Depois você vai poder vincular gastos a eles.
      </p>
      <Button onClick={onCreate} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" /> Cadastrar fornecedor
      </Button>
    </div>
  )
}
