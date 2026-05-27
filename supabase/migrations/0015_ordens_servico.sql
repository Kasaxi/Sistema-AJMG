-- ============================================================
-- MIGRAÇÃO 0015 — Ordens de serviço (solicitações públicas)
--
-- Tabela separada `ordens_servico` pra solicitações que chegam
-- de fora do sistema: form público anônimo OU portal do cliente
-- com token. Quando ADMIN/MANUTENCAO aceita, gera uma manutenção
-- vinculada (manutencao_id) e fluxo segue normal.
--
-- Por que separado de `manutencoes`:
--   • Solicitação pode vir incompleta (sem responsável, sem data)
--   • Pode ser recusada antes de virar trabalho
--   • Origem precisa ser auditável
--   • RLS público (anon INSERT) sem comprometer manutencoes
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. Token público no cliente pós-venda (portal privado)
-- ============================================================
ALTER TABLE public.clientes_pos_venda
  ADD COLUMN IF NOT EXISTS token UUID UNIQUE DEFAULT gen_random_uuid();

-- Backfill de clientes existentes que ainda não têm token
UPDATE public.clientes_pos_venda
  SET token = gen_random_uuid()
  WHERE token IS NULL;

ALTER TABLE public.clientes_pos_venda
  ALTER COLUMN token SET NOT NULL;

-- ============================================================
-- 2. Tabela ordens_servico
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Identificação do solicitante
  cliente_id        TEXT REFERENCES public.clientes_pos_venda(id) ON DELETE SET NULL,
  nome_solicitante  TEXT NOT NULL,
  telefone          TEXT,
  email             TEXT,
  cpf_cnpj          TEXT,
  endereco          TEXT,

  -- Descrição do problema
  descricao         TEXT NOT NULL,

  -- Status do fluxo de aceitação
  status            TEXT NOT NULL DEFAULT 'PENDENTE'
                      CHECK (status IN ('PENDENTE','ACEITA','RECUSADA')),

  -- Vínculo com manutenção quando aceita
  manutencao_id     TEXT REFERENCES public.manutencoes(id) ON DELETE SET NULL,

  -- Origem (auditoria — saber se veio do portal ou form público aberto)
  origem            TEXT NOT NULL DEFAULT 'PUBLICA'
                      CHECK (origem IN ('PORTAL','PUBLICA')),

  -- Auditoria de decisão
  motivo_recusa     TEXT,
  decidida_em       TIMESTAMPTZ,
  decidida_por      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ordens_servico_status_idx     ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS ordens_servico_cliente_idx    ON public.ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS ordens_servico_created_idx    ON public.ordens_servico(created_at DESC);
CREATE INDEX IF NOT EXISTS ordens_servico_manutencao_idx ON public.ordens_servico(manutencao_id);

DROP TRIGGER IF EXISTS ordens_servico_set_updated_at ON public.ordens_servico;
CREATE TRIGGER ordens_servico_set_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 3. Anexos da ordem (fotos/vídeos enviados pelo cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ordem_servico_anexos (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ordem_id        TEXT NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL DEFAULT 'OUTRO'
                    CHECK (file_type IN ('FOTO','VIDEO','DOCUMENTO','OUTRO')),
  size_bytes      INTEGER,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ordem_servico_anexos_ordem_idx
  ON public.ordem_servico_anexos(ordem_id);

-- ============================================================
-- 4. RLS — ordens_servico
-- ============================================================
-- Cliente anônimo só pode INSERT (criar solicitação). Quem aceita/recusa
-- precisa de auth + acesso ao módulo. Aplica-se também ao SELECT pelo
-- próprio portal — fluxo público usa service_role no server.
ALTER TABLE public.ordens_servico        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_servico_anexos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia ordens_servico" ON public.ordens_servico;
CREATE POLICY "Admin gerencia ordens_servico" ON public.ordens_servico
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "MANUTENCAO gerencia ordens_servico" ON public.ordens_servico;
CREATE POLICY "MANUTENCAO gerencia ordens_servico" ON public.ordens_servico
  FOR ALL USING (public.user_has_module('MANUTENCAO'));

DROP POLICY IF EXISTS "Admin gerencia ordem_servico_anexos" ON public.ordem_servico_anexos;
CREATE POLICY "Admin gerencia ordem_servico_anexos" ON public.ordem_servico_anexos
  FOR ALL USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "MANUTENCAO gerencia ordem_servico_anexos" ON public.ordem_servico_anexos;
CREATE POLICY "MANUTENCAO gerencia ordem_servico_anexos" ON public.ordem_servico_anexos
  FOR ALL USING (public.user_has_module('MANUTENCAO'));

-- ============================================================
-- 5. Storage bucket pros anexos da O.S.
-- ============================================================
-- Privado: anon faz upload via service_role (server action), nunca lê
-- de volta. ADMIN/MANUTENCAO lê pelo painel interno.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ordem-servico-anexos',
  'ordem-servico-anexos',
  false,
  104857600,  -- 100 MB (cabe vídeo curto)
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies de leitura (ADMIN/MANUTENCAO). Write é via service_role server-side.
DROP POLICY IF EXISTS "Admin lê ordem-servico-anexos" ON storage.objects;
CREATE POLICY "Admin lê ordem-servico-anexos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ordem-servico-anexos'
    AND public.current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "MANUTENCAO lê ordem-servico-anexos" ON storage.objects;
CREATE POLICY "MANUTENCAO lê ordem-servico-anexos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ordem-servico-anexos'
    AND public.user_has_module('MANUTENCAO')
  );

-- Delete (caso a O.S. seja recusada e admin queira limpar)
DROP POLICY IF EXISTS "Admin remove ordem-servico-anexos" ON storage.objects;
CREATE POLICY "Admin remove ordem-servico-anexos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ordem-servico-anexos'
    AND public.current_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "MANUTENCAO remove ordem-servico-anexos" ON storage.objects;
CREATE POLICY "MANUTENCAO remove ordem-servico-anexos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ordem-servico-anexos'
    AND public.user_has_module('MANUTENCAO')
  );
