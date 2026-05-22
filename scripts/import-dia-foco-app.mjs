#!/usr/bin/env node
/**
 * Importa dados do dia-foco-app (tarefas, profiles, histórico) pro sistema-empresa.
 *
 * One-shot: roda uma vez, não foi feito pra ser re-rodado contra os mesmos CSVs.
 * Os IDs originais (cuids do dia-foco-app) são preservados em agenda_itens.id
 * e agenda_historico.id pra manter a relação tarefa↔histórico intacta.
 *
 * Pré-requisitos:
 *   1. Migrations 0003/0004/0005 aplicadas no Supabase
 *   2. .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   3. CSVs em scripts/data/dia-foco-app/:
 *        - profiles.csv
 *        - tarefas.csv
 *        - tarefas_historico.csv
 *   4. Usuário Wesley criado em auth.users com profile role=ADMIN
 *
 * Uso:
 *   node scripts/import-dia-foco-app.mjs --admin-email=seuemail@dominio.com
 *   node scripts/import-dia-foco-app.mjs --admin-email=... --dry-run
 *
 * Comportamento:
 *   - criado_por: tarefas do Wesley → Wesley novo; resto → admin atual
 *   - atribuido_para: NULL, EXCETO se responsavel original for "WESLEY" (case insensitive)
 *   - responsavel/criador original ficam em observacoes
 *   - Categorias criadas automaticamente (TABALHO/TRABALHO/trabalho → "Trabalho")
 *   - Histórico inserido direto (não dispara o trigger, pois é INSERT)
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

// ── Setup ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(__dirname, 'data', 'dia-foco-app')

// Carrega .env.local manualmente (evita dependência de dotenv)
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

const args = parseArgs(process.argv.slice(2))
const ADMIN_EMAIL = args['admin-email']
const WESLEY_EMAIL = args['wesley-email'] ?? 'wesley@ajmgconstrutora.com.br'
const DRY_RUN = args['dry-run'] === true

if (!ADMIN_EMAIL) {
  console.error('Faltou --admin-email=seuemail@dominio.com')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v === undefined ? true : v
    }
  }
  return out
}

/**
 * Os CSVs do Supabase já são UTF-8 puro — readFileSync com 'utf8' decodifica
 * corretamente. Mantemos esta função como passthrough pra não mudar callsites
 * e por se um futuro CSV vier com mojibake real.
 */
function fixMojibake(s) {
  if (s === null || s === undefined) return s
  return s
}

/** Parser CSV simples com delimitador `;` e suporte a "campos com aspas". */
function parseCSV(text, delimiter = ';') {
  const rows = []
  let i = 0
  let field = ''
  let row = []
  let inQuotes = false
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
    if (c === '\n') {
      row.push(field); rows.push(row)
      field = ''; row = []
      i++; continue
    }
    field += c; i++
  }
  if (field || row.length) {
    row.push(field); rows.push(row)
  }
  if (!rows.length) return []
  const header = rows[0]
  return rows.slice(1)
    .filter(r => r.some(c => c !== ''))
    .map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])))
}

function readCsv(filename) {
  const path = join(DATA_DIR, filename)
  if (!existsSync(path)) {
    console.error(`Arquivo ausente: ${path}`)
    process.exit(1)
  }
  const raw = readFileSync(path, 'utf8')
  return parseCSV(raw)
}

function normPrioridade(p) {
  const fixed = fixMojibake(p).trim()
  const map = {
    'Baixa': 'BAIXA',
    'Média': 'MEDIA', 'Media': 'MEDIA',
    'Alta': 'ALTA',
  }
  return map[fixed] ?? 'MEDIA'
}

function normStatus(s) {
  const fixed = fixMojibake(s).trim()
  const map = {
    'A Fazer': 'PENDENTE',
    'Em Andamento': 'EM_ANDAMENTO',
    'Concluída': 'CONCLUIDO', 'Concluida': 'CONCLUIDO',
    'Cancelada': 'CANCELADO',
  }
  return map[fixed] ?? 'PENDENTE'
}

/** Normaliza nome de categoria (consolida TABALHO/TRABALHO/trabalho → Trabalho). */
function normCategoriaNome(raw) {
  if (!raw) return null
  const fixed = fixMojibake(raw).trim()
  if (!fixed) return null
  const upper = fixed.toUpperCase()
  if (upper === 'TABALHO' || upper === 'TRABALHO') return 'Trabalho'
  // Title case (primeira letra maiúscula, resto como está se já tem acento)
  // Capricha pra "Marketing", "Avaliações", "Documentação", etc.
  return fixed.charAt(0).toUpperCase() + fixed.slice(1).toLowerCase()
}

