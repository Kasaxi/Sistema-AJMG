'use client'

import { useRef, useState } from 'react'
import {
  Loader2, Paperclip, X as XIcon, FileText, Image as ImageIcon,
  Video, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  criarOrdemServicoPublica,
  uploadOrdemAnexoPublico,
} from '@/app/actions/ordens-servico-actions'
import { cn } from '@/lib/utils'

interface Props {
  /** Quando vindo do portal, prefixa o token pra vincular ao cliente. */
  token: string | null
  /** Pré-preenche dados (usado no portal logado). */
  defaults?: {
    nome?: string
    telefone?: string | null
    email?: string | null
    cpf_cnpj?: string | null
  }
}

const MAX_FILE_BYTES = 100 * 1024 * 1024
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

export function OrdemPublicaForm({ token, defaults }: Props) {
  const [nome, setNome] = useState(defaults?.nome ?? '')
  const [telefone, setTelefone] = useState(defaults?.telefone ?? '')
  const [email, setEmail] = useState(defaults?.email ?? '')
  const [cpfCnpj, setCpfCnpj] = useState(defaults?.cpf_cnpj ?? '')
  const [endereco, setEndereco] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function adicionarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return
    const lista = Array.from(files)
    const grandes = lista.filter(f => f.size > MAX_FILE_BYTES)
    if (grandes.length) {
      setErro(`Arquivo maior que 100 MB: ${grandes.map(f => f.name).join(', ')}`)
    }
    const validos = lista.filter(f => f.size <= MAX_FILE_BYTES)
    if (validos.length) setArquivos(prev => [...prev, ...validos])
  }
  function removerArquivo(idx: number) {
    setArquivos(prev => prev.filter((_, i) => i !== idx))
  }

  async function enviar() {
    setErro(null)
    if (!nome.trim()) { setErro('Informe seu nome.'); return }
    if (!descricao.trim()) { setErro('Descreva o problema.'); return }

    setEnviando(true)
    try {
      const { id } = await criarOrdemServicoPublica({
        token,
        nome_solicitante: nome.trim(),
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        cpf_cnpj: cpfCnpj.trim() || null,
        endereco: endereco.trim() || null,
        descricao: descricao.trim(),
      })

      // Sobe anexos em paralelo, ignorando falhas individuais
      const falhas: string[] = []
      for (const file of arquivos) {
        try {
          const fd = new FormData()
          fd.append('ordem_id', id)
          fd.append('file', file)
          await uploadOrdemAnexoPublico(fd)
        } catch (e) {
          falhas.push(`${file.name}: ${e instanceof Error ? e.message : 'erro'}`)
        }
      }

      if (falhas.length) {
        setErro(`Solicitação enviada, mas alguns arquivos falharam:\n${falhas.join('\n')}`)
      }
      setSucesso(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-3 font-display text-xl font-bold text-[var(--ink)]">
          Solicitação recebida!
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Recebemos seu pedido. Em breve um responsável entra em contato pra agendar.
        </p>
        <Button
          onClick={() => {
            setSucesso(false)
            setNome(defaults?.nome ?? '')
            setTelefone(defaults?.telefone ?? '')
            setEmail(defaults?.email ?? '')
            setCpfCnpj(defaults?.cpf_cnpj ?? '')
            setEndereco('')
            setDescricao('')
            setArquivos([])
            setErro(null)
          }}
          variant="outline"
          className="mt-6"
        >
          Enviar outra solicitação
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">{erro}</span>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Quem é você</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="o-nome">Nome completo *</Label>
            <Input id="o-nome" value={nome} onChange={e => setNome(e.target.value)} className="mt-1.5 h-11 rounded-xl" autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="o-tel">Telefone</Label>
              <Input id="o-tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="o-email">Email</Label>
              <Input id="o-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
            </div>
          </div>
          <div>
            <Label htmlFor="o-cpf">CPF ou CNPJ</Label>
            <Input id="o-cpf" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-base font-bold text-[var(--ink)]">Onde e o quê</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="o-end">Endereço do imóvel</Label>
            <Input id="o-end" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="o-desc">Descreva o problema *</Label>
            <textarea
              id="o-desc"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Torneira do banheiro pingando, mancha de umidade na parede da sala…"
              rows={5}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-bright)]/40"
            />
          </div>

          {/* Anexos */}
          <div>
            <Label>Fotos ou vídeos (opcional)</Label>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Anexe imagens ou um vídeo curto do problema. Acelera o diagnóstico.
            </p>
            {arquivos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {arquivos.map((f, i) => {
                  const { Icon, cor } = iconePorMime(f.type)
                  return (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5">
                      <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--paper)]', cor)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--ink)]">{f.name}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-[var(--ink-faint)]">{formatSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => removerArquivo(i)}
                        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded text-[var(--ink-faint)] hover:bg-rose-50 hover:text-rose-600"
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
              accept="image/*,video/*,application/pdf"
              multiple
              onChange={e => {
                adicionarArquivos(e.target.files)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] px-3.5 text-sm font-semibold text-[var(--ink-soft)] transition-all hover:border-[var(--brand-bright)]/40 hover:text-[var(--ink)]"
            >
              <Paperclip className="h-4 w-4" />
              {arquivos.length === 0 ? 'Anexar fotos ou vídeo' : 'Anexar mais'}
            </button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end">
        <Button onClick={enviar} disabled={enviando} className="h-11 px-6 text-base">
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {enviando ? 'Enviando…' : 'Enviar solicitação'}
        </Button>
      </div>

      <p className="text-center text-xs text-[var(--ink-faint)]">
        Ao enviar, você autoriza a AJMG a entrar em contato sobre essa solicitação.
      </p>
    </div>
  )
}
