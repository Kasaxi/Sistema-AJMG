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
import { Plus, Pencil, Trash2, Loader2, EyeOff, Hammer, Home, Boxes } from 'lucide-react'
import {
  listCentrosCusto, createCentroCusto, updateCentroCusto, deleteCentroCusto,
  listObrasParaSelect, listImoveisParaSelect,
} from '@/app/actions/financeiro-actions'
import type { CentroCusto, CentroCustoInput, CentroCustoTipo } from '@/types/financeiro'
import { CENTRO_CUSTO_TIPO_LABELS } from '@/types/financeiro'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { FormError } from '@/components/ui/form-error'
import { cn } from '@/lib/utils'

const TIPO_ICON: Record<CentroCustoTipo, React.ElementType> = {
  OBRA: Hammer, IMOVEL: Home, AVULSO: Boxes,
}

export default function CentrosCustoPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([])
  const [imoveis, setImoveis] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<CentroCusto | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setCentros(await listCentrosCusto({ incluirInativos: true }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    void Promise.all([listObrasParaSelect(), listImoveisParaSelect()])
      .then(([o, i]) => { setObras(o); setImoveis(i) })
      .catch(() => {})
  }, [])

  // Agrupa por "grupo" (sem grupo vai pro fim)
  const grupos = (() => {
    const map = new Map<string, CentroCusto[]>()
    for (const c of centros) {
      const k = c.grupo ?? ''
      const arr = map.get(k) ?? []
      arr.push(c); map.set(k, arr)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  })()

  async function excluir(c: CentroCusto) {
    const ok = await confirm({
      title: 'Excluir centro de custo',
      description: `Excluir "${c.nome}"? Lançamentos vinculados ficam sem centro.`,
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteCentroCusto(c.id)
      toast.success('Centro de custo excluído')
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir')
    }
  }

  return (
    <>
      <Header
        eyebrow="Financeiro"
        title="Centros de custo"
        subtitle="Obras, imóveis e avulsos (ADM, Abastecimento…) pra separar relatórios"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={carregar} />
            <Button className="gap-1.5" onClick={() => { setEditando(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> Novo centro
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : centros.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-bright)]"><Boxes className="h-6 w-6" /></span>
            <p className="mt-4 font-display text-base font-semibold text-[var(--ink)]">Nenhum centro de custo</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Crie centros pra separar gastos por obra, imóvel ou área (ADM, Abastecimento…).</p>
            <Button className="mt-4 gap-1.5" onClick={() => { setEditando(null); setFormOpen(true) }}><Plus className="h-4 w-4" /> Novo centro</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {grupos.map(([grupo, itens]) => (
              <section key={grupo || '__sem__'}>
                <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{grupo || 'Sem grupo'}</h2>
                <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
                  {itens.map(c => {
                    const Icon = TIPO_ICON[c.tipo]
                    return (
                      <div key={c.id} className="group flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0 hover:bg-[var(--paper)]/50">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-bright)]"><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm font-semibold text-[var(--ink)]', !c.ativo && 'text-[var(--ink-faint)]')}>
                            {c.nome}{!c.ativo && <EyeOff className="ml-1.5 inline h-3 w-3" />}
                          </p>
                          <p className="text-[11px] text-[var(--ink-faint)]">{CENTRO_CUSTO_TIPO_LABELS[c.tipo]}</p>
                        </div>
                        <button onClick={() => { setEditando(c); setFormOpen(true) }} aria-label="Editar" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-[var(--brand-tint)] hover:text-[var(--brand-bright)] group-hover:opacity-100">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => excluir(c)} aria-label="Excluir" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CentroForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editando}
        obras={obras}
        imoveis={imoveis}
        onSaved={carregar}
      />
    </>
  )
}

const NONE = '__none__'

function CentroForm({ open, onClose, initialData, obras, imoveis, onSaved }: {
  open: boolean; onClose: () => void; initialData: CentroCusto | null
  obras: { id: string; nome: string }[]; imoveis: { id: string; nome: string }[]; onSaved: () => void
}) {
  const editing = !!initialData
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [tipo, setTipo] = useState<CentroCustoTipo>('AVULSO')
  const [nome, setNome] = useState('')
  const [grupo, setGrupo] = useState('')
  const [obraId, setObraId] = useState<string>(NONE)
  const [imovelId, setImovelId] = useState<string>(NONE)
  const [ativo, setAtivo] = useState(true)

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (initialData) {
      setTipo(initialData.tipo)
      setNome(initialData.nome)
      setGrupo(initialData.grupo ?? '')
      setObraId(initialData.obra_id ?? NONE)
      setImovelId(initialData.imovel_id ?? NONE)
      setAtivo(initialData.ativo)
    } else {
      setTipo('AVULSO'); setNome(''); setGrupo(''); setObraId(NONE); setImovelId(NONE); setAtivo(true)
    }
  }, [open, initialData])

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    if (tipo === 'OBRA' && obraId === NONE) { setErro('Selecione a obra.'); return }
    if (tipo === 'IMOVEL' && imovelId === NONE) { setErro('Selecione o imóvel.'); return }
    startTransition(async () => {
      try {
        const payload: CentroCustoInput = {
          nome, grupo: grupo.trim() || null, tipo, ativo,
          obra_id: tipo === 'OBRA' ? obraId : null,
          imovel_id: tipo === 'IMOVEL' ? imovelId : null,
        }
        if (editing && initialData) {
          await updateCentroCusto(initialData.id, payload)
          toast.success('Centro atualizado')
        } else {
          await createCentroCusto(payload)
          toast.success('Centro criado')
        }
        onSaved(); onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao salvar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{editing ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <FormError message={erro} />
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select items={{ AVULSO: 'Avulso (ADM, Abastecimento…)', OBRA: 'Obra', IMOVEL: 'Imóvel' }} value={tipo} onValueChange={(v) => {
              const t = v as CentroCustoTipo
              setTipo(t); if (t === 'OBRA') setImovelId(NONE); if (t === 'IMOVEL') setObraId(NONE)
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AVULSO">Avulso (ADM, Abastecimento…)</SelectItem>
                <SelectItem value="OBRA">Obra</SelectItem>
                <SelectItem value="IMOVEL">Imóvel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === 'OBRA' && (
            <div className="space-y-1.5">
              <Label>Obra *</Label>
              <Select items={{ [NONE]: 'Selecione', ...Object.fromEntries(obras.map(o => [o.id, o.nome])) }} value={obraId} onValueChange={(v) => {
                const id = v ?? NONE; setObraId(id)
                const o = obras.find(x => x.id === id); if (o && !nome.trim()) setNome(o.nome)
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Selecione</SelectItem>
                  {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === 'IMOVEL' && (
            <div className="space-y-1.5">
              <Label>Imóvel *</Label>
              <Select items={{ [NONE]: 'Selecione', ...Object.fromEntries(imoveis.map(im => [im.id, im.nome])) }} value={imovelId} onValueChange={(v) => {
                const id = v ?? NONE; setImovelId(id)
                const im = imoveis.find(x => x.id === id); if (im && !nome.trim()) setNome(im.nome)
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Selecione</SelectItem>
                  {imoveis.map(im => <SelectItem key={im.id} value={im.id}>{im.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-nome">Nome *</Label>
              <Input id="cc-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: SALDO ADM" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-grupo">Grupo</Label>
              <Input id="cc-grupo" value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Ex.: ADM" />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <button type="button" role="switch" aria-checked={ativo} onClick={() => setAtivo(a => !a)}
              className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', ativo ? 'bg-[var(--brand-bright)]' : 'bg-[var(--line)]')}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', ativo ? 'translate-x-[22px]' : 'translate-x-0.5')} />
            </button>
            <span className="text-sm font-medium text-[var(--ink)]">Ativo (aparece ao lançar)</span>
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
