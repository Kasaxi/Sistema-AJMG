import { getCotacaoPublicByToken } from '@/app/actions/cotacoes-actions'
import { CotacaoPublicForm } from '@/components/cotacoes/cotacao-public-form'
import { Building2, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CotacaoPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let view
  try {
    view = await getCotacaoPublicByToken(token)
  } catch (e) {
    return (
      <PublicShell>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-3 font-display text-xl font-bold text-[var(--ink)]">Link inválido</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {e instanceof Error ? e.message : 'Não foi possível abrir esta cotação.'}
          </p>
          <p className="mt-4 text-xs text-[var(--ink-faint)]">
            Confirme o link com quem mandou ou peça que reenviem.
          </p>
        </div>
      </PublicShell>
    )
  }

  const { cotacao } = view
  if (cotacao.status === 'FECHADA' || cotacao.status === 'CANCELADA') {
    return (
      <PublicShell>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
          <h1 className="font-display text-xl font-bold text-[var(--ink)]">
            Cotação {cotacao.status === 'FECHADA' ? 'encerrada' : 'cancelada'}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Esta cotação não está mais aceitando respostas. Entre em contato com a AJMG se tiver dúvidas.
          </p>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <CotacaoPublicForm initialView={view} />
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-8">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-bright)] text-white">
            <Building2 className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold leading-tight text-[var(--ink)]">
              AJMG Construtora
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              Pedido de Orçamento
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  )
}
