/**
 * Extração de itens de cotação a partir de arquivos enviados pelo fornecedor.
 *
 * Estratégias:
 *   - Excel (.xlsx / .xls / .csv): parse local com SheetJS, heurística de
 *     mapeamento de colunas (descrição, qtd, unidade, preço).
 *   - PDF / imagem: Claude (API oficial da Anthropic) com tool_use forçando
 *     schema estruturado. Retorno tipado garantido.
 *
 * Saída uniforme: { items, observacoes_gerais?, prazo_entrega_dias? }
 */

import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'
import type { AnexoTipo } from '@/types/compras'

export interface ItemExtraido {
  descricao: string
  quantidade?: number
  unidade?: string
  preco_unitario?: number
  observacoes?: string
}

export interface ExtracaoResultado {
  items: ItemExtraido[]
  observacoes_gerais?: string
  prazo_entrega_dias?: number
}

// ═══════════════════════════════════════════════════════════════
// DETECÇÃO DE TIPO
// ═══════════════════════════════════════════════════════════════

export function detectTipoAnexo(mimeType: string, fileName: string): AnexoTipo {
  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (mimeType.startsWith('image/')) return 'IMAGEM'
  if (
    mimeType.includes('spreadsheetml') ||
    mimeType.includes('ms-excel') ||
    mimeType === 'text/csv' ||
    /\.(xlsx|xls|csv)$/i.test(fileName)
  ) return 'EXCEL'
  return 'OUTRO'
}

// ═══════════════════════════════════════════════════════════════
// EXCEL / CSV — parse local
// ═══════════════════════════════════════════════════════════════

/**
 * Heurística pra mapear cabeçalhos comuns. Aceita variações em PT/EN.
 */
const HEADER_PATTERNS: Record<keyof ItemExtraido, RegExp[]> = {
  descricao: [/descri[cç][aã]o/i, /item/i, /produto/i, /material/i, /especifica[cç][aã]o/i, /^name$/i, /^description$/i],
  quantidade: [/^qtd/i, /quantidade/i, /quant\b/i, /^qty$/i, /^quantity$/i],
  unidade: [/unidade/i, /^un\.?$/i, /^uni\b/i, /^unit$/i, /medida/i],
  preco_unitario: [/pre[cç]o.*unit/i, /val(or)?.*unit/i, /unit[aá]rio/i, /pre[cç]o(?!.*total)/i, /unit.?price/i],
  observacoes: [/observ/i, /obs\b/i, /notes?/i, /coment/i],
}

function matchColumn(header: string): keyof ItemExtraido | null {
  const h = header.trim()
  if (!h) return null
  for (const [key, patterns] of Object.entries(HEADER_PATTERNS) as [keyof ItemExtraido, RegExp[]][]) {
    if (patterns.some(p => p.test(h))) return key
  }
  return null
}

function parseNumberBR(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // "R$ 1.234,56" → 1234.56 ; "1234.56" → 1234.56
    const cleaned = v.replace(/[R$\s]/gi, '').trim()
    // Se tem vírgula como decimal: remove pontos de milhar, troca vírgula
    if (/,\d{1,3}$/.test(cleaned)) {
      const n = Number(cleaned.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) ? n : undefined
    }
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function extractFromExcel(buffer: Buffer | ArrayBuffer): ExtracaoResultado {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { items: [] }
  const sheet = workbook.Sheets[sheetName]
  // Lê como array of arrays (cabeçalho na primeira linha não-vazia)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })

  // Procura a primeira linha que parece um cabeçalho (≥2 colunas mapeadas)
  let headerIdx = -1
  let headerMap: Map<number, keyof ItemExtraido> = new Map()
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const map = new Map<number, keyof ItemExtraido>()
    const row = rows[i]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (typeof cell !== 'string') continue
      const key = matchColumn(cell)
      if (key) map.set(c, key)
    }
    if (map.size >= 2) { headerIdx = i; headerMap = map; break }
  }
  if (headerIdx === -1) return { items: [] }

  const items: ItemExtraido[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c == null || c === '')) continue
    const item: ItemExtraido = { descricao: '' }
    for (const [colIdx, key] of headerMap.entries()) {
      const val = row[colIdx]
      if (val == null || val === '') continue
      if (key === 'descricao' || key === 'unidade' || key === 'observacoes') {
        item[key] = String(val).trim()
      } else if (key === 'quantidade' || key === 'preco_unitario') {
        const n = parseNumberBR(val)
        if (n != null) item[key] = n
      }
    }
    if (item.descricao) items.push(item)
  }

  return { items }
}

// ═══════════════════════════════════════════════════════════════
// PDF / IMAGEM — Claude via Anthropic API
// ═══════════════════════════════════════════════════════════════

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

const IMAGE_MIME_SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type SupportedImageMime = typeof IMAGE_MIME_SUPPORTED[number]

