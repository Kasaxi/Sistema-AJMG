-- ============================================================
-- MIGRAÇÃO 0011 — Itens da Manutenção (várias situações por O.S.)
--
-- Uma manutenção passa a ter:
--   • problema (texto livre, opcional — resumo geral)
--   • manutencao_itens (lista de situações específicas, cada uma
--     com descrição, status próprio e anexos próprios)
--
-- `manutencao_anexos` ganha `item_id` opcional — anexo pode ser
-- de um item específico (foto da torneira) ou geral da manutenção
-- (foto da fachada).
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. Problema vira opcional
-- ============================================================
ALTER TABLE public.manutencoes
  ALTER COLUMN problema DROP NOT NULL;

-- ============================================================
-- 2. manutencao_itens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manutencao_itens (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  manutencao_id  TEXT NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  descricao      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDENTE'
                   CHECK (status IN ('PENDENTE','RESOLVIDO')),
  observacoes    TEXT,
  ordem          INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manutencao_itens_manutencao_idx
  ON public.manutencao_itens(manutencao_id, ordem);
CREATE INDEX IF NOT EXISTS manutencao_itens_status_idx
  ON public.manutencao_itens(status);

DROP TRIGGER IF EXISTS manutencao_itens_set_updated_at ON public.manutencao_itens;
CREATE TRIGGER manutencao_itens_set_updated_at
  BEFORE UPDATE ON public.manutencao_itens
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 3. manutencao_anexos ganha item_id (opcional)
-- ============================================================
ALTER TABLE public.manutencao_anexos
  ADD COLUMN IF NOT EXISTS item_id TEXT
  REFERENCES public.manutencao_itens(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS manutencao_anexos_item_idx
  ON public.manutencao_anexos(item_id);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.manutencao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia manutencao_itens" ON public.manutencao_itens;
CREATE POLICY "Admin gerencia manutencao_itens" ON public.manutencao_itens
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "MANUTENCAO gerencia manutencao_itens" ON public.manutencao_itens;
CREATE POLICY "MANUTENCAO gerencia manutencao_itens" ON public.manutencao_itens
  FOR ALL USING (public.user_has_module('MANUTENCAO'));
