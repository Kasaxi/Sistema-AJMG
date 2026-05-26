import { cn } from '@/lib/utils'
import { STATUS_LABELS, AVALIACAO_LABELS } from '@/types/vendas'

// Variants alinhadas ao DESIGN.md — só tokens nomeados do sistema.
// Sem slate / orange / violet — esses fugiam da paleta restrita.
type Variant = 'brand' | 'brandSolid' | 'accent' | 'neutral' | 'mute' | 'warn' | 'danger'
type Kind = 'crm' | 'avaliacao'

// CRM funnel — pipeline stages.
// Stages "em andamento" colapsam em accent (Cobalt) — distinção fica no label.
const CRM_VARIANT: Record<string, Variant> = {
  NOVO_LEAD:       'accent',
  CONTATO_INICIAL: 'accent',
  DOCUMENTACAO:    'accent',
  AVALIACAO:       'warn',
  SIMULACAO:       'warn',
  VISITA:          'accent',
  ASSINATURA_DOCS: 'accent',
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
  QV_LIBERACAO_REAVALIAR:     'accent',
  PRECISA_CARTA_CANCELAMENTO: 'warn',
  VENDA_FECHADA:              'brandSolid',
  DESISTENCIA:                'mute',
  TOKEN:                      'accent',
}

// 7 variants → todas dentro dos tokens do design system.
// Resultados positivos usam brand (azul escuro) — nunca verde, per DESIGN.md.
const VARIANT_CLASS: Record<Variant, string> = {
  brand:      'bg-[var(--brand-tint)] text-[var(--brand)] ring-[var(--brand)]/15 [&>i]:bg-[var(--brand)]',
  brandSolid: 'bg-[var(--brand)] text-[var(--on-brand)] ring-[var(--brand)]/30 [&>i]:bg-white',
  accent:     'bg-[var(--brand-tint)] text-[var(--brand-bright)] ring-[var(--brand-bright)]/15 [&>i]:bg-[var(--brand-bright)]',
  neutral:    'bg-[var(--paper)] text-[var(--ink-soft)] ring-[var(--line)] [&>i]:bg-[var(--ink-soft)]',
  mute:       'bg-[var(--paper)]/60 text-[var(--ink-faint)] ring-[var(--line)] [&>i]:bg-[var(--ink-faint)]',
  warn:       'bg-amber-50 text-amber-700 ring-amber-600/15 [&>i]:bg-amber-500',
  danger:     'bg-rose-50 text-rose-700 ring-rose-600/15 [&>i]:bg-rose-500',
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
