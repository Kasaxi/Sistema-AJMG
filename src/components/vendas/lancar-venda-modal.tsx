'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Search, User } from 'lucide-react'
import type { Cliente } from '@/types/vendas'
import { getClientes, lancarVenda } from '@/app/actions/vendas-actions'
import { formatPhone } from '@/lib/utils'

interface LancarVendaModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  /** Se fornecido, abre em modo edição (cliente travado, campos pré-preenchidos). */
  vendaToEdit?: Cliente | null
}

const TIPO_VENDA_OPTIONS: Array<{ value: 'NOVO' | 'USADO' | 'AMBOS'; label: string }> = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'USADO', label: 'Usado' },
  { value: 'AMBOS', label: 'Ambos' },
]

export function LancarVendaModal({ open, onClose, onSaved, vendaToEdit }: LancarVendaModalProps) {
  const isEdit = !!vendaToEdit

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Cliente | null>(null)

  const [tipoVenda, setTipoVenda] = useState<'NOVO' | 'USADO' | 'AMBOS'>('NOVO')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset / hidratação quando o modal abre/fecha.
  useEffect(() => {
    if (!open) {
      setSearch(''); setResults([]); setSelected(null)
      setTipoVenda('NOVO'); setValor(''); setData(new Date().toISOString().split('T')[0])
      setError(null)
      return
    }
    // Modo edição: pré-preenche com os dados da venda existente.
    if (vendaToEdit) {
      setSelected(vendaToEdit)
      setTipoVenda((vendaToEdit.tipo_venda ?? 'NOVO') as 'NOVO' | 'USADO' | 'AMBOS')
      setValor(vendaToEdit.valor_venda != null ? String(vendaToEdit.valor_venda) : '')
      setData(vendaToEdit.data_venda ? vendaToEdit.data_venda.split('T')[0] : new Date().toISOString().split('T')[0])
    }
  }, [open, vendaToEdit])

  // Busca debounced — só dispara depois de 250ms de inatividade.
  useEffect(() => {
    if (!open || selected) { setResults([]); return }
    const q = search.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const res = await getClientes({ search: q, per_page: 8 })
        setResults(res.clientes)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [search, open, selected])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) { setError('Selecione um cliente.'); return }
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) { setError('Informe um valor válido.'); return }
    if (!data) { setError('Informe a data da venda.'); return }
    setError(null); setSaving(true)
    try {
      await lancarVenda({
        cliente_id: selected.id,
        tipo_venda: tipoVenda,
        valor_venda: valorNum,
        data_venda: data,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao lançar venda')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
            {isEdit ? 'Editar Venda' : 'Lançar Venda'}
          </DialogTitle>
          <p className="text-sm text-[var(--ink-soft)]">
            {isEdit
              ? 'Ajuste valor, data ou tipo desta venda.'
              : 'Busque o cliente e registre o valor da venda fechada.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Busca / seleção de cliente */}
          {!selected ? (
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou telefone…"
                  className="pl-10"
                  autoFocus
                />
              </div>
              {search.trim().length >= 2 && (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                  {searching && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--ink-faint)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
                    </div>
                  )}
                  {!searching && results.length === 0 && (
                    <div className="px-4 py-3 text-sm text-[var(--ink-faint)]">
                      Nenhum cliente encontrado.
                    </div>
                  )}
                  {!searching && results.map(c => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--paper)]"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--ink)]">{c.nome}</p>
                        <p className="text-xs text-[var(--ink-faint)]">
                          {formatPhone(c.telefone_whatsapp)}
                          {c.vendedor?.nome ? ` · ${c.vendedor.nome}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand)] text-white">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{selected.nome}</p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {formatPhone(selected.telefone_whatsapp)}
                    {selected.vendedor?.nome ? ` · ${selected.vendedor.nome}` : ''}
                  </p>
                </div>
              </div>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 hover:underline"
                >
                  Trocar
                </button>
              )}
            </div>
          )}

          {/* Dados da venda */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Venda *</Label>
              <Select value={tipoVenda} onValueChange={v => setTipoVenda((v ?? 'NOVO') as 'NOVO' | 'USADO' | 'AMBOS')}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) => TIPO_VENDA_OPTIONS.find(o => o.value === v)?.label ?? 'Novo'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIPO_VENDA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da Venda *</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Valor da Venda (R$) *</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !selected}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salvar Venda' : 'Lançar Venda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
