'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshButton } from '@/components/ui/refresh-button'
import {
  ArrowLeft, ArrowRight, AlertCircle, Inbox, MapPin, Phone, Mail, Globe,
} from 'lucide-react'
import { listOrdensServico } from '@/app/actions/ordens-servico-actions'
import type { OrdemServico, OrdemServicoStatus } from '@/types/manutencoes'
import { ORDEM_SERVICO_STATUS_LABEL } from '@/types/manutencoes'
import { cn } from '@/lib/utils'

const FILTROS: { id: 'TODAS' | OrdemServicoStatus; label: string }[] = [
  { id: 'TODAS',    label: 'Todas' },
  { id: 'PENDENTE', label: 'Pendentes' },
  { id: 'ACEITA',   label: 'Aceitas' },
  { id: 'RECUSADA', label: 'Recusadas' },
]

const STATUS_TONE: Record<OrdemServicoStatus, string> = {
  PENDENTE: 'bg-amber-50 text-amber-700',
  ACEITA:   'bg-emerald-50 text-emerald-700',
  RECUSADA: 'bg-rose-50 text-rose-700',
}

function formatDateTimeBR(iso: string) {
  const dt = new Date(iso)
  const d = dt.toLocaleDateString('pt-BR')
  const t = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${d} · ${t}`
}

export default function SolicitacoesListPage() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'TODAS' | OrdemServicoStatus>('PENDENTE')

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const data = await listOrdensServico()
      setOrdens(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const filtradas = filtro === 'TODAS' ? ordens : ordens.filter(o => o.status === filtro)
  const pendentes = ordens.filter(o => o.status === 'PENDENTE').length

  return (
    <>
      <Header
        eyebrow="Manutenções"
        title="Solicitações"
        subtitle={pendentes > 0 ? `${pendentes} pendente${pendentes > 1 ? 's' : ''} aguardando análise` : 'Solicitações recebidas pelo portal ou link público'}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/manutencoes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              <ArrowLeft className="h-4 w-4" /> Manutenções
            </Link>
            <RefreshButton onRefresh={carregar} />
          </div>
        }
      />

      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-8">
        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Tabs de filtro */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--line)] bg-white p-1">
          {FILTROS.map(f => {
            const count = f.id === 'TODAS' ? ordens.length : ordens.filter(o => o.status === f.id).length
            const ativo = filtro === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
                  ativo
                    ? 'bg-[var(--ink)] text-white'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)]',
                )}
              >
                {f.label}
                {count > 0 && (
                  <span className={cn(
                    'inline-grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold',
                    ativo ? 'bg-white/20 text-white' : 'bg-[var(--paper)] text-[var(--ink-soft)]',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--ink-soft)]">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-base font-semibold text-[var(--ink)]">
              Nenhuma solicitação {filtro === 'PENDENTE' ? 'pendente' : filtro === 'TODAS' ? '' : ORDEM_SERVICO_STATUS_LABEL[filtro as OrdemServicoStatus].toLowerCase()}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Solicitações aparecem aqui quando clientes usam o portal ou o link público.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtradas.map(o => (
              <li key={o.id}>
                <Link
                  href={`/manutencoes/solicitacoes/${o.id}`}
                  className="group block rounded-2xl border border-[var(--line)] bg-white p-4 transition-all hover:border-[var(--brand-bright)]/40 hover:shadow-sm sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
                          STATUS_TONE[o.status],
                        )}>
                          {ORDEM_SERVICO_STATUS_LABEL[o.status]}
                        </span>
                        <span className="text-[11px] text-[var(--ink-faint)]">
                          {formatDateTimeBR(o.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
                          <Globe className="h-3 w-3" />
                          {o.origem === 'PORTAL' ? 'Portal' : 'Público'}
                        </span>
                      </div>
                      <p className="mt-1.5 font-display text-base font-semibold text-[var(--ink)]">
                        {o.nome_solicitante}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">
                        {o.descricao}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-faint)]">
                        {o.telefone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {o.telefone}
                          </span>
                        )}
                        {o.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {o.email}
                          </span>
                        )}
                        {o.endereco && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {o.endereco}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink)]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
