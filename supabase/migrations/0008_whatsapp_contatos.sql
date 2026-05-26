-- ============================================================
-- MIGRAÇÃO 0008 — Contatos do WhatsApp pra envio de relatórios
--
-- Tabela compartilhada entre usuários ADMIN com COMPRAS. Permite
-- cadastrar contatos (nome + número) reutilizáveis pra envio de
-- relatórios de cotação via WhatsApp Web sem precisar redigitar
-- o número toda vez.
--
-- O número é armazenado normalizado (só dígitos, com DDD e country
-- code se BR — ex: 5561991731449). A normalização acontece na
-- server action.
--
-- RLS: igual cotações — ADMIN gerencia, COMPRAS lê.
--
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_contatos (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome        TEXT NOT NULL,
  numero      TEXT NOT NULL,
  criado_por  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero)
);

CREATE INDEX IF NOT EXISTS whatsapp_contatos_nome_idx ON public.whatsapp_contatos(nome);

DROP TRIGGER IF EXISTS whatsapp_contatos_set_updated_at ON public.whatsapp_contatos;
CREATE TRIGGER whatsapp_contatos_set_updated_at
  BEFORE UPDATE ON public.whatsapp_contatos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia whatsapp_contatos" ON public.whatsapp_contatos;
CREATE POLICY "Admin gerencia whatsapp_contatos" ON public.whatsapp_contatos
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "COMPRAS lê whatsapp_contatos" ON public.whatsapp_contatos;
CREATE POLICY "COMPRAS lê whatsapp_contatos" ON public.whatsapp_contatos
  FOR SELECT USING (public.user_has_module('COMPRAS'));
