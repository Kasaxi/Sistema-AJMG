'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshButton } from '@/components/ui/refresh-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, ArrowUpRight, ArrowDownLeft, Loader2, EyeOff } from 'lucide-react'
import {
  listCategorias, createCategoria, updateCategoria, deleteCategoria,
} from '@/app/actions/financeiro-actions'
import type { FinanceiroCategoria, GrupoDRE, LancamentoTipo } from '@/types/financeiro'
import { GRUPO_DRE_LABELS } from '@/types/financeiro'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { FormError } from '@/components/ui/form-error'
import { cn } from '@/lib/utils'

const GRUPOS_DRE = Object.keys(GRUPO_DRE_LABELS) as GrupoDRE[]

export default function CategoriasFinanceiroPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<FinanceiroCategoria | null>(null)
  const [tipoNovo, setTipoNovo] = useState<LancamentoTipo>('ENTRADA')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setCategorias(await listCategorias({ incluirInativas: true }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const entradas = categorias.filter(c => c.tipo === 'ENTRADA')
  const saidas = categorias.filter(c => c.tipo === 'SAIDA')

  function novo(tipo: LancamentoTipo) { setEditando(null); setTipoNovo(tipo); setFormOpen(true) }
  function editar(c: FinanceiroCategoria) { setEditando(c); setFormOpen(true) }

  async function excluir(c: FinanceiroCategoria) {
    const ok = await confirm({
      title: 'Excluir categoria',
      description: `Excluir "${c.nome}"? Lançamentos que a usavam ficam sem categoria.`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteCategoria(c.id)
      toast.success('Categoria excluída')
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir')
    }
  }

  return (
    <>
      <Header
        eyebrow="Financeiro"
        title="Categorias"
        subtitle="Classificação das entradas e saídas (base do DRE)"
        actions={<RefreshButton onRefresh={carregar} />}
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Coluna tipo="ENTRADA" itens={entradas} onNovo={() => novo('ENTRADA')} onEditar={editar} onExcluir={excluir} />
            <Coluna tipo="SAIDA" itens={saidas} onNovo={() => novo('SAIDA')} onEditar={editar} onExcluir={excluir} />
          </div>
        )}
      </div>

      <CategoriaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editando}
        tipoNovo={tipoNovo}
        onSaved={carregar}
      />
    </>
  )
}

function Coluna({ tipo, itens, onNovo, onEditar, onExcluir }: {
  tipo: LancamentoTipo; itens: FinanceiroCategoria[]
  onNovo: () => void; onEditar: (c: FinanceiroCategoria) => void; onExcluir: (c: FinanceiroCategoria) => void
}) {
  const entrada = tipo === 'ENTRADA'
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={cn('grid h-8 w-8 place-items-center rounded-lg', entrada ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
            {entrada ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
          </span>
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{entrada ? 'Entradas' : 'Saídas'}</h2>
        </div>
        <Button size="sm" variant="outline" onClick={onNovo} className="gap-1"><Plus className="h-3.5 w-3.5" /> Nova</Button>
      </div>

      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--ink-faint)]">Nenhuma categoria ainda.</p>
      ) : (
        <ul className="space-y-1">
          {itens.map(c => (
            <li key={c.id} className="group flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-[var(--paper)]/60">
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium text-[var(--ink)]', !c.ativo && 'text-[var(--ink-faint)]')}>
                  {c.nome}
                  {!c.ativo && <EyeOff className="ml-1.5 inline h-3 w-3 text-[var(--ink-faint)]" />}
                </p>
                {c.grupo_dre && <p className="text-[11px] text-[var(--ink-faint)]">{GRUPO_DRE_LABELS[c.grupo_dre]}</p>}
              </div>
              <button onClick={() => onEditar(c)} aria-label="Editar" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[var(--brand-tint)] hover:text-[var(--brand-bright)] group-hover:opacity-100">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onExcluir(c)} aria-label="Excluir" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CategoriaForm({ open, onClose, initialData, tipoNovo, onSaved }: {
  open: boolean; onClose: () => void; initialData: FinanceiroCategoria | null
  tipoNovo: LancamentoTipo; onSaved: () => void
}) {
  const editing = !!initialData
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<LancamentoTipo>('ENTRADA')
  const [grupoDre, setGrupoDre] = useState<GrupoDRE | '__none__'>('__none__')
  const [ativo, setAtivo] = useState(true)

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (initialData) {
      setNome(initialData.nome)
      setTipo(initialData.tipo)
      setGrupoDre(initialData.grupo_dre ?? '__none__')
      setAtivo(initialData.ativo)
    } else {
      setNome('')
      setTipo(tipoNovo)
      setGrupoDre('__none__')
      setAtivo(true)
    }
  }, [open, initialData, tipoNovo])

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    startTransition(async () => {
      try {
        const payload = { nome, tipo, grupo_dre: grupoDre === '__none__' ? null : grupoDre, ativo }
        if (editing && initialData) {
          await updateCategoria(initialData.id, payload)
          toast.success('Categoria atualizada')
        } else {
          await createCategoria(payload)
          toast.success('Categoria criada')
        }
        onSaved()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao salvar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <FormError message={erro} />
          <div className="space-y-1.5">
            <Label htmlFor="cat-nome">Nome *</Label>
            <Input id="cat-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Material de Construção" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select items={{ ENTRADA: 'Entrada', SAIDA: 'Saída' }} value={tipo} onValueChange={(v) => setTipo(v as LancamentoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grupo (DRE)</Label>
              <Select items={{ __none__: 'Sem grupo', ...GRUPO_DRE_LABELS }} value={grupoDre} onValueChange={(v) => setGrupoDre(v as GrupoDRE | '__none__')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem grupo</SelectItem>
                  {GRUPOS_DRE.map(g => <SelectItem key={g} value={g}>{GRUPO_DRE_LABELS[g]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <button type="button" role="switch" aria-checked={ativo} onClick={() => setAtivo(a => !a)}
              className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', ativo ? 'bg-[var(--brand-bright)]' : 'bg-[var(--line)]')}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', ativo ? 'translate-x-[22px]' : 'translate-x-0.5')} />
            </button>
            <span className="text-sm font-medium text-[var(--ink)]">Ativa (aparece ao lançar)</span>
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
