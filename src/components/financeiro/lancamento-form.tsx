'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ArrowDownLeft, ArrowUpRight, Trash2, Repeat } from 'lucide-react'
import type { Lancamento, LancamentoInput, LancamentoTipo, FinanceiroCategoria, CentroCusto } from '@/types/financeiro'
import { createLancamento, updateLancamento, deleteLancamento } from '@/app/actions/financeiro-actions'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { FormError } from '@/components/ui/form-error'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  initialData?: Lancamento | null
  categorias: FinanceiroCategoria[]
  centros: CentroCusto[]
  onSaved?: () => void
}

// Rótulo "Grupo > Nome" pra um centro de custo.
function rotuloCentro(c: CentroCusto): string {
  return c.grupo ? `${c.grupo} › ${c.nome}` : c.nome
}

const ITEMS_RECORRENCIA: Record<string, string> = {
  NENHUMA: 'Não repetir', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual',
}

const NONE = '__none__'

function parseBR(v: string): number {
  if (!v.trim()) return NaN
  return Number(v.replace(/\./g, '').replace(',', '.'))
}

function formatBR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export function LancamentoForm({ open, onClose, initialData, categorias, centros, onSaved }: Props) {
  const editing = !!initialData
  const confirm = useConfirm()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [tipo, setTipo] = useState<LancamentoTipo>('SAIDA')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState<string>(NONE)
  const [centroId, setCentroId] = useState<string>(NONE)
  const [dataCompetencia, setDataCompetencia] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [pago, setPago] = useState(false)
  const [recorrencia, setRecorrencia] = useState<'NENHUMA' | 'SEMANAL' | 'MENSAL' | 'ANUAL'>('NENHUMA')
  const [parcelas, setParcelas] = useState('2')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (!open) return
    setErro(null)
    const hoje = new Date().toISOString().split('T')[0]
    if (initialData) {
      setTipo(initialData.tipo)
      setDescricao(initialData.descricao)
      setValor(formatBR(initialData.valor))
      setCategoriaId(initialData.categoria_id ?? NONE)
      setCentroId(initialData.centro_custo_id ?? NONE)
      setDataCompetencia(initialData.data_competencia)
      setDataVencimento(initialData.data_vencimento)
      setPago(initialData.status === 'PAGO')
      setRecorrencia('NENHUMA')
      setParcelas('2')
      setObservacoes(initialData.observacoes ?? '')
    } else {
      setTipo('SAIDA')
      setDescricao('')
      setValor('')
      setCategoriaId(NONE)
      setCentroId(NONE)
      setDataCompetencia(hoje)
      setDataVencimento(hoje)
      setPago(false)
      setRecorrencia('NENHUMA')
      setParcelas('2')
      setObservacoes('')
    }
  }, [open, initialData])

  // Ao escolher competência num lançamento novo, sugere o mesmo vencimento.
  function onCompetenciaChange(v: string) {
    setDataCompetencia(v)
    if (!editing && (!dataVencimento || dataVencimento === dataCompetencia)) setDataVencimento(v)
  }

  const categoriasDoTipo = categorias.filter(c => c.tipo === tipo)
  const isEntrada = tipo === 'ENTRADA'

  const itemsCategoria = useMemo(
    () => ({ [NONE]: 'Sem categoria', ...Object.fromEntries(categoriasDoTipo.map(c => [c.id, c.nome])) }),
    [categoriasDoTipo],
  )
  const itemsCentro = useMemo(
    () => ({ [NONE]: 'Nenhum', ...Object.fromEntries(centros.map(c => [c.id, rotuloCentro(c)])) }),
    [centros],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) { setErro('Faltou a descrição.'); return }
    const valorNum = parseBR(valor)
    if (!Number.isFinite(valorNum) || valorNum <= 0) { setErro('Informe um valor válido.'); return }
    if (!dataCompetencia || !dataVencimento) { setErro('Informe as datas.'); return }
    const nParcelas = recorrencia === 'NENHUMA' ? 1 : Math.max(2, parseInt(parcelas, 10) || 2)

    const payload: LancamentoInput = {
      tipo,
      descricao: descricao.trim(),
      valor: valorNum,
      status: pago ? 'PAGO' : 'PENDENTE',
      categoria_id: categoriaId === NONE ? null : categoriaId,
      centro_custo_id: centroId === NONE ? null : centroId,
      data_competencia: dataCompetencia,
      data_vencimento: dataVencimento,
      observacoes: observacoes.trim() || null,
      recorrencia: editing ? 'NENHUMA' : recorrencia,
      parcelas: nParcelas,
    }

    startTransition(async () => {
      try {
        if (editing && initialData) {
          await updateLancamento(initialData.id, payload)
          toast.success('Lançamento atualizado')
        } else {
          await createLancamento(payload)
          toast.success(nParcelas > 1 ? `${nParcelas} lançamentos criados` : 'Lançamento criado')
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
      title: 'Excluir lançamento',
      description: `Excluir "${initialData.descricao}"?`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      try {
        await deleteLancamento(initialData.id)
        toast.success('Lançamento excluído')
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
            {editing ? 'Editar lançamento' : 'Novo lançamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Entrada / Saída */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--paper)] p-1.5">
            <button
              type="button"
              onClick={() => { setTipo('ENTRADA'); setCategoriaId(NONE) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all focus-visible:outline-none',
                isEntrada ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
              )}
            >
              <ArrowUpRight className="h-4 w-4" /> Entrada
            </button>
            <button
              type="button"
              onClick={() => { setTipo('SAIDA'); setCategoriaId(NONE) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all focus-visible:outline-none',
                !isEntrada ? 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
              )}
            >
              <ArrowDownLeft className="h-4 w-4" /> Saída
            </button>
          </div>

          <FormError message={erro} />

          {/* Valor + datas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--ink-faint)]">R$</span>
                <Input id="valor" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" className="pl-9 font-semibold" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp">Competência *</Label>
              <Input id="comp" type="date" value={dataCompetencia} onChange={e => onCompetenciaChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venc" className="text-[var(--brand-bright)]">Vencimento *</Label>
              <Input id="venc" type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="border-[var(--brand-bright)]/30" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição *</Label>
            <Input id="desc" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Compra de cimento — QD 55" />
          </div>

          {/* Categoria + obra */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select items={itemsCategoria} value={categoriaId} onValueChange={(v) => setCategoriaId(v ?? NONE)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem categoria</SelectItem>
                  {categoriasDoTipo.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Centro de custo</Label>
              <Select items={itemsCentro} value={centroId} onValueChange={(v) => setCentroId(v ?? NONE)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {centros.map(c => <SelectItem key={c.id} value={c.id}>{rotuloCentro(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recorrência — só em lançamento novo */}
          {!editing && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/60 p-4">
              <SectionHeader icon={Repeat} label="Recorrência" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Repetir</Label>
                  <Select items={ITEMS_RECORRENCIA} value={recorrencia} onValueChange={(v) => setRecorrencia(v as typeof recorrencia)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NENHUMA">Não repetir</SelectItem>
                      <SelectItem value="SEMANAL">Semanal</SelectItem>
                      <SelectItem value="MENSAL">Mensal</SelectItem>
                      <SelectItem value="ANUAL">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recorrencia !== 'NENHUMA' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="parc">Nº de parcelas</Label>
                    <Input id="parc" type="number" min={2} max={120} value={parcelas} onChange={e => setParcelas(e.target.value)} />
                  </div>
                )}
              </div>
              {recorrencia !== 'NENHUMA' && (
                <p className="mt-2 text-xs text-[var(--ink-faint)]">Cria as parcelas futuras como pendentes, a partir do vencimento.</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Input id="obs" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>

          {/* Já pago/recebido */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3">
            <button
              type="button"
              role="switch"
              aria-checked={pago}
              onClick={() => setPago(p => !p)}
              className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', pago ? 'bg-[var(--brand-bright)]' : 'bg-[var(--line)]')}
            >
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', pago ? 'translate-x-[22px]' : 'translate-x-0.5')} />
            </button>
            <span className="text-sm font-medium text-[var(--ink)]">
              {isEntrada ? 'Já foi recebido?' : 'Já foi pago?'}
            </span>
          </label>

          <DialogFooter className="gap-2">
            {editing && (
              <Button type="button" variant="ghost" onClick={handleDelete} disabled={pending} className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar lançamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
