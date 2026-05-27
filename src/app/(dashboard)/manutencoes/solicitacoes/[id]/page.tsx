'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, AlertCircle, Phone, Mail, MapPin, IdCard, Globe, Wrench,
  FileText, Image as ImageIcon, Video, Loader2, Check, X as XIcon,
  Download,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  getOrdemServico, aceitarOrdemServico, recusarOrdemServico,
  getOrdemAnexoSignedUrl,
} from '@/app/actions/ordens-servico-actions'
import { listProfilesAtivosComManutencao } from '@/app/actions/manutencoes-actions'
import type { OrdemServico, OrdemServicoAnexo } from '@/types/manutencoes'
import { ORDEM_SERVICO_STATUS_LABEL } from '@/types/manutencoes'
import { cn } from '@/lib/utils'

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}
function formatSize(b: number | null) {
  if (!b) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
function iconePorTipo(tipo: OrdemServicoAnexo['file_type']) {
  if (tipo === 'FOTO')  return { Icon: ImageIcon, cor: 'text-emerald-700' }
  if (tipo === 'VIDEO') return { Icon: Video,     cor: 'text-violet-700' }
  return { Icon: FileText, cor: 'text-[var(--ink-soft)]' }
}
function mimeFromName(name: string): string {
  const ext = (name.match(/\.(\w+)$/)?.[1] ?? '').toLowerCase()
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png')  return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif')  return 'image/gif'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'mp4')  return 'video/mp4'
  if (ext === 'mov')  return 'video/quicktime'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'pdf')  return 'application/pdf'
  return 'application/octet-stream'
}

type Viewing = { anexo: OrdemServicoAnexo; url: string; mime: string }

