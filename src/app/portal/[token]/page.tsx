import Link from 'next/link'
import { Building2, AlertCircle, Wrench, Plus, CalendarDays, MapPin } from 'lucide-react'
import { getPortalByToken } from '@/app/actions/ordens-servico-actions'
import { ORDEM_SERVICO_STATUS_LABEL, MANUTENCAO_STATUS_LABEL } from '@/types/manutencoes'
import type { Manutencao, OrdemServico, ManutencaoStatus, OrdemServicoStatus } from '@/types/manutencoes'

export const dynamic = 'force-dynamic'

const STATUS_M_TONE: Record<ManutencaoStatus, string> = {
  AGENDADA:     'bg-[var(--paper)] text-[var(--ink-soft)]',
  EM_ANDAMENTO: 'bg-amber-50 text-amber-700',
  CONCLUIDA:    'bg-emerald-50 text-emerald-700',
  CANCELADA:    'bg-rose-50 text-rose-700',
}
const STATUS_O_TONE: Record<OrdemServicoStatus, string> = {
  PENDENTE: 'bg-amber-50 text-amber-700',
  ACEITA:   'bg-emerald-50 text-emerald-700',
  RECUSADA: 'bg-rose-50 text-rose-700',
}

function formatDateBR(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function formatDateTimeBR(iso: string) {
  const dt = new Date(iso)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function PortalClientePage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let view
  try {
    view = await getPortalByToken(token)
  } catch (e) {
    return (
      <PortalShell>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-3 font-display text-xl font-bold text-[var(--ink)]">Portal não encontrado</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {e instanceof Error ? e.message : 'Não foi possível abrir esse portal.'}
          </p>
          <p className="mt-4 text-xs text-[var(--ink-faint)]">
            Confirme o link com a AJMG.
          </p>
        </div>
      </PortalShell>
    )
  }

  const { cliente, manutencoes, ordens } = view
  const pendentes = ordens.filter(o => o.status === 'PENDENTE')
  const decididas = ordens.filter(o => o.status !== 'PENDENTE')

  return (
    <PortalShell>
      <div className="space-y-6">
        {/* Header pessoal */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Olá,
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            {cliente.nome}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Esse é seu portal pra acompanhar manutenções e abrir novas solicitações.
          </p>
          <Link
            href={`/manutencao/nova?token=${cliente.token}`}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--brand-bright)]"
          >
            <Plus className="h-4 w-4" /> Abrir nova solicitação
          </Link>
        </section>

        {/* Solicitações pendentes */}
        {pendentes.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-base font-bold text-[var(--ink)]">
              Aguardando análise ({pendentes.length})
            </h2>
            <ul className="space-y-2">
              {pendentes.map(o => <OrdemCard key={o.id} ordem={o} />)}
            </ul>
          </section>
        )}

        {/* Manutenções em andamento ou concluídas */}
        {manutencoes.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-base font-bold text-[var(--ink)]">
              Suas manutenções
            </h2>
            <ul className="space-y-2">
              {manutencoes.map(m => <ManutencaoCard key={m.id} manutencao={m} />)}
            </ul>
          </section>
        )}

        {/* Histórico de solicitações recusadas/aceitas */}
        {decididas.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-base font-bold text-[var(--ink)]">
              Histórico de solicitações
            </h2>
            <ul className="space-y-2">
              {decididas.map(o => <OrdemCard key={o.id} ordem={o} />)}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {pendentes.length === 0 && manutencoes.length === 0 && decididas.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--ink-soft)]">
              <Wrench className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-base font-semibold text-[var(--ink)]">
              Você ainda não abriu solicitações
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Use o botão acima sempre que precisar de manutenção no seu imóvel.
            </p>
          </section>
        )}
      </div>
    </PortalShell>
  )
}

function OrdemCard({ ordem }: { ordem: OrdemServico }) {
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_O_TONE[ordem.status]}`}>
          {ORDEM_SERVICO_STATUS_LABEL[ordem.status]}
        </span>
        <span className="text-[11px] text-[var(--ink-faint)]">
          Enviada em {formatDateTimeBR(ordem.created_at)}
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--ink)] whitespace-pre-line">{ordem.descricao}</p>
      {ordem.endereco && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]">
          <MapPin className="h-3 w-3" /> {ordem.endereco}
        </p>
      )}
      {ordem.status === 'RECUSADA' && ordem.motivo_recusa && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs text-rose-700">
          <span className="font-semibold">Motivo: </span>{ordem.motivo_recusa}
        </p>
      )}
    </li>
  )
}

function ManutencaoCard({ manutencao }: { manutencao: Manutencao }) {
  const dataAg = formatDateBR(manutencao.data_agendada)
  const dataCon = formatDateBR(manutencao.data_concluida)
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_M_TONE[manutencao.status]}`}>
          {MANUTENCAO_STATUS_LABEL[manutencao.status]}
        </span>
        {dataCon ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
            <CalendarDays className="h-3 w-3" /> Concluída em {dataCon}
          </span>
        ) : dataAg ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
            <CalendarDays className="h-3 w-3" /> Agendada {dataAg}
          </span>
        ) : null}
      </div>
      {manutencao.endereco && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]">
          <MapPin className="h-3 w-3" /> {manutencao.endereco}
        </p>
      )}
      {manutencao.observacoes && (
        <p className="mt-1.5 text-sm text-[var(--ink)] whitespace-pre-line">{manutencao.observacoes}</p>
      )}
    </li>
  )
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-8">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-bright)] text-white">
            <Building2 className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold leading-tight text-[var(--ink)]">
              AJMG Construtora
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              Portal do Cliente
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  )
}
