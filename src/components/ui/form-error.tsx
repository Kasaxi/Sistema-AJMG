import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bloco padrão de erro em forms. Renderiza nada quando `message` é vazio,
 * então pode substituir o boilerplate `{erro && (...)}` direto:
 *   <FormError message={erro} />
 */
export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="whitespace-pre-line">{message}</span>
    </div>
  )
}
