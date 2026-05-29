'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Loader2, ImagePlus, FilePlus2, Trash2, FileText, X as XIcon, Download, Image as ImageIcon,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  listImovelAnexos, criarUploadUrlImovelAnexo, registrarImovelAnexo, removerImovelAnexo,
} from '@/app/actions/imoveis-actions'
import { uploadToSignedUrl, fileTypeImovelFromMime } from '@/lib/storage-upload'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { ImovelAnexo, ImovelAnexoTipo } from '@/types/imoveis'

type AnexoComUrl = ImovelAnexo & { url: string }
type Resumo = { id: string; file_type: ImovelAnexoTipo }

const MAX_BYTES = 100 * 1024 * 1024

function formatSize(b: number | null): string | null {
  if (!b) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function tipoView(a: AnexoComUrl): 'img' | 'pdf' | 'outro' {
  const ext = (a.file_name.match(/\.(\w+)$/)?.[1] ?? '').toLowerCase()
  if (a.file_type === 'FOTO' || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'img'
  if (ext === 'pdf') return 'pdf'
  return 'outro'
}

export function ImovelAnexos({ imovelId, onChanged }: { imovelId: string; onChanged?: (resumo: Resumo[]) => void }) {
  const confirm = useConfirm()
  const [anexos, setAnexos] = useState<AnexoComUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [uploadando, setUploadando] = useState<'FOTO' | 'DOCUMENTO' | null>(null)
  const [viewingIdx, setViewingIdx] = useState<number | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  // Navegação do visualizador (entre todos os anexos)
  const navView = useCallback((delta: number) => {
    setViewingIdx(i => (i == null ? null : (i + delta + anexos.length) % anexos.length))
  }, [anexos.length])

  useEffect(() => {
    if (viewingIdx == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') navView(-1)
      if (e.key === 'ArrowRight') navView(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewingIdx, navView])

  function notificar(lista: AnexoComUrl[]) {
    onChanged?.(lista.map(a => ({ id: a.id, file_type: a.file_type })))
  }

  const carregar = useCallback(async (): Promise<AnexoComUrl[]> => {
    setLoading(true)
    try {
      const lista = await listImovelAnexos(imovelId)
      setAnexos(lista)
      return lista
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar anexos.')
      return []
    } finally {
      setLoading(false)
    }
  }, [imovelId])

  useEffect(() => { void carregar() }, [carregar])

  async function subir(files: FileList | null, modo: 'FOTO' | 'DOCUMENTO') {
    if (!files?.length) return
    setErro(null); setUploadando(modo)
    const falhas: string[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) { falhas.push(`${file.name}: maior que 100 MB`); continue }
      try {
        const { bucket, path, token } = await criarUploadUrlImovelAnexo({ imovelId, fileName: file.name })
        await uploadToSignedUrl(bucket, path, token, file)
        await registrarImovelAnexo({
          imovelId, path, fileName: file.name,
          fileType: fileTypeImovelFromMime(file.type),
          sizeBytes: file.size,
        })
      } catch (e) {
        falhas.push(`${file.name}: ${e instanceof Error ? e.message : 'erro'}`)
      }
    }
    if (falhas.length) setErro(falhas.join('\n'))
    setUploadando(null)
    notificar(await carregar())
  }

  async function remover(a: AnexoComUrl) {
    const ok = await confirm({
      title: 'Remover anexo',
      description: `Remover "${a.file_name}"?`,
      confirmLabel: 'Remover',
      destructive: true,
    })
    if (!ok) return
    setErro(null)
    try {
      await removerImovelAnexo(a.id)
      const next = anexos.filter(x => x.id !== a.id)
      setAnexos(next)
      notificar(next)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover.')
    }
  }

  const fotos = anexos.filter(a => a.file_type === 'FOTO')
  const docs = anexos.filter(a => a.file_type !== 'FOTO')

  return (
    <>
      {erro && (
        <p className="mb-2 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">{erro}</p>
      )}

      {/* FOTOS */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Fotos</span>
          <button
            type="button"
            onClick={() => fotoInputRef.current?.click()}
            disabled={uploadando !== null}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--line)] px-2.5 text-xs font-semibold text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)] disabled:opacity-60"
          >
            {uploadando === 'FOTO' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Adicionar fotos
          </button>
          <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { void subir(e.target.files, 'FOTO'); if (fotoInputRef.current) fotoInputRef.current.value = '' }} />
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--ink-faint)]"><Loader2 className="h-3 w-3 animate-spin" /> Carregando…</div>
        ) : fotos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--ink-faint)]">Nenhuma foto ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map(a => (
              <div key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]">
                <button type="button" onClick={() => setViewingIdx(anexos.indexOf(a))} className="absolute inset-0 cursor-pointer" aria-label={`Abrir ${a.file_name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.file_name} className="h-full w-full object-cover" loading="lazy" />
                </button>
                <button type="button" onClick={() => remover(a)} aria-label="Remover foto"
                  className="absolute right-1 top-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100">
                  <XIcon className="h-3 w-3" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DOCUMENTOS */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Documentos</span>
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={uploadando !== null}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--line)] px-2.5 text-xs font-semibold text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)] disabled:opacity-60"
          >
            {uploadando === 'DOCUMENTO' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
            Adicionar documentos
          </button>
          <input ref={docInputRef} type="file" accept="application/pdf,.xlsx,.xls,.doc,.docx,image/*" multiple className="hidden"
            onChange={e => { void subir(e.target.files, 'DOCUMENTO'); if (docInputRef.current) docInputRef.current.value = '' }} />
        </div>
        {!loading && docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--ink-faint)]">Nenhum documento ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {docs.map(a => {
              const size = formatSize(a.size_bytes)
              return (
                <li key={a.id} className="group flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--paper)] text-[var(--ink-soft)]"><FileText className="h-3.5 w-3.5" /></span>
                  <button type="button" onClick={() => setViewingIdx(anexos.indexOf(a))} className="min-w-0 flex-1 truncate text-left text-xs text-[var(--ink)] hover:underline">{a.file_name}</button>
                  {size && <span className="shrink-0 text-[10px] tabular-nums text-[var(--ink-faint)]">{size}</span>}
                  <button type="button" onClick={() => remover(a)} aria-label="Remover documento"
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Visualizador com navegação entre todos os anexos */}
      <Dialog open={viewingIdx != null} onOpenChange={v => { if (!v) setViewingIdx(null) }}>
        <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl">
          {viewingIdx != null && anexos[viewingIdx] && (() => {
            const atual = anexos[viewingIdx]
            const tipo = tipoView(atual)
            const multiplos = anexos.length > 1
            return (
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper)]/40 py-2.5 pl-4 pr-12">
                  <h3 className="truncate font-display text-sm font-semibold text-[var(--ink)]">
                    {atual.file_name}
                    {multiplos && <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">{viewingIdx + 1}/{anexos.length}</span>}
                  </h3>
                  <a href={atual.url} download={atual.file_name} target="_blank" rel="noopener"
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brand-bright)]/40">
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </a>
                </div>
                <div className="relative grid place-items-center bg-black/95 p-4">
                  {tipo === 'img' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={atual.url} alt={atual.file_name} className="max-h-[75vh] max-w-full object-contain" />
                  )}
                  {tipo === 'pdf' && (
                    <iframe src={atual.url} title={atual.file_name} className="h-[75vh] w-full bg-white" />
                  )}
                  {tipo === 'outro' && (
                    <div className="grid h-[40vh] place-items-center text-center text-white/80">
                      <div>
                        <FileText className="mx-auto h-10 w-10 opacity-60" />
                        <p className="mt-3 text-sm">Pré-visualização não disponível</p>
                        <a href={atual.url} download={atual.file_name} target="_blank" rel="noopener"
                          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]">
                          <Download className="h-3.5 w-3.5" /> Baixar arquivo
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Setas de navegação */}
                  {multiplos && (
                    <>
                      <button type="button" onClick={() => navView(-1)} aria-label="Anterior"
                        className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={() => navView(1)} aria-label="Próximo"
                        className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Indicador compacto pro card (ex.: 3 fotos · 2 arquivos). */
export function AnexosResumo({ anexos }: { anexos?: { id: string; file_type: string }[] }) {
  if (!anexos?.length) return null
  const fotos = anexos.filter(a => a.file_type === 'FOTO').length
  const docs = anexos.length - fotos
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-[var(--ink-faint)]">
      {fotos > 0 && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3 w-3" />{fotos}</span>}
      {docs > 0 && <span className="inline-flex items-center gap-0.5"><FileText className="h-3 w-3" />{docs}</span>}
    </span>
  )
}
