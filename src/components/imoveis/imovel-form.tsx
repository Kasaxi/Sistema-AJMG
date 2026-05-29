'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Home, MapPin, FileText, Trash2, Images } from 'lucide-react'
import {
  createImovel, updateImovel, deleteImovel,
} from '@/app/actions/imoveis-actions'
import { ImovelAnexos } from './imovel-anexos'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import type { Imovel, ImovelCarteira, ImovelStatus, ImovelInput } from '@/types/imoveis'
import { IMOVEL_STATUS_LABEL, STATUS_POR_TIPO } from '@/types/imoveis'
import type { Vendedor } from '@/types/vendas'

const NONE = '__none__'

interface Props {
  open: boolean
  onClose: () => void
  initialData?: Imovel | null
  carteiras: ImovelCarteira[]
  vendedores: Vendedor[]
  carteiraPadrao?: string | null
  onSaved?: () => void
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      </div>
      <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-bright)]">{label}</h3>
    </div>
  )
}

const LABEL = 'text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]'

function parseBR(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function formatBR(n: number | null): string {
  if (n == null) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildState(initialData?: Imovel | null, carteiraPadrao?: string | null) {
  return {
    carteira_id: initialData?.carteira_id ?? carteiraPadrao ?? '',
    identificacao: initialData?.identificacao ?? '',
    empreendimento: initialData?.empreendimento ?? '',
    idr_matricula: initialData?.idr_matricula ?? '',
    status: (initialData?.status ?? 'DISPONIVEL') as ImovelStatus,
    andamento: initialData?.andamento ?? '',
    endereco: initialData?.endereco ?? '',
    cidade: initialData?.cidade ?? '',
    regiao: initialData?.regiao ?? '',
    correspondente: initialData?.correspondente ?? '',
    avaliacao: initialData?.avaliacao != null ? formatBR(Number(initialData.avaliacao)) : '',
    vencimento_laudo: initialData?.vencimento_laudo ?? '',
    chave_com: initialData?.chave_com ?? '',
    clientes: initialData?.clientes ?? '',
    local: initialData?.local ?? '',
    vendedor_id: initialData?.vendedor_id ?? NONE,
    observacoes: initialData?.observacoes ?? '',
  }
}

export function ImovelForm({ open, onClose, initialData, carteiras, vendedores, carteiraPadrao, onSaved }: Props) {
  const editing = !!initialData
  const confirm = useConfirm()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState(() => buildState(initialData, carteiraPadrao))

  useEffect(() => {
    if (open) { setForm(buildState(initialData, carteiraPadrao)); setErro(null) }
  }, [open, initialData, carteiraPadrao])

  function set<K extends keyof ReturnType<typeof buildState>>(key: K, value: ReturnType<typeof buildState>[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Status disponíveis conforme o tipo da carteira escolhida (Novos vs Usados)
  const tipoSel = carteiras.find(c => c.id === form.carteira_id)?.tipo ?? 'USADO'
  const statusOpcoes: ImovelStatus[] = STATUS_POR_TIPO[tipoSel].includes(form.status)
    ? STATUS_POR_TIPO[tipoSel]
    : [...STATUS_POR_TIPO[tipoSel], form.status]

  function salvar() {
    setErro(null)
    if (!form.identificacao.trim()) { setErro('Informe a identificação do imóvel.'); return }

    const payload: ImovelInput = {
      carteira_id: form.carteira_id || null,
      identificacao: form.identificacao.trim(),
      empreendimento: form.empreendimento.trim() || null,
      idr_matricula: form.idr_matricula.trim() || null,
      status: form.status,
      andamento: form.andamento.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      regiao: form.regiao.trim() || null,
      correspondente: form.correspondente.trim() || null,
      avaliacao: parseBR(form.avaliacao),
      vencimento_laudo: form.vencimento_laudo || null,
      chave_com: form.chave_com.trim() || null,
      clientes: form.clientes.trim() || null,
      local: form.local.trim() || null,
      vendedor_id: form.vendedor_id === NONE ? null : form.vendedor_id,
      observacoes: form.observacoes.trim() || null,
    }

    startTransition(async () => {
      try {
        if (editing && initialData) await updateImovel(initialData.id, payload)
        else await createImovel(payload)
        toast.success(editing ? 'Imóvel atualizado' : 'Imóvel criado')
        onSaved?.()
        onClose()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
      }
    })
  }

  async function excluir() {
    if (!initialData) return
    const ok = await confirm({
      title: 'Excluir imóvel',
      description: `Excluir o imóvel "${initialData.identificacao}"?`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      try {
        await deleteImovel(initialData.id)
        toast.success('Imóvel excluído')
        onSaved?.()
        onClose()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao excluir.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{editing ? 'Editar imóvel' : 'Novo imóvel'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Identificação */}
          <section>
            <SectionHeader icon={Home} label="Identificação" />
            <div className="space-y-3">
              <div>
                <Label className={LABEL}>Identificação *</Label>
                <Input value={form.identificacao} onChange={e => set('identificacao', e.target.value)} placeholder="Ex: APT 101 / Casa QD 77" className="mt-1.5 h-10 rounded-xl" autoFocus />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className={LABEL}>Empreendimento</Label>
                  <Input value={form.empreendimento} onChange={e => set('empreendimento', e.target.value)} placeholder="QD 77 LT 38 PQ Alvorada I" className="mt-1.5 h-10 rounded-xl" />
                </div>
                <div>
                  <Label className={LABEL}>IDR / Matrícula</Label>
                  <Input value={form.idr_matricula} onChange={e => set('idr_matricula', e.target.value)} placeholder="IDR159944" className="mt-1.5 h-10 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className={LABEL}>Carteira</Label>
                  <Select value={form.carteira_id} onValueChange={v => set('carteira_id', v ?? '')}>
                    <SelectTrigger className="mt-1.5 h-10 w-full rounded-xl">
                      <SelectValue placeholder="Sem carteira">
                        {(v: string | null) => carteiras.find(c => c.id === v)?.nome ?? 'Sem carteira'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem carteira</SelectItem>
                      {carteiras.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={LABEL}>Status</Label>
                  <Select value={form.status} onValueChange={v => set('status', (v ?? 'DISPONIVEL') as ImovelStatus)}>
                    <SelectTrigger className="mt-1.5 h-10 w-full rounded-xl">
                      <SelectValue>
                        {(v: string | null) => IMOVEL_STATUS_LABEL[(v as ImovelStatus) ?? 'DISPONIVEL']}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOpcoes.map(v => <SelectItem key={v} value={v}>{IMOVEL_STATUS_LABEL[v]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className={LABEL}>Andamento</Label>
                <Input value={form.andamento} onChange={e => set('andamento', e.target.value)} placeholder="Ex: Garantia OK / Montagem / Cliente X reserva" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div>
                <Label className={LABEL}>Clientes</Label>
                <Input value={form.clientes} onChange={e => set('clientes', e.target.value)} placeholder="Ex: CLI Jhonatan / Felipe" className="mt-1.5 h-10 rounded-xl" />
              </div>
            </div>
          </section>

          {/* Localização */}
          <section>
            <SectionHeader icon={MapPin} label="Localização" />
            <div className="space-y-3">
              <div>
                <Label className={LABEL}>Endereço</Label>
                <Input value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, bairro" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className={LABEL}>Cidade</Label>
                  <Input value={form.cidade} onChange={e => set('cidade', e.target.value)} className="mt-1.5 h-10 rounded-xl" />
                </div>
                <div>
                  <Label className={LABEL}>Região</Label>
                  <Input value={form.regiao} onChange={e => set('regiao', e.target.value)} placeholder="Ocidental, Valparaíso…" className="mt-1.5 h-10 rounded-xl" />
                </div>
              </div>
              <div>
                <Label className={LABEL}>Local (link do mapa)</Label>
                <Input value={form.local} onChange={e => set('local', e.target.value)} placeholder="https://maps… ou referência" className="mt-1.5 h-10 rounded-xl" />
              </div>
            </div>
          </section>

          {/* Comercial / laudo */}
          <section>
            <SectionHeader icon={FileText} label="Comercial e laudo" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className={LABEL}>Avaliação (R$)</Label>
                <Input inputMode="decimal" value={form.avaliacao} onChange={e => set('avaliacao', e.target.value)} placeholder="142.000,00" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div>
                <Label className={LABEL}>Vencimento do laudo</Label>
                <Input value={form.vencimento_laudo} onChange={e => set('vencimento_laudo', e.target.value)} placeholder="dd/mm/aaaa ou VENCIDO" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div>
                <Label className={LABEL}>Correspondente</Label>
                <Input value={form.correspondente} onChange={e => set('correspondente', e.target.value)} placeholder="NOVA, OUTRA…" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div>
                <Label className={LABEL}>Chave com</Label>
                <Input value={form.chave_com} onChange={e => set('chave_com', e.target.value)} placeholder="No quadro, c/ vizinho…" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div className="sm:col-span-2">
                <Label className={LABEL}>Vendedor responsável</Label>
                <Select value={form.vendedor_id} onValueChange={v => set('vendedor_id', v ?? NONE)}>
                  <SelectTrigger className="mt-1.5 h-10 w-full rounded-xl">
                    <SelectValue placeholder="Sem vendedor">
                      {(v: string | null) => (!v || v === NONE) ? 'Sem vendedor' : (vendedores.find(x => x.id === v)?.nome ?? 'Sem vendedor')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem vendedor</SelectItem>
                    {vendedores.filter(v => v.ativo).map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <Label className={LABEL}>Observações</Label>
            <textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={2}
              placeholder="Notas internas…"
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/15"
            />
          </section>

          {/* Fotos e documentos — só após o imóvel existir */}
          {editing && initialData ? (
            <section>
              <SectionHeader icon={Images} label="Fotos e documentos" />
              <ImovelAnexos imovelId={initialData.id} onChanged={onSaved} />
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)]/40 px-4 py-3 text-center text-xs text-[var(--ink-soft)]">
              Crie o imóvel primeiro pra anexar fotos e documentos.
            </p>
          )}

          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</div>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <div>
              {editing && (
                <Button type="button" variant="ghost" onClick={excluir} disabled={pending} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
              <Button type="button" onClick={salvar} disabled={pending}>
                {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
