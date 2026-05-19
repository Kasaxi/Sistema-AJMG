-- ============================================================
-- MIGRAÇÃO 0001 — Vínculo usuário ↔ vendedor por e-mail
-- Execute este script no SQL Editor do Supabase (idempotente)
-- ============================================================

-- 1. Coluna de e-mail no vendedor
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS email TEXT;

-- E-mail único (case-insensitive), permitindo múltiplos NULL
CREATE UNIQUE INDEX IF NOT EXISTS vendedores_email_unique
  ON public.vendedores (lower(email))
  WHERE email IS NOT NULL;

-- 2. Ao criar o usuário, já vincula ao vendedor cujo e-mail bate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_id UUID;
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

-- 3. Backfill: vincula perfis VENDEDOR já existentes cujo e-mail
--    corresponde a um vendedor (cobre quem se cadastrou antes do vendedor existir)
UPDATE public.profiles p
SET vendedor_id = v.id
FROM auth.users u, public.vendedores v
WHERE p.id = u.id
  AND p.vendedor_id IS NULL
  AND p.role = 'VENDEDOR'
  AND lower(u.email) = lower(v.email)
  AND v.email IS NOT NULL;
