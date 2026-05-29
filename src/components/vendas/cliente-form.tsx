'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Loader2, User, Home, ClipboardList, FileText,
} from 'lucide-react'
import type { Cliente, Vendedor } from '@/types/vendas'
import { REPROVACAO_MOTIVOS, CONDICIONADO_MOTIVOS, AVALIACAO_LABELS } from '@/types/vendas'
import { createCliente, updateCliente, getCidades } from '@/app/actions/vendas-actions'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface ClienteFormProps {
  open: boolean
  onClose: () => void
  vendedores: Vendedor[]
  initialData?: Cliente | null
  defaultVendedorId?: string
}

const STATUS_NOVO_OPTIONS = Object.entries(AVALIACAO_LABELS).map(([value, label]) => ({ value, label }))

// Monta o estado do form a partir do cliente em edição (ou vazio pra criação).
// Extraído porque precisa rodar tanto na montagem quanto toda vez que o modal
// reabre com outro cliente — senão o form abre em branco ao editar.
function toFormState(initialData?: Cliente | null, defaultVendedorId?: string) {
  return {
    nome: initialData?.nome ?? '',
    telefone_whatsapp: initialData?.telefone_whatsapp ?? '',
    cpf: initialData?.cpf ?? '',
    cidade: initialData?.cidade ?? '',
    vendedor_id: initialData?.vendedor_id ?? defaultVendedorId ?? '',
    tipo_imovel: initialData?.tipo_imovel ?? 'AMBOS',
    tipo_cliente: initialData?.tipo_cliente ?? 'NOVO',
    tipo_renda: initialData?.tipo_renda ?? '',
    status_novo: initialData?.status_novo ?? 'NAO_AVALIADO',
    status_usado: initialData?.status_usado ?? 'NAO_AVALIADO',
    motivo_reprovacao: initialData?.motivo_reprovacao ?? '',
    motivo_reprovacao_usado: initialData?.motivo_reprovacao_usado ?? '',
    observacoes: initialData?.observacoes ?? '',
    valor_venda: initialData?.valor_venda ? String(initialData.valor_venda) : '',
    valor_simulacao_novo: initialData?.valor_simulacao_novo ? String(initialData.valor_simulacao_novo) : '',
    valor_simulacao_usado: initialData?.valor_simulacao_usado ? String(initialData.valor_simulacao_usado) : '',
    data_venda: initialData?.data_venda ? initialData.data_venda.split('T')[0] : '',
    data_avaliacao: initialData?.data_avaliacao
      ? initialData.data_avaliacao.split('T')[0]
      : new Date().toISOString().split('T')[0],
  }
}

// ─── Componentes internos ────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-bright)]">
        {label}
      </h3>
    </div>
  )
}

