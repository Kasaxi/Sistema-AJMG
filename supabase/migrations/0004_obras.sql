-- ============================================================
-- MIGRAÇÃO 0004 — Tabela `obras` (cadastro enxuto)
--
-- Cadastro central de obras/empreendimentos da construtora.
-- Existe agora pra resolver FK de outros módulos (Agenda usa
-- obra_id; Compras vai usar; RH/Financeiro também).
--
-- Sem UI nesta fase — apenas tabela + RLS. UI vem na Fase 2
-- depois da Agenda.
--
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.obras (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome                  TEXT NOT NULL,
  endereco              TEXT,
  cidade                TEXT,
  status                TEXT NOT NULL DEFAULT 'PLANEJAMENTO'
                          CHECK (status IN ('PLANEJAMENTO','EM_ANDAMENTO','PAUSADA','CONCLUIDA')),
  data_inicio           DATE,
  data_previsao_entrega DATE,
  orcamento_previsto    NUMERIC(14,2),
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obras_status_idx ON public.obras(status);
CREATE INDEX IF NOT EXISTS obras_nome_idx ON public.obras USING GIN (to_tsvector('portuguese', nome));

-- Trigger de updated_at
DROP TRIGGER IF EXISTS obras_set_updated_at ON public.obras;
CREATE TRIGGER obras_set_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- ADMIN faz tudo
DROP POLICY IF EXISTS "Admin gerencia obras" ON public.obras;
CREATE POLICY "Admin gerencia obras" ON public.obras
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- COLABORADOR com acesso a 'OBRAS' lê
-- (escrita ficará pra quando UI existir; por enquanto só Admin escreve)
DROP POLICY IF EXISTS "Colaborador com acesso OBRAS lê obras" ON public.obras;
CREATE POLICY "Colaborador com acesso OBRAS lê obras" ON public.obras
  FOR SELECT USING (public.user_has_module('OBRAS'));
