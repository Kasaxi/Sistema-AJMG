'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { Obra, ObraComResumo, ObraInput, ObraStatus } from '@/types/obras'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return { supabase, user }
}

function revalidate() {
  revalidatePath('/obras')
}

export async function listObras(opts: { status?: ObraStatus } = {}): Promise<Obra[]> {
  const { supabase } = await requireUser()
  let q = supabase.from('obras').select('*').order('created_at', { ascending: false })
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Obra[]
}

export async function listObrasComResumo(): Promise<ObraComResumo[]> {
  const { supabase } = await requireUser()

  const [obrasRes, gastosRes] = await Promise.all([
    supabase.from('obras').select('*').order('created_at', { ascending: false }),
    supabase.from('gastos').select('obra_id, valor_total'),
  ])

  if (obrasRes.error) throw new Error(obrasRes.error.message)
  if (gastosRes.error) throw new Error(gastosRes.error.message)

  const resumoPorObra = new Map<string, { total: number; count: number }>()
  for (const g of gastosRes.data ?? []) {
    const cur = resumoPorObra.get(g.obra_id) ?? { total: 0, count: 0 }
    cur.total += Number(g.valor_total ?? 0)
    cur.count += 1
    resumoPorObra.set(g.obra_id, cur)
  }

  return (obrasRes.data ?? []).map(o => ({
    ...(o as Obra),
    totalGasto: resumoPorObra.get(o.id)?.total ?? 0,
    numCompras: resumoPorObra.get(o.id)?.count ?? 0,
  }))
}

export async function getObra(id: string): Promise<Obra | null> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Obra) ?? null
}

export async function createObra(input: ObraInput): Promise<Obra> {
  const { supabase } = await requireUser()
  const row = {
    nome: input.nome.trim(),
    endereco: input.endereco?.trim() || null,
    cidade: input.cidade?.trim() || null,
    status: input.status ?? 'PLANEJAMENTO',
    data_inicio: input.data_inicio ?? null,
    data_previsao_entrega: input.data_previsao_entrega ?? null,
    orcamento_previsto: input.orcamento_previsto ?? null,
    observacoes: input.observacoes?.trim() || null,
  }
  const { data, error } = await supabase
    .from('obras')
    .insert(row)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidate()
  return data as Obra
}

export async function updateObra(id: string, input: Partial<ObraInput>): Promise<Obra> {
  const { supabase } = await requireUser()
  const patch: Partial<ObraInput> = {}
  if (input.nome !== undefined)                  patch.nome = input.nome.trim()
  if (input.endereco !== undefined)              patch.endereco = input.endereco?.trim() || null
  if (input.cidade !== undefined)                patch.cidade = input.cidade?.trim() || null
  if (input.status !== undefined)                patch.status = input.status
  if (input.data_inicio !== undefined)           patch.data_inicio = input.data_inicio || null
  if (input.data_previsao_entrega !== undefined) patch.data_previsao_entrega = input.data_previsao_entrega || null
  if (input.orcamento_previsto !== undefined)    patch.orcamento_previsto = input.orcamento_previsto
  if (input.observacoes !== undefined)           patch.observacoes = input.observacoes?.trim() || null

  const { data, error } = await supabase
    .from('obras')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidate()
  return data as Obra
}

export async function deleteObra(id: string): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase.from('obras').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
