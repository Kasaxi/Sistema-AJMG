'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, AlertCircle, Calendar as CalendarIcon, Plus, Trash2 } from 'lucide-react'
import {
  createManutencao,
  listTiposManutencao,
  listProfilesAtivosComManutencao,
} from '@/app/actions/manutencoes-actions'
import { ClientePosVendaAutocomplete } from '@/components/manutencoes/cliente-autocomplete'
import type { TipoManutencao, ClientePosVenda, ManutencaoItemInput } from '@/types/manutencoes'

interface ItemDraft extends ManutencaoItemInput {
  _id: string
}
function novoItemDraft(): ItemDraft {
  return { _id: crypto.randomUUID(), descricao: '', tipo_id: null, status: 'PENDENTE' }
}

export default function NovaManutencaoPage() {
  const router = useRouter()

  // Catálogos
  const [tipos, setTipos] = useState<TipoManutencao[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)

  // Form state
  const [cliente, setCliente] = useState<ClientePosVenda | null>(null)
  const [endereco, setEndereco] = useState('')
  const [dataAgendada, setDataAgendada] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemDraft[]>([novoItemDraft()])
  const [criarNaAgenda, setCriarNaAgenda] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarCatalogos = useCallback(async () => {
    setCarregando(true)
    try {
      const [t, r] = await Promise.all([
        listTiposManutencao({ ativosApenas: true }),
        listProfilesAtivosComManutencao(),
      ])
      setTipos(t); setResponsaveis(r)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregarCatalogos() }, [carregarCatalogos])

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItens(prev => prev.map(it => it._id === id ? { ...it, ...patch } : it))
  }
  function removerItem(id: string) {
    setItens(prev => prev.length === 1 ? prev : prev.filter(it => it._id !== id))
  }
  function adicionarItem() {
    setItens(prev => [...prev, novoItemDraft()])
  }

  async function salvar() {
    setErro(null)
    const itensValidos = itens.filter(it => it.descricao.trim())
    if (itensValidos.length === 0) {
      setErro('Adicione ao menos um item descrevendo o problema.')
      return
    }

    setSalvando(true)
    try {
      const m = await createManutencao({
        cliente_id: cliente?.id || null,
        endereco: endereco.trim() || null,
        data_agendada: dataAgendada || null,
        hora_inicio: horaInicio || null,
        responsavel_id: responsavelId || null,
        observacoes: observacoes.trim() || null,
        itens: itensValidos.map((it, i) => ({
          descricao: it.descricao.trim(),
          tipo_id: it.tipo_id || null,
          status: it.status,
          observacoes: it.observacoes || null,
          ordem: i,
        })),
        criar_na_agenda: criarNaAgenda,
      })
      router.push(`/manutencoes/${m.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao criar a manutenção.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <>
        <Header eyebrow="Manutenções" title="Nova manutenção" />
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-8">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </>
    )
  }

  const podeCriarAgenda = !!(dataAgendada && responsavelId)

  return (
    <>
      <Header
        eyebrow="Manutenções"
        title="Nova manutenção"
        subtitle="Cadastra a solicitação ou serviço já realizado."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/manutencoes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <Button onClick={salvar} disabled={salvando} className="px-5">
              {salvando ? 'Salvando…' : 'Criar manutenção'}
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-8">
        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Identificação */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Quem e onde</h2>
          <div className="space-y-4">
            <div>
              <Label>Cliente (opcional)</Label>
              <div className="mt-1.5">
                <ClientePosVendaAutocomplete value={cliente?.id ?? null} onChange={setCliente} />
              </div>
            </div>
            <div>
              <Label htmlFor="endereco">Endereço do imóvel</Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
                placeholder="Ex: QD 55 Casa 3 — Luziânia"
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
          </div>
        </section>

        {/* Itens — situações específicas */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--ink)]">Itens / situações</h2>
              <p className="text-xs text-[var(--ink-soft)]">
                Liste cada problema separadamente com seu tipo. Fotos/vídeos por item vêm no detalhe.
              </p>
            </div>
            <Button variant="outline" onClick={adicionarItem} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <div className="space-y-2.5">
            {itens.map((it, idx) => (
              <div key={it._id} className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/40 p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-[var(--ink-soft)] ring-1 ring-inset ring-[var(--line)]">
                    {idx + 1}
                  </span>
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
                    <Input
                      value={it.descricao}
                      onChange={e => updateItem(it._id, { descricao: e.target.value })}
                      placeholder="Ex: Torneira pingando no banheiro da suíte"
                      className="h-10 rounded-lg"
                    />
                    <select
                      value={it.tipo_id ?? ''}
                      onChange={e => updateItem(it._id, { tipo_id: e.target.value || null })}
                      className="h-10 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
                    >
                      <option value="">— tipo —</option>
                      {tipos.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerItem(it._id)}
                    disabled={itens.length === 1}
                    className="mt-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Agendamento */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Quando e quem</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px_1fr]">
            <div>
              <Label htmlFor="data">Data agendada</Label>
              <Input
                id="data"
                type="date"
                value={dataAgendada}
                onChange={e => setDataAgendada(e.target.value)}
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                type="time"
                value={horaInicio}
                onChange={e => setHoraInicio(e.target.value)}
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="responsavel">Responsável</Label>
              <select
                id="responsavel"
                value={responsavelId}
                onChange={e => setResponsavelId(e.target.value)}
                className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
              >
                <option value="">— não definido —</option>
                {responsaveis.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkbox criar na agenda */}
          <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${criarNaAgenda && podeCriarAgenda ? 'border-[var(--ink)] bg-[var(--brand-tint)]/30' : 'border-[var(--line)] hover:bg-[var(--paper)]/40'}`}>
            <input
              type="checkbox"
              checked={criarNaAgenda}
              onChange={e => setCriarNaAgenda(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--ink)]"
            />
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
                <CalendarIcon className="h-3.5 w-3.5" />
                Criar item na Agenda do responsável
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                {podeCriarAgenda
                  ? 'Cria um item categoria=Manutenção atribuído ao responsável na data/hora marcada. Status sincroniza com a manutenção.'
                  : 'Defina data + responsável pra ativar essa opção.'}
              </p>
            </div>
          </label>
        </section>

        {/* Observações */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <Label htmlFor="obs">Observações internas</Label>
          <textarea
            id="obs"
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Histórico, contexto, restrições, etc."
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
          />
        </section>
      </div>
    </>
  )
}
