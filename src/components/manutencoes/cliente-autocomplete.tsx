'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Users, Loader2, Plus } from 'lucide-react'
import {
  searchClientesPosVenda, createClientePosVenda,
} from '@/app/actions/manutencoes-actions'
import type { ClientePosVenda } from '@/types/manutencoes'
import { cn } from '@/lib/utils'

interface Props {
  /** Cliente selecionado (id) ou null. */
  value: string | null
  onChange: (cliente: ClientePosVenda | null) => void
  /** Render do hint/erro abaixo do input. */
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Busca cliente_pos_venda por nome/telefone/CPF. Mostra sugestões e
 * permite "cadastrar novo" inline se nada bater com a busca.
 */
export function ClientePosVendaAutocomplete({ value, onChange, className, disabled, autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [sugestoes, setSugestoes] = useState<ClientePosVenda[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [criando, setCriando] = useState(false)
  const [novoTelefone, setNovoTelefone] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const acabouDeSelecionar = useRef(false)

  // Reflete cliente selecionado externamente no campo
  useEffect(() => {
    if (!value) {
      setQuery('')
      return
    }
  }, [value])

  // Busca debounced
  useEffect(() => {
    if (acabouDeSelecionar.current) {
      acabouDeSelecionar.current = false
      return
    }
    if (value) return  // já tem cliente selecionado
    const trimmed = query.trim()
    if (trimmed.length < 2) { setSugestoes([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await searchClientesPosVenda(trimmed)
        setSugestoes(r)
        setHighlighted(0)
      } catch {
        setSugestoes([])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [query, value])

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  function escolher(c: ClientePosVenda) {
    acabouDeSelecionar.current = true
    onChange(c)
    setQuery(c.nome)
    setOpen(false)
    setSugestoes([])
  }

  function limpar() {
    onChange(null)
    setQuery('')
    setSugestoes([])
  }

  async function cadastrarNovo() {
    if (!query.trim()) return
    setCriando(true)
    try {
      const novo = await createClientePosVenda({
        nome: query.trim(),
        telefone: novoTelefone.trim() || null,
      })
      escolher(novo)
      setNovoTelefone('')
    } finally {
      setCriando(false)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || sugestoes.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlighted(h => Math.min(h + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault(); escolher(sugestoes[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const mostraDropdown = open && !value && query.trim().length >= 2
  const semResultados = mostraDropdown && !loading && sugestoes.length === 0
  const podeCadastrar = semResultados && query.trim().length >= 3

  // Quando há value: mostra "chip" do cliente selecionado
  if (value && query) {
    return (
      <div className={cn('flex items-center gap-2 rounded-xl border border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/30 px-3 py-2', className)}>
        <Users className="h-4 w-4 shrink-0 text-[var(--brand-bright)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{query}</span>
        <button
          type="button"
          onClick={limpar}
          className="cursor-pointer text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Buscar cliente por nome, telefone, CPF…"
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--ink-faint)]" />
      )}

      {mostraDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-lg ring-1 ring-foreground/5">
          {sugestoes.length > 0 && (
            <ul role="listbox">
              {sugestoes.map((c, idx) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => escolher(c)}
                    onMouseEnter={() => setHighlighted(idx)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                      idx === highlighted ? 'bg-[var(--brand-tint)]' : 'hover:bg-[var(--paper)]',
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-xs font-bold text-[var(--ink-soft)]">
                      {c.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{c.nome}</p>
                      {(c.telefone || c.cpf_cnpj) && (
                        <p className="truncate text-xs text-[var(--ink-soft)]">
                          {[c.telefone, c.cpf_cnpj].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {podeCadastrar && (
            <div className="border-t border-[var(--line)] bg-[var(--paper)]/40 p-2.5">
              {criando ? (
                <div className="flex items-center gap-2 px-1 text-xs text-[var(--ink-soft)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cadastrando…
                </div>
              ) : (
                <>
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                    Não achou? Cadastra novo:
                  </p>
                  <div className="mt-2 flex items-stretch gap-1.5">
                    <Input
                      value={novoTelefone}
                      onChange={e => setNovoTelefone(e.target.value)}
                      placeholder="Telefone (opcional)"
                      className="h-9 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={cadastrarNovo}
                      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[var(--ink)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--ink-soft)]"
                    >
                      <Plus className="h-3 w-3" /> Criar "{query.trim().slice(0, 30)}"
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {semResultados && !podeCadastrar && (
            <p className="px-3 py-3 text-center text-xs text-[var(--ink-faint)]">
              Digite ao menos 3 letras pra cadastrar um cliente novo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
