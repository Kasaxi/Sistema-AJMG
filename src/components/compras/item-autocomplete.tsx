'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Sparkles, Loader2 } from 'lucide-react'
import { searchItensCatalogo, type ItemCatalogoSugestao } from '@/app/actions/compras-actions'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Disparado ao escolher uma sugestão do catálogo. Recebe o item completo
   *  (com unidade_padrao_id e categoria_padrao_id pré-resolvidos). */
  onSelect: (item: ItemCatalogoSugestao) => void
  placeholder?: string
  className?: string
  /** Mínimo de caracteres antes de disparar busca (default 2). */
  minChars?: number
  /** Debounce ms (default 200). */
  debounceMs?: number
  /** Disabled. */
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

/**
 * Input com sugestões do catálogo de itens. Conforme o usuário digita,
 * busca matches no DB e mostra dropdown. Selecionar pré-preenche
 * descrição + unidade + categoria via callback `onSelect`.
 */
export function ItemAutocomplete({
  value, onChange, onSelect,
  placeholder = 'Descrição do item',
  className,
  minChars = 2,
  debounceMs = 200,
  disabled,
  autoFocus,
  id,
}: Props) {
  const [sugestoes, setSugestoes] = useState<ItemCatalogoSugestao[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Evita reabrir o dropdown logo após o usuário selecionar via click.
  const acabouDeSelecionar = useRef(false)

  // Debounced search
  useEffect(() => {
    if (acabouDeSelecionar.current) {
      acabouDeSelecionar.current = false
      return
    }
    const trimmed = value.trim()
    if (trimmed.length < minChars) {
      setSugestoes([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const results = await searchItensCatalogo(trimmed)
        // Filtra match exato (o que já está no input) — não faz sentido sugerir
        const filtered = results.filter(r => r.descricao.toLowerCase() !== trimmed.toLowerCase())
        setSugestoes(filtered)
        setHighlighted(0)
      } catch {
        setSugestoes([])
      } finally {
        setLoading(false)
      }
    }, debounceMs)
    return () => clearTimeout(t)
  }, [value, minChars, debounceMs])

  // Click fora fecha
  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  function escolher(item: ItemCatalogoSugestao) {
    acabouDeSelecionar.current = true
    onChange(item.descricao)
    onSelect(item)
    setOpen(false)
    setSugestoes([])
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || sugestoes.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      escolher(sugestoes[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const mostraDropdown = open && sugestoes.length > 0 && value.trim().length >= minChars

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--ink-faint)]" />
      )}

      {mostraDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-lg ring-1 ring-foreground/5">
          <div className="border-b border-[var(--line)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Sugestões do catálogo · {sugestoes.length}
          </div>
          <ul role="listbox">
            {sugestoes.map((s, idx) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => escolher(s)}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                    idx === highlighted ? 'bg-[var(--brand-tint)]' : 'hover:bg-[var(--paper)]',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
                    {s.descricao}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {s.unidade?.sigla && (
                      <span className="rounded-md bg-[var(--paper)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
                        {s.unidade.sigla}
                      </span>
                    )}
                    {s.categoria && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: s.categoria.cor ? `${s.categoria.cor}1A` : 'var(--brand-tint)',
                          color: s.categoria.cor ?? 'var(--brand-bright)',
                        }}
                      >
                        {s.categoria.nome}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
