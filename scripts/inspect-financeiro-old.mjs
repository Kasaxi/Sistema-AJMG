#!/usr/bin/env node
/**
 * Inspeciona o banco do ERP-Financeiro ANTIGO (somente leitura) pra confirmar
 * conexão e esquema antes de migrar. Não altera nada.
 *
 * Uso: node scripts/inspect-financeiro-old.mjs
 * Requer OLD_FINANCEIRO_DB_URL no .env.local
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const connectionString = env.OLD_FINANCEIRO_DB_URL
if (!connectionString) {
  console.error('OLD_FINANCEIRO_DB_URL não encontrada no .env.local')
  process.exit(1)
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

const ALVO = ['transactions', 'categories', 'properties', 'property_groups', 'people']

try {
  await client.connect()
  console.log('✅ Conectado.\n')

  const tabs = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  )
  console.log('=== TABELAS (public) ===')
  for (const r of tabs.rows) {
    const c = await client.query(`SELECT COUNT(*)::int AS n FROM public."${r.table_name}"`)
    console.log(`  ${r.table_name.padEnd(28)} ${c.rows[0].n} linhas`)
  }

  for (const t of ALVO) {
    const exists = tabs.rows.some(r => r.table_name === t)
    if (!exists) { console.log(`\n=== ${t}: NÃO EXISTE ===`); continue }
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]
    )
    console.log(`\n=== ${t} — colunas ===`)
    console.log('  ' + cols.rows.map(c => `${c.column_name}:${c.data_type}`).join(', '))
  }

  // Amostra de transactions pra confirmar semântica
  console.log('\n=== transactions — 3 amostras ===')
  const sample = await client.query(
    `SELECT id, type, status, amount, description, transaction_date, due_date, category_id, property_id, person_id, source
     FROM public.transactions ORDER BY due_date DESC NULLS LAST LIMIT 3`
  ).catch(e => ({ rows: [], err: e.message }))
  if (sample.err) console.log('  (erro:', sample.err, ')')
  else for (const r of sample.rows) console.log('  ', JSON.stringify(r))

  // Distintos de status/type e distribuição
  const dist = await client.query(
    `SELECT type, status, COUNT(*)::int n FROM public.transactions GROUP BY type, status ORDER BY type, status`
  ).catch(() => ({ rows: [] }))
  console.log('\n=== transactions — type/status ===')
  for (const r of dist.rows) console.log(`  ${r.type ?? '-'} / ${r.status ?? '-'}: ${r.n}`)

  // Properties (centros de custo antigos) com grupo
  const props = await client.query(
    `SELECT p.id, p.endereco, g.name AS grupo
     FROM public.properties p LEFT JOIN public.property_groups g ON g.id = p.group_id
     ORDER BY g.name NULLS LAST, p.endereco LIMIT 30`
  ).catch(e => ({ rows: [], err: e.message }))
  console.log('\n=== properties (até 30) — viram centros de custo ===')
  if (props.err) console.log('  (erro:', props.err, ')')
  else for (const r of props.rows) console.log(`  [${r.grupo ?? 'sem grupo'}] ${r.endereco}`)

} catch (e) {
  console.error('❌ Falha:', e.message)
  process.exit(1)
} finally {
  await client.end()
}
