'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Search, MoreHorizontal, Edit2, Trash2,
  Phone, MapPin, SlidersHorizontal, ChevronLeft, ChevronRight, Users, X, RefreshCw,
} from 'lucide-react'
import { ClienteForm } from '@/components/vendas/cliente-form'
import { StatusBadge } from '@/components/vendas/status-badge'
import {
  getClientes, getVendedores, getCidades, deleteCliente, updateCliente
} from '@/app/actions/vendas-actions'
import type { Cliente, Vendedor, ClienteFilters } from '@/types/vendas'
import { AVALIACAO_LABELS } from '@/types/vendas'
import { formatPhone, formatDate, cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'

const TIPO_IMOVEL_LABELS = { NOVO: 'Novo', USADO: 'Usado', AMBOS: 'Ambos' }
const TIPO_RENDA_LABELS = { FORMAL: 'Formal', INFORMAL: 'Informal', AMBOS: 'Ambos' }

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Two-tone avatar, strictly on-brand (dark blue / near-black ink).
function avatarTone(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return h % 2 === 0 ? 'bg-[var(--brand)]' : 'bg-[var(--ink)]'
}

interface FilterDropdownProps {
  label: string
  value: string
  placeholder: string
  options: Record<string, string>
  onChange: (value: string) => void
}
function FilterDropdown({ label, value, placeholder, options, onChange }: FilterDropdownProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
        {label}
      </label>
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger className="h-10 rounded-xl border-[var(--line)] text-sm">
          <SelectValue placeholder={placeholder}>
            {(v: string | null) => (v ? options[v] ?? v : placeholder)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {Object.entries(options).map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function ClientesPage() {
  const confirm = useConfirm()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [cidades, setCidades] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const hasLoaded = useRef(false)
  const [page, setPage] = useState(1)

  const [filters, setFilters] = useState<ClienteFilters>({})
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)

  const perPage = 50
  const totalPages = Math.ceil(total / perPage)
  const activeFilters = Object.keys(filters).length

  const loadData = useCallback(async () => {
    // Mostra o skeleton apenas no primeiro carregamento.
    // Re-fetches subsequentes mantêm a lista visível com um sinal sutil de "atualizando".
    if (hasLoaded.current) setRefetching(true)
    else setLoading(true)
    try {
      const [clientesData, vendedoresData] = await Promise.all([
        getClientes({ ...filters, search: search || undefined, page, per_page: perPage }),
        getVendedores(),
      ])
      setClientes(clientesData.clientes)
      setTotal(clientesData.total)
      setVendedores(vendedoresData)
      hasLoaded.current = true
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefetching(false)
    }
  }, [filters, search, page])

  useEffect(() => { loadData() }, [loadData])

  // Cidades distintas só precisam ser carregadas uma vez — não dependem dos filtros.
  useEffect(() => {
    getCidades().then(setCidades).catch(err => console.error(err))
  }, [])

  function handleFilterChange(key: keyof ClienteFilters, value: string) {
    const next = value || undefined
    setFilters(prev => {
      // Bail se o valor não mudou de fato (evita fetch desnecessário e flicker).
      if (prev[key] === next) return prev
      return { ...prev, [key]: next }
    })
    setPage(1)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Excluir cliente',
      description: 'Deseja excluir este cliente?',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    await deleteCliente(id)
    loadData()
  }

  async function handleQuickStatus(id: string, field: 'status_novo' | 'status_usado', value: string) {
    await updateCliente(id, { [field]: value })
    loadData()
  }

  function openCreate() { setEditingCliente(null); setFormOpen(true) }
  function openEdit(c: Cliente) { setEditingCliente(c); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditingCliente(null); loadData() }

  const novoClienteBtn = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={loadData}
        disabled={refetching}
        aria-label="Atualizar"
        className="h-11 cursor-pointer rounded-2xl border-[var(--line)] px-4"
      >
        <RefreshCw className={cn('h-4 w-4', refetching && 'animate-spin')} strokeWidth={2.2} />
      </Button>
      <Button
        onClick={openCreate}
        className="h-11 gap-2 rounded-2xl bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)] shadow-[0_8px_20px_-8px_var(--brand)] transition-all hover:bg-[var(--brand-hover)] hover:shadow-[0_10px_24px_-8px_var(--brand)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo Cliente
      </Button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="Clientes"
        subtitle="Base de clientes e leads do funil"
        actions={novoClienteBtn}
      />

      <div className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
        {/* Hero stat */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-faint)]">
              Total na base
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              {loading ? (
                <Skeleton className="h-12 w-28 rounded-xl" />
              ) : (
                <span className="font-display text-5xl font-extrabold tracking-[-0.03em] text-[var(--ink)] tabular-nums">
                  {total}
                </span>
              )}
              <span className="text-sm text-[var(--ink-soft)]">
                {total === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="group relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 text-[var(--ink-faint)] transition-colors group-focus-within:text-[var(--brand-bright)]" />
            <Input
              placeholder="Buscar por nome ou telefone…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="h-12 rounded-2xl border-[var(--line)] bg-[var(--surface)] pl-11 text-sm text-[var(--ink)] shadow-sm transition-all placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--brand-bright)] focus-visible:ring-4 focus-visible:ring-[var(--brand-bright)]/12"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'inline-flex h-12 items-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition-all',
              showFilters || activeFilters > 0
                ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-sm hover:border-[var(--ink-faint)]'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={2.4} />
            Filtros
            {activeFilters > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--on-brand)] px-1 text-[11px] font-bold text-[var(--brand)]">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Filtros expandidos */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-2 gap-5 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:grid-cols-4">
            {/* Status Novo (avaliação imóvel novo) */}
            <FilterDropdown
              label="Status Novo"
              value={filters.status_novo ?? ''}
              placeholder="Todos os status"
              options={AVALIACAO_LABELS}
              onChange={v => handleFilterChange('status_novo', v)}
            />
            {/* Status Usado (avaliação imóvel usado) */}
            <FilterDropdown
              label="Status Usado"
              value={filters.status_usado ?? ''}
              placeholder="Todos os status"
              options={AVALIACAO_LABELS}
              onChange={v => handleFilterChange('status_usado', v)}
            />
            {/* Vendedor */}
            <FilterDropdown
              label="Vendedor"
              value={filters.vendedor_id ?? ''}
              placeholder="Todos"
              options={Object.fromEntries(vendedores.map(v => [v.id, v.nome]))}
              onChange={v => handleFilterChange('vendedor_id', v)}
            />
            {/* Tipo de Renda */}
            <FilterDropdown
              label="Tipo de Renda"
              value={filters.tipo_renda ?? ''}
              placeholder="Todos os tipos"
              options={TIPO_RENDA_LABELS}
              onChange={v => handleFilterChange('tipo_renda', v)}
            />
            {/* Cidade */}
            <FilterDropdown
              label="Cidade"
              value={filters.cidade ?? ''}
              placeholder="Todas as cidades"
              options={Object.fromEntries(cidades.map(c => [c, c]))}
              onChange={v => handleFilterChange('cidade', v)}
            />
            {/* De — data início */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">De</label>
              <Input
                type="date"
                value={filters.data_inicio ?? ''}
                onChange={e => handleFilterChange('data_inicio', e.target.value)}
                className="h-10 rounded-xl border-[var(--line)] text-sm"
              />
            </div>
            {/* Até — data fim */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Até</label>
              <Input
                type="date"
                value={filters.data_fim ?? ''}
                onChange={e => handleFilterChange('data_fim', e.target.value)}
                className="h-10 rounded-xl border-[var(--line)] text-sm"
              />
            </div>
            {activeFilters > 0 && (
              <div className="col-span-full flex justify-end">
                <button
                  onClick={() => { setFilters({}); setPage(1) }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                >
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabela */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(11,16,32,0.04),0_20px_48px_-24px_rgba(11,16,32,0.18)]">
          {loading ? (
            <div className="divide-y divide-[var(--line)]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-5">
                  <Skeleton className="h-11 w-11 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-44 rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--brand-tint)] ring-1 ring-inset ring-[var(--brand-bright)]/15">
                <Users className="h-8 w-8 text-[var(--brand)]" strokeWidth={1.8} />
              </div>
              <p className="mt-6 font-display text-2xl font-bold tracking-[-0.02em] text-[var(--ink)]">
                {activeFilters > 0 || search ? 'Nenhum resultado' : 'Sua base começa aqui'}
              </p>
              <p className="mt-2 max-w-sm text-sm text-[var(--ink-soft)]">
                {activeFilters > 0 || search
                  ? 'Não encontramos clientes para esses filtros. Ajuste a busca e tente de novo.'
                  : 'Cadastre o primeiro cliente para acompanhá-lo por todo o funil de vendas.'}
              </p>
              <Button
                onClick={openCreate}
                className="mt-7 h-11 gap-2 rounded-2xl bg-[var(--brand)] px-5 font-semibold text-[var(--on-brand)] shadow-[0_8px_20px_-8px_var(--brand)] transition-all hover:bg-[var(--brand-hover)]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Cadastrar cliente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left">
                    {['Cliente', 'Informações', 'Avaliações', 'Vendedor', ''].map((h, i) => (
                      <th
                        key={i}
                        className={cn(
                          'px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]',
                          i === 1 && 'hidden md:table-cell',
                          i === 3 && 'hidden sm:table-cell',
                          i === 4 && 'w-12',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn(
                  'divide-y divide-[var(--line)] transition-opacity',
                  refetching && 'opacity-60'
                )}>
                  {clientes.map((c) => (
                    <tr
                      key={c.id}
                      className="group relative transition-colors hover:bg-[var(--paper)]"
                    >
                      {/* CLIENTE — avatar + nome + data_avaliacao */}
                      <td className="relative px-6 py-4">
                        <span className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-r bg-[var(--brand-bright)] transition-all duration-200 group-hover:h-7" />
                        <div className="flex items-center gap-3.5">
                          <div className={cn(
                            'grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-[13px] font-bold text-white',
                            avatarTone(c.nome)
                          )}>
                            {initials(c.nome)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--ink)]">{c.nome}</p>
                            <p className="text-xs tabular-nums text-[var(--ink-faint)]">{formatDate(c.data_avaliacao)}</p>
                          </div>
                        </div>
                      </td>

                      {/* INFORMAÇÕES — telefone + cidade + chip de renda */}
                      <td className="hidden px-6 py-4 md:table-cell">
                        <div className="flex flex-col gap-1.5">
                          <a
                            href={`https://wa.me/55${c.telefone_whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex w-fit items-center gap-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--brand-bright)]"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {formatPhone(c.telefone_whatsapp)}
                          </a>
                          {c.cidade && (
                            <span className="flex items-center gap-1.5 text-xs text-[var(--ink-faint)]">
                              <MapPin className="h-3 w-3" />
                              {c.cidade}
                            </span>
                          )}
                          {c.tipo_renda && (
                            <span className="inline-flex w-fit items-center rounded-md bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)] ring-1 ring-inset ring-[var(--brand)]/15">
                              {c.tipo_renda}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* AVALIAÇÕES — NOVO + USADO chips, cada um clicável */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)] w-12">Novo</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40">
                                <StatusBadge status={c.status_novo} kind="avaliacao" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                <p className="px-2 py-1.5 text-xs font-semibold text-[var(--ink-faint)]">Avaliação Novo</p>
                                <DropdownMenuSeparator />
                                {Object.entries(AVALIACAO_LABELS).map(([k, v]) => (
                                  <DropdownMenuItem key={k} onClick={() => handleQuickStatus(c.id, 'status_novo', k)} className="text-sm">
                                    {v}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)] w-12">Usado</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40">
                                <StatusBadge status={c.status_usado} kind="avaliacao" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                <p className="px-2 py-1.5 text-xs font-semibold text-[var(--ink-faint)]">Avaliação Usado</p>
                                <DropdownMenuSeparator />
                                {Object.entries(AVALIACAO_LABELS).map(([k, v]) => (
                                  <DropdownMenuItem key={k} onClick={() => handleQuickStatus(c.id, 'status_usado', k)} className="text-sm">
                                    {v}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </td>

                      {/* VENDEDOR */}
                      <td className="hidden px-6 py-4 sm:table-cell">
                        {c.vendedor?.nome
                          ? <span className="text-sm text-[var(--ink-soft)]">{c.vendedor.nome}</span>
                          : <span className="text-sm text-[var(--ink-faint)]">—</span>}
                      </td>

                      {/* AÇÕES — kebab */}
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button
                              aria-label="Ações do cliente"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 cursor-pointer rounded-xl text-[var(--ink-faint)] opacity-100 transition-opacity hover:bg-[var(--paper)] hover:text-[var(--ink)] data-[popup-open]:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(c.id)} variant="destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--line)] px-6 py-4">
              <span className="text-xs text-[var(--ink-soft)]">
                Página <span className="font-semibold text-[var(--ink)]">{page}</span> de {totalPages}
                <span className="hidden sm:inline"> · {total} registros</span>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="icon"
                  className="h-9 w-9 rounded-xl border-[var(--line)]"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon"
                  className="h-9 w-9 rounded-xl border-[var(--line)]"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ClienteForm
        open={formOpen}
        onClose={closeForm}
        vendedores={vendedores}
        initialData={editingCliente}
      />
    </div>
  )
}
