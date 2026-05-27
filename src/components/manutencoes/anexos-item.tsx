'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Paperclip, Loader2, Trash2, Upload, FileText, Image as ImageIcon,
  Video, ExternalLink,
} from 'lucide-react'
import {
  listManutencaoAnexos,
  uploadManutencaoAnexo,
  removerManutencaoAnexo,
  getAnexoSignedUrl,
} from '@/app/actions/manutencoes-actions'
import type { ManutencaoAnexo } from '@/types/manutencoes'
import { cn } from '@/lib/utils'

interface Props {
  manutencaoId: string
  /** Quando preenchido, lista/sobe anexos só daquele item. */
  itemId: string
  /** Bloqueia upload/remoção quando false (ex.: manutenção cancelada). */
  podeEditar: boolean
}

function detectaTipo(mime: string): { kind: 'image' | 'video' | 'doc'; Icon: React.ElementType; cor: string } {
  if (mime.startsWith('image/')) return { kind: 'image', Icon: ImageIcon, cor: 'text-emerald-700' }
  if (mime.startsWith('video/')) return { kind: 'video', Icon: Video,     cor: 'text-violet-700' }
  return { kind: 'doc', Icon: FileText, cor: 'text-[var(--ink-soft)]' }
}

function formatSize(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AnexosItem({ manutencaoId, itemId, podeEditar }: Props) {
  const [anexos, setAnexos] = useState<ManutencaoAnexo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listManutencaoAnexos(manutencaoId, { item_id: itemId })
      setAnexos(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar anexos.')
    } finally {
      setLoading(false)
    }
  }, [manutencaoId, itemId])

  useEffect(() => { void carregar() }, [carregar])

  async function onArquivoEscolhido(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('manutencao_id', manutencaoId)
      fd.append('item_id', itemId)
      fd.append('file_type', file.type.startsWith('image/') ? 'FOTO_DEPOIS' : file.type.startsWith('video/') ? 'OUTRO' : 'DOCUMENTO')
      fd.append('file', file)
      const novo = await uploadManutencaoAnexo(fd)
      setAnexos(prev => [novo, ...prev])
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function abrir(anexo: ManutencaoAnexo) {
    setErro(null)
    try {
      const url = await getAnexoSignedUrl(anexo.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir.')
    }
  }

  async function remover(anexo: ManutencaoAnexo) {
    if (!confirm(`Remover "${anexo.file_name}"?`)) return
    setErro(null)
    try {
      await removerManutencaoAnexo(anexo.id)
      setAnexos(prev => prev.filter(a => a.id !== anexo.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover.')
    }
  }

  if (loading && anexos.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--ink-faint)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando anexos…
      </div>
    )
  }

  return (
    <div className="mt-2.5">
      {erro && (
        <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
          {erro}
        </p>
      )}

      {anexos.length > 0 && (
        <ul className="mb-2 space-y-1">
          {anexos.map(a => {
            const { Icon, cor } = detectaTipo(a.file_name.match(/\.\w+$/) ? mimeFromName(a.file_name) : 'application/octet-stream')
            const size = formatSize(a.size_bytes)
            return (
              <li key={a.id} className="group flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5">
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--paper)]', cor)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => abrir(a)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-xs text-[var(--ink)] hover:underline"
                >
                  <span className="truncate">{a.file_name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                </button>
                {size && (
                  <span className="shrink-0 text-[10px] tabular-nums text-[var(--ink-faint)]">{size}</span>
                )}
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => remover(a)}
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remover anexo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {podeEditar && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf,.xlsx,.xls"
            onChange={onArquivoEscolhido}
            disabled={uploading}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40 disabled:cursor-not-allowed disabled:opacity-60',
              uploading
                ? 'border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/40 text-[var(--brand-bright)]'
                : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--brand-bright)]/40 hover:bg-[var(--paper)] hover:text-[var(--ink)]',
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Paperclip className="h-3 w-3" />
                {anexos.length === 0 ? 'Anexar foto ou vídeo' : 'Anexar mais'}
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}

// Helper: deriva mime a partir da extensão do nome (usado pra escolher ícone)
function mimeFromName(name: string): string {
  const ext = (name.match(/\.(\w+)$/)?.[1] ?? '').toLowerCase()
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png')  return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'gif')  return 'image/gif'
  if (ext === 'mp4')  return 'video/mp4'
  if (ext === 'mov')  return 'video/quicktime'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mkv')  return 'video/x-matroska'
  if (ext === 'pdf')  return 'application/pdf'
  return 'application/octet-stream'
}
