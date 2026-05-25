#!/usr/bin/env node
/**
 * Importa gastos dos 3 CSVs (qd-55, qd-70, qd-151) pra tabela `gastos`.
 *
 * Pré-requisitos:
 *   1. Migration 0006 aplicada
 *   2. As 3 obras criadas (QD 55, QD 70, QD 151 — Parque Alvorada I)
 *   3. .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *
 * Faz:
 *   - Parse CSV (delimitador `,` com aspas)
 *   - Separa unidade colada na quantidade (6M³ → qtd 6 + un m³)
 *   - Normaliza moeda BR (R$ 1.500,00 → 1500.00)
 *   - Corrige typo de data (06/08/0205 → 2025)
 *   - Mapeia categorias do CSV pras seed do banco
 *   - Vincula cada arquivo à obra correta (por nome)
 *   - Pula linhas vazias e o "Total" no fim
 *
 * Uso:
 *   node scripts/import-obras-compras.mjs
 *   node scripts/import-obras-compras.mjs --dry-run
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(__dirname, 'data', 'compras')

function loadEnv() {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = value
  }
}
loadEnv()

const args = process.argv.slice(2).reduce((acc, a) => {
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=')
    acc[k] = v === undefined ? true : v
  }
  return acc
}, {})
const DRY_RUN = args['dry-run'] === true

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Mapping: arquivo → nome da obra ────────────────────────────────────────
const ARQUIVO_OBRA = {
  'qd-55.csv':  'QD 55',
  'qd-70.csv':  'QD 70',
  'qd-151.csv': 'QD 151 — Parque Alvorada I',
}

// ── Mapping: categoria do CSV → categoria seed ─────────────────────────────
const CATEGORIA_MAP = {
  'Estrutura':            'Estrutura',
  'Alvenaria':            'Alvenaria',
  'Ferragem':             'Ferragem',
  'Impermeabilizante':    'Impermeabilizante',
  'Hidráulica':           'Hidráulica',
  'Hidraulica':           'Hidráulica',
  'Elétrica':             'Elétrica',
  'Eletrica':             'Elétrica',
  'Acabamento':           'Acabamento',
  'Mármore':              'Mármore',
  'Marmore':              'Mármore',
  'Mão-de-obra':          'Mão-de-obra',
  'Mão-de-Obra':          'Mão-de-obra',
  'Mao-de-obra':          'Mão-de-obra',
  'Equipamentos':         'Locação/Equipamentos',
  'Locação Maquinário':   'Locação/Equipamentos',
  'Locacao Maquinario':   'Locação/Equipamentos',
  'Aluguel':              'Aluguel',
  'Documentação Inicial': 'Documentação',
  'Documentação':         'Documentação',
  'Documentacao':         'Documentação',
  'Transporte':           'Transporte',
  'Energia':              'Energia/Água',
  'Água':                 'Energia/Água',
  'Agua':                 'Energia/Água',
  'Ajuda de custo':       'Ajuda de custo',
  'Outros':               'Outros',
}

// ── CSV parser ─────────────────────────────────────────────────────────────
function parseCSV(text, delimiter = ',') {
  const rows = []
  let i = 0, field = '', row = [], inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === delimiter) { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; continue }
    field += c; i++
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Converte "R$ 1.500,00" → 1500.00 */
function parseBRL(v) {
  if (!v) return null
  const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Converte "26/09/2025" ou "06/08/0205" → "2025-09-26" (corrige typo 0205→2025) */
function parseDate(v) {
  if (!v) return null
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  let [, d, mo, y] = m
  if (y === '0205') y = '2025' // typo conhecido em qd-55
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * Separa "6M³" → { qtd: 6, sigla: 'm³' }; "4 pç" → { qtd: 4, sigla: 'pç' };
 * "21,00 m" → { qtd: 21, sigla: 'm' }; "50" → { qtd: 50, sigla: 'un' (default) }
 */
function parseQuantidade(raw) {
  if (raw == null) return { qtd: null, sigla: 'un' }
  const s = String(raw).trim()
  if (!s) return { qtd: null, sigla: 'un' }

  // Padrões: número (com vírgula opc) seguido opc por espaço e unidade
  const m = s.match(/^([\d.,]+)\s*([a-zA-ZÀ-úçÇ²³º°]+)?$/)
  if (!m) return { qtd: parseBRL(s), sigla: 'un' }

  const num = parseBRL(m[1])
  const unidade = (m[2] ?? '').toLowerCase().trim()

  const SIGLA_MAP = {
    'm':  'm',  'm2': 'm²', 'm²': 'm²', 'm3': 'm³', 'm³': 'm³',
    'kg': 'kg', 'sc': 'sc', 'l':  'l',
    'pç': 'pç', 'pc': 'pç', 'p':  'pç',
    'un': 'un', 'd':  'dia', 'dia': 'dia', 'mês': 'mês', 'mes': 'mês',
    'h':  'h',  'palete': 'palete', 'paletes': 'palete',
  }
  const sigla = SIGLA_MAP[unidade] ?? 'un'
  return { qtd: num, sigla }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Import obras-compras (${DRY_RUN ? 'DRY-RUN' : 'EXECUÇÃO REAL'})`)
  console.log('')

  // 1. Carrega catálogos do banco
  console.log('[1/5] Carregando catálogos do banco...')
  const { data: obras } = await supabase.from('obras').select('id, nome')
  const { data: categorias } = await supabase.from('categorias_custo').select('id, nome')
  const { data: unidades } = await supabase.from('unidades_medida').select('id, sigla')

  const obrasByNome = new Map(obras.map(o => [o.nome, o.id]))
  const catByNome = new Map(categorias.map(c => [c.nome, c.id]))
  const unByGlia = new Map(unidades.map(u => [u.sigla, u.id]))

  console.log(`   ${obras.length} obras · ${categorias.length} categorias · ${unidades.length} unidades`)

  // 2. Resolve admin user pra criado_por
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome, role')
    .eq('role', 'ADMIN')
    .limit(1)
  const adminId = profiles?.[0]?.id ?? null

  // 3. Processa cada CSV
  console.log('[2/5] Processando CSVs...')
  const todosGastos = []
  const naoMapeados = new Set()

  for (const [arquivo, nomeObra] of Object.entries(ARQUIVO_OBRA)) {
    const path = join(DATA_DIR, arquivo)
    if (!existsSync(path)) {
      console.warn(`   ⚠ ${arquivo} não encontrado, pulando`)
      continue
    }
    const obraId = obrasByNome.get(nomeObra)
    if (!obraId) {
      console.warn(`   ⚠ Obra "${nomeObra}" não existe no banco. Pula ${arquivo}.`)
      continue
    }

    const raw = readFileSync(path, 'utf8')
    const rows = parseCSV(raw)

    // Acha a linha do header (que começa com "Descrição")
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][0] ?? '').trim().toLowerCase().startsWith('descri')) {
        headerIdx = i; break
      }
    }
    if (headerIdx < 0) {
      console.warn(`   ⚠ ${arquivo}: header não encontrado, pulando`)
      continue
    }

    let importados = 0, ignorados = 0
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      const desc = (r[0] ?? '').trim()
      const cat = (r[1] ?? '').trim()
      const qtdRaw = (r[2] ?? '').trim()
      const dataRaw = (r[3] ?? '').trim()
      const valorUnitRaw = (r[4] ?? '').trim()

      // Pula linhas vazias e o "Total" final
      if (!desc) { ignorados++; continue }
      if (desc.toLowerCase() === 'total') { ignorados++; continue }
      if (!cat || !qtdRaw || !dataRaw || !valorUnitRaw) {
        // Linha incompleta — registra e pula
        naoMapeados.add(`linha incompleta: ${desc.slice(0, 30)}`)
        ignorados++
        continue
      }

      // Mapeia categoria
      const catNome = CATEGORIA_MAP[cat] ?? null
      if (!catNome) {
        naoMapeados.add(`categoria sem map: "${cat}"`)
        ignorados++
        continue
      }
      const categoriaId = catByNome.get(catNome)
      if (!categoriaId) {
        naoMapeados.add(`categoria não no banco: "${catNome}"`)
        ignorados++
        continue
      }

      // Parse qtd + unidade
      const { qtd, sigla } = parseQuantidade(qtdRaw)
      if (qtd == null || qtd <= 0) {
        naoMapeados.add(`qtd inválida: "${qtdRaw}"`)
        ignorados++
        continue
      }
      const unidadeId = unByGlia.get(sigla) ?? unByGlia.get('un')

      // Parse data
      const data = parseDate(dataRaw)
      if (!data) {
        naoMapeados.add(`data inválida: "${dataRaw}"`)
        ignorados++
        continue
      }

      // Parse valor unitário
      const valorUnit = parseBRL(valorUnitRaw)
      if (valorUnit == null || valorUnit < 0) {
        naoMapeados.add(`valor inválido: "${valorUnitRaw}"`)
        ignorados++
        continue
      }

      todosGastos.push({
        obra_id: obraId,
        descricao: desc,
        categoria_id: categoriaId,
        unidade_id: unidadeId,
        quantidade: qtd,
        valor_unitario: valorUnit,
        data,
        criado_por: adminId,
      })
      importados++
    }
    console.log(`   ${arquivo}: ${importados} importados, ${ignorados} ignorados`)
  }

  // 4. Avisos
  if (naoMapeados.size) {
    console.log('')
    console.log('[3/5] Linhas ignoradas (amostra):')
    let i = 0
    for (const m of naoMapeados) {
      if (i++ >= 15) break
      console.log('   - ' + m)
    }
    if (naoMapeados.size > 15) console.log(`   ... + ${naoMapeados.size - 15} avisos`)
  }

  // 5. Insert (batch)
  console.log('')
  console.log(`[4/5] Total a importar: ${todosGastos.length} gastos`)
  if (DRY_RUN) {
    console.log('DRY-RUN: nada foi escrito.')
    return
  }
  console.log('[5/5] Inserindo no banco...')
  const BATCH = 200
  for (let i = 0; i < todosGastos.length; i += BATCH) {
    const slice = todosGastos.slice(i, i + BATCH)
    const { error } = await supabase.from('gastos').insert(slice)
    if (error) {
      console.error('Erro no batch ' + i + ': ' + error.message)
      process.exit(1)
    }
    console.log(`   ${Math.min(i + BATCH, todosGastos.length)}/${todosGastos.length}`)
  }
  console.log('')
  console.log('Feito ✓')
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
