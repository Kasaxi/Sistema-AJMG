'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import type { Cliente, Vendedor } from '@/types/vendas'
import { REPROVACAO_MOTIVOS, CONDICIONADO_MOTIVOS } from '@/types/vendas'
import { createCliente, updateCliente } from '@/app/actions/vendas-actions'

interface ClienteFormProps {
  open: boolean
  onClose: () => void
  vendedores: Vendedor[]
  initialData?: Cliente | null
  defaultVendedorId?: string
}

const STATUS_NOVO_OPTIONS = [
  { value: 'NAO_AVALIADO', label: 'Não Avaliado' },
  { value: 'APROVADO', label: 'Aprovado' },
  { value: 'REPROVADO', label: 'Reprovado' },
  { value: 'CONDICIONADO', label: 'Condicionado' },
  { value: 'QV_LIBERACAO_REAVALIAR', label: 'QV/Lib. Reavaliar' },
  { value: 'PRECISA_CARTA_CANCELAMENTO', label: 'Carta Cancelamento' },
  { value: 'VENDA_FECHADA', label: 'Venda Fechada' },
]

export function ClienteForm({ open, onClose, vendedores, initialData, defaultVendedorId }: ClienteFormProps) {
  const isEdit = !!initialData
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: initialData?.nome ?? '',
    telefone_whatsapp: initialData?.telefone_whatsapp ?? '',
    cpf: initialData?.cpf ?? '',
    cidade: initialData?.cidade ?? '',
    vendedor_id: initialData?.vendedor_id ?? defaultVendedorId ?? '',
    tipo_imovel: initialData?.tipo_imovel ?? 'NOVO',
    tipo_cliente: initialData?.tipo_cliente ?? 'NOVO',
    tipo_renda: initialData?.tipo_renda ?? '',
    status_novo: initialData?.status_novo ?? 'NAO_AVALIADO',
    status_usado: initialData?.status_usado ?? '',
    motivo_reprovacao: initialData?.motivo_reprovacao ?? '',
    motivo_reprovacao_usado: initialData?.motivo_reprovacao_usado ?? '',
    observacoes: initialData?.observacoes ?? '',
    valor_venda: initialData?.valor_venda ? String(initialData.valor_venda) : '',
    valor_simulacao_novo: initialData?.valor_simulacao_novo ? String(initialData.valor_simulacao_novo) : '',
    valor_simulacao_usado: initialData?.valor_simulacao_usado ? String(initialData.valor_simulacao_usado) : '',
    data_venda: initialData?.data_venda ? initialData.data_venda.split('T')[0] : '',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !form.telefone_whatsapp.trim()) {
      setError('Nome e WhatsApp são obrigatórios.')
      return
    }
    setError(null)
    setLoading(true)

    try {
      const payload = {
        ...form,
        tipo_imovel: form.tipo_imovel as Cliente['tipo_imovel'],
        tipo_cliente: form.tipo_cliente as Cliente['tipo_cliente'],
        tipo_renda: (form.tipo_renda || null) as Cliente['tipo_renda'],
        vendedor_id: form.vendedor_id || null,
        cpf: form.cpf || null,
        cidade: form.cidade || null,
        motivo_reprovacao: form.motivo_reprovacao || null,
        motivo_reprovacao_usado: form.motivo_reprovacao_usado || null,
        observacoes: form.observacoes || null,
        valor_venda: form.valor_venda ? parseFloat(form.valor_venda) : null,
        valor_simulacao_novo: form.valor_simulacao_novo ? parseFloat(form.valor_simulacao_novo) : null,
        valor_simulacao_usado: form.valor_simulacao_usado ? parseFloat(form.valor_simulacao_usado) : null,
        data_venda: form.data_venda ? new Date(form.data_venda).toISOString() : null,
        status: form.status_novo ?? 'NOVO_LEAD',
      }

      if (isEdit && initialData) {
        await updateCliente(initialData.id, payload)
      } else {
        await createCliente(payload)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  const showMotivoReprovacao = form.status_novo === 'REPROVADO'
  const showMotivoCondicionado = form.status_novo === 'CONDICIONADO'
  const showVendaFields = form.status_novo === 'VENDA_FECHADA'
  const showUsado = form.tipo_imovel === 'USADO' || form.tipo_imovel === 'AMBOS'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dados básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" required />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp *</Label>
              <Input value={form.telefone_whatsapp} onChange={e => set('telefone_whatsapp', e.target.value)} placeholder="(11) 99999-9999" required />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={e => set('cidade', e.target.value)} placeholder="Cidade" />
            </div>
          </div>

          {/* Relacionamentos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Select value={form.vendedor_id} onValueChange={v => set('vendedor_id', v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem vendedor</SelectItem>
                  {vendedores.filter(v => v.ativo).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Imóvel</Label>
              <Select value={form.tipo_imovel} onValueChange={v => set('tipo_imovel', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOVO">Novo</SelectItem>
                  <SelectItem value="USADO">Usado</SelectItem>
                  <SelectItem value="AMBOS">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Renda</Label>
              <Select value={form.tipo_renda} onValueChange={v => set('tipo_renda', v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Não informado</SelectItem>
                  <SelectItem value="FORMAL">Formal</SelectItem>
                  <SelectItem value="INFORMAL">Informal</SelectItem>
                  <SelectItem value="AMBOS">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status Imóvel Novo</Label>
              <Select value={form.status_novo} onValueChange={v => set('status_novo', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_NOVO_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showUsado && (
              <div className="space-y-1.5">
                <Label>Status Imóvel Usado</Label>
                <Select value={form.status_usado} onValueChange={v => set('status_usado', v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_NOVO_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Motivos condicionais */}
          {showMotivoReprovacao && (
            <div className="space-y-1.5">
              <Label>Motivo da Reprovação</Label>
              <Select value={form.motivo_reprovacao} onValueChange={v => set('motivo_reprovacao', v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                <SelectContent>
                  {REPROVACAO_MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {showMotivoCondicionado && (
            <div className="space-y-1.5">
              <Label>Motivo do Condicionamento</Label>
              <Select value={form.motivo_reprovacao} onValueChange={v => set('motivo_reprovacao', v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                <SelectContent>
                  {CONDICIONADO_MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Venda */}
          {showVendaFields && (
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[var(--brand-bright)]/15 bg-[var(--brand-tint)] p-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Valor da Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_venda}
                  onChange={e => set('valor_venda', e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data da Venda</Label>
                <Input
                  type="date"
                  value={form.data_venda}
                  onChange={e => set('data_venda', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo da Venda</Label>
                <Select value={form.tipo_imovel} onValueChange={v => set('tipo_imovel', v ?? '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOVO">Novo</SelectItem>
                    <SelectItem value="USADO">Usado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Simulações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Simulação Novo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_simulacao_novo}
                onChange={e => set('valor_simulacao_novo', e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Simulação Usado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_simulacao_usado}
                onChange={e => set('valor_simulacao_usado', e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={3}
              placeholder="Anotações sobre o cliente..."
              className="w-full resize-none rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-bright)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-bright)]/12"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="cursor-pointer rounded-xl border-[var(--line)]">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="cursor-pointer rounded-xl bg-[var(--brand)] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-hover)]">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : isEdit ? 'Salvar Alterações' : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
