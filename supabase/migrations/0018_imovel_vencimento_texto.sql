-- ============================================================
-- MIGRAÇÃO 0018 — vencimento_laudo vira texto livre
--
-- O laudo nem sempre é uma data: pode ser "VENCIDO", "em análise", etc.
-- Converte a coluna DATE → TEXT, preservando as datas já cadastradas
-- no formato BR (dd/mm/aaaa).
--
-- Idempotente: só converte se a coluna ainda for DATE.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'imoveis'
      AND column_name = 'vencimento_laudo' AND data_type = 'date'
  ) THEN
    ALTER TABLE public.imoveis
      ALTER COLUMN vencimento_laudo TYPE TEXT
      USING to_char(vencimento_laudo, 'DD/MM/YYYY');
  END IF;
END $$;
