'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pencil, Check, Loader2, MapPin, FileText, KeyRound, ChevronDown, Images, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { updateImovel } from '@/app/actions/imoveis-actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImovelAnexos } from './imovel-anexos'
import type { Imovel, ImovelStatus, CarteiraTipo, ImovelInput, ImovelAnexoTipo } from '@/types/imoveis'
import { IMOVEL_STATUS_LABEL, STATUS_POR_TIPO } from '@/types/imoveis'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<ImovelStatus, string> = {
  DISPONIVEL:    'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  NEGOCIACAO:    'bg-amber-50 text-amber-700 hover:bg-amber-100',
  AGIO:          'bg-teal-50 text-teal-700 hover:bg-teal-100',
  PARADO:        'bg-rose-50 text-rose-700 hover:bg-rose-100',
  EM_CONSTRUCAO: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  VENDIDO:       'bg-[var(--brand-tint)] text-[var(--brand-bright)] hover:bg-[var(--brand-tint)]/70',
  ALUGADA:       'bg-purple-50 text-purple-700 hover:bg-purple-100',
  FINALIZADO:    'bg-violet-50 text-violet-700 hover:bg-violet-100',
}
const CORRESPONDENTES = ['NOVA', 'MICHELLE', 'VICTORIA', 'OUTRA']

// Cores das etiquetas de correspondente (espelha o Monday)
function correspondenteTone(v: string | null): string {
  switch ((v ?? '').toUpperCase()) {
    case 'NOVA':     return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    case 'MICHELLE': return 'bg-amber-50 text-amber-700 hover:bg-amber-100'
    case 'VICTORIA': return 'bg-rose-50 text-rose-700 hover:bg-rose-100'
    case 'OUTRA':    return 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    default:         return 'bg-[var(--paper)] text-[var(--ink-soft)] hover:bg-[var(--line)]/40'
  }
}

