import { cn } from '@/lib/utils'
import { STATUS_LABELS } from '@/types/vendas'

type Variant = 'brand' | 'brandSolid' | 'neutral' | 'accent' | 'warn' | 'alert' | 'danger' | 'violet'

const STATUS_VARIANT: Record<string, Variant> = {
  NOVO_LEAD:                  'accent',
  NAO_AVALIADO:               'neutral',
  CONDICIONADO:               'warn',
  QV_LIBERACAO_REAVALIAR:     'violet',
  PRECISA_CARTA_CANCELAMENTO: 'alert',
  APROVADO:                   'brand',
  REPROVADO:                  'danger',
  VENDA_FECHADA:              'brandSolid',
}

// Positive outcomes use the brand dark-blue (no green, per brand palette).
const VARIANT_CLASS: Record<Variant, string> = {
  brand:      'bg-[var(--brand-tint)] text-[var(--brand)] ring-[var(--brand)]/15 [&>i]:bg-[var(--brand)]',
  brandSolid: 'bg-[var(--brand)] text-[var(--on-brand)] ring-[var(--brand)]/30 [&>i]:bg-white',
  accent:     'bg-[var(--brand-tint)] text-[var(--brand-bright)] ring-[var(--brand-bright)]/15 [&>i]:bg-[var(--brand-bright)]',
  neutral:    'bg-slate-100 text-slate-600 ring-slate-500/15 [&>i]:bg-slate-400',
  warn:       'bg-amber-50 text-amber-700 ring-amber-600/15 [&>i]:bg-amber-500',
  alert:      'bg-orange-50 text-orange-700 ring-orange-600/15 [&>i]:bg-orange-500',
  danger:     'bg-rose-50 text-rose-700 ring-rose-600/15 [&>i]:bg-rose-500',
  violet:     'bg-violet-50 text-violet-700 ring-violet-600/15 [&>i]:bg-violet-500',
}

interface StatusBadgeProps {
  status: string | null | undefined
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status ?? 'NAO_AVALIADO'
  const label = STATUS_LABELS[key] ?? key
  const variant = STATUS_VARIANT[key] ?? 'neutral'

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
