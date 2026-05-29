#!/usr/bin/env node
/**
 * Lê o ERP-Financeiro ANTIGO (OLD_FINANCEIRO_DB_URL) e gera um SQL idempotente
 * pra popular o módulo Financeiro novo (rodar no SQL Editor do NOSSO Supabase,
 * DEPOIS de aplicar a migration 0019).
 *
 * Mapeia:
 *   properties (+ group) -> financeiro_centros_custo (tipo AVULSO; reclassificar na tela)
 *   categories           -> financeiro_categorias (INCOME->ENTRADA / EXPENSE->SAIDA)
 *   transactions         -> financeiro_lancamentos (status PENDING/CONFIRMED/CANCELLED
 *                           -> PENDENTE/PAGO/CANCELADO; created_by = NULL)
 * Reusa os IDs (uuid) antigos como IDs nossos -> FKs já apontam certo + re-run seguro.
 *
 * Uso: node scripts/migrate-financeiro.mjs
 * Saída: scripts/data/financeiro/_seed_financeiro.sql
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

const connectionString = env.OLD_FINANCEIRO_DB_URL
if (!connectionString) { console.error('OLD_FINANCEIRO_DB_URL ausente'); process.exit(1) }

const TIPO = { INCOME: 'ENTRADA', EXPENSE: 'SAIDA' }
const STATUS = { PENDING: 'PENDENTE', CONFIRMED: 'PAGO', CANCELLED: 'CANCELADO' }

const q = (s) => s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`
const n = (v) => v === null || v === undefined || v === '' ? 'NULL' : Number(v)

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  // ── Centros de custo (properties + grupo) ──
  const props = (await client.query(
    `SELECT p.id::text AS id, p.endereco, g.name AS grupo
     FROM public.properties p LEFT JOIN public.property_groups g ON g.id = p.group_id`
  )).rows

  // Dedupe por (grupo||nome): se repetir, mapeia o 2º id pro 1º centro.
  const centroPorChave = new Map()  // chave -> id mantido
  const remapProp = new Map()       // property_id antigo -> centro_custo_id final
  const centros = []
  let ordem = 0
  for (const p of props) {
    const nome = (p.endereco || 'Sem nome').trim()
    const grupo = p.grupo ? p.grupo.trim() : null
    const chave = `${grupo ?? ''}|||${nome.toLowerCase()}`
    if (centroPorChave.has(chave)) {
      remapProp.set(p.id, centroPorChave.get(chave))
    } else {
      centroPorChave.set(chave, p.id)
      remapProp.set(p.id, p.id)
      centros.push({ id: p.id, nome, grupo, ordem: ordem++ })
    }
  }

  // ── Categorias ──
  const cats = (await client.query(
    `SELECT id::text AS id, name, type::text AS type, dre_group::text AS dre, is_active FROM public.categories`
  )).rows

  // ── Lançamentos ──
  const txs = (await client.query(
    `SELECT id::text AS id, type::text AS type, status::text AS status, amount,
            description,
            to_char(transaction_date,'YYYY-MM-DD') AS comp,
            to_char(due_date,'YYYY-MM-DD')          AS venc,
            category_id::text AS category_id, property_id::text AS property_id, source
     FROM public.transactions`
  )).rows

  // ── Monta SQL ──
  const L = []
  L.push('-- Seed do módulo Financeiro — gerado de migrate-financeiro.mjs')
  L.push('-- Rodar no SQL Editor do Supabase APÓS aplicar 0019_modulo_financeiro.sql')
  L.push('-- Idempotente (ON CONFLICT (id) DO NOTHING).')
  L.push('BEGIN;')
  L.push('')

  L.push(`-- Centros de custo (${centros.length})`)
  for (const c of centros) {
    L.push(`INSERT INTO public.financeiro_centros_custo (id, nome, grupo, tipo, ativo, ordem) VALUES (${q(c.id)}, ${q(c.nome)}, ${q(c.grupo)}, 'AVULSO', true, ${c.ordem}) ON CONFLICT (id) DO NOTHING;`)
  }
  L.push('')

  L.push(`-- Categorias (${cats.length})`)
  let co = 0
  for (const c of cats) {
    const tipo = TIPO[c.type] ?? 'SAIDA'
    const dre = c.dre && c.dre !== 'NAO_RELATORIO' ? q(c.dre) : (c.dre ? q(c.dre) : 'NULL')
    L.push(`INSERT INTO public.financeiro_categorias (id, nome, tipo, grupo_dre, ativo, ordem) VALUES (${q(c.id)}, ${q(c.name)}, '${tipo}', ${dre}, ${c.is_active === false ? 'false' : 'true'}, ${co++}) ON CONFLICT (id) DO NOTHING;`)
  }
  L.push('')

  L.push(`-- Lançamentos (${txs.length})`)
  let skipped = 0
  const values = []
  for (const t of txs) {
    const tipo = TIPO[t.type]
    const status = STATUS[t.status] ?? 'PENDENTE'
    if (!tipo || !t.venc || !t.comp) { skipped++; continue }
    const centro = t.property_id ? (remapProp.get(t.property_id) ?? null) : null
    const pagto = status === 'PAGO' ? q(t.venc) : 'NULL'
    values.push(`(${q(t.id)}, '${tipo}', ${q(t.description || 'Sem descrição')}, ${n(t.amount)}, '${status}', ${t.category_id ? q(t.category_id) : 'NULL'}, ${centro ? q(centro) : 'NULL'}, ${q(t.comp)}, ${q(t.venc)}, ${pagto}, 'import', NULL)`)
  }
  // INSERT em lotes de 200
  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200)
    L.push('INSERT INTO public.financeiro_lancamentos (id, tipo, descricao, valor, status, categoria_id, centro_custo_id, data_competencia, data_vencimento, data_pagamento, origem, created_by) VALUES')
    L.push(chunk.join(',\n'))
    L.push('ON CONFLICT (id) DO NOTHING;')
    L.push('')
  }

  L.push('COMMIT;')

  mkdirSync('scripts/data/financeiro', { recursive: true })
  writeFileSync('scripts/data/financeiro/_seed_financeiro.sql', L.join('\n'), 'utf-8')

  console.log('✅ Gerado: scripts/data/financeiro/_seed_financeiro.sql')
  console.log(`   Centros de custo: ${centros.length} (de ${props.length} properties; ${props.length - centros.length} mesclados por duplicidade)`)
  console.log(`   Categorias: ${cats.length}`)
  console.log(`   Lançamentos: ${values.length} (${skipped} ignorados por faltar data/tipo)`)
} catch (e) {
  console.error('❌ Falha:', e.message)
  process.exit(1)
} finally {
  await client.end()
}
