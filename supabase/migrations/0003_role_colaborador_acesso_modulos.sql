-- ============================================================
-- MIGRAÇÃO 0003 — Role COLABORADOR + acesso a módulos
--
-- Adiciona o terceiro role `COLABORADOR` em profiles, com
-- controle granular de quais módulos esse usuário pode ver.
--
-- Quem precisa disso AGORA:
--   - Omar: role=COLABORADOR, acesso_modulos=['AGENDA']
--   - Wesley: continua role=ADMIN (campo será ignorado)
--
-- Idempotente.
-- ============================================================

-- ─── 1. Expandir CHECK de profiles.role ───────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('ADMIN', 'VENDEDOR', 'COLABORADOR'));

-- ─── 2. Novas colunas em profiles ─────────────────────────────
-- acesso_modulos: lista de módulos que COLABORADOR pode acessar.
-- Valores válidos: 'AGENDA','OBRAS','COMPRAS','RH','FINANCEIRO','COBRANCA'
-- Ignorado para ADMIN e VENDEDOR.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acesso_modulos TEXT[] NOT NULL DEFAULT '{}';

-- ativo: permite "desligar" um usuário sem deletar (preserva FKs).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- updated_at: profiles ainda não tinha, mas agora é editável (acesso_modulos muda).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 3. Helper: usuário tem acesso a um módulo? ───────────────
-- Regras:
--   ADMIN       → sempre true
--   VENDEDOR    → só 'VENDAS'
--   COLABORADOR → módulo precisa estar em acesso_modulos
--   (não autenticado / sem perfil → false)
CREATE OR REPLACE FUNCTION public.user_has_module(modulo TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_acesso TEXT[];
  v_ativo BOOLEAN;
BEGIN
  SELECT role, acesso_modulos, ativo
    INTO v_role, v_acesso, v_ativo
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_role IS NULL OR v_ativo IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'ADMIN' THEN
    RETURN TRUE;
  END IF;

  IF v_role = 'VENDEDOR' THEN
    RETURN modulo = 'VENDAS';
  END IF;

  -- COLABORADOR
  RETURN modulo = ANY(v_acesso);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 4. handle_new_user(): default vira COLABORADOR sem módulos ─
-- Antes: novo usuário vinha como VENDEDOR. Agora, se NÃO há vendedor
-- com email correspondente, vira COLABORADOR (sem acesso) — Admin
-- ajusta depois. Mantém o comportamento de "vincular ao vendedor"
-- quando o email bate.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_id TEXT;
  v_role TEXT;
BEGIN
  SELECT id INTO v_id
    FROM public.vendedores
   WHERE lower(email) = lower(new.email)
   LIMIT 1;

  v_role := CASE WHEN v_id IS NOT NULL THEN 'VENDEDOR' ELSE 'COLABORADOR' END;

  INSERT INTO public.profiles (id, nome, role, vendedor_id, acesso_modulos)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    v_role,
    v_id,
    '{}'::TEXT[]
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Índice em acesso_modulos (GIN para ANY/contains) ──────
CREATE INDEX IF NOT EXISTS profiles_acesso_modulos_idx
  ON public.profiles USING GIN (acesso_modulos);
