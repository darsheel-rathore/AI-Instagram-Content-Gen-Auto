export interface PdfContent {
  title: string
  subtitle: string
  sections: Array<{
    heading: string
    body?: string
    items?: string[]
  }>
  generatedAt: string
}

export interface PdfTemplateDefinition {
  id: string
  name: string
  description: string
  colors: { header: string; accent: string; bg: string; text: string }
}

export const PDF_TEMPLATES: PdfTemplateDefinition[] = [
  {
    id: 'executive',
    name: 'Executive',
    description: 'Navy & white, corporate precision',
    colors: { header: '#0f1737', accent: '#fbbf24', bg: '#ffffff', text: '#1e1e28' },
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Dark dashboard theme, emerald accents',
    colors: { header: '#060914', accent: '#10b981', bg: '#0a0e1c', text: '#c8d2e2' },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Deep blue corporate, cyan precision',
    colors: { header: '#073763', accent: '#06b6d4', bg: '#f1f5f9', text: '#1e293b' },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Amber & gold, warm editorial feel',
    colors: { header: '#78350f', accent: '#f59e0b', bg: '#fffcf5', text: '#1c1917' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Pure B&W, typography-first',
    colors: { header: '#080808', accent: '#888888', bg: '#ffffff', text: '#141414' },
  },
]

type RGB = [number, number, number]

interface Style {
  pageBg: RGB
  headerBg: RGB
  headerH: number
  titleColor: RGB
  subtitleColor: RGB
  dateColor: RGB
  accentBar: RGB
  headingColor: RGB
  bodyColor: RGB
  bulletColor: RGB
  separatorColor: RGB
  footerColor: RGB
  sideBarColor: RGB | null
  darkPage: boolean
}

const STYLES: Record<string, Style> = {
  executive: {
    pageBg: [255, 255, 255],
    headerBg: [15, 23, 55],
    headerH: 48,
    titleColor: [255, 255, 255],
    subtitleColor: [176, 190, 225],
    dateColor: [130, 148, 195],
    accentBar: [251, 191, 36],
    headingColor: [15, 23, 55],
    bodyColor: [50, 55, 75],
    bulletColor: [251, 191, 36],
    separatorColor: [220, 225, 240],
    footerColor: [130, 140, 165],
    sideBarColor: [251, 191, 36],
    darkPage: false,
  },
  studio: {
    pageBg: [10, 14, 28],
    headerBg: [5, 8, 18],
    headerH: 50,
    titleColor: [255, 255, 255],
    subtitleColor: [148, 163, 184],
    dateColor: [100, 116, 139],
    accentBar: [16, 185, 129],
    headingColor: [16, 185, 129],
    bodyColor: [203, 213, 225],
    bulletColor: [16, 185, 129],
    separatorColor: [28, 38, 62],
    footerColor: [100, 116, 139],
    sideBarColor: null,
    darkPage: true,
  },
  blueprint: {
    pageBg: [241, 245, 249],
    headerBg: [7, 55, 99],
    headerH: 48,
    titleColor: [255, 255, 255],
    subtitleColor: [186, 230, 253],
    dateColor: [147, 197, 253],
    accentBar: [6, 182, 212],
    headingColor: [7, 55, 99],
    bodyColor: [30, 41, 59],
    bulletColor: [6, 182, 212],
    separatorColor: [203, 213, 225],
    footerColor: [100, 116, 139],
    sideBarColor: [6, 182, 212],
    darkPage: false,
  },
  editorial: {
    pageBg: [255, 252, 245],
    headerBg: [120, 53, 15],
    headerH: 48,
    titleColor: [255, 252, 245],
    subtitleColor: [254, 215, 170],
    dateColor: [253, 186, 116],
    accentBar: [245, 158, 11],
    headingColor: [120, 53, 15],
    bodyColor: [28, 25, 23],
    bulletColor: [245, 158, 11],
    separatorColor: [231, 218, 195],
    footerColor: [161, 135, 98],
    sideBarColor: [245, 158, 11],
    darkPage: false,
  },
  minimal: {
    pageBg: [255, 255, 255],
    headerBg: [8, 8, 8],
    headerH: 40,
    titleColor: [255, 255, 255],
    subtitleColor: [180, 180, 180],
    dateColor: [140, 140, 140],
    accentBar: [80, 80, 80],
    headingColor: [15, 15, 15],
    bodyColor: [40, 40, 40],
    bulletColor: [60, 60, 60],
    separatorColor: [210, 210, 210],
    footerColor: [160, 160, 160],
    sideBarColor: null,
    darkPage: false,
  },
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function styleFromCustomColors(colors: PdfTemplateDefinition['colors']): Style {
  const pageBg = hexToRgb(colors.bg)
  const headerBg = hexToRgb(colors.header)
  const accentBar = hexToRgb(colors.accent)
  const bodyColor = hexToRgb(colors.text)
  const darkPage = (pageBg[0] * 299 + pageBg[1] * 587 + pageBg[2] * 114) / 1000 < 128
  return {
    pageBg,
    headerBg,
    headerH: 48,
    titleColor: [255, 255, 255],
    subtitleColor: [200, 215, 235],
    dateColor: [160, 175, 195],
    accentBar,
    headingColor: darkPage ? accentBar : headerBg,
    bodyColor,
    bulletColor: accentBar,
    separatorColor: darkPage ? [40, 50, 70] : [210, 215, 225],
    footerColor: [130, 140, 160],
    sideBarColor: accentBar,
    darkPage,
  }
}

function resolveStyle(templateId: string): Style {
  if (STYLES[templateId]) return STYLES[templateId]
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('pdf_custom_templates') : null
    if (raw) {
      const custom = JSON.parse(raw) as PdfTemplateDefinition[]
      const found = custom.find((t) => t.id === templateId)
      if (found) return styleFromCustomColors(found.colors)
    }
  } catch { /* ignore */ }
  return STYLES.executive
}

const LINE_H_10 = 4.5  // mm per line at 10pt
const LINE_H_11 = 5.0  // mm per line at 11pt

export async function generateAndDownloadPdf(content: PdfContent, templateId: string): Promise<void> {
  const mod = await import('jspdf')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF = (mod as any).default ?? (mod as any).jsPDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const s: Style = resolveStyle(templateId)
  const PW = 210
  const PH = 297
  const ML = 20
  const MR = 20
  const FOOTER_H = 15
  const MB = FOOTER_H + 8
  const CW = PW - ML - MR

  let y = 0

  function fillPage() {
    doc.setFillColor(...s.pageBg)
    doc.rect(0, 0, PW, PH, 'F')
  }

  function drawHeader(page1: boolean) {
    if (!page1) {
      // Thin accent stripe on subsequent pages
      doc.setFillColor(...s.accentBar)
      doc.rect(0, 0, PW, 3, 'F')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(...s.dateColor)
      const shortTitle = content.title.length > 80 ? content.title.slice(0, 77) + '…' : content.title
      doc.text(shortTitle, ML, 9)
      y = 16
      return
    }

    // Header band
    doc.setFillColor(...s.headerBg)
    doc.rect(0, 0, PW, s.headerH, 'F')

    // Accent bar at bottom of header
    doc.setFillColor(...s.accentBar)
    doc.rect(0, s.headerH - 1.5, PW, 1.5, 'F')

    // Decorative left accent block
    doc.setFillColor(...s.accentBar)
    doc.rect(ML, 11, 3, 3, 'F')

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...s.titleColor)
    const titleLines: string[] = doc.splitTextToSize(content.title, CW - 10)
    doc.text(titleLines, ML + 7, 17)

    const titleBottom = 17 + (titleLines.length - 1) * 7.5

    // Subtitle
    if (content.subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...s.subtitleColor)
      const subLines: string[] = doc.splitTextToSize(content.subtitle, CW - 10)
      doc.text(subLines, ML + 7, titleBottom + 7)
    }

    // Date top-right
    const dateStr = new Date(content.generatedAt).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...s.dateColor)
    doc.text(dateStr, PW - MR, 10, { align: 'right' })

    y = s.headerH + 10
  }

  function drawFooters(totalPages: number) {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setDrawColor(...s.separatorColor)
      doc.setLineWidth(0.4)
      doc.line(ML, PH - FOOTER_H, PW - MR, PH - FOOTER_H)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...s.footerColor)
      doc.text('Content Strategy Report', ML, PH - FOOTER_H + 6)
      doc.text(`${p} / ${totalPages}`, PW / 2, PH - FOOTER_H + 6, { align: 'center' })
      doc.text(
        new Date(content.generatedAt).getFullYear().toString(),
        PW - MR,
        PH - FOOTER_H + 6,
        { align: 'right' },
      )
    }
  }

  function checkBreak(neededMm: number) {
    if (y + neededMm > PH - MB) {
      doc.addPage()
      fillPage()
      drawHeader(false)
    }
  }

  function renderSection(section: { heading: string; body?: string; items?: string[] }, idx: number) {
    // Section heading
    checkBreak(18)

    if (s.sideBarColor) {
      doc.setFillColor(...s.sideBarColor)
      doc.rect(ML, y, 2.5, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...s.headingColor)
      doc.text(section.heading.toUpperCase(), ML + 5.5, y + 5)
    } else {
      // Minimal / Studio: heading + accent underline
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...s.headingColor)
      doc.text(section.heading.toUpperCase(), ML, y + 5)
      if (!s.darkPage) {
        doc.setDrawColor(...s.accentBar)
        doc.setLineWidth(0.5)
        doc.line(ML, y + 7, ML + 30, y + 7)
      }
    }
    y += LINE_H_11 + 5

    // Body text
    if (section.body?.trim()) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...s.bodyColor)
      const lines: string[] = doc.splitTextToSize(section.body, CW)
      checkBreak(lines.length * LINE_H_10 + 4)
      doc.text(lines, ML, y)
      y += lines.length * LINE_H_10 + 4
    }

    // Bullet items
    if (section.items?.length) {
      for (const item of section.items) {
        const lines: string[] = doc.splitTextToSize(item, CW - 7)
        checkBreak(lines.length * LINE_H_10 + 3)

        // Bullet dot or dash for minimal
        if (s.sideBarColor) {
          doc.setFillColor(...s.bulletColor)
          doc.circle(ML + 1.8, y + 1.8, 1.2, 'F')
        } else {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.setTextColor(...s.bulletColor)
          doc.text('–', ML + 0.5, y + 3.5)
        }

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...s.bodyColor)
        doc.text(lines, ML + 7, y + (lines.length > 1 ? 0 : 0))
        y += lines.length * LINE_H_10 + 3
      }
      y += 2
    }

    // Section separator (not after last section)
    const isLast = idx === (content.sections?.length ?? 0) - 1
    if (!isLast) {
      y += 4
      checkBreak(8)
      doc.setDrawColor(...s.separatorColor)
      doc.setLineWidth(0.3)
      doc.line(ML, y, PW - MR, y)
      y += 8
    }
  }

  // ── Render ─────────────────────────────────────────
  fillPage()
  drawHeader(true)

  for (let i = 0; i < content.sections.length; i++) {
    renderSection(content.sections[i], i)
  }

  drawFooters(doc.getNumberOfPages())

  const safe = content.title.slice(0, 50).replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-').toLowerCase()
  doc.save(`${safe || 'content-strategy'}.pdf`)
}
