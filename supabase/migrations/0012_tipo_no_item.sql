-- ============================================================
-- MIGRAÇÃO 0012 — Tipo por item; remove problema/tipo da manutenção
--
-- Reorganização proposta pelo uso real:
--   • Cada item de manutenção ganha tipo próprio (uma O.S. pode
--     ter "torneira pingando" → Hidráulica e "luz queimada" →
--     Elétrica simultaneamente).
--   • `manutencoes.problema` (resumo geral) sai — itens fazem isso.
--   • `manutencoes.tipo_id` sai — vai pro item.
--
-- ⚠ ATENÇÃO: DROP COLUMN é destrutivo. Se há dados nesses campos
--    que você queira preservar, faça backup antes.
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. Adiciona tipo_id no item
-- ============================================================
ALTER TABLE public.manutencao_itens
  ADD COLUMN IF NOT EXISTS tipo_id TEXT
  REFERENCES public.tipos_manutencao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS manutencao_itens_tipo_idx
  ON public.manutencao_itens(tipo_id);

-- ============================================================
-- 2. Remove problema e tipo da manutenção
-- ============================================================
-- Solta o índice de tipo_id antes do DROP COLUMN
DROP INDEX IF EXISTS public.manutencoes_tipo_idx;

ALTER TABLE public.manutencoes DROP COLUMN IF EXISTS tipo_id;
ALTER TABLE public.manutencoes DROP COLUMN IF EXISTS problema;
