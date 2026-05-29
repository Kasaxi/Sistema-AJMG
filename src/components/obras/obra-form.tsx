'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, MapPin, ClipboardList, CalendarDays, Wallet, Trash2 } from 'lucide-react'
import type { Obra, ObraInput, ObraStatus } from '@/types/obras'
import { OBRA_STATUS_LABELS } from '@/types/obras'
import { createObra, updateObra, deleteObra } from '@/app/actions/obras-actions'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface ObraFormProps {
  open: boolean
  onClose: () => void
  initialData?: Obra | null
  onSaved?: () => void
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      </div>
      <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-bright)]">
        {label}
      </h3>
    </div>
  )
}

function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1">
      {options.map(o => {
        const isActive = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 flex-1 cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:text-sm',
              isActive
                ? 'bg-[var(--brand-tint)] text-[var(--brand-bright)] shadow-sm ring-1 ring-inset ring-[var(--brand-bright)]/30'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ObraForm({ open, onClose, initialData, onSaved }: ObraFormProps) {
  const editing = !!initialData
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [status, setStatus] = useState<ObraStatus>('PLANEJAMENTO')
  const [dataInicio, setDataInicio] = useState('')
  const [dataPrevisao, setDataPrevisao] = useState('')
  const [orcamento, setOrcamento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (initialData) {
      setNome(initialData.nome)
      setEndereco(initialData.endereco ?? '')
      setCidade(initialData.cidade ?? '')
      setStatus(initialData.status)
      setDataInicio(initialData.data_inicio ?? '')
      setDataPrevisao(initialData.data_previsao_entrega ?? '')
      setOrcamento(initialData.orcamento_previsto != null ? String(initialData.orcamento_previsto) : '')
      setObservacoes(initialData.observacoes ?? '')
    } else {
      setNome('')
      setEndereco('')
      setCidade('')
      setStatus('PLANEJAMENTO')
      setDataInicio('')
      setDataPrevisao('')
      setOrcamento('')
      setObservacoes('')
    }
  }, [open, initialData])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) {
      setErro('Faltou o nome da obra')
      return
    }

    const orcamentoNum = orcamento.trim()
      ? Number(orcamento.replace(/\./g, '').replace(',', '.'))
      : null
    if (orcamentoNum != null && !Number.isFinite(orcamentoNum)) {
      setErro('Orçamento inválido')
      return
    }

    const payload: ObraInput = {
      nome: nome.trim(),
      endereco: endereco.trim() || null,
      cidade: cidade.trim() || null,
      status,
      data_inicio: dataInicio || null,
      data_previsao_entrega: dataPrevisao || null,
      orcamento_previsto: orcamentoNum,
      observacoes: observacoes.trim() || null,
    }

    startTransition(async () => {
      try {
        if (editing && initialData) {
          await updateObra(initialData.id, payload)
        } else {
          await createObra(payload)
        }
        onSaved?.()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao salvar')
      }
    })
  }

  async function handleDelete() {
    if (!initialData) return
    const ok = await confirm({
      title: 'Excluir obra',
      description: `Excluir a obra "${initialData.nome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      try {
        await deleteObra(initialData.id)
        onSaved?.()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao excluir')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? 'Editar obra' : 'Nova obra'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Identificação */}
          <section>
            <SectionHeader icon={ClipboardList} label="Identificação" />
            <div className="space-y-3">
              <div>
                <Label htmlFor="obra-nome" className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Nome *
                </Label>
                <Input
                  id="obra-nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: QD 151 Parque Alvorada"
                  className="mt-1.5 h-10 rounded-xl"
                  autoFocus
                  required
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Status</Label>
                <div className="mt-1.5">
                  <Segmented<ObraStatus>
                    options={[
                      { value: 'PLANEJAMENTO', label: 'Planejamento' },
                      { value: 'EM_ANDAMENTO', label: 'Em andamento' },
                      { value: 'PAUSADA',      label: 'Pausada' },
                      { value: 'CONCLUIDA',    label: 'Concluída' },
                    ]}
                    value={status}
                    onChange={setStatus}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Localização */}
          <section>
            <SectionHeader icon={MapPin} label="Localização" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Endereço</Label>
                <Input
                  value={endereco}
                  onChange={e => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Cidade</Label>
                <Input
                  value={cidade}
                  onChange={e => setCidade(e.target.value)}
                  placeholder="Ex: Luziânia"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
          </section>

          {/* Cronograma + orçamento */}
          <section>
            <SectionHeader icon={CalendarDays} label="Cronograma e orçamento" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Previsão de entrega</Label>
                <Input
                  type="date"
                  value={dataPrevisao}
                  onChange={e => setDataPrevisao(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <Wallet className="h-3 w-3" /> Orçamento previsto (R$)
                </Label>
                <Input
                  inputMode="decimal"
                  value={orcamento}
                  onChange={e => setOrcamento(e.target.value)}
                  placeholder="0,00"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <SectionHeader icon={ClipboardList} label="Observações" />
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Detalhes, particularidades, decisões…"
              rows={3}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/15"
            />
          </section>

          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {erro}
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:flex-row sm:justify-between">
            <div>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={pending}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
