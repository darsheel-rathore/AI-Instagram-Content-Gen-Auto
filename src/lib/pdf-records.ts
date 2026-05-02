import type { GiveawayPdfContent } from './giveaway-html-template'

export interface PdfRecord {
  id: string
  generatedAt: string
  promptId: string | null
  promptTitle: string
  ctaText: string
  content: GiveawayPdfContent
  design: string
  provider: string
  model: string
}

const LS_KEY = 'pdf_records'

export function loadPdfRecords(): PdfRecord[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    return raw ? (JSON.parse(raw) as PdfRecord[]) : []
  } catch {
    return []
  }
}

export function savePdfRecords(records: PdfRecord[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(records))
  } catch { /* ignore quota */ }
}
