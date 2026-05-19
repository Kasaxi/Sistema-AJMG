'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Edit2, Phone } from 'lucide-react'
import { ClienteForm } from '@/components/vendas/cliente-form'
import { getClientes, getVendedores, getEtapasFunil, updateCliente } from '@/app/actions/vendas-actions'
import type { Cliente, Vendedor, EtapaFunil } from '@/types/vendas'
import { formatPhone, cn } from '@/lib/utils'

const STATUS_DOT: Record<string, string> = {
  APROVADO:                   'bg-[var(--brand)]',
  VENDA_FECHADA:              'bg-[var(--brand)]',
  REPROVADO:                  'bg-rose-500',
  CONDICIONADO:               'bg-amber-500',
  QV_LIBERACAO_REAVALIAR:     'bg-violet-500',
  PRECISA_CARTA_CANCELAMENTO: 'bg-orange-500',
  NAO_AVALIADO:               'bg-slate-400',
  NOVO_LEAD:                  'bg-[var(--brand-bright)]',
}

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

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [etapasData, clientesData, vendedoresData] = await Promise.all([
        getEtapasFunil(),
        getClientes({ per_page: 500 }),
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

  function getClientesPorEtapa(chave: string) {
    return clientes.filter(c => (c.status_novo ?? 'NAO_AVALIADO') === chave)
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

  async function handleDrop(chave: string, clienteId: string) {
    if (!clienteId) return
    const cliente = clientes.find(c => c.id === clienteId)
    if (!cliente || cliente.status_novo === chave) return
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, status_novo: chave, status: chave } : c))
    await updateCliente(clienteId, { status_novo: chave, status: chave })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <Header
        eyebrow="Vendas"
        title="CRM — Funil de Vendas"
        subtitle="Arraste os cartões para mover entre etapas"
      />

      <div className="flex-1 overflow-x-auto">
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
          <div className="flex min-w-max items-start gap-4 p-6">
            {etapas.map((etapa) => {
              const items = getClientesPorEtapa(etapa.chave)
              const dot = STATUS_DOT[etapa.chave] ?? 'bg-slate-400'
              const isOver = dragOver === etapa.chave

              return (
                <div
                  key={etapa.id}
                  className="flex w-72 shrink-0 flex-col gap-2.5"
                  onDragOver={e => { e.preventDefault(); setDragOver(etapa.chave) }}
                  onDragLeave={() => setDragOver(prev => prev === etapa.chave ? null : prev)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOver(null)
                    handleDrop(etapa.chave, e.dataTransfer.getData('clienteId'))
                  }}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', dot)} />
                      <span className="text-sm font-semibold text-[var(--ink)]">{etapa.nome}</span>
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--paper)] px-1.5 text-[11px] font-bold text-[var(--ink-soft)] ring-1 ring-inset ring-[var(--line)]">
                        {items.length}
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

                  {/* Cards */}
                  <div
                    className={cn(
                      'min-h-[80px] space-y-2.5 rounded-2xl transition-colors',
                      isOver && 'bg-[var(--brand-tint)] ring-2 ring-inset ring-[var(--brand-bright)]/25'
                    )}
                  >
                    {items.map((c) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('clienteId', c.id); setDragging(c.id) }}
                        onDragEnd={() => setDragging(null)}
                        className={cn(
                          'cursor-grab rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-sm transition-all duration-200 active:cursor-grabbing',
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
                      <div className="flex h-16 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] text-xs text-[var(--ink-faint)]">
                        Solte aqui
                      </div>
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
