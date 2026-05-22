-- ============================================================
-- MIGRAÇÃO 0002 — Alinhar schema ao banco Neon (Prisma)
--
-- Esta migração prepara o Supabase para receber os dados
-- exportados do Neon (banco antigo, gerado por Prisma).
--
-- O que muda:
--   1. IDs de UUID → TEXT (preserva os cuids do Neon)
--   2. `updated_at` adicionado em `etapas_funil` e `whatsapp_contacts`
--   3. Trigger genérico de auto-update em `updated_at`
--   4. `lead_distribuicao.data` vira TIMESTAMPTZ (Neon usa timestamp)
--   5. UNIQUE de `lead_distribuicao(vendedor_id, data)` removido
--      (Neon não tem; possíveis duplicatas serão preservadas)
--   6. `current_vendedor_id()` retorna TEXT em vez de UUID
--
-- Idempotente: pode rodar várias vezes sem erro.
-- ============================================================

-- ─── 0. DROP de policies que referenciam vendedor_id ──────
-- (impedem ALTER COLUMN TYPE). Recriadas no final.
DROP POLICY IF EXISTS "Vendedor vê seus clientes" ON public.clientes;
DROP POLICY IF EXISTS "Vendedor edita seus clientes" ON public.clientes;
DROP POLICY IF EXISTS "Vendedor insere clientes" ON public.clientes;

-- ─── 1. DROP de FKs que apontam para colunas UUID ──────────
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_vendedor_id_fkey;

ALTER TABLE public.lead_distribuicao
  DROP CONSTRAINT IF EXISTS lead_distribuicao_vendedor_id_fkey;

-- ─── 2. Converter IDs de UUID para TEXT ────────────────────
-- vendedores.id
ALTER TABLE public.vendedores
  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.vendedores
  ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.vendedores
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- clientes.id e clientes.vendedor_id
ALTER TABLE public.clientes
  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.clientes
  ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.clientes
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.clientes
  ALTER COLUMN vendedor_id TYPE TEXT USING vendedor_id::text;

-- etapas_funil.id
ALTER TABLE public.etapas_funil
  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.etapas_funil
  ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.etapas_funil
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- lead_distribuicao.id e .vendedor_id
ALTER TABLE public.lead_distribuicao
  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.lead_distribuicao
  ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.lead_distribuicao
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.lead_distribuicao
  ALTER COLUMN vendedor_id TYPE TEXT USING vendedor_id::text;

-- whatsapp_contacts.id
ALTER TABLE public.whatsapp_contacts
  ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.whatsapp_contacts
  ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.whatsapp_contacts
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- profiles.vendedor_id (continua sem FK explícita, mas o tipo precisa bater)
ALTER TABLE public.profiles
  ALTER COLUMN vendedor_id TYPE TEXT USING vendedor_id::text;

-- ─── 3. Reaplicar FKs com TEXT ─────────────────────────────
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;

ALTER TABLE public.lead_distribuicao
  ADD CONSTRAINT lead_distribuicao_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE CASCADE;

-- ─── 4. Adicionar updated_at onde falta ────────────────────
ALTER TABLE public.etapas_funil
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.lead_distribuicao
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── 5. lead_distribuicao.data → TIMESTAMPTZ ───────────────
ALTER TABLE public.lead_distribuicao
  ALTER COLUMN data TYPE TIMESTAMPTZ USING data::timestamptz;
ALTER TABLE public.lead_distribuicao
  ALTER COLUMN data SET DEFAULT now();

-- ─── 6. Remover UNIQUE (vendedor_id, data) ─────────────────
-- Neon não tem; possíveis duplicatas no dump precisam entrar.
-- Se quiser reativar depois de validar os dados, basta:
--   ALTER TABLE public.lead_distribuicao
--     ADD CONSTRAINT lead_distribuicao_vendedor_id_data_key UNIQUE (vendedor_id, data);
ALTER TABLE public.lead_distribuicao
  DROP CONSTRAINT IF EXISTS lead_distribuicao_vendedor_id_data_key;

-- ─── 7. Trigger genérico de updated_at ─────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendedores_set_updated_at ON public.vendedores;
CREATE TRIGGER vendedores_set_updated_at
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS clientes_set_updated_at ON public.clientes;
CREATE TRIGGER clientes_set_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS etapas_funil_set_updated_at ON public.etapas_funil;
CREATE TRIGGER etapas_funil_set_updated_at
  BEFORE UPDATE ON public.etapas_funil
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS lead_distribuicao_set_updated_at ON public.lead_distribuicao;
CREATE TRIGGER lead_distribuicao_set_updated_at
  BEFORE UPDATE ON public.lead_distribuicao
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS whatsapp_contacts_set_updated_at ON public.whatsapp_contacts;
CREATE TRIGGER whatsapp_contacts_set_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 8. current_vendedor_id() retorna TEXT ─────────────────
-- Precisa de DROP explícito: CREATE OR REPLACE não muda tipo de retorno.
DROP FUNCTION IF EXISTS public.current_vendedor_id();
CREATE FUNCTION public.current_vendedor_id()
RETURNS TEXT AS $$
  SELECT vendedor_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── 8b. handle_new_user(): v_id agora é TEXT ──────────────
-- O trigger original declarava v_id UUID; após migrar vendedores.id para TEXT,
-- o SELECT cuid INTO v_id falha. Atualizando.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_id TEXT;
BEGIN
  SELECT id INTO v_id
  FROM public.vendedores
  WHERE lower(email) = lower(new.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, nome, role, vendedor_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'VENDEDOR',
    v_id
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 9. Recriar policies de RLS em clientes ────────────────
-- (foram dropadas na seção 0 para permitir ALTER COLUMN TYPE)
CREATE POLICY "Vendedor vê seus clientes" ON public.clientes
  FOR SELECT USING (
    public.current_user_role() = 'VENDEDOR'
    AND vendedor_id = public.current_vendedor_id()
  );

CREATE POLICY "Vendedor edita seus clientes" ON public.clientes
  FOR UPDATE USING (
    public.current_user_role() = 'VENDEDOR'
    AND vendedor_id = public.current_vendedor_id()
  );

CREATE POLICY "Vendedor insere clientes" ON public.clientes
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'VENDEDOR'
    AND vendedor_id = public.current_vendedor_id()
    OR public.current_user_role() = 'ADMIN'
  );
