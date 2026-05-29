'use client'

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Send, Trash2, Plus, AlertCircle, MessageCircle } from 'lucide-react'
import {
  listWhatsappContatos,
  createWhatsappContato,
  deleteWhatsappContato,
} from '@/app/actions/whatsapp-contatos-actions'
import type { WhatsappContato } from '@/types/whatsapp'
import { formatWhatsappDisplay } from '@/types/whatsapp'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  /** Texto pré-formatado que vai pra mensagem. */
  mensagem: string
}

export function WhatsappPickerDialog({ open, onClose, mensagem }: Props) {
  const confirm = useConfirm()
  const [contatos, setContatos] = useState<WhatsappContato[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [novoNome, setNovoNome] = useState('')
  const [novoNumero, setNovoNumero] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  const [removendo, setRemovendo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await listWhatsappContatos()
      setContatos(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar contatos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void carregar()
  }, [open, carregar])

  async function cadastrar() {
    setErro(null)
    if (!novoNome.trim() || !novoNumero.trim()) {
      setErro('Preencha nome e número.')
      return
    }
    setSalvandoNovo(true)
    try {
      await createWhatsappContato({ nome: novoNome, numero: novoNumero })
      setNovoNome('')
      setNovoNumero('')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao cadastrar.')
    } finally {
      setSalvandoNovo(false)
    }
  }

  async function remover(id: string, nome: string) {
    const ok = await confirm({
      title: 'Remover contato',
      description: `Remover ${nome} dos contatos?`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    setRemovendo(id)
    try {
      await deleteWhatsappContato(id)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao remover.')
    } finally {
      setRemovendo(null)
    }
  }

  function enviarPara(contato: WhatsappContato) {
    // web.whatsapp.com/send abre direto na conversa no WhatsApp Web
    // (pula a landing page do wa.me/api.whatsapp.com)
    const url = `https://web.whatsapp.com/send?phone=${contato.numero}&text=${encodeURIComponent(mensagem)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="border-b border-[var(--line)] px-6 py-5">
          <h2 className="font-display text-lg font-bold leading-tight text-[var(--ink)]">
            Enviar relatório no WhatsApp
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Escolha um contato pra abrir a conversa com a mensagem pré-formatada.
          </p>
        </div>

        <div className="space-y-6 px-6 py-5">
          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Novo contato */}
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Novo contato
            </p>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/40 p-3.5">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome do contato"
                  className="h-10 rounded-lg"
                />
                <Input
                  value={novoNumero}
                  onChange={e => setNovoNumero(e.target.value)}
                  placeholder="DDD + número (ex: 61 99173-1449)"
                  inputMode="tel"
                  className="h-10 rounded-lg tabular-nums"
                />
              </div>
              <Button
                onClick={cadastrar}
                disabled={salvandoNovo}
                className="mt-3 w-full gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {salvandoNovo ? 'Cadastrando…' : 'Cadastrar contato'}
              </Button>
            </div>
          </section>

          {/* Contatos salvos */}
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Contatos salvos
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : contatos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--ink-soft)]">
                Nenhum contato salvo ainda. Cadastre o primeiro acima.
              </p>
            ) : (
              <div className="space-y-2">
                {contatos.map(c => (
                  <ContatoRow
                    key={c.id}
                    contato={c}
                    onEnviar={() => enviarPara(c)}
                    onRemover={() => remover(c.id, c.nome)}
                    removendo={removendo === c.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--line)] bg-[var(--paper)]/40 px-6 py-3 text-center">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            <MessageCircle className="h-3 w-3" />
            Abre uma nova aba do WhatsApp com a mensagem pronta
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContatoRow({
  contato, onEnviar, onRemover, removendo,
}: {
  contato: WhatsappContato
  onEnviar: () => void
  onRemover: () => void
  removendo: boolean
}) {
  // Avatar com inicial(es)
  const iniciais = contato.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 transition-colors hover:border-[var(--brand-bright)]/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] font-display text-sm font-bold text-[var(--brand-bright)]">
        {iniciais || '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{contato.nome}</p>
        <p className="truncate text-xs tabular-nums text-[var(--ink-soft)]">
          {formatWhatsappDisplay(contato.numero)}
        </p>
      </div>
      <button
        type="button"
        onClick={onEnviar}
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-[var(--ink)] text-white transition-all hover:bg-[var(--ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
        aria-label={`Enviar para ${contato.nome}`}
      >
        <Send className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onRemover}
        disabled={removendo}
        className={cn(
          'grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40 disabled:cursor-not-allowed disabled:opacity-40',
        )}
        aria-label={`Remover ${contato.nome}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
