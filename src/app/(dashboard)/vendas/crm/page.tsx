'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Edit2, Phone, RefreshCw } from 'lucide-react'
import { ClienteForm } from '@/components/vendas/cliente-form'
import { getClientes, getVendedores, getEtapasFunil, updateCliente } from '@/app/actions/vendas-actions'
import type { Cliente, Vendedor, EtapaFunil } from '@/types/vendas'
import { formatPhone, cn } from '@/lib/utils'

// Hex de cada etapa do funil CRM — usado pra colorir borda, badge e header da coluna.
// VENDA_FECHADA usa azul-brand (regra "nunca verde"), ignorando o #22c55e que vem do banco.
const STATUS_HEX: Record<string, string> = {
  NOVO_LEAD:       '#2F55F2', // brand-bright
  CONTATO_INICIAL: '#06B6D4', // cyan
  DOCUMENTACAO:    '#8B5CF6', // violet
  AVALIACAO:       '#F59E0B', // amber
  SIMULACAO:       '#14B8A6', // teal
  VISITA:          '#EC4899', // pink
  ASSINATURA_DOCS: '#6366F1', // indigo
  CONFORMIDADE:    '#64748B', // slate
  VENDA_FECHADA:   '#14224F', // brand (dark navy)
}

const CARDS_LIMIT_PER_COLUMN = 30