function formatBRL(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function parseBR(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

interface Props {
  imovel: Imovel
  variant: CarteiraTipo
  onEditarTudo: (im: Imovel) => void
  /** Atualiza o item na lista após salvar inline (otimista já aplicado). */
  onPatched: (id: string, patch: Partial<Imovel>) => void
  /** Chamado após persistir — usado pra reconciliar contagem/aba quando o status muda. */
  onSaved?: (patch: Partial<Imovel>) => void
}

export function ImovelCard({ imovel, variant, onEditarTudo, onPatched, onSaved }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [erro, setErro] = useState(false)
  const [anexosOpen, setAnexosOpen] = useState(false)
  const [resumoAnexos, setResumoAnexos] = useState<{ id: string; file_type: ImovelAnexoTipo }[]>(imovel.anexos ?? [])

  useEffect(() => { setResumoAnexos(imovel.anexos ?? []) }, [imovel.anexos])

  async function salvar(patch: Partial<ImovelInput> & Partial<Imovel>, campo: string) {
    setSaving(campo); setErro(false)
    onPatched(imovel.id, patch as Partial<Imovel>)   // otimista
    try {
      await updateImovel(imovel.id, patch)
      onSaved?.(patch as Partial<Imovel>)
    } catch {
      setErro(true)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 transition-shadow hover:shadow-sm">
      {/* Topo: identificação + editar tudo */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* STATUS inline */}
            <StatusPicker
              value={imovel.status}
              variant={variant}
              saving={saving === 'status'}
              onChange={(s) => salvar({ status: s }, 'status')}
            />
            <span className="truncate font-display text-sm font-bold text-[var(--ink)]">{imovel.identificacao}</span>
            {imovel.idr_matricula && (
              <span className="font-display text-xs font-bold tabular-nums text-[var(--ink-faint)]">· {imovel.idr_matricula}</span>
            )}
            {erro && <span className="text-[10px] font-semibold text-rose-600">erro ao salvar</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {variant === 'USADO' && (
            <InlineMoney
              value={imovel.avaliacao != null ? Number(imovel.avaliacao) : null}
              saving={saving === 'avaliacao'}
              onSave={(n) => salvar({ avaliacao: n }, 'avaliacao')}
            />
          )}
          {variant === 'NOVO' && (
            <span className="font-display text-sm font-bold tabular-nums text-[var(--ink)]">
              {formatBRL(imovel.avaliacao != null ? Number(imovel.avaliacao) : null)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onEditarTudo(imovel)}
            aria-label="Editar tudo"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Linha de campos voláteis */}
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* CLIENTES (Novos) */}
        {variant === 'NOVO' && (
          <InlineField
            label="Clientes"
            value={imovel.clientes}
            placeholder="CLI Fulano / Vendedor"
            saving={saving === 'clientes'}
            onSave={(v) => salvar({ clientes: v }, 'clientes')}
          />
        )}

        {/* ANDAMENTO (ambos) */}
        <InlineField
          label="Andamento"
          value={imovel.andamento}
          placeholder="Garantia OK, Montagem…"
          saving={saving === 'andamento'}
          onSave={(v) => salvar({ andamento: v }, 'andamento')}
        />

        {/* CORRESPONDENTE (ambos) — badge colorido */}
        <div>
          <FieldLabel>Correspondente</FieldLabel>
          <div className="mt-0.5">
            <ChoicePicker
              value={imovel.correspondente}
              options={CORRESPONDENTES}
              placeholder="—"
              saving={saving === 'correspondente'}
              toneFor={correspondenteTone}
              onChange={(v) => salvar({ correspondente: v }, 'correspondente')}
            />
          </div>
        </div>

        {/* CHAVE (Usados) */}
        {variant === 'USADO' && (
          <InlineField
            label="Chave com"
            icon={KeyRound}
            value={imovel.chave_com}
            placeholder="No quadro, c/ vizinho…"
            saving={saving === 'chave_com'}
            onSave={(v) => salvar({ chave_com: v }, 'chave_com')}
          />
        )}

        {/* VENCIMENTO LAUDO — texto livre (data, "VENCIDO", etc.) */}
        {variant === 'USADO' ? (
          <InlineField
            label="Vencimento laudo"
            icon={FileText}
            value={imovel.vencimento_laudo}
            placeholder="dd/mm/aaaa ou VENCIDO"
            saving={saving === 'vencimento_laudo'}
            onSave={(v) => salvar({ vencimento_laudo: v }, 'vencimento_laudo')}
          />
        ) : imovel.vencimento_laudo ? (
          <div>
            <FieldLabel>Vencimento laudo</FieldLabel>
            <p className="inline-flex items-center gap-1 px-2 py-1 text-sm text-[var(--ink)]">
              <FileText className="h-3 w-3 text-[var(--ink-faint)]" /> {imovel.vencimento_laudo}
            </p>
          </div>
        ) : null}

        {/* LOCAL (Usados) */}
        {variant === 'USADO' && (
          <InlineField
            label="Local"
            icon={MapPin}
            value={imovel.local}
            placeholder="Link do mapa ou referência"
            saving={saving === 'local'}
            onSave={(v) => salvar({ local: v }, 'local')}
          />
        )}

        {/* FOTOS E ARQUIVOS — acesso rápido (abre modal de anexos) */}
        <div>
          <FieldLabel>Fotos e arquivos</FieldLabel>
          {(() => {
            const f = resumoAnexos.filter(a => a.file_type === 'FOTO').length
            const d = resumoAnexos.length - f
            return (
              <button
                type="button"
                onClick={() => setAnexosOpen(true)}
                className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-[var(--paper)]"
              >
                {resumoAnexos.length === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink-faint)]">
                    <Images className="h-3.5 w-3.5" /> Adicionar
                  </span>
                ) : (
                  <>
                    <span className={cn('inline-flex items-center gap-1 font-semibold', f ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]')}>
                      <ImageIcon className="h-3.5 w-3.5" /> {f}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 font-semibold', d ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]')}>
                      <FileText className="h-3.5 w-3.5" /> {d}
                    </span>
                  </>
                )}
              </button>
            )
          })()}
        </div>
      </div>

      {/* Modal de fotos e arquivos (acesso rápido pelo card) */}
      <Dialog open={anexosOpen} onOpenChange={setAnexosOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Fotos e arquivos
              <span className="ml-2 text-sm font-normal text-[var(--ink-soft)]">{imovel.identificacao}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <ImovelAnexos imovelId={imovel.id} onChanged={setResumoAnexos} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-faint)]">{children}</p>
}

function SavingDot({ saving }: { saving: boolean }) {
  if (!saving) return null
  return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--ink-faint)]" />
}

