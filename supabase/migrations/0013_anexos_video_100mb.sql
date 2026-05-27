-- ============================================================
-- MIGRAÇÃO 0013 — Anexos de manutenção: 100 MB + vídeos
--
-- Vídeos curtos de celular pesam 50-80 MB. O bucket inicial em
-- 20 MB era suficiente pra fotos/PDF mas não cabe vídeo.
--
-- Sobe limite pra 100 MB e libera mime types de vídeo.
--
-- Idempotente.
-- ============================================================

UPDATE storage.buckets
SET
  file_size_limit = 104857600,  -- 100 MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    -- Vídeo (cobre formatos comuns de iPhone/Android)
    'video/mp4',
    'video/quicktime',   -- .mov (iPhone)
    'video/webm',
    'video/x-matroska'   -- .mkv
  ]
WHERE id = 'manutencao-anexos';