function isSupportedImageMime(m: string): m is SupportedImageMime {
  return (IMAGE_MIME_SUPPORTED as readonly string[]).includes(m)
}

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada no .env.local.')
  }
  return new Anthropic({ apiKey })
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'registrar_itens_orcamento',
  description:
    'Registra os itens encontrados no documento de orçamento do fornecedor, com descrição, quantidade, unidade e preço unitário.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Lista de itens cotados. Um item por linha do orçamento.',
        items: {
          type: 'object',
          properties: {
            descricao: { type: 'string', description: 'Descrição do item/material/serviço.' },
            quantidade: { type: 'number', description: 'Quantidade numérica. Se ausente, omitir.' },
            unidade: { type: 'string', description: 'Sigla da unidade (un, kg, m, m², m³, sc, l, h, dia, mês). Se ausente, omitir.' },
            preco_unitario: { type: 'number', description: 'Preço por unidade em REAL (apenas o número, sem R$ ou separadores).' },
            observacoes: { type: 'string', description: 'Observação curta do item (marca, modelo, validade) quando relevante.' },
          },
          required: ['descricao'],
        },
      },
      observacoes_gerais: {
        type: 'string',
        description: 'Observações gerais da proposta (condições de pagamento, validade, etc).',
      },
      prazo_entrega_dias: {
        type: 'number',
        description: 'Prazo de entrega declarado pelo fornecedor, em dias.',
      },
    },
    required: ['items'],
  },
}

const SYSTEM_PROMPT = `Você é um assistente que extrai linhas de orçamento de documentos enviados por fornecedores brasileiros do setor de construção civil.

Regras:
- Extraia apenas itens com pelo menos uma descrição reconhecível.
- Valores monetários estão em REAL (R$). Converta para número puro (1234.56 — sem R$, sem separador de milhar).
- Decimais aceitos: tanto vírgula quanto ponto. Normalize.
- Unidades comuns: un, pç, kg, sc, m, m², m³, l, h, dia, mês, palete.
- Ignore totais, subtotais, descontos e cabeçalhos — apenas linhas de itens.
- Se houver prazo de entrega ou condições de pagamento explícitas, registre em campos próprios.
- Se o documento for ilegível ou não for um orçamento, retorne lista vazia.`

export async function extractFromPdfOrImage(
  base64: string,
  mimeType: string,
  _fileName: string,
): Promise<ExtracaoResultado> {
  const client = getAnthropic()
  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'

  if (!isImage && !isPdf) {
    throw new Error(`Tipo de arquivo não suportado pela IA: ${mimeType}`)
  }
  if (isImage && !isSupportedImageMime(mimeType)) {
    throw new Error(
      `Formato de imagem não suportado (${mimeType}). Use JPG, PNG, GIF ou WebP.`
    )
  }

  const userContent: Anthropic.Messages.ContentBlockParam[] = []
  if (isPdf) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    })
  } else {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType as SupportedImageMime, data: base64 },
    })
  }
  userContent.push({
    type: 'text',
    text: 'Extraia os itens deste orçamento. Use a ferramenta registrar_itens_orcamento.',
  })

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: 'registrar_itens_orcamento' },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUse = response.content.find(c => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('IA não retornou tool_use.')
  }
  const parsed = toolUse.input as ExtracaoResultado
  if (!Array.isArray(parsed.items)) {
    throw new Error('IA retornou estrutura sem `items`.')
  }
  return parsed
}

// ═══════════════════════════════════════════════════════════════
// SANITIZAÇÃO DE ERROS — mensagens amigáveis pro fornecedor
// ═══════════════════════════════════════════════════════════════

/**
 * Converte uma mensagem de erro técnica (ex.: "400 {type: invalid_request_error,
 * Your credit balance is too low…}") em algo compreensível pro fornecedor.
 * O erro técnico cru deve ser logado pelo chamador (console.error) pra debug do admin.
 */
export function sanitizeExtractionError(rawError: string): string {
  const lower = rawError.toLowerCase()

  // Anthropic billing / créditos esgotados / quota
  if (
    lower.includes('credit balance') ||
    lower.includes('billing') ||
    lower.includes('plans') ||
    lower.includes('quota') ||
    lower.includes('insufficient')
  ) {
    return 'Sistema de leitura automática indisponível no momento. Preencha os itens manualmente abaixo.'
  }

  // Rate limit
  if (lower.includes('rate_limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo, ou preencha manualmente.'
  }

  // Autenticação / chave inválida
  if (
    lower.includes('authentication') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return 'Sistema de leitura indisponível. Preencha os itens manualmente.'
  }

  // Arquivo inválido / formato não suportado pela IA
  if (
    lower.includes('invalid_image') ||
    lower.includes('unsupported') ||
    lower.includes('formato de imagem') ||
    lower.includes('não suportado')
  ) {
    return 'Formato de arquivo não reconhecido pela leitura automática. Tente outro arquivo (PDF, JPG, PNG) ou preencha manualmente.'
  }

  // Timeout / rede
  if (
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound')
  ) {
    return 'Tempo de leitura excedido. Tente novamente ou preencha manualmente.'
  }

  // Arquivo muito grande / processamento pesado
  if (lower.includes('too large') || lower.includes('payload')) {
    return 'Arquivo muito grande pra leitura automática. Tente um arquivo menor ou preencha manualmente.'
  }

  // Genérico
  return 'Não foi possível ler o arquivo automaticamente. Preencha os itens manualmente abaixo.'
}

// ═══════════════════════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════════════════════

export async function extractFromBuffer(
  buffer: Buffer | ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<{ tipo: AnexoTipo; resultado: ExtracaoResultado }> {
  const tipo = detectTipoAnexo(mimeType, fileName)

  if (tipo === 'EXCEL') {
    return { tipo, resultado: extractFromExcel(buffer) }
  }
  if (tipo === 'PDF' || tipo === 'IMAGEM') {
    const base64 = Buffer.isBuffer(buffer)
      ? buffer.toString('base64')
      : Buffer.from(buffer).toString('base64')
    return { tipo, resultado: await extractFromPdfOrImage(base64, mimeType, fileName) }
  }
  return { tipo, resultado: { items: [] } }
}