/** Texto editável inline: clica → input → salva no blur/Enter. */
function InlineField({
  label, value, placeholder, saving, onSave, icon: Icon,
}: {
  label: string
  value: string | null
  placeholder?: string
  saving: boolean
  onSave: (v: string) => void
  icon?: React.ElementType
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  function commit() {
    setEditing(false)
    const v = draft.trim()
    if (v !== (value ?? '')) onSave(v)
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <FieldLabel>{label}</FieldLabel>
        <SavingDot saving={saving} />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          placeholder={placeholder}
          className="mt-0.5 h-8 w-full rounded-lg border border-[var(--brand-bright)]/40 bg-white px-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/30"
        />
      ) : value && /^https?:\/\//.test(value) ? (
        // Valor é um link → abre em nova aba; lápis separado pra editar
        <div className="group/inline mt-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-sm">
          {Icon && <Icon className="h-3 w-3 shrink-0 text-[var(--ink-faint)]" />}
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 flex-1 items-center gap-1 truncate font-medium text-[var(--brand-bright)] hover:underline"
          >
            Abrir <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Editar"
            className="shrink-0 cursor-pointer rounded p-0.5 text-[var(--ink-faint)] opacity-0 transition-opacity hover:text-[var(--ink)] group-hover/inline:opacity-60"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group/inline mt-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-[var(--paper)]"
        >
          {Icon && <Icon className="h-3 w-3 shrink-0 text-[var(--ink-faint)]" />}
          <span className={cn('min-w-0 flex-1 truncate', value ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]')}>
            {value || placeholder || '—'}
          </span>
          <Pencil className="h-3 w-3 shrink-0 text-[var(--ink-faint)] opacity-0 transition-opacity group-hover/inline:opacity-50" />
        </button>
      )}
    </div>
  )
}

function StatusPicker({ value, variant, saving, onChange }: { value: ImovelStatus; variant: CarteiraTipo; saving: boolean; onChange: (s: ImovelStatus) => void }) {
  // Lista os status do tipo; inclui o valor atual caso seja de outro conjunto (ex.: finalizado num usado)
  const lista = STATUS_POR_TIPO[variant].includes(value)
    ? STATUS_POR_TIPO[variant]
    : [...STATUS_POR_TIPO[variant], value]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
          STATUS_TONE[value],
        )}
      >
        {IMOVEL_STATUS_LABEL[value]}
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {lista.map(s => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)} className="cursor-pointer gap-2">
            {s === value && <Check className="h-3.5 w-3.5" />}
            <span className={s === value ? 'font-semibold' : ''}>{IMOVEL_STATUS_LABEL[s]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChoicePicker({
  value, options, placeholder, saving, onChange, toneFor,
}: {
  value: string | null
  options: string[]
  placeholder?: string
  saving: boolean
  onChange: (v: string) => void
  /** Quando passado, renderiza o valor como badge colorido (ex.: correspondente). */
  toneFor?: (v: string | null) => string
}) {
  // Com cor: badge (estilo status). Sem cor: texto simples (fallback).
  if (toneFor) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40',
            value ? toneFor(value) : 'bg-[var(--paper)] text-[var(--ink-faint)] hover:bg-[var(--line)]/40',
          )}
        >
          {value || placeholder || '—'}
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-36">
          {options.map(o => (
            <DropdownMenuItem key={o} onClick={() => onChange(o)} className="cursor-pointer gap-2">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-full', toneFor(o).split(' ')[0])} />
              <span className={o === value ? 'font-semibold' : ''}>{o}</span>
              {o === value && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="mt-0.5 inline-flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded-lg px-2 text-sm transition-colors hover:bg-[var(--paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/30">
        <span className={value ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}>{value || placeholder || '—'}</span>
        {saving ? <Loader2 className="h-3 w-3 animate-spin text-[var(--ink-faint)]" /> : <ChevronDown className="h-3 w-3 text-[var(--ink-faint)]" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-32">
        {options.map(o => (
          <DropdownMenuItem key={o} onClick={() => onChange(o)} className="cursor-pointer gap-2">
            {o === value && <Check className="h-3.5 w-3.5" />}
            <span className={o === value ? 'font-semibold' : ''}>{o}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InlineMoney({ value, saving, onSave }: { value: number | null; saving: boolean; onSave: (n: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    const n = parseBR(draft)
    if (n !== value) onSave(n)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        inputMode="decimal"
        defaultValue={value != null ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        placeholder="0,00"
        className="h-8 w-28 rounded-lg border border-[var(--brand-bright)]/40 bg-white px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/30"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(''); setEditing(true) }}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-display text-sm font-bold tabular-nums text-[var(--ink)] transition-colors hover:bg-[var(--paper)]"
    >
      {saving && <Loader2 className="h-3 w-3 animate-spin text-[var(--ink-faint)]" />}
      {formatBRL(value)}
    </button>
  )
}

