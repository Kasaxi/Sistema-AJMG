'use client'

import { useEffect, useState } from 'react'
import { FileText, Film, X, Loader2, Download, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { AgendaAnexo } from '@/types/agenda'
import { deleteAgendaAnexo, getAnexoSignedUrl } from '@/app/actions/agenda-actions'
import { cn } from '@/lib/utils'

interface AnexosGalleryProps {
  anexos: AgendaAnexo[]
  onChange: () => void
}

interface AnexoCardProps {
  anexo: AgendaAnexo
  onClick: (anexo: AgendaAnexo, url: string) => void
  onDelete: (anexo: AgendaAnexo) => void
}

function formatBytes(b: number | null): string {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function AnexoCard({ anexo, onClick, onDelete }: AnexoCardProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAnexoSignedUrl(anexo.storage_path)
      .then(u => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setUrl(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [anexo.storage_path])

  function handleClick() {
    if (url) onClick(anexo, url)
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={!url}
        className="absolute inset-0 cursor-pointer disabled:cursor-default"
        aria-label={`Abrir ${anexo.nome}`}
      >
        {loading && (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-faint)]" />
          </div>
        )}
        {!loading && anexo.tipo === 'FOTO' && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={anexo.nome}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {!loading && anexo.tipo === 'VIDEO' && url && (
          <>
            <video src={url} className="h-full w-full object-cover" preload="metadata" muted />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="rounded-full bg-white/90 p-3">
                <Film className="h-5 w-5 text-[var(--ink)]" />
              </div>
            </div>
          </>
        )}
        {!loading && anexo.tipo === 'DOCUMENTO' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2">
            <FileText className="h-8 w-8 text-[var(--ink-faint)]" />
            <p className="line-clamp-2 text-center text-[10px] font-medium text-[var(--ink-soft)]">
              {anexo.nome}
            </p>
          </div>
        )}
      </button>

      {/* Tamanho */}
      <div className="pointer-events-none absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
        {formatBytes(anexo.tamanho_bytes)}
      </div>

      {/* Botão deletar (hover) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(anexo) }}
        className="absolute right-1 top-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
        aria-label="Excluir anexo"
      >
        <X className="h-3 w-3" strokeWidth={3} />
      </button>
    </div>
  )
}

export function AnexosGallery({ anexos, onChange }: AnexosGalleryProps) {
  const [viewing, setViewing] = useState<{ anexo: AgendaAnexo; url: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (!anexos?.length) {
    return null
  }

  async function handleDelete(anexo: AgendaAnexo) {
    if (!confirm(`Excluir "${anexo.nome}"?`)) return
    setDeleting(anexo.id)
    try {
      await deleteAgendaAnexo(anexo.id)
      onChange()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {anexos.map(a => (
          <div key={a.id} className={cn('relative', deleting === a.id && 'opacity-40')}>
            <AnexoCard
              anexo={a}
              onClick={(an, url) => setViewing({ anexo: an, url })}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>

      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null) }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {viewing && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/40 px-4 py-2.5">
                <h3 className="truncate font-display text-sm font-semibold text-[var(--ink)]">{viewing.anexo.nome}</h3>
                <a
                  href={viewing.url}
                  download={viewing.anexo.nome}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-semibold text-[var(--ink)] transition-all hover:border-[var(--brand-bright)]/40"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </a>
              </div>
              <div className="grid place-items-center bg-black/95 p-4">
                {viewing.anexo.tipo === 'FOTO' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewing.url} alt={viewing.anexo.nome} className="max-h-[70vh] max-w-full object-contain" />
                )}
                {viewing.anexo.tipo === 'VIDEO' && (
                  <video src={viewing.url} controls className="max-h-[70vh] max-w-full" />
                )}
                {viewing.anexo.tipo === 'DOCUMENTO' && (
                  <iframe src={viewing.url} className="h-[70vh] w-full bg-white" title={viewing.anexo.nome} />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
