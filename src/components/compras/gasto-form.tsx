'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ClipboardList, Tag, Calculator, Building2, Trash2 } from 'lucide-react'
import type { CategoriaCusto, Fornecedor, Gasto, GastoInput, UnidadeMedida } from '@/types/compras'
import { createGasto, updateGasto, deleteGasto, upsertItemCatalogo } from '@/app/actions/compras-actions'
import { ItemAutocomplete } from './item-autocomplete'

const NONE = '__none__'

interface GastoFormProps {
  open: boolean
  onClose: () => void
  obraId: string
  initialData?: Gasto | null
  categorias: CategoriaCusto[]
  unidades: UnidadeMedida[]
  fornecedores: Fornecedor[]
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

function parseBR(v: string): number {
  if (!v.trim()) return NaN
  return Number(v.replace(/\./g, '').replace(',', '.'))
}

function formatBR(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function GastoForm({
  open, onClose, obraId, initialData, categorias, unidades, fornecedores, onSaved,
}: GastoFormProps) {
  const editing = !!initialData
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [unidadeId, setUnidadeId] = useState<string>('')
  const [fornecedorId, setFornecedorId] = useState<string>(NONE)
  const [quantidade, setQuantidade] = useState('')
  const [valorUnitario, setValorUnitario] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [observacoes, setObservacoes] = useState('')

  // Default sensato: unidade "un" se existir
  const defaultUnidadeId = unidades.find(u => u.sigla === 'un')?.id ?? unidades[0]?.id ?? ''

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (initialData) {
      setDescricao(initialData.descricao)
      setCategoriaId(initialData.categoria_id)
      setUnidadeId(initialData.unidade_id)
      setFornecedorId(initialData.fornecedor_id ?? NONE)
      setQuantidade(formatBR(Number(initialData.quantidade), 3).replace(/,?0+$/, ''))
      setValorUnitario(formatBR(Number(initialData.valor_unitario), 2))
      setData(initialData.data)
      setObservacoes(initialData.observacoes ?? '')
    } else {
      setDescricao('')
      setCategoriaId(categorias[0]?.id ?? '')
      setUnidadeId(defaultUnidadeId)
      setFornecedorId(NONE)
      setQuantidade('')
      setValorUnitario('')
      setData(new Date().toISOString().slice(0, 10))
      setObservacoes('')
    }
  }, [open, initialData, categorias, defaultUnidadeId])

  const qtdNum = parseBR(quantidade)
  const valorNum = parseBR(valorUnitario)
  const totalPreview = Number.isFinite(qtdNum) && Number.isFinite(valorNum)
    ? qtdNum * valorNum
    : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) { setErro('Descrição é obrigatória'); return }
    if (!categoriaId)      { setErro('Selecione uma categoria'); return }
    if (!unidadeId)        { setErro('Selecione uma unidade'); return }
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) { setErro('Quantidade inválida'); return }
    if (!Number.isFinite(valorNum) || valorNum < 0) { setErro('Valor unitário inválido'); return }
    if (!data)             { setErro('Data é obrigatória'); return }

    const payload: GastoInput = {
      obra_id: obraId,
      descricao: descricao.trim(),
      categoria_id: categoriaId,
      unidade_id: unidadeId,
      fornecedor_id: fornecedorId === NONE ? null : fornecedorId,
      quantidade: qtdNum,
      valor_unitario: valorNum,
      data,
      observacoes: observacoes.trim() || null,
    }

    startTransition(async () => {
      try {
        if (editing && initialData) {
          await updateGasto(initialData.id, payload)
        } else {
          await createGasto(payload)
          // Cresce o catálogo automaticamente — se a descrição já existir
          // (case-insensitive), é no-op. Não bloqueia o save em caso de falha.
          try {
            await upsertItemCatalogo({
              descricao: payload.descricao,
              unidade_padrao_id: payload.unidade_id,
              categoria_padrao_id: payload.categoria_id,
            })
          } catch (err) {
            console.warn('[gasto] upsert catálogo falhou:', err)
          }
        }
        onSaved?.()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao salvar')
      }
    })
  }

  function handleDelete() {
    if (!initialData) return
    if (!confirm(`Excluir o gasto "${initialData.descricao}"?`)) return
    startTransition(async () => {
      try {
        await deleteGasto(initialData.id, obraId)
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
            {editing ? 'Editar gasto' : 'Novo gasto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Identificação */}
          <section>
            <SectionHeader icon={ClipboardList} label="O que foi" />
            <div className="space-y-3">
              <div>
                <Label htmlFor="g-desc" className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Descrição *
                </Label>
                <ItemAutocomplete
                  id="g-desc"
                  value={descricao}
                  onChange={setDescricao}
                  onSelect={(item) => {
                    if (item.unidade_padrao_id) setUnidadeId(item.unidade_padrao_id)
                    if (item.categoria_padrao_id) setCategoriaId(item.categoria_padrao_id)
                  }}
                  placeholder="Ex: Cimento CP-II 50kg"
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Categoria *</Label>
                  <Select value={categoriaId} onValueChange={v => setCategoriaId(v ?? '')}>
                    <SelectTrigger className="mt-1.5 h-10 w-full rounded-xl">
                      <SelectValue placeholder="Escolha…">
                        {(v: string | null) => categorias.find(c => c.id === v)?.nome ?? 'Escolha…'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.filter(c => c.ativo).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                    <Building2 className="h-3 w-3" /> Fornecedor
                  </Label>
                  <Select value={fornecedorId} onValueChange={v => setFornecedorId(v ?? NONE)}>
                    <SelectTrigger className="mt-1.5 h-10 w-full rounded-xl">
                      <SelectValue placeholder="Sem fornecedor">
                        {(v: string | null) => {
                          if (!v || v === NONE) return 'Sem fornecedor'
                          return fornecedores.find(f => f.id === v)?.nome ?? 'Sem fornecedor'
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem fornecedor</SelectItem>
                      {fornecedores.filter(f => f.ativo).map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          {/* Quantidade + valores */}
          <section>
            <SectionHeader icon={Calculator} label="Quanto e quando" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Quantidade *</Label>
                <Input
                  inputMode="decimal"
                  value={quantidade}
                  onChange={e => setQuantidade(e.target.value)}
                  placeholder="0"
                  className="mt-1.5 h-10 rounded-xl"
                  required
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Unidade *</Label>
                <Select value={unidadeId} onValueChange={v => setUnidadeId(v ?? '')}>
                  <SelectTrigger className="mt-1.5 h-10 w-full rounded-xl">
                    <SelectValue placeholder="un">
                      {(v: string | null) => unidades.find(u => u.id === v)?.sigla ?? 'un'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.sigla} — {u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Valor unit. (R$) *</Label>
                <Input
                  inputMode="decimal"
                  value={valorUnitario}
                  onChange={e => setValorUnitario(e.target.value)}
                  placeholder="0,00"
                  className="mt-1.5 h-10 rounded-xl"
                  required
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Data *</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Preview do total — calculado pelo banco mas mostrado aqui */}
            {totalPreview != null && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Total</span>
                <span className="font-display text-lg font-bold text-[var(--ink)]">
                  R$ {formatBR(totalPreview)}
                </span>
              </div>
            )}
          </section>

          {/* Observações */}
          <section>
            <SectionHeader icon={Tag} label="Observações (opcional)" />
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Nota fiscal, número do pedido, particularidade…"
              rows={2}
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
