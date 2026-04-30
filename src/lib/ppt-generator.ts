import type { SlideData, PptTemplate } from './masterclass-templates'

function hex(color: string): string {
  return color.replace('#', '')
}

function isColorDark(color: string): boolean {
  const c = color.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export async function generatePptxBuffer(slides: SlideData[], template: PptTemplate): Promise<Buffer> {
  // Dynamic import keeps this module server-only (pptxgenjs uses node:https)
  const PptxGenJS = (await import('pptxgenjs')).default
  const prs = new PptxGenJS()

  prs.layout = 'LAYOUT_WIDE'
  prs.author = 'Instagram Dashboard'
  prs.title = slides[0]?.title ?? 'Masterclass'

  const { colors } = template
  const isDark = isColorDark(colors.bg)

  for (const slide of slides) {
    const s = prs.addSlide()
    s.background = { fill: hex(colors.bg) }

    if (slide.type === 'title') {
      s.addShape(prs.ShapeType.rect, {
        x: 0, y: 0, w: 0.15, h: '100%',
        fill: { color: hex(colors.primary) },
        line: { type: 'none' },
      })
      s.addText(slide.title, {
        x: 0.5, y: 2.2, w: 9, h: 1.2,
        fontSize: 40, bold: true,
        color: hex(colors.text), align: 'center', fontFace: 'Calibri',
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.5, y: 3.6, w: 9, h: 0.7,
          fontSize: 22, color: hex(colors.subtitle), align: 'center', fontFace: 'Calibri',
        })
      }
      s.addShape(prs.ShapeType.rect, {
        x: 3, y: 4.5, w: 4, h: 0.05,
        fill: { color: hex(colors.primary) }, line: { type: 'none' },
      })

    } else if (slide.type === 'section') {
      s.addShape(prs.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: hex(colors.primary) }, line: { type: 'none' },
      })
      s.addText(slide.title, {
        x: 0.6, y: 2.2, w: 9, h: 1.2,
        fontSize: 36, bold: true,
        color: isDark ? hex(colors.bg) : 'FFFFFF', align: 'center', fontFace: 'Calibri',
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.6, y: 3.5, w: 9, h: 0.6,
          fontSize: 18,
          color: isDark ? hex(colors.bg) : 'FFFFFFBB',
          align: 'center', fontFace: 'Calibri',
        })
      }

    } else if (slide.type === 'closing') {
      s.addShape(prs.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: hex(colors.accent) }, line: { type: 'none' },
      })
      s.addText(slide.title, {
        x: 0.5, y: 1.8, w: 9, h: 1.2,
        fontSize: 38, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri',
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.5, y: 3.2, w: 9, h: 0.8,
          fontSize: 20, color: 'FFFFFFCC', align: 'center', fontFace: 'Calibri',
        })
      }

    } else {
      // agenda / content
      s.addShape(prs.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: hex(colors.primary) }, line: { type: 'none' },
      })
      s.addText(slide.title, {
        x: 0.5, y: 0.2, w: 9, h: 0.85,
        fontSize: 26, bold: true, color: hex(colors.primary), fontFace: 'Calibri',
      })
      s.addShape(prs.ShapeType.rect, {
        x: 0.5, y: 1.05, w: 9, h: 0.03,
        fill: { color: hex(colors.accent) + '60' }, line: { type: 'none' },
      })
      if (slide.points?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bulletItems = slide.points.map((pt) => ({
          text: pt,
          options: {
            bullet: { type: 'bullet' as const, code: '25A0', color: hex(colors.accent) },
            color: hex(colors.text),
            fontSize: 16,
            fontFace: 'Calibri',
            paraSpaceBefore: 8,
          },
        }))
        s.addText(bulletItems as Parameters<typeof s.addText>[0], {
          x: 0.5, y: 1.25, w: 9, h: 4.1, valign: 'top',
        })
      }
    }

    if (slide.notes) s.addNotes(slide.notes)
  }

  return await prs.write({ outputType: 'nodebuffer' }) as Buffer
}
