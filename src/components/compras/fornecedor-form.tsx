'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Building2, Phone, Mail, FileText, Trash2 } from 'lucide-react'
import type { Fornecedor, FornecedorInput } from '@/types/compras'
import { createFornecedor, updateFornecedor, deleteFornecedor } from '@/app/actions/compras-actions'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { FormError } from '@/components/ui/form-error'
import { cn } from '@/lib/utils'

interface FornecedorFormProps {
  open: boolean
  onClose: () => void
  initialData?: Fornecedor | null
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

export function FornecedorForm({ open, onClose, initialData, onSaved }: FornecedorFormProps) {
  const editing = !!initialData
  const confirm = useConfirm()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [ativo, setAtivo] = useState(true)

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (initialData) {
      setNome(initialData.nome)
      setTelefone(initialData.telefone ?? '')
      setEmail(initialData.email ?? '')
      setCnpjCpf(initialData.cnpj_cpf ?? '')
      setObservacoes(initialData.observacoes ?? '')
      setAtivo(initialData.ativo)
    } else {
      setNome('')
      setTelefone('')
      setEmail('')
      setCnpjCpf('')
      setObservacoes('')
      setAtivo(true)
    }
  }, [open, initialData])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) {
      setErro('Faltou o nome do fornecedor')
      return
    }

    const payload: FornecedorInput = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      cnpj_cpf: cnpjCpf.trim() || null,
      observacoes: observacoes.trim() || null,
      ativo,
    }

    startTransition(async () => {
      try {
        if (editing && initialData) {
          await updateFornecedor(initialData.id, payload)
        } else {
          await createFornecedor(payload)
        }
        toast.success(editing ? 'Fornecedor atualizado' : 'Fornecedor criado')
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
      title: 'Excluir fornecedor',
      description: `Excluir o fornecedor "${initialData.nome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      try {
        await deleteFornecedor(initialData.id)
        toast.success('Fornecedor excluído')
        onSaved?.()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao excluir')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? 'Editar fornecedor' : 'Novo fornecedor'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Identificação */}
          <section>
            <SectionHeader icon={Building2} label="Identificação" />
            <div className="space-y-3">
              <div>
                <Label htmlFor="f-nome" className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Nome *
                </Label>
                <Input
                  id="f-nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Multilit Materiais"
                  className="mt-1.5 h-10 rounded-xl"
                  autoFocus
                  required
                />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <FileText className="h-3 w-3" /> CNPJ ou CPF
                </Label>
                <Input
                  value={cnpjCpf}
                  onChange={e => setCnpjCpf(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
          </section>

          {/* Contato */}
          <section>
            <SectionHeader icon={Phone} label="Contato" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <Phone className="h-3 w-3" /> Telefone
                </Label>
                <Input
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(61) 99999-9999"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contato@fornecedor.com"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <SectionHeader icon={FileText} label="Observações" />
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Condições, contato preferido, histórico…"
              rows={3}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/15"
            />
          </section>

          {/* Status */}
          {editing && (
            <section>
              <label className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all',
                ativo
                  ? 'border-[var(--brand-bright)]/30 bg-[var(--brand-tint)]/40'
                  : 'border-[var(--line)] bg-[var(--paper)]'
              )}>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={e => setAtivo(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-[var(--line)]"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--ink)]">Fornecedor ativo</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {ativo
                      ? 'Aparece no select ao criar gastos'
                      : 'Não aparece em novos gastos, mas gastos passados continuam vinculados'}
                  </p>
                </div>
              </label>
            </section>
          )}

          <FormError message={erro} />

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
