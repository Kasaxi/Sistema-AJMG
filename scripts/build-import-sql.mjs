#!/usr/bin/env node
/**
 * Transforma o export JSON da tabela `users` do Neon em um arquivo SQL
 * pronto para rodar no SQL Editor do Supabase.
 *
 * O SQL gerado:
 *   1. Cria uma TEMP TABLE _neon_users com os registros do Neon
 *   2. Atualiza vendedores.email via JOIN (necessário para o trigger
 *      handle_new_user() vincular o vendedor_id no profile)
 *   3. Insere em auth.users diretamente (com bcrypt hash original
 *      na coluna encrypted_password — sem reset de senha)
 *   4. Corrige profiles.role para ADMINs (o trigger cria como VENDEDOR
 *      por padrão)
 *   5. Corrige profiles.nome com o nome original do Neon
 *
 * Uso:
 *   node scripts/build-import-sql.mjs \
 *     supabase/legacy/neon-users.json \
 *     supabase/legacy/auth-users-inserts.sql
 *
 * Formato esperado do JSON de entrada (array de objetos):
 *   [
 *     {
 *       "id": "cln1...",
 *       "email": "joao@empresa.com",
 *       "password": "$2b$10$....",
 *       "nome": "João Silva",
 *       "role": "ADMIN" | "VENDEDOR",
 *       "vendedor_id": "cln1xyz..." | null,
 *       "created_at": "2024-05-12T14:30:00.000Z"
 *     }
 *   ]
 *
 * Como exportar do Neon:
 *   No SQL Editor do Neon, rode:
 *     SELECT json_agg(row_to_json(u)) FROM users u;
 *   Copie o resultado e salve em supabase/legacy/neon-users.json
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , inputPath, outputPath] = process.argv

if (!inputPath || !outputPath) {
  console.error('Uso: node scripts/build-import-sql.mjs <input.json> <output.sql>')
  process.exit(1)
}

const raw = readFileSync(resolve(inputPath), 'utf-8')
const users = JSON.parse(raw)

if (!Array.isArray(users)) {
  console.error('Entrada inválida: era esperado um array JSON de usuários.')
  process.exit(1)
}

// Escapa string para literal SQL (single-quoted)
function q(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

// Valida bcrypt — Supabase auth aceita $2a$ / $2b$ / $2y$
const bcryptRe = /^\$2[aby]\$\d{2}\$/
const bad = users.filter((u) => !u.password || !bcryptRe.test(u.password))
if (bad.length > 0) {
  console.warn(
    `Aviso: ${bad.length} usuário(s) com hash em formato não-bcrypt. ` +
      'Eles precisarão redefinir senha após a migração. Emails:'
  )
  bad.forEach((u) => console.warn('  -', u.email))
}

const lines = []
lines.push('-- ============================================================')
lines.push('-- Import de usuários do Neon → Supabase auth.users')
lines.push('-- Gerado por scripts/build-import-sql.mjs')
lines.push(`-- Total: ${users.length} usuário(s)`)
lines.push('-- ============================================================')
lines.push('')
lines.push('BEGIN;')
lines.push('')

// 1. TEMP TABLE com dados do Neon
lines.push('-- 1) Tabela temporária com os usuários do Neon')
lines.push('CREATE TEMP TABLE _neon_users (')
lines.push('  neon_id      TEXT,')
lines.push('  email        TEXT NOT NULL,')
lines.push('  password     TEXT NOT NULL,')
lines.push('  nome         TEXT NOT NULL,')
lines.push('  role         TEXT NOT NULL,')
lines.push('  vendedor_id  TEXT,')
lines.push('  created_at   TIMESTAMPTZ NOT NULL')
lines.push(') ON COMMIT DROP;')
lines.push('')

for (const u of users) {
  lines.push(
    `INSERT INTO _neon_users VALUES (${q(u.id)}, ${q(u.email)}, ${q(u.password)}, ${q(
      u.nome
    )}, ${q(u.role)}, ${q(u.vendedor_id)}, ${q(u.created_at)}::timestamptz);`
  )
}
lines.push('')

// 2. Atualizar vendedores.email (essencial para o trigger linkar profile→vendedor)
lines.push('-- 2) Popular vendedores.email a partir do mapping users→vendedores do Neon')
lines.push('UPDATE public.vendedores v')
lines.push('SET email = nu.email')
lines.push('FROM _neon_users nu')
lines.push('WHERE nu.vendedor_id = v.id')
lines.push('  AND nu.vendedor_id IS NOT NULL;')
lines.push('')

// 3. Inserir em auth.users (hash bcrypt preservado)
lines.push('-- 3) Inserir em auth.users. O trigger handle_new_user() cria o profile')
lines.push('--    automaticamente e linka o vendedor_id pelo email.')
// IMPORTANTE: tokens auxiliares (confirmation_token, recovery_token, etc) DEVEM
// ser '' e não NULL — o GoTrue (auth service do Supabase) trata NULL como
// inconsistência e quebra a listUsers/updateUserById com "Database error finding users".
lines.push('INSERT INTO auth.users (')
lines.push('  id,')
lines.push('  instance_id,')
lines.push('  aud,')
lines.push('  role,')
lines.push('  email,')
lines.push('  encrypted_password,')
lines.push('  email_confirmed_at,')
lines.push('  raw_app_meta_data,')
lines.push('  raw_user_meta_data,')
lines.push('  created_at,')
lines.push('  updated_at,')
lines.push('  confirmation_token,')
lines.push('  recovery_token,')
lines.push('  email_change,')
lines.push('  email_change_token_current,')
lines.push('  email_change_token_new,')
lines.push('  phone_change,')
lines.push('  phone_change_token,')
lines.push('  reauthentication_token')
lines.push(')')
lines.push('SELECT')
lines.push('  gen_random_uuid(),')
lines.push(`  '00000000-0000-0000-0000-000000000000'::uuid,`)
lines.push(`  'authenticated',`)
lines.push(`  'authenticated',`)
lines.push('  lower(nu.email),')
lines.push('  nu.password,')
lines.push('  nu.created_at,')
lines.push(`  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),`)
lines.push(`  jsonb_build_object('nome', nu.nome),`)
lines.push('  nu.created_at,')
lines.push('  now(),')
lines.push(`  '', '', '', '', '', '', '', ''`)
lines.push('FROM _neon_users nu')
lines.push('WHERE NOT EXISTS (')
lines.push('  SELECT 1 FROM auth.users au WHERE lower(au.email) = lower(nu.email)')
lines.push(');')
lines.push('')

// 4. Corrigir role e nome no profile (trigger cria todos como VENDEDOR)
lines.push('-- 4) Corrigir role e nome em profiles a partir do Neon')
lines.push('UPDATE public.profiles p')
lines.push('SET role = nu.role,')
lines.push('    nome = nu.nome')
lines.push('FROM auth.users au')
lines.push('JOIN _neon_users nu ON lower(nu.email) = lower(au.email)')
lines.push('WHERE p.id = au.id;')
lines.push('')

// 5. Verificações finais
lines.push('-- 5) Verificação rápida')
lines.push(`DO $$
DECLARE
  expected INTEGER;
  imported INTEGER;
BEGIN
  SELECT COUNT(*) INTO expected FROM _neon_users;
  SELECT COUNT(*) INTO imported FROM auth.users au
    WHERE EXISTS (SELECT 1 FROM _neon_users nu WHERE lower(nu.email) = lower(au.email));
  RAISE NOTICE 'Esperados: %, importados: %', expected, imported;
  IF imported < expected THEN
    RAISE WARNING 'Alguns usuários não foram importados (provável conflito de email pré-existente).';
  END IF;
END $$;`)
lines.push('')
lines.push('COMMIT;')
lines.push('')

const outPath = resolve(outputPath)
writeFileSync(outPath, lines.join('\n'), 'utf-8')

console.log(`✓ SQL gerado em: ${outPath}`)
console.log(`  ${users.length} usuário(s) processado(s)`)
if (bad.length > 0) {
  console.log(`  ${bad.length} sem hash bcrypt válido (precisarão resetar senha)`)
}
console.log('')
console.log('Próximo passo: abrir o Supabase SQL Editor e rodar o arquivo gerado.')
