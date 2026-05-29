'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, AlertCircle, Calendar as CalendarIcon, Plus, Trash2,
  Paperclip, FileText, Image as ImageIcon, Video, X as XIcon,
} from 'lucide-react'
import {
  createManutencao,
  listTiposManutencao,
  listProfilesAtivosComManutencao,
  criarUploadUrlManutencaoAnexo,
  registrarManutencaoAnexo,
} from '@/app/actions/manutencoes-actions'
import { ClientePosVendaAutocomplete } from '@/components/manutencoes/cliente-autocomplete'
import { uploadToSignedUrl, fileTypeManutencaoFromMime } from '@/lib/storage-upload'
import type { TipoManutencao, ClientePosVenda, ManutencaoItemInput } from '@/types/manutencoes'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'

interface ItemDraft extends ManutencaoItemInput {
  _id: string
  arquivos: File[]
}
function novoItemDraft(): ItemDraft {
  return { _id: crypto.randomUUID(), descricao: '', tipo_id: null, status: 'PENDENTE', arquivos: [] }
}

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB — alinhado ao bucket
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function iconePorMime(mime: string) {
  if (mime.startsWith('image/')) return { Icon: ImageIcon, cor: 'text-emerald-700' }
  if (mime.startsWith('video/')) return { Icon: Video,     cor: 'text-violet-700' }
  return { Icon: FileText, cor: 'text-[var(--ink-soft)]' }
}

export default function NovaManutencaoPage() {
  const router = useRouter()
  const confirm = useConfirm()

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
  function adicionarArquivos(itemId: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const lista = Array.from(files)
    const grandes = lista.filter(f => f.size > MAX_FILE_BYTES)
    if (grandes.length) {
      setErro(`Arquivo maior que 100 MB: ${grandes.map(f => f.name).join(', ')}`)
    }
    const validos = lista.filter(f => f.size <= MAX_FILE_BYTES)
    if (validos.length === 0) return
    setItens(prev => prev.map(it =>
      it._id === itemId ? { ...it, arquivos: [...it.arquivos, ...validos] } : it,
    ))
  }
  function removerArquivo(itemId: string, idx: number) {
    setItens(prev => prev.map(it =>
      it._id === itemId ? { ...it, arquivos: it.arquivos.filter((_, i) => i !== idx) } : it,
    ))
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
      const { manutencao, itens: itensCriados } = await createManutencao({
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

      // Upload de anexos pós-save (mapeia draft → item criado pela ordem).
      // Browser sobe direto pro Supabase via signed URL.
      const falhas: string[] = []
      for (let i = 0; i < itensValidos.length; i++) {
        const draft = itensValidos[i]
        const criado = itensCriados[i]
        if (!criado || draft.arquivos.length === 0) continue
        for (const file of draft.arquivos) {
          try {
            const { bucket, path, token } = await criarUploadUrlManutencaoAnexo({
              manutencaoId: manutencao.id,
              itemId: criado.id,
              fileName: file.name,
            })
            await uploadToSignedUrl(bucket, path, token, file)
            await registrarManutencaoAnexo({
              manutencaoId: manutencao.id,
              itemId: criado.id,
              path,
              fileName: file.name,
              fileType: fileTypeManutencaoFromMime(file.type),
              sizeBytes: file.size,
            })
          } catch (e) {
            falhas.push(`${file.name}: ${e instanceof Error ? e.message : 'erro'}`)
          }
        }
      }

      if (falhas.length) {
        // Manutenção foi criada; avisa falhas e segue pro detalhe.
        await confirm({
          title: 'Manutenção criada com avisos',
          description: `Alguns anexos falharam:\n${falhas.join('\n')}`,
          confirmLabel: 'Entendi',
          hideCancel: true,
        })
      }
      router.push(`/manutencoes/${manutencao.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao criar a manutenção.')
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
                Liste cada problema separadamente com seu tipo. Anexe fotos ou vídeos direto no item.
              </p>
            </div>
            <Button variant="outline" onClick={adicionarItem} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <div className="space-y-2.5">
            {itens.map((it, idx) => (
              <ItemDraftCard
                key={it._id}
                item={it}
                index={idx}
                tipos={tipos}
                podeRemover={itens.length > 1}
                onUpdate={(patch) => updateItem(it._id, patch)}
                onRemove={() => removerItem(it._id)}
                onAddFiles={(files) => adicionarArquivos(it._id, files)}
                onRemoveFile={(i) => removerArquivo(it._id, i)}
              />
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

// ─────────────────────────────────────────────────────────────────
// ItemDraftCard — uma linha da lista de itens com upload inline
// ─────────────────────────────────────────────────────────────────
interface ItemDraftCardProps {
  item: ItemDraft
  index: number
  tipos: TipoManutencao[]
  podeRemover: boolean
  onUpdate: (patch: Partial<ItemDraft>) => void
  onRemove: () => void
  onAddFiles: (files: FileList | null) => void
  onRemoveFile: (idx: number) => void
}

function ItemDraftCard({
  item, index, tipos, podeRemover, onUpdate, onRemove, onAddFiles, onRemoveFile,
}: ItemDraftCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/40 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-[var(--ink-soft)] ring-1 ring-inset ring-[var(--line)]">
          {index + 1}
        </span>
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
          <Input
            value={item.descricao}
            onChange={e => onUpdate({ descricao: e.target.value })}
            placeholder="Ex: Torneira pingando no banheiro da suíte"
            className="h-10 rounded-lg"
          />
          <select
            value={item.tipo_id ?? ''}
            onChange={e => onUpdate({ tipo_id: e.target.value || null })}
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
          onClick={onRemove}
          disabled={!podeRemover}
          className="mt-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Remover item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Anexos do item (upload diferido — sobem após criar) */}
      <div className="mt-2.5 pl-[2.375rem]">
        {item.arquivos.length > 0 && (
          <ul className="mb-2 space-y-1">
            {item.arquivos.map((f, i) => {
              const { Icon, cor } = iconePorMime(f.type)
              return (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5"
                >
                  <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--paper)]', cor)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--ink)]">{f.name}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-[var(--ink-faint)]">{formatSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(i)}
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded text-[var(--ink-faint)] transition-colors hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remover arquivo"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.xlsx,.xls"
          multiple
          onChange={e => {
            onAddFiles(e.target.files)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--line)] px-2.5 text-xs font-semibold text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:bg-white hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-bright)]/40"
        >
          <Paperclip className="h-3 w-3" />
          {item.arquivos.length === 0 ? 'Anexar foto ou vídeo' : 'Anexar mais'}
        </button>
      </div>
    </div>
  )
}
