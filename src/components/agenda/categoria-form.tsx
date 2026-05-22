'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2, Check,
  Wrench, FileText, Camera, Megaphone, ClipboardCheck, GraduationCap,
  Calendar, Hammer, Truck, Phone, AlertCircle, Briefcase, Home, Star,
  ShieldCheck, ClipboardList,
} from 'lucide-react'
import type { CategoriaAgenda } from '@/types/agenda'
import { createCategoriaAgenda, updateCategoriaAgenda } from '@/app/actions/agenda-actions'
import { cn } from '@/lib/utils'

interface CategoriaFormProps {
  open: boolean
  onClose: () => void
  initialData?: CategoriaAgenda | null
  onSaved: () => void
  proximaOrdem: number
}

// Paleta limitada — força consistência visual (sem verde, alinhado com Abacate Pay)
const CORES = [
  '#1E3A8A', // azul escuro
  '#2563EB', // azul
  '#0891B2', // ciano
  '#7C3AED', // roxo
  '#BE185D', // rosa
  '#DC2626', // vermelho
  '#EA580C', // laranja
  '#B45309', // âmbar
  '#475569', // slate
  '#1F2937', // ink (quase preto)
]

const ICONES = [
  { key: 'Wrench',         icon: Wrench,         label: 'Manutenção' },
  { key: 'FileText',       icon: FileText,       label: 'Documento' },
  { key: 'Camera',         icon: Camera,         label: 'Fotos' },
  { key: 'Megaphone',      icon: Megaphone,      label: 'Marketing' },
  { key: 'ClipboardCheck', icon: ClipboardCheck, label: 'Avaliação' },
  { key: 'GraduationCap',  icon: GraduationCap,  label: 'Treinamento' },
  { key: 'Calendar',       icon: Calendar,       label: 'Agenda' },
  { key: 'Hammer',         icon: Hammer,         label: 'Obra' },
  { key: 'Truck',          icon: Truck,          label: 'Transporte' },
  { key: 'Phone',          icon: Phone,          label: 'Contato' },
  { key: 'AlertCircle',    icon: AlertCircle,    label: 'Urgente' },
  { key: 'Briefcase',      icon: Briefcase,      label: 'Trabalho' },
  { key: 'Home',           icon: Home,           label: 'Imóvel' },
  { key: 'Star',           icon: Star,           label: 'Destaque' },
  { key: 'ShieldCheck',    icon: ShieldCheck,    label: 'Vistoria' },
  { key: 'ClipboardList',  icon: ClipboardList,  label: 'Planejamento' },
]

export function CategoriaForm({ open, onClose, initialData, onSaved, proximaOrdem }: CategoriaFormProps) {
  const editing = !!initialData
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [cor, setCor] = useState<string>(CORES[0])
  const [icone, setIcone] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    if (initialData) {
      setNome(initialData.nome)
      setCor(initialData.cor ?? CORES[0])
      setIcone(initialData.icone ?? null)
    } else {
      setNome('')
      setCor(CORES[0])
      setIcone(null)
    }
  }, [open, initialData])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const nomeTrim = nome.trim()
    if (!nomeTrim) { setErro('O nome é obrigatório'); return }

    startTransition(async () => {
      try {
        if (editing && initialData) {
          await updateCategoriaAgenda(initialData.id, { nome: nomeTrim, cor, icone })
        } else {
          await createCategoriaAgenda({ nome: nomeTrim, cor, icone, ordem: proximaOrdem })
        }
        onSaved()
        onClose()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao salvar')
      }
    })
  }

  const IconePreview = ICONES.find(i => i.key === icone)?.icon

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? 'Editar categoria' : 'Nova categoria'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Preview */}
          <div className="flex items-center justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: `${cor}1A`, color: cor }}
            >
              {IconePreview && <IconePreview className="h-4 w-4" />}
              {nome || 'Nome da categoria'}
            </span>
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="cat-nome" className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
              Nome *
            </Label>
            <Input
              id="cat-nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Vistorias"
              className="mt-1.5 h-10 rounded-xl"
              autoFocus
              required
            />
          </div>

          {/* Cor */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Cor</Label>
            <div className="mt-1.5 grid grid-cols-10 gap-1.5">
              {CORES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-label={`Cor ${c}`}
                  className={cn(
                    'grid h-7 w-7 cursor-pointer place-items-center rounded-full ring-2 ring-offset-2 transition-all',
                    cor === c ? 'ring-[var(--ink)]' : 'ring-transparent hover:ring-[var(--line)]',
                  )}
                  style={{ backgroundColor: c }}
                >
                  {cor === c && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
              Ícone (opcional)
            </Label>
            <div className="mt-1.5 grid grid-cols-8 gap-1.5">
              <button
                type="button"
                onClick={() => setIcone(null)}
                title="Sem ícone"
                className={cn(
                  'grid h-9 w-9 cursor-pointer place-items-center rounded-lg border transition-all',
                  icone === null
                    ? 'border-[var(--brand-bright)] bg-[var(--brand-tint)] text-[var(--brand-bright)]'
                    : 'border-[var(--line)] bg-white text-[var(--ink-faint)] hover:border-[var(--brand-bright)]/30',
                )}
              >
                <span className="text-[10px] font-bold">—</span>
              </button>
              {ICONES.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcone(key)}
                  title={label}
                  className={cn(
                    'grid h-9 w-9 cursor-pointer place-items-center rounded-lg border transition-all',
                    icone === key
                      ? 'border-[var(--brand-bright)] bg-[var(--brand-tint)] text-[var(--brand-bright)]'
                      : 'border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--brand-bright)]/30',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {erro}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
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

/** Exporta map de ícones pra outras telas usarem na renderização. */
export function getIconeCategoria(key: string | null) {
  if (!key) return null
  return ICONES.find(i => i.key === key)?.icon ?? null
}
