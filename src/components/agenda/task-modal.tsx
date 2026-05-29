'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, ClipboardList, Clock, Tag, User as UserIcon, MapPin, RotateCw, Trash2, Paperclip } from 'lucide-react'
import type {
  AgendaItem, AgendaItemInput, CategoriaAgenda, AgendaPrioridade,
  AgendaRecorrencia, AgendaStatus, AgendaTipo,
} from '@/types/agenda'
import { RECORRENCIA_LABELS } from '@/types/agenda'
import {
  createAgendaItem, updateAgendaItem, deleteAgendaItem, getAgendaItem,
} from '@/app/actions/agenda-actions'
import { AnexosUpload } from './anexos-upload'
import { AnexosGallery } from './anexos-gallery'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface TaskModalProps {
  open: boolean
  onClose: () => void
  initialData?: AgendaItem | null
  categorias: CategoriaAgenda[]
  pessoas: { id: string; nome: string }[]
  defaultDate?: string  // YYYY-MM-DD
  onSaved?: () => void
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-bright)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      </div>
      <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-bright)]">
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
              'flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
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

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const NONE = '__none__'

export function TaskModal({ open, onClose, initialData, categorias, pessoas, defaultDate, onSaved }: TaskModalProps) {
  const editing = !!initialData
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Item ao vivo (com anexos atualizados — refetch quando user adiciona/remove)
  const [itemAtual, setItemAtual] = useState<AgendaItem | null>(initialData ?? null)
  const [tipo, setTipo] = useState<AgendaTipo>('TAREFA')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hojeISO())
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [prioridade, setPrioridade] = useState<AgendaPrioridade>('MEDIA')
  const [status, setStatus] = useState<AgendaStatus>('PENDENTE')
  const [categoriaId, setCategoriaId] = useState<string>(NONE)
  const [atribuidoPara, setAtribuidoPara] = useState<string>(NONE)
  const [local, setLocal] = useState('')
  const [recorrencia, setRecorrencia] = useState<AgendaRecorrencia>('NENHUMA')
  const [recorrenciaAte, setRecorrenciaAte] = useState('')

  useEffect(() => {
    if (!open) return
    setErro(null)
    setItemAtual(initialData ?? null)
    if (initialData) {
      setTipo(initialData.tipo)
      setTitulo(initialData.titulo)
      setDescricao(initialData.descricao ?? '')
      setData(initialData.data)
      setHoraInicio(initialData.hora_inicio?.slice(0, 5) ?? '')
      setHoraFim(initialData.hora_fim?.slice(0, 5) ?? '')
      setPrioridade(initialData.prioridade)
      setStatus(initialData.status)
      setCategoriaId(initialData.categoria_id ?? NONE)
      setAtribuidoPara(initialData.atribuido_para ?? NONE)
      setLocal(initialData.local ?? '')
      setRecorrencia(initialData.recorrencia)
      setRecorrenciaAte(initialData.recorrencia_ate ?? '')
    } else {
      setTipo('TAREFA')
      setTitulo('')
      setDescricao('')
      setData(defaultDate ?? hojeISO())
      setHoraInicio('')
      setHoraFim('')
      setPrioridade('MEDIA')
      setStatus('PENDENTE')
      setCategoriaId(NONE)
      setAtribuidoPara(NONE)
      setLocal('')
      setRecorrencia('NENHUMA')
      setRecorrenciaAte('')
    }
  }, [open, initialData, defaultDate])

  function handleTipoChange(novo: AgendaTipo) {
    setTipo(novo)
    if (novo === 'TAREFA') {
      setHoraInicio('')
      setHoraFim('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!titulo.trim()) {
      setErro('O título é obrigatório')
      return
    }
    if (tipo === 'AGENDAMENTO' && !horaInicio) {
      setErro('Agendamento precisa de hora de início')
      return
    }

    const payload: AgendaItemInput = {
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      data,
      hora_inicio: tipo === 'AGENDAMENTO' ? horaInicio + ':00' : null,
      hora_fim: tipo === 'AGENDAMENTO' && horaFim ? horaFim + ':00' : null,
      prioridade,
      status,
      categoria_id: categoriaId === NONE ? null : categoriaId,
      atribuido_para: atribuidoPara === NONE ? null : atribuidoPara,
      local: local.trim() || null,
      recorrencia: editing ? undefined : recorrencia,
      recorrencia_ate: editing ? undefined : (recorrencia === 'NENHUMA' ? null : recorrenciaAte || null),
    }

    startTransition(async () => {
      try {
        if (editing && initialData) {
          await updateAgendaItem(initialData.id, payload)
        } else {
          await createAgendaItem(payload)
        }
        onSaved?.()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao salvar')
      }
    })
  }

  async function recarregarAnexos() {
    if (!itemAtual?.id) return
    const novo = await getAgendaItem(itemAtual.id)
    if (novo) setItemAtual(novo)
  }

  async function handleDelete() {
    if (!initialData) return
    const ok = await confirm({
      title: 'Excluir tarefa',
      description: 'Excluir esta tarefa? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    setErro(null)
    startTransition(async () => {
      try {
        await deleteAgendaItem(initialData.id)
        onSaved?.()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao excluir')
      } finally {
        setDeleting(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? 'Editar tarefa' : 'Nova tarefa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">

          {/* Tipo */}
          <Segmented<AgendaTipo>
            options={[
              { value: 'TAREFA', label: 'Tarefa' },
              { value: 'AGENDAMENTO', label: 'Agendamento (com horário)' },
            ]}
            value={tipo}
            onChange={handleTipoChange}
          />

          {/* Informações principais */}
          <section>
            <SectionHeader icon={ClipboardList} label="Informações" />
            <div className="space-y-3">
              <div>
                <Label htmlFor="titulo" className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  Título *
                </Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Vistoria QD 121 LT 34"
                  className="mt-1.5 h-10 rounded-xl"
                  autoFocus
                  required
                />
              </div>

              <div>
                <Label htmlFor="descricao" className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  Descrição
                </Label>
                <textarea
                  id="descricao"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Detalhes, protocolos, observações…"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/15"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Prioridade</Label>
                  <div className="mt-1.5">
                    <Segmented<AgendaPrioridade>
                      options={[
                        { value: 'BAIXA', label: 'Baixa' },
                        { value: 'MEDIA', label: 'Média' },
                        { value: 'ALTA', label: 'Alta' },
                      ]}
                      value={prioridade}
                      onChange={setPrioridade}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Status</Label>
                  <div className="mt-1.5">
                    <Segmented<AgendaStatus>
                      options={[
                        { value: 'PENDENTE',     label: 'A fazer' },
                        { value: 'EM_ANDAMENTO', label: 'Fazendo' },
                        { value: 'CONCLUIDO',    label: 'Feita' },
                      ]}
                      value={status === 'CANCELADO' ? 'PENDENTE' : status}
                      onChange={setStatus}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Data & hora */}
          <section>
            <SectionHeader icon={Clock} label="Quando" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Data *</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl"
                  required
                />
              </div>
              {tipo === 'AGENDAMENTO' && (
                <>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Início *</Label>
                    <Input
                      type="time"
                      value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)}
                      className="mt-1.5 h-10 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Fim</Label>
                    <Input
                      type="time"
                      value={horaFim}
                      onChange={e => setHoraFim(e.target.value)}
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                </>
              )}
            </div>

            {!editing && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                    <RotateCw className="h-3 w-3" /> Repetir
                  </Label>
                  <Select value={recorrencia} onValueChange={v => setRecorrencia((v ?? 'NENHUMA') as AgendaRecorrencia)}>
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                      <SelectValue>
                        {(v: string | null) => RECORRENCIA_LABELS[(v ?? 'NENHUMA') as AgendaRecorrencia]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RECORRENCIA_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {recorrencia !== 'NENHUMA' && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Repetir até</Label>
                    <Input
                      type="date"
                      value={recorrenciaAte}
                      onChange={e => setRecorrenciaAte(e.target.value)}
                      min={data}
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Organização */}
          <section>
            <SectionHeader icon={Tag} label="Organização" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Categoria</Label>
                <Select value={categoriaId} onValueChange={v => setCategoriaId(v ?? NONE)}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                    <SelectValue placeholder="Sem categoria">
                      {(v: string | null) => {
                        if (!v || v === NONE) return 'Sem categoria'
                        return categorias.find(c => c.id === v)?.nome ?? 'Sem categoria'
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem categoria</SelectItem>
                    {categorias.filter(c => c.ativo).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  <UserIcon className="h-3 w-3" /> Atribuir a
                </Label>
                <Select value={atribuidoPara} onValueChange={v => setAtribuidoPara(v ?? NONE)}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                    <SelectValue placeholder="Ninguém">
                      {(v: string | null) => {
                        if (!v || v === NONE) return 'Ninguém'
                        return pessoas.find(p => p.id === v)?.nome ?? 'Ninguém'
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ninguém</SelectItem>
                    {pessoas.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  <MapPin className="h-3 w-3" /> Local
                </Label>
                <Input
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                  placeholder="Ex: Obra QD 151, Escritório, endereço…"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
            </div>
          </section>

          {/* Anexos — só quando o item já existe (precisa do id) */}
          {editing && itemAtual && (
            <section>
              <SectionHeader icon={Paperclip} label={`Anexos${itemAtual.anexos?.length ? ` (${itemAtual.anexos.length})` : ''}`} />
              <div className="space-y-3">
                {itemAtual.anexos && itemAtual.anexos.length > 0 && (
                  <AnexosGallery anexos={itemAtual.anexos} onChange={recarregarAnexos} />
                )}
                <AnexosUpload
                  itemId={itemAtual.id}
                  totalAtual={itemAtual.anexos?.length ?? 0}
                  onUploaded={recarregarAnexos}
                />
              </div>
            </section>
          )}

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
                  disabled={pending || deleting}
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
