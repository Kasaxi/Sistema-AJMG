'use client'

import { useRef, useState } from 'react'
import { Camera, Upload, Loader2, AlertCircle } from 'lucide-react'
import { uploadAgendaAnexo } from '@/app/actions/agenda-actions'
import { cn } from '@/lib/utils'

const MAX_VIDEO_MB = 50
const MAX_FOTO_DIM = 1920 // máx 1920px no lado maior
const FOTO_QUALITY = 0.85

interface AnexosUploadProps {
  itemId: string
  onUploaded: () => void
  totalAtual: number
  className?: string
}

/** Redimensiona uma imagem grande pra economizar storage e acelerar upload. */
async function comprimirFoto(file: File): Promise<File> {
  if (file.size < 800 * 1024) return file // já está pequena
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => { URL.revokeObjectURL(url); resolve(i) }
    i.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha lendo imagem')) }
    i.src = url
  })
  const scale = Math.min(1, MAX_FOTO_DIM / Math.max(img.width, img.height))
  if (scale >= 1) return file // já está em tamanho razoável
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', FOTO_QUALITY)
  )
  if (!blob) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
}

export function AnexosUpload({ itemId, onUploaded, totalAtual, className }: AnexosUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const restante = 20 - totalAtual
  const desabilitado = restante <= 0

  async function processarArquivos(files: FileList | File[]) {
    setErro(null)
    const arr = Array.from(files)
    if (!arr.length) return

    if (arr.length > restante) {
      setErro(`Limite de 20 arquivos por tarefa. Você pode enviar mais ${restante}.`)
      return
    }

    setUploading(true)
    try {
      for (const file of arr) {
        if (file.type.startsWith('video/') && file.size > MAX_VIDEO_MB * 1024 * 1024) {
          setErro(`"${file.name}" excede ${MAX_VIDEO_MB} MB`)
          continue
        }
        let final = file
        if (file.type.startsWith('image/')) {
          try { final = await comprimirFoto(file) } catch { /* fallback to original */ }
        }
        const fd = new FormData()
        fd.append('file', final, final.name)
        await uploadAgendaAnexo(itemId, fd)
      }
      onUploaded()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) processarArquivos(e.dataTransfer.files)
  }

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!desabilitado) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-5 transition-all',
          dragOver
            ? 'border-[var(--brand-bright)] bg-[var(--brand-tint)]/30'
            : desabilitado
              ? 'border-[var(--line)] bg-[var(--paper)] opacity-60'
              : 'border-[var(--line)] bg-white hover:border-[var(--brand-bright)]/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={e => e.target.files && processarArquivos(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files && processarArquivos(e.target.files)}
        />

        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--ink)]">
            {uploading ? 'Enviando…' : 'Arraste arquivos aqui'}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
            Foto, vídeo (até {MAX_VIDEO_MB} MB) ou PDF · {restante} restantes
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={desabilitado || uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)] transition-all hover:border-[var(--brand-bright)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Escolher
          </button>
          <button
            type="button"
            disabled={desabilitado || uploading}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)] transition-all hover:border-[var(--brand-bright)]/40 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
            title="Tirar foto agora"
          >
            <Camera className="h-4 w-4" /> Câmera
          </button>
        </div>
      </div>

      {erro && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {erro}
        </div>
      )}
    </div>
  )
}
