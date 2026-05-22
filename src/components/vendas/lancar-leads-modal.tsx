'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Send, History, Trash2, Calendar, Hash, Users } from 'lucide-react'
import type { Vendedor, LeadDistribuicao } from '@/types/vendas'
import {
  getLeadDistribuicao, upsertLeadDistribuicao, deleteLeadDistribuicao, getVendedores,
} from '@/app/actions/vendas-actions'
import { formatDate, cn } from '@/lib/utils'

interface LancarLeadsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function LancarLeadsModal({ open, onClose, onSaved }: LancarLeadsModalProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [recentes, setRecentes] = useState<LeadDistribuicao[]>([])

  const [vendedorId, setVendedorId] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [quantidade, setQuantidade] = useState('')

  const [saving, setSaving] = useState(false)
  const [loadingRecentes, setLoadingRecentes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadRecentes() {
    setLoadingRecentes(true)
    try {
      const list = await getLeadDistribuicao()
      setRecentes(list.slice(0, 20))
    } finally {
      setLoadingRecentes(false)
    }
  }

  useEffect(() => {
    if (!open) {
      setVendedorId(''); setData(new Date().toISOString().split('T')[0]); setQuantidade('')
      setError(null); setRecentes([])
      return
    }
    Promise.all([getVendedores(true), loadRecentes()]).then(([vs]) => setVendedores(vs))
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vendedorId) { setError('Selecione um vendedor.'); return }
    const qty = parseInt(quantidade, 10)
    if (!qty || qty <= 0) { setError('Informe uma quantidade válida.'); return }
    if (!data) { setError('Informe a data.'); return }
    setError(null); setSaving(true)
    try {
      await upsertLeadDistribuicao(vendedorId, qty, data)
      setQuantidade('')
      await loadRecentes()
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lançamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    try {
      await deleteLeadDistribuicao(id)
      await loadRecentes()
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] !max-w-2xl overflow-y-auto rounded-3xl sm:!max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
              <Send className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
                Lançar Leads Diários
              </DialogTitle>
              <p className="text-sm text-[var(--ink-soft)]">
                Registre quantos leads cada vendedor recebeu hoje.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[var(--ink-faint)]" /> Vendedor *
            </Label>
            <Select value={vendedorId} onValueChange={v => setVendedorId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um vendedor…">
                  {(v: string | null) => v ? (vendedores.find(x => x.id === v)?.nome ?? v) : 'Selecione um vendedor…'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[var(--ink-faint)]" /> Data *
              </Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="inline-flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-[var(--ink-faint)]" /> Quantidade *
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="Ex: 10"
                min={1}
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={saving || !vendedorId}
            className="w-full cursor-pointer rounded-xl bg-[var(--brand)] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-hover)]"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Salvar Leads
          </Button>
        </form>

        {/* Lançamentos recentes */}
        <div className="border-t border-[var(--line)] pt-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-bright)]">
              <History className="h-3.5 w-3.5" strokeWidth={2.2} />
            </div>
            <h3 className="font-display text-sm font-bold tracking-tight text-[var(--ink)]">
              Lançamentos Recentes
            </h3>
          </div>

          {loadingRecentes ? (
            <p className="py-4 text-center text-sm text-[var(--ink-faint)]">Carregando…</p>
          ) : recentes.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--ink-faint)]">Nenhum lançamento ainda.</p>
          ) : (
            <div className="space-y-2">
              {recentes.map(r => (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center justify-between rounded-xl bg-[var(--paper)] p-3 ring-1 ring-inset ring-[var(--line)]/60',
                    'transition-all duration-200 hover:bg-[var(--surface)] hover:shadow-sm hover:ring-[var(--brand-bright)]/20'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {r.vendedor?.nome ?? '—'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--ink-faint)]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(r.data)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-[var(--brand-bright)]">
                        <Hash className="h-3 w-3" />
                        {r.quantidade} {r.quantidade === 1 ? 'lead' : 'leads'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    aria-label="Excluir lançamento"
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
