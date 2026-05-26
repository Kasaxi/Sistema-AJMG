export interface WhatsappContato {
  id: string
  nome: string
  numero: string         // dígitos, normalizado (5561991731449)
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface WhatsappContatoInput {
  nome: string
  numero: string         // pode vir formatado, a action normaliza
}

/**
 * Normaliza um número de WhatsApp pra dígitos apenas, com country code BR
 * se ausente. Retorna null se o input não bate com nada útil.
 */
export function normalizeWhatsappNumber(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`  // BR sem code
  if (digits.length === 12 || digits.length === 13) return digits          // já tem country code
  return null
}

/** Formata um número normalizado pra exibição: 55 (61) 99173-1449 */
export function formatWhatsappDisplay(numero: string): string {
  // Remove country code 55 se BR
  const semCountry = numero.startsWith('55') && (numero.length === 12 || numero.length === 13)
    ? numero.slice(2)
    : numero
  if (semCountry.length === 11) {
    // (61) 99173-1449
    return `(${semCountry.slice(0, 2)}) ${semCountry.slice(2, 7)}-${semCountry.slice(7)}`
  }
  if (semCountry.length === 10) {
    return `(${semCountry.slice(0, 2)}) ${semCountry.slice(2, 6)}-${semCountry.slice(6)}`
  }
  return numero
}