export default function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [ordem, setOrdem] = useState<OrdemServico | null>(null)
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [acao, setAcao] = useState<'aceitar' | 'recusar' | null>(null)

  // Form de aceite
  const [responsavelId, setResponsavelId] = useState('')
  const [dataAgendada, setDataAgendada] = useState('')
  const [horaInicio, setHoraInicio] = useState('')

  // Form de recusa
  const [recusaOpen, setRecusaOpen] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')

  // Visualização de anexo
  const [viewing, setViewing] = useState<Viewing | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const [o, r] = await Promise.all([
        getOrdemServico(id),
        listProfilesAtivosComManutencao(),
      ])
      if (!o) { router.replace('/manutencoes/solicitacoes'); return }
      setOrdem(o)
      setResponsaveis(r)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void carregar() }, [carregar])

  async function aceitar() {
    if (!ordem) return
    setAcao('aceitar'); setErro(null)
    try {
      const m = await aceitarOrdemServico(ordem.id, {
        data_agendada: dataAgendada || null,
        hora_inicio: horaInicio || null,
        responsavel_id: responsavelId || null,
      })
      router.push(`/manutencoes/${m.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao aceitar.')
      setAcao(null)
    }
  }

  async function recusar() {
    if (!ordem) return
    setAcao('recusar'); setErro(null)
    try {
      await recusarOrdemServico(ordem.id, motivoRecusa.trim() || null)
      setRecusaOpen(false)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao recusar.')
    } finally {
      setAcao(null)
    }
  }

  async function abrirAnexo(an: OrdemServicoAnexo) {
    setErro(null); setOpeningId(an.id)
    try {
      const url = await getOrdemAnexoSignedUrl(an.id)
      const mime = mimeFromName(an.file_name)
      if (mime.startsWith('image/') || mime.startsWith('video/') || mime === 'application/pdf') {
        setViewing({ anexo: an, url, mime })
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir.')
    } finally {
      setOpeningId(null)
    }
  }

  if (loading) {
    return (
      <>
        <Header eyebrow="Solicitação" title="Carregando…" />
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-8">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </>
    )
  }
  if (!ordem) return null

  const pendente = ordem.status === 'PENDENTE'

  return (
    <>
      <Header
        eyebrow="Solicitação"
        title={ordem.nome_solicitante}
        subtitle={formatDateTimeBR(ordem.created_at)}
        actions={
          <Link
            href="/manutencoes/solicitacoes"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" /> Solicitações
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-8">
        {erro && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Status */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
              ordem.status === 'PENDENTE' && 'bg-amber-50 text-amber-700',
              ordem.status === 'ACEITA'   && 'bg-emerald-50 text-emerald-700',
              ordem.status === 'RECUSADA' && 'bg-rose-50 text-rose-700',
            )}>
              {ORDEM_SERVICO_STATUS_LABEL[ordem.status]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]">
              <Globe className="h-3 w-3" />
              {ordem.origem === 'PORTAL' ? 'Veio do portal do cliente' : 'Veio do link público'}
            </span>
          </div>

          {ordem.status === 'ACEITA' && ordem.manutencao_id && (
            <div className="mt-3">
              <Link
                href={`/manutencoes/${ordem.manutencao_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-bright)] hover:underline"
              >
                <Wrench className="h-4 w-4" /> Ver manutenção criada
              </Link>
            </div>
          )}
          {ordem.status === 'RECUSADA' && ordem.motivo_recusa && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/30 px-3 py-2 text-xs text-rose-700">
              <span className="font-semibold">Motivo da recusa: </span>{ordem.motivo_recusa}
            </p>
          )}
        </section>

        {/* Identificação */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Identificação</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field icon={Phone}  label="Telefone" value={ordem.telefone} />
            <Field icon={Mail}   label="Email"    value={ordem.email} />
            <Field icon={IdCard} label="CPF/CNPJ" value={ordem.cpf_cnpj} />
            <Field icon={MapPin} label="Endereço" value={ordem.endereco} />
          </dl>
        </section>

        {/* Descrição */}
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="mb-3 font-display text-base font-bold text-[var(--ink)]">Descrição do problema</h2>
          <p className="whitespace-pre-line text-sm text-[var(--ink)]">{ordem.descricao}</p>
        </section>

        {/* Anexos enviados pelo cliente */}
        {ordem.anexos && ordem.anexos.length > 0 && (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <h2 className="mb-3 font-display text-base font-bold text-[var(--ink)]">
              Fotos / vídeos enviados
            </h2>
            <ul className="space-y-1.5">
              {ordem.anexos.map(an => {
                const { Icon, cor } = iconePorTipo(an.file_type)
                const size = formatSize(an.size_bytes)
                return (
                  <li key={an.id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-2">
                    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--paper)]', cor)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <button
                      type="button"
                      onClick={() => abrirAnexo(an)}
                      disabled={openingId === an.id}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-sm text-[var(--ink)] hover:underline disabled:cursor-wait"
                    >
                      <span className="truncate">{an.file_name}</span>
                      {openingId === an.id && <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-60" />}
                    </button>
                    {size && <span className="shrink-0 text-[10px] tabular-nums text-[var(--ink-faint)]">{size}</span>}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Ações: aceitar/recusar (apenas quando pendente) */}
        {pendente && (
          <section className="rounded-2xl border border-[var(--brand-bright)]/40 bg-[var(--brand-tint)]/30 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-[var(--ink)]">Decidir</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Aceitando, a solicitação vira uma manutenção pronta pra agendar. Recusando, o cliente é avisado.
            </p>

            {/* Opções de aceite — agenda */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_1fr]">
              <div>
                <Label htmlFor="r-resp">Responsável (opcional)</Label>
                <select
                  id="r-resp"
                  value={responsavelId}
                  onChange={e => setResponsavelId(e.target.value)}
                  className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
                >
                  <option value="">— não definir agora —</option>
                  {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="r-data">Data</Label>
                <Input id="r-data" type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="r-hora">Hora</Label>
                <Input id="r-hora" type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={aceitar} disabled={!!acao} className="gap-1.5">
                {acao === 'aceitar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aceitar e criar manutenção
              </Button>
              <Button variant="outline" onClick={() => setRecusaOpen(true)} disabled={!!acao} className="gap-1.5">
                <XIcon className="h-4 w-4" /> Recusar
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* Modal de recusa */}
      <Dialog open={recusaOpen} onOpenChange={(v) => { if (!v) setRecusaOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <h3 className="font-display text-lg font-bold text-[var(--ink)]">Recusar solicitação</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Motivo (opcional) — fica visível pro cliente no portal.
          </p>
          <textarea
            value={motivoRecusa}
            onChange={e => setMotivoRecusa(e.target.value)}
            placeholder="Ex: Fora do escopo de garantia, item não coberto…"
            rows={4}
            className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecusaOpen(false)} disabled={!!acao}>
              Cancelar
            </Button>
            <Button onClick={recusar} disabled={!!acao} className="bg-rose-600 text-white hover:bg-rose-700">
              {acao === 'recusar' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmar recusa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox de anexo */}
      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-4xl">
          {viewing && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper)]/40 py-2.5 pl-4 pr-12">
                <h3 className="truncate font-display text-sm font-semibold text-[var(--ink)]">
                  {viewing.anexo.file_name}
                </h3>
                <a
                  href={viewing.url}
                  download={viewing.anexo.file_name}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brand-bright)]/40"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </a>
              </div>
              <div className="grid place-items-center bg-black/95 p-4">
                {viewing.mime.startsWith('image/') && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewing.url} alt={viewing.anexo.file_name} className="max-h-[75vh] max-w-full object-contain" />
                )}
                {viewing.mime.startsWith('video/') && (
                  <video src={viewing.url} controls autoPlay className="max-h-[75vh] max-w-full" />
                )}
                {viewing.mime === 'application/pdf' && (
                  <iframe src={viewing.url} className="h-[75vh] w-full bg-white" title={viewing.anexo.file_name} />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--ink)]">{value || '—'}</dd>
    </div>
  )
}