interface SegmentedOption { value: string; label: string }
function Segmented({ options, value, onChange }: {
  options: SegmentedOption[]
  value: string
  onChange: (v: string) => void
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
              'flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition-all',
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

function StatusGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-2 sm:grid-cols-3">
      {STATUS_NOVO_OPTIONS.map(o => {
        const isActive = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold transition-all',
              isActive
                ? 'bg-[var(--brand-tint)] text-[var(--brand-bright)] ring-1 ring-inset ring-[var(--brand-bright)]/40 shadow-sm'
                : 'text-[var(--ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Select de motivo (reprovação ou condicionamento), exibido só quando status pede. */
function MotivoSelect({
  status, value, onChange,
}: {
  status: string
  value: string
  onChange: (v: string) => void
}) {
  const isReprov = status === 'REPROVADO'
  const isCondic = status === 'CONDICIONADO'
  if (!isReprov && !isCondic) return null
  const opcoes = isReprov ? REPROVACAO_MOTIVOS : CONDICIONADO_MOTIVOS
  const label = isReprov ? 'Motivo da Reprovação' : 'Motivo do Condicionamento'

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        {label}
      </Label>
      <Select key={status} value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger className="h-10 w-full rounded-xl">
          <SelectValue placeholder="Selecione um motivo…">
            {(v: string | null) => v ?? 'Selecione um motivo…'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opcoes.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ClienteForm({ open, onClose, vendedores, initialData, defaultVendedorId }: ClienteFormProps) {
  const isEdit = !!initialData
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cidades, setCidades] = useState<string[]>([])

  const [form, setForm] = useState(() => toFormState(initialData, defaultVendedorId))

  // Re-popula o form sempre que o modal abre (com o cliente atual, ou vazio pra criação).
  // Sem isso, o useState inicial só vale na 1ª montagem e o form abre em branco ao editar.
  useEffect(() => {
    if (open) setForm(toFormState(initialData, defaultVendedorId))
  }, [open, initialData, defaultVendedorId])

  // Carrega cidades existentes só quando o modal abre.
  useEffect(() => {
    if (!open) return
    getCidades().then(setCidades).catch(err => console.error(err))
  }, [open])

  function set(key: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Coerência: motivo só faz sentido quando status é REPROVADO ou CONDICIONADO.
      // Ao mudar status pra outro valor, limpa o motivo correspondente.
      if (key === 'status_novo' && value !== 'REPROVADO' && value !== 'CONDICIONADO') {
        next.motivo_reprovacao = ''
      }
      if (key === 'status_usado' && value !== 'REPROVADO' && value !== 'CONDICIONADO') {
        next.motivo_reprovacao_usado = ''
      }
      return next
    })
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
      // Deriva tipo_venda a partir de qual status virou VENDA_FECHADA.
      const novoFechada = form.status_novo === 'VENDA_FECHADA'
      const usadoFechada = form.status_usado === 'VENDA_FECHADA'
      const tipoVendaDerivado: Cliente['tipo_venda'] | null =
        novoFechada && usadoFechada ? 'AMBOS'
        : novoFechada ? 'NOVO'
        : usadoFechada ? 'USADO'
        : null

      const payload = {
        ...form,
        tipo_imovel: form.tipo_imovel as Cliente['tipo_imovel'],
        tipo_venda: tipoVendaDerivado,
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
        data_avaliacao: form.data_avaliacao
          ? new Date(form.data_avaliacao + 'T12:00:00').toISOString()
          : new Date().toISOString(),
        // CRM status: novos clientes começam em NOVO_LEAD; editar não sobrescreve a etapa atual.
        // status (CRM) e status_novo/status_usado (avaliação) são domínios SEPARADOS.
        ...(isEdit ? {} : { status: 'NOVO_LEAD' }),
      }

      if (isEdit && initialData) {
        await updateCliente(initialData.id, payload)
      } else {
        await createCliente(payload)
      }
      toast.success(isEdit ? 'Cliente atualizado' : 'Cliente criado')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  const isVendaFechadaNovo = form.status_novo === 'VENDA_FECHADA'
  const isVendaFechadaUsado = form.status_usado === 'VENDA_FECHADA'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] !max-w-3xl overflow-y-auto rounded-3xl sm:!max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]">
              <User className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
                {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
              <p className="text-sm text-[var(--ink-soft)]">
                {isEdit ? 'Atualize os dados do cliente.' : 'Preencha os dados para realizar o pré-cadastro.'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Informações Pessoais ───────────────────────── */}
          <section className="space-y-4">
            <SectionHeader icon={User} label="Informações Pessoais" />

            <div className="space-y-1.5">
              <Label>Nome Completo *</Label>
              <Input
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                placeholder="Ex: João da Silva"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>WhatsApp *</Label>
                <Input
                  value={form.telefone_whatsapp}
                  onChange={e => set('telefone_whatsapp', e.target.value)}
                  placeholder="(61) 99999-9999"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={e => set('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Select value={form.cidade} onValueChange={v => set('cidade', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma cidade…">
                      {(v: string | null) => v ? v : 'Selecione uma cidade…'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não informada</SelectItem>
                    {cidades.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vendedor *</Label>
                <Select value={form.vendedor_id} onValueChange={v => set('vendedor_id', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar">
                      {(v: string | null) => v ? (vendedores.find(x => x.id === v)?.nome ?? v) : 'Sem vendedor'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem vendedor</SelectItem>
                    {vendedores.filter(v => v.ativo).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Perfil do Cliente ───────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader icon={Home} label="Perfil" />

            <div className="space-y-1.5">
              <Label>Perfil do Cliente *</Label>
              <Segmented
                options={[
                  { value: 'NOVO', label: 'Cliente Novo (Lead)' },
                  { value: 'ANTIGO', label: 'Cliente Antigo (Retorno)' },
                ]}
                value={form.tipo_cliente}
                onChange={v => set('tipo_cliente', v)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Renda *</Label>
              <Segmented
                options={[
                  { value: 'FORMAL', label: 'Formal' },
                  { value: 'INFORMAL', label: 'Informal' },
                  { value: 'AMBOS', label: 'Ambos' },
                ]}
                value={form.tipo_renda || 'FORMAL'}
                onChange={v => set('tipo_renda', v)}
              />
            </div>
          </section>

          {/* ── Avaliação de Imóveis ────────────────────────── */}
          <section className="space-y-5">
            <SectionHeader icon={ClipboardList} label="Avaliação de Imóveis" />

            {/* IMÓVEL NOVO */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Imóvel Novo
              </Label>
              <StatusGrid value={form.status_novo} onChange={v => set('status_novo', v)} />

              <MotivoSelect
                status={form.status_novo}
                value={form.motivo_reprovacao}
                onChange={v => set('motivo_reprovacao', v)}
              />

              {/* Aprovado: simulação | Venda Fechada: valor + data (não os dois) */}
              {form.status_novo === 'APROVADO' && (
                <div className="rounded-xl border border-[var(--brand-bright)]/15 bg-[var(--brand-tint)]/30 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Simulação Novo (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.valor_simulacao_novo}
                      onChange={e => set('valor_simulacao_novo', e.target.value)}
                      placeholder="0,00"
                      className="h-9"
                    />
                  </div>
                </div>
              )}
              {isVendaFechadaNovo && (
                <div className="grid gap-3 rounded-xl border border-[var(--brand-bright)]/15 bg-[var(--brand-tint)]/30 p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor da Venda (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.valor_venda}
                      onChange={e => set('valor_venda', e.target.value)}
                      placeholder="0,00"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data da Venda</Label>
                    <Input
                      type="date"
                      value={form.data_venda}
                      onChange={e => set('data_venda', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* IMÓVEL USADO */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Imóvel Usado
              </Label>
              <StatusGrid value={form.status_usado} onChange={v => set('status_usado', v)} />

              <MotivoSelect
                status={form.status_usado}
                value={form.motivo_reprovacao_usado}
                onChange={v => set('motivo_reprovacao_usado', v)}
              />

              {form.status_usado === 'APROVADO' && (
                <div className="rounded-xl border border-[var(--brand-bright)]/15 bg-[var(--brand-tint)]/30 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Simulação Usado (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.valor_simulacao_usado}
                      onChange={e => set('valor_simulacao_usado', e.target.value)}
                      placeholder="0,00"
                      className="h-9"
                    />
                  </div>
                </div>
              )}
              {isVendaFechadaUsado && (
                <div className="grid gap-3 rounded-xl border border-[var(--brand-bright)]/15 bg-[var(--brand-tint)]/30 p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor da Venda (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.valor_venda}
                      onChange={e => set('valor_venda', e.target.value)}
                      placeholder="0,00"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data da Venda</Label>
                    <Input
                      type="date"
                      value={form.data_venda}
                      onChange={e => set('data_venda', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </div>

          </section>

          {/* ── Detalhes Adicionais ─────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader icon={FileText} label="Detalhes Adicionais" />

            <div className="space-y-1.5">
              <Label>Data de Cadastro/Avaliação *</Label>
              <Input
                type="date"
                value={form.data_avaliacao}
                onChange={e => set('data_avaliacao', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <textarea
                value={form.observacoes}
                onChange={e => set('observacoes', e.target.value)}
                rows={3}
                placeholder="Anotações sobre o cliente…"
                className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-bright)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-bright)]/12"
              />
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