export default function CRMPage() {
  const [etapas, setEtapas] = useState<EtapaFunil[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<string>('NOVO_LEAD')
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [etapasData, clientesData, vendedoresData] = await Promise.all([
        getEtapasFunil(),
        getClientes({ per_page: 2000 }),
        getVendedores(true),
      ])
      setEtapas(etapasData)
      setClientes(clientesData.clientes)
      setVendedores(vendedoresData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Filtra pela etapa do CRM (clientes.status), NÃO confundir com status_novo (avaliação).
  function getClientesPorEtapa(chave: string) {
    return clientes.filter(c => (c.status ?? 'NOVO_LEAD') === chave)
  }

  function openCreate(chave: string) {
    setDefaultStatus(chave)
    setEditingCliente(null)
    setFormOpen(true)
  }

  function openEdit(c: Cliente) {
    setEditingCliente(c)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingCliente(null)
    loadData()
  }

  // Drag-drop muda APENAS o status (CRM/funil). status_novo (avaliação) é domínio diferente.
  async function handleDrop(chave: string, clienteId: string) {
    if (!clienteId) return
    const cliente = clientes.find(c => c.id === clienteId)
    if (!cliente || cliente.status === chave) return
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, status: chave } : c))
    await updateCliente(clienteId, { status: chave })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="CRM — Funil de Vendas"
        subtitle="Arraste os cartões para mover entre etapas"
        actions={
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            aria-label="Atualizar"
            className="h-11 cursor-pointer rounded-2xl border-[var(--line)] px-4"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} strokeWidth={2.2} />
          </Button>
        }
      />

      {/* Kanban com altura fixa: a página não rola, cada coluna scrolla internamente.
          Isso libera o scroll horizontal do conjunto e mantém a UI calma. */}
      <div className="h-[calc(100vh-160px)] overflow-x-auto overflow-y-hidden">
        {loading ? (
          <div className="flex min-w-max gap-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-72 shrink-0 space-y-2.5">
                <Skeleton className="h-12 w-full rounded-2xl" />
                {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-24 w-full rounded-2xl" />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-w-max items-stretch gap-4 p-6">
            {etapas.map((etapa) => {
              const allItems = getClientesPorEtapa(etapa.chave)
              const isExpanded = expanded.has(etapa.chave)
              const items = isExpanded ? allItems : allItems.slice(0, CARDS_LIMIT_PER_COLUMN)
              const hidden = allItems.length - items.length
              const color = STATUS_HEX[etapa.chave] ?? '#94a3b8'
              const isOver = dragOver === etapa.chave

              return (
                <div
                  key={etapa.id}
                  className="flex w-72 shrink-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm"
                  style={{ borderTopWidth: '3px', borderTopColor: color }}
                  onDragOver={e => { e.preventDefault(); setDragOver(etapa.chave) }}
                  onDragLeave={() => setDragOver(prev => prev === etapa.chave ? null : prev)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOver(null)
                    handleDrop(etapa.chave, e.dataTransfer.getData('clienteId'))
                  }}
                >
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-3"
                    style={{ backgroundColor: `${color}0F` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--ink)]">{etapa.nome}</span>
                      <span
                        className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                        style={{ backgroundColor: `${color}1F`, color }}
                      >
                        {allItems.length}
                      </span>
                    </div>
                    <button
                      onClick={() => openCreate(etapa.chave)}
                      aria-label={`Novo cliente em ${etapa.nome}`}
                      className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  </div>

                  {/* Cards (scroll interno) */}
                  <div
                    className={cn(
                      'flex-1 space-y-2.5 overflow-y-auto p-2.5 transition-colors',
                      isOver && 'bg-[var(--brand-tint)]/40 ring-2 ring-inset ring-[var(--brand-bright)]/25'
                    )}
                  >
                    {items.map((c) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('clienteId', c.id); setDragging(c.id) }}
                        onDragEnd={() => setDragging(null)}
                        className={cn(
                          'cursor-grab rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm transition-all duration-200 active:cursor-grabbing',
                          'hover:-translate-y-0.5 hover:border-[var(--brand-bright)]/30 hover:shadow-md',
                          dragging === c.id && 'rotate-1 opacity-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--ink)]">{c.nome}</p>
                            <a
                              href={`https://wa.me/55${c.telefone_whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-faint)] transition-colors hover:text-[var(--brand-bright)]"
                              onClick={e => e.stopPropagation()}
                            >
                              <Phone className="h-3 w-3" />
                              {formatPhone(c.telefone_whatsapp)}
                            </a>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button aria-label="Ações do cliente" variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer rounded-lg text-[var(--ink-faint)] hover:bg-[var(--paper)] hover:text-[var(--ink)]">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            } />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(c)}>
                                <Edit2 className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => window.open(`https://wa.me/55${c.telefone_whatsapp.replace(/\D/g, '')}`, '_blank')}
                              >
                                <Phone className="mr-2 h-4 w-4" /> WhatsApp
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {c.vendedor && (
                            <span className="rounded-md bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-soft)] ring-1 ring-inset ring-[var(--line)]">
                              {c.vendedor.nome}
                            </span>
                          )}
                          <span className="rounded-md bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                            {c.tipo_imovel === 'NOVO' ? 'Novo' : c.tipo_imovel === 'USADO' ? 'Usado' : 'Ambos'}
                          </span>
                          {c.valor_simulacao_novo && (
                            <span className="rounded-md bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-bright)]">
                              Sim. R${Number(c.valor_simulacao_novo).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>

                        {c.observacoes && (
                          <p className="mt-2 line-clamp-2 text-[11px] text-[var(--ink-faint)]">{c.observacoes}</p>
                        )}
                      </div>
                    ))}

                    {items.length === 0 && (
                      <div className="flex h-16 items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] text-xs text-[var(--ink-faint)]">
                        Solte aqui
                      </div>
                    )}

                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(prev => new Set(prev).add(etapa.chave))}
                        className="w-full cursor-pointer rounded-xl border border-dashed border-[var(--line)] py-2 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--brand-bright)]/40 hover:bg-[var(--brand-tint)]/40 hover:text-[var(--brand-bright)]"
                      >
                        Ver mais {hidden} {hidden === 1 ? 'cliente' : 'clientes'}
                      </button>
                    )}

                    {isExpanded && allItems.length > CARDS_LIMIT_PER_COLUMN && (
                      <button
                        type="button"
                        onClick={() => setExpanded(prev => {
                          const next = new Set(prev); next.delete(etapa.chave); return next
                        })}
                        className="w-full cursor-pointer rounded-xl py-2 text-xs font-semibold text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-soft)]"
                      >
                        Recolher
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
