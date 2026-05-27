-- ============================================================
-- MIGRAÇÃO 0014 — Policies de WRITE no bucket manutencao-anexos
--
-- A 0010 só criou policy de SELECT em storage.objects pro bucket
-- `manutencao-anexos`. Como storage.objects tem RLS habilitada,
-- INSERT/UPDATE/DELETE ficavam bloqueados — upload de foto/vídeo
-- por item (ou geral) falhava silenciosamente com permission denied.
--
-- Aqui adicionamos as policies que faltavam, no mesmo padrão usado
-- nas outras (ADMIN faz tudo; MANUTENCAO faz tudo no bucket).
--
-- Idempotente.
-- ============================================================

-- INSERT (upload)
DROP POLICY IF EXISTS "Admin envia manutencao-anexos" ON storage.objects;
CREATE POLICY "Admin envia manutencao-anexos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'manutencao-anexos'
    AND public.current_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "MANUTENCAO envia manutencao-anexos" ON storage.objects;
CREATE POLICY "MANUTENCAO envia manutencao-anexos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'manutencao-anexos'
    AND public.user_has_module('MANUTENCAO')
  );

-- UPDATE (raro, mas garante upsert/metadados)
DROP POLICY IF EXISTS "Admin atualiza manutencao-anexos" ON storage.objects;
CREATE POLICY "Admin atualiza manutencao-anexos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'manutencao-anexos'
    AND public.current_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "MANUTENCAO atualiza manutencao-anexos" ON storage.objects;
CREATE POLICY "MANUTENCAO atualiza manutencao-anexos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'manutencao-anexos'
    AND public.user_has_module('MANUTENCAO')
  );

-- DELETE (remoção de anexo)
DROP POLICY IF EXISTS "Admin remove manutencao-anexos" ON storage.objects;
CREATE POLICY "Admin remove manutencao-anexos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'manutencao-anexos'
    AND public.current_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "MANUTENCAO remove manutencao-anexos" ON storage.objects;
CREATE POLICY "MANUTENCAO remove manutencao-anexos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'manutencao-anexos'
    AND public.user_has_module('MANUTENCAO')
  );