/** Trunca números mal-formados de `ordem` (algumas tarefas têm "\t-1") */
function normOrdem(v) {
  const n = parseInt(String(v).trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Caminho oposto: converte "0205" (typo) → "2025" em datas DD/MM/YYYY se aplicável. */
function normData(v) {
  if (!v) return null
  // CSV vem com formato YYYY-MM-DD ou timestamptz — preserva
  return v.slice(0, 10)
}

function nomePessoa(profile) {
  return fixMojibake(profile?.nome ?? '').trim() || '(sem nome)'
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('Import dia-foco-app → sistema-empresa')
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (não escreve no banco)' : 'EXECUÇÃO REAL'}`)
  console.log('')

  // 1) Resolver auth user IDs (admin atual + Wesley)
  console.log('[1/6] Resolvendo usuários...')
  const { data: adminUser, error: eA } = await supabase
    .from('profiles')
    .select('id, nome, role')
    .eq('id', (await getAuthUserIdByEmail(ADMIN_EMAIL)))
    .single()
  if (eA || !adminUser) {
    console.error(`Admin "${ADMIN_EMAIL}" não encontrado em profiles. Verifique o email.`)
    process.exit(1)
  }
  if (adminUser.role !== 'ADMIN') {
    console.error(`Usuário "${ADMIN_EMAIL}" não é ADMIN (é ${adminUser.role}). Aborta.`)
    process.exit(1)
  }
  console.log(`   Admin: ${nomePessoa(adminUser)} (${adminUser.id})`)

  const wesleyAuthId = await getAuthUserIdByEmail(WESLEY_EMAIL)
  if (!wesleyAuthId) {
    console.warn(`   ⚠ Wesley (${WESLEY_EMAIL}) não encontrado — todas as tarefas dele cairão pro admin.`)
  } else {
    console.log(`   Wesley: ${wesleyAuthId}`)
  }

  // 2) Carregar CSVs
  console.log('[2/6] Lendo CSVs...')
  const profiles = readCsv('profiles.csv')
  const tarefas = readCsv('tarefas.csv')
  const historico = readCsv('tarefas_historico.csv')
  console.log(`   ${profiles.length} profiles · ${tarefas.length} tarefas · ${historico.length} entradas de histórico`)

  // 3) Mapa user_id antigo → user_id novo
  console.log('[3/6] Mapeando usuários...')
  const WESLEY_OLD_ID = '0988102b-560b-4dc9-8adf-54c1b1ae5521'
  const userMap = new Map()
  for (const p of profiles) {
    const oldId = p.user_id
    if (!oldId) continue
    if (oldId === WESLEY_OLD_ID && wesleyAuthId) {
      userMap.set(oldId, wesleyAuthId)
    } else {
      userMap.set(oldId, adminUser.id)
    }
  }
  // Fallback pra IDs sem profile: vai pro admin
  function mapUser(oldId) {
    if (!oldId) return adminUser.id
    return userMap.get(oldId) ?? adminUser.id
  }
  console.log(`   ${userMap.size} mapeamentos`)

  // 4) Resolver categorias (cria as que faltam)
  console.log('[4/6] Categorias...')
  const categoriasUnicas = new Set()
  for (const t of tarefas) {
    const nome = normCategoriaNome(t.categoria)
    if (nome) categoriasUnicas.add(nome)
  }
  const categoriasArr = [...categoriasUnicas].sort()
  console.log(`   ${categoriasArr.length} categorias únicas: ${categoriasArr.join(', ')}`)

  const categoriaIdMap = new Map() // nome → id
  for (let i = 0; i < categoriasArr.length; i++) {
    const nome = categoriasArr[i]
    const cor = CORES_CATEGORIAS[i % CORES_CATEGORIAS.length]
    if (DRY_RUN) {
      categoriaIdMap.set(nome, `<dry-id:${nome}>`)
      continue
    }
    const { data: existente } = await supabase
      .from('categorias_agenda')
      .select('id')
      .eq('nome', nome)
      .maybeSingle()
    if (existente) {
      categoriaIdMap.set(nome, existente.id)
    } else {
      const { data: nova, error } = await supabase
        .from('categorias_agenda')
        .insert({ nome, cor, ordem: i })
        .select('id')
        .single()
      if (error) { console.error(`   Erro criando categoria "${nome}":`, error.message); process.exit(1) }
      categoriaIdMap.set(nome, nova.id)
    }
  }

  // 5) Inserir agenda_itens
  console.log('[5/6] Importando tarefas...')
  let okT = 0, skipT = 0
  const tarefaIdSet = new Set()  // IDs efetivamente importados (pra filtrar histórico)
  for (const t of tarefas) {
    const id = t.id?.trim()
    if (!id) { skipT++; continue }

    const categoriaNome = normCategoriaNome(t.categoria)
    const responsavelOriginal = fixMojibake(t.responsavel ?? '').trim()
    const criadorNome = nomePessoa(profiles.find(p => p.user_id === t.user_id))

    // Atribuição: só se responsavel for exatamente "WESLEY"
    let atribuidoPara = null
    if (responsavelOriginal.toUpperCase() === 'WESLEY' && wesleyAuthId) {
      atribuidoPara = wesleyAuthId
    }

    const obsParts = ['[Origem: dia-foco-app']
    if (criadorNome && criadorNome !== '(sem nome)') obsParts.push(`criado por: ${criadorNome}`)
    if (responsavelOriginal) obsParts.push(`responsável original: ${responsavelOriginal}`)
    const obsPrefix = obsParts.join(' · ') + ']'

    const row = {
      id,
      tipo: 'TAREFA',
      titulo: fixMojibake(t.titulo ?? '').trim().slice(0, 500) || 'Sem título',
      descricao: fixMojibake(t.descricao ?? '').trim() || null,
      data: normData(t.data) ?? new Date().toISOString().slice(0, 10),
      hora_inicio: null,
      hora_fim: null,
      prioridade: normPrioridade(t.prioridade),
      status: normStatus(t.status),
      categoria_id: categoriaNome ? categoriaIdMap.get(categoriaNome) : null,
      local: null,
      observacoes: obsPrefix,
      criado_por: mapUser(t.user_id),
      atribuido_para: atribuidoPara,
      recorrencia: 'NENHUMA',
      recorrencia_ate: null,
      ordem: normOrdem(t.ordem),
      created_at: t.created_at || undefined,
      updated_at: t.updated_at || undefined,
    }

    if (DRY_RUN) { okT++; tarefaIdSet.add(id); continue }

    const { error } = await supabase
      .from('agenda_itens')
      .upsert(row, { onConflict: 'id' })
    if (error) {
      console.error(`   ⚠ Erro tarefa ${id} ("${row.titulo.slice(0, 40)}"):`, error.message)
      skipT++
      continue
    }
    okT++
    tarefaIdSet.add(id)
  }
  console.log(`   ${okT} importadas · ${skipT} puladas`)

  // 6) Inserir histórico (só pra tarefas que conseguimos importar)
  console.log('[6/6] Importando histórico...')
  let okH = 0, skipH = 0
  for (const h of historico) {
    const tarefaId = h.tarefa_id?.trim()
    if (!tarefaId || !tarefaIdSet.has(tarefaId)) { skipH++; continue }

    const row = {
      id: h.id?.trim(),
      item_id: tarefaId,
      campo_alterado: fixMojibake(h.campo_alterado ?? '').trim(),
      valor_anterior: fixMojibake(h.valor_anterior ?? '') || null,
      valor_novo: fixMojibake(h.valor_novo ?? '') || null,
      mudado_por: null, // user_id antigo, sem mapeamento direto — deixa null
      mudado_em: h.created_at || undefined,
    }
    if (DRY_RUN) { okH++; continue }

    const { error } = await supabase
      .from('agenda_historico')
      .upsert(row, { onConflict: 'id' })
    if (error) {
      console.error(`   ⚠ Erro histórico ${row.id}:`, error.message)
      skipH++
      continue
    }
    okH++
  }
  console.log(`   ${okH} entradas · ${skipH} puladas`)

  console.log('')
  console.log('═══ Resumo ═══')
  console.log(`Categorias: ${categoriasArr.length}`)
  console.log(`Tarefas:    ${okT} ok, ${skipT} puladas`)
  console.log(`Histórico:  ${okH} ok, ${skipH} puladas (sem tarefa correspondente)`)
  console.log(DRY_RUN ? '\nDRY-RUN: nada foi escrito. Rode sem --dry-run pra aplicar.' : '\nFeito ✓')
}

/** Busca o auth.users.id pelo email. Retorna null se não encontrar. */
async function getAuthUserIdByEmail(email) {
  // Como service-role, podemos consultar auth.users via admin.listUsers + filtro
  // (ou via SQL direto se preferir).
  let page = 1
  while (page < 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`Erro buscando auth users: ${error.message}`)
    const u = data.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) return null
    page++
  }
  return null
}

const CORES_CATEGORIAS = [
  '#1E3A8A', // azul-escuro
  '#3B82F6', // azul
  '#0F766E', // teal escuro
  '#7C3AED', // roxo
  '#B45309', // âmbar escuro
  '#BE185D', // rosa escuro
  '#475569', // slate
  '#0E7490', // ciano
]

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
