-- ============================================================
-- MIGRAÇÃO 0010 — Módulo Manutenções
--
-- Tabelas:
--   tipos_manutencao        — taxonomia (hidráulica, elétrica, etc)
--   clientes_pos_venda      — proprietários dos imóveis (independente
--                             do CRM clientes — será usado por
--                             Manutenção AGORA e Cobrança DEPOIS)
--   manutencoes             — registro da intervenção
--   manutencao_anexos       — fotos/docs (bucket próprio)
--   gastos (ALTER)          — adiciona manutencao_id + CHECK XOR
--                             obra_id ⊕ manutencao_id
--
-- Permissão: role 'MANUTENCAO' em profiles.acesso_modulos.
-- Omar (omar@ajmgconstrutora.com.br) ganha automaticamente.
--
-- Idempotente.
-- ============================================================

-- ============================================================
-- 1. tipos_manutencao
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tipos_manutencao (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome        TEXT UNIQUE NOT NULL,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tipos_manutencao_set_updated_at ON public.tipos_manutencao;
CREATE TRIGGER tipos_manutencao_set_updated_at
  BEFORE UPDATE ON public.tipos_manutencao
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.tipos_manutencao (nome, ordem) VALUES
  ('Hidráulica',     1),
  ('Elétrica',       2),
  ('Pintura',        3),
  ('Marcenaria',     4),
  ('Estrutura',      5),
  ('Vidraçaria',     6),
  ('Telhado',        7),
  ('Pisos',          8),
  ('Esquadrias',     9),
  ('Outros',        99)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- 2. clientes_pos_venda — proprietários dos imóveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes_pos_venda (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome          TEXT NOT NULL,
  telefone      TEXT,
  email         TEXT,
  cpf_cnpj      TEXT,
  observacoes   TEXT,
  criado_por    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_pv_nome_idx
  ON public.clientes_pos_venda USING GIN (to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS clientes_pv_telefone_idx
  ON public.clientes_pos_venda(telefone);

DROP TRIGGER IF EXISTS clientes_pv_set_updated_at ON public.clientes_pos_venda;
CREATE TRIGGER clientes_pv_set_updated_at
  BEFORE UPDATE ON public.clientes_pos_venda
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 3. manutencoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manutencoes (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id        TEXT REFERENCES public.clientes_pos_venda(id) ON DELETE SET NULL,
  tipo_id           TEXT REFERENCES public.tipos_manutencao(id) ON DELETE SET NULL,
  endereco          TEXT,
  status            TEXT NOT NULL DEFAULT 'AGENDADA'
                      CHECK (status IN ('AGENDADA','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
  problema          TEXT NOT NULL,
  data_agendada     DATE,
  hora_inicio       TIME,
  data_concluida    DATE,
  responsavel_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes       TEXT,
  agenda_item_id    TEXT REFERENCES public.agenda_itens(id) ON DELETE SET NULL,
  criado_por        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manutencoes_cliente_idx       ON public.manutencoes(cliente_id);
CREATE INDEX IF NOT EXISTS manutencoes_tipo_idx          ON public.manutencoes(tipo_id);
CREATE INDEX IF NOT EXISTS manutencoes_responsavel_idx   ON public.manutencoes(responsavel_id);
CREATE INDEX IF NOT EXISTS manutencoes_status_idx        ON public.manutencoes(status);
CREATE INDEX IF NOT EXISTS manutencoes_data_agendada_idx ON public.manutencoes(data_agendada DESC);

DROP TRIGGER IF EXISTS manutencoes_set_updated_at ON public.manutencoes;
CREATE TRIGGER manutencoes_set_updated_at
  BEFORE UPDATE ON public.manutencoes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- 4. manutencao_anexos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manutencao_anexos (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  manutencao_id   TEXT NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL DEFAULT 'OUTRO'
                    CHECK (file_type IN ('FOTO_ANTES','FOTO_DEPOIS','NOTA_FISCAL','DOCUMENTO','OUTRO')),
  legenda         TEXT,
  size_bytes      INTEGER,
  uploaded_por    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manutencao_anexos_manutencao_idx
  ON public.manutencao_anexos(manutencao_id);

-- ============================================================
-- 5. gastos — adiciona manutencao_id + CHECK XOR
-- ============================================================
-- Permite obra_id NULL (gastos de manutenção têm obra_id=NULL)
ALTER TABLE public.gastos ALTER COLUMN obra_id DROP NOT NULL;

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS manutencao_id TEXT
  REFERENCES public.manutencoes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS gastos_manutencao_idx ON public.gastos(manutencao_id);

-- XOR: exatamente um entre obra_id e manutencao_id está preenchido.
-- Cada gasto pertence a um contexto único — separação garantida no DB.
ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_contexto_xor;
ALTER TABLE public.gastos ADD CONSTRAINT gastos_contexto_xor CHECK (
  (obra_id IS NOT NULL AND manutencao_id IS NULL) OR
  (obra_id IS NULL AND manutencao_id IS NOT NULL)
);

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE public.tipos_manutencao    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_pos_venda  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencao_anexos   ENABLE ROW LEVEL SECURITY;

-- tipos_manutencao: ADMIN gerencia; quem tem MANUTENCAO lê.
DROP POLICY IF EXISTS "Admin gerencia tipos_manutencao" ON public.tipos_manutencao;
CREATE POLICY "Admin gerencia tipos_manutencao" ON public.tipos_manutencao
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "MANUTENCAO lê tipos_manutencao" ON public.tipos_manutencao;
CREATE POLICY "MANUTENCAO lê tipos_manutencao" ON public.tipos_manutencao
  FOR SELECT USING (public.user_has_module('MANUTENCAO'));

-- clientes_pos_venda: ADMIN gerencia; MANUTENCAO lê.
-- (Quando Cobrança vier, adiciona policy COBRANCA aqui também.)
DROP POLICY IF EXISTS "Admin gerencia clientes_pv" ON public.clientes_pos_venda;
CREATE POLICY "Admin gerencia clientes_pv" ON public.clientes_pos_venda
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "MANUTENCAO lê clientes_pv" ON public.clientes_pos_venda;
CREATE POLICY "MANUTENCAO lê clientes_pv" ON public.clientes_pos_venda
  FOR SELECT USING (public.user_has_module('MANUTENCAO'));
DROP POLICY IF EXISTS "MANUTENCAO cria clientes_pv" ON public.clientes_pos_venda;
CREATE POLICY "MANUTENCAO cria clientes_pv" ON public.clientes_pos_venda
  FOR INSERT WITH CHECK (public.user_has_module('MANUTENCAO'));
DROP POLICY IF EXISTS "MANUTENCAO atualiza clientes_pv" ON public.clientes_pos_venda;
CREATE POLICY "MANUTENCAO atualiza clientes_pv" ON public.clientes_pos_venda
  FOR UPDATE USING (public.user_has_module('MANUTENCAO'));

-- manutencoes: ADMIN faz tudo; MANUTENCAO lê + cria + atualiza.
DROP POLICY IF EXISTS "Admin gerencia manutencoes" ON public.manutencoes;
CREATE POLICY "Admin gerencia manutencoes" ON public.manutencoes
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "MANUTENCAO lê manutencoes" ON public.manutencoes;
CREATE POLICY "MANUTENCAO lê manutencoes" ON public.manutencoes
  FOR SELECT USING (public.user_has_module('MANUTENCAO'));
DROP POLICY IF EXISTS "MANUTENCAO cria manutencoes" ON public.manutencoes;
CREATE POLICY "MANUTENCAO cria manutencoes" ON public.manutencoes
  FOR INSERT WITH CHECK (public.user_has_module('MANUTENCAO'));
DROP POLICY IF EXISTS "MANUTENCAO atualiza manutencoes" ON public.manutencoes;
CREATE POLICY "MANUTENCAO atualiza manutencoes" ON public.manutencoes
  FOR UPDATE USING (public.user_has_module('MANUTENCAO'));

-- manutencao_anexos: ADMIN faz tudo; MANUTENCAO faz tudo nos próprios anexos.
DROP POLICY IF EXISTS "Admin gerencia manutencao_anexos" ON public.manutencao_anexos;
CREATE POLICY "Admin gerencia manutencao_anexos" ON public.manutencao_anexos
  FOR ALL USING (public.current_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "MANUTENCAO gerencia manutencao_anexos" ON public.manutencao_anexos;
CREATE POLICY "MANUTENCAO gerencia manutencao_anexos" ON public.manutencao_anexos
  FOR ALL USING (public.user_has_module('MANUTENCAO'));

-- ============================================================
-- 7. Storage bucket pros anexos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'manutencao-anexos',
  'manutencao-anexos',
  false,
  20971520,  -- 20 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admin lê manutencao-anexos" ON storage.objects;
CREATE POLICY "Admin lê manutencao-anexos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'manutencao-anexos'
    AND public.current_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "MANUTENCAO lê manutencao-anexos" ON storage.objects;
CREATE POLICY "MANUTENCAO lê manutencao-anexos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'manutencao-anexos'
    AND public.user_has_module('MANUTENCAO')
  );

-- ============================================================
-- 8. Permissões
-- ============================================================
-- Por decisão de produto, o módulo MANUTENCAO não tem grant automático.
-- O admin libera o módulo pra cada usuário que for atuar (incluindo a
-- conta dedicada "Manutenção" que será criada via Supabase Dashboard).
