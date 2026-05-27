import { Building2 } from 'lucide-react'
import { OrdemPublicaForm } from '@/components/manutencoes/ordem-publica-form'

export const dynamic = 'force-dynamic'

interface SearchParams { token?: string }

export default async function NovaOrdemPublicaPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const { token } = await searchParams
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
              Solicitação de Manutenção
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <OrdemPublicaForm token={token ?? null} />
      </main>
    </div>
  )
}
