'use client'

import { createClient } from '@/lib/supabase'

/**
 * Upload direto do browser pro Supabase Storage via signed upload URL.
 *
 * Por que não passar pela server action: arquivos grandes (vídeo 100MB)
 * trafegariam browser → função Vercel → Supabase, consumindo duração de
 * função e batendo limite de body. Com signed URL o byte vai direto do
 * browser pro storage; a função só assina a permissão (alguns bytes).
 *
 * Fluxo: server gera { path, token } → este helper sobe → server registra
 * o metadata na tabela.
 */
export async function uploadToSignedUrl(
  bucket: string,
  path: string,
  token: string,
  file: File,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || 'application/octet-stream',
    })
  if (error) throw new Error(`Falha no upload: ${error.message}`)
}

export function fileTypeManutencaoFromMime(
  mime: string,
): 'FOTO_DEPOIS' | 'OUTRO' | 'DOCUMENTO' {
  if (mime.startsWith('image/')) return 'FOTO_DEPOIS'
  if (mime.startsWith('video/')) return 'OUTRO'
  return 'DOCUMENTO'
}

export function fileTypeOrdemFromMime(
  mime: string,
): 'FOTO' | 'VIDEO' | 'DOCUMENTO' | 'OUTRO' {
  if (mime.startsWith('image/')) return 'FOTO'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime === 'application/pdf') return 'DOCUMENTO'
  return 'OUTRO'
}

export function fileTypeImovelFromMime(
  mime: string,
): 'FOTO' | 'DOCUMENTO' | 'OUTRO' {
  if (mime.startsWith('image/')) return 'FOTO'
  if (mime === 'application/pdf' || mime.includes('spreadsheet') || mime.includes('ms-excel')) return 'DOCUMENTO'
  return 'OUTRO'
}
