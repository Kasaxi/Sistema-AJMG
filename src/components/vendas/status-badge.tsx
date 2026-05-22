import { cn } from '@/lib/utils'
import { STATUS_LABELS, AVALIACAO_LABELS } from '@/types/vendas'

type Variant = 'brand' | 'brandSolid' | 'neutral' | 'accent' | 'warn' | 'alert' | 'danger' | 'violet' | 'mute'
type Kind = 'crm' | 'avaliacao'

// CRM funnel — pipeline stages.
const CRM_VARIANT: Record<string, Variant> = {
  NOVO_LEAD:       'accent',
  CONTATO_INICIAL: 'accent',
  DOCUMENTACAO:    'violet',
  AVALIACAO:       'warn',
  SIMULACAO:       'warn',
  VISITA:          'accent',
  ASSINATURA_DOCS: 'violet',
  CONFORMIDADE:    'neutral',
  VENDA_FECHADA:   'brandSolid',
}

// Avaliação — outcome per property type.
const AVALIACAO_VARIANT: Record<string, Variant> = {
  NAO_AVALIADO:               'neutral',
  EM_ANALISE:                 'accent',
  APROVADO:                   'brand',
  REPROVADO:                  'danger',
  CONDICIONADO:               'warn',
  QV_LIBERACAO_REAVALIAR:     'violet',
  PRECISA_CARTA_CANCELAMENTO: 'alert',
  VENDA_FECHADA:              'brandSolid',
  DESISTENCIA:                'mute',
  TOKEN:                      'accent',
}

// Positive outcomes use the brand dark-blue (no green, per brand palette).
const VARIANT_CLASS: Record<Variant, string> = {
  brand:      'bg-[var(--brand-tint)] text-[var(--brand)] ring-[var(--brand)]/15 [&>i]:bg-[var(--brand)]',
  brandSolid: 'bg-[var(--brand)] text-[var(--on-brand)] ring-[var(--brand)]/30 [&>i]:bg-white',
  accent:     'bg-[var(--brand-tint)] text-[var(--brand-bright)] ring-[var(--brand-bright)]/15 [&>i]:bg-[var(--brand-bright)]',
  neutral:    'bg-slate-100 text-slate-600 ring-slate-500/15 [&>i]:bg-slate-400',
  mute:       'bg-slate-50 text-slate-500 ring-slate-400/15 [&>i]:bg-slate-300',
  warn:       'bg-amber-50 text-amber-700 ring-amber-600/15 [&>i]:bg-amber-500',
  alert:      'bg-orange-50 text-orange-700 ring-orange-600/15 [&>i]:bg-orange-500',
  danger:     'bg-rose-50 text-rose-700 ring-rose-600/15 [&>i]:bg-rose-500',
  violet:     'bg-violet-50 text-violet-700 ring-violet-600/15 [&>i]:bg-violet-500',
}

interface StatusBadgeProps {
  status: string | null | undefined
  kind?: Kind
  className?: string
}

export function StatusBadge({ status, kind = 'crm', className }: StatusBadgeProps) {
  const labels = kind === 'avaliacao' ? AVALIACAO_LABELS : STATUS_LABELS
  const variants = kind === 'avaliacao' ? AVALIACAO_VARIANT : CRM_VARIANT
  const key = status ?? (kind === 'avaliacao' ? 'NAO_AVALIADO' : 'NOVO_LEAD')
  const label = labels[key] ?? key
  const variant = variants[key] ?? 'neutral'

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors',
      VARIANT_CLASS[variant],
      className
    )}>
      <i className="h-1.5 w-1.5 rounded-full not-italic" />
      {label}
    </span>
  )
}
