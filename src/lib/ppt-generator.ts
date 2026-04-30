import type { SlideData, PptTemplate } from './masterclass-templates'

// ── Constants ──────────────────────────────────────────────────────────────────
const PW = 13.33   // LAYOUT_WIDE width (inches)
const PH = 7.5     // LAYOUT_WIDE height (inches)
const ML = 0.7     // left margin
const MR = 0.7     // right margin
const CW = PW - ML - MR  // content width

// ── Helpers ────────────────────────────────────────────────────────────────────
function h(color: string): string { return color.replace('#', '') }
function gh(slide: SlideData): string { return slide.heading ?? slide.title ?? '' }
function gbullets(slide: SlideData): string[] { return slide.bullets ?? slide.points ?? [] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slide = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Prs = any

function addBullets(s: Slide, items: string[], opts: {
  x: number; y: number; w: number; h: number;
  bulletColor: string; textColor: string; fontSize?: number; fontFace?: string;
}) {
  if (!items.length) return
  const bulletItems = items.map((pt) => ({
    text: pt,
    options: {
      bullet: { type: 'bullet' as const, code: '25CF', color: opts.bulletColor },
      color: opts.textColor,
      fontSize: opts.fontSize ?? 15,
      fontFace: opts.fontFace ?? 'Calibri',
      paraSpaceBefore: 6,
    },
  }))
  s.addText(bulletItems, { x: opts.x, y: opts.y, w: opts.w, h: opts.h, valign: 'top' })
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — EXECUTIVE DARK
// Navy #0f1729 · Gold #c9a84c · Text white · Subtle left gold bar
// Footer @themedhachannel on every slide
// ══════════════════════════════════════════════════════════════════════════════

function execTitle(prs: Prs, s: Slide, slide: SlideData) {
  // Large centered title
  s.addText(gh(slide), {
    x: ML, y: 2.2, w: CW, h: 1.4,
    fontSize: 44, bold: true, color: h('#ffffff'),
    align: 'center', fontFace: 'Georgia',
  })
  // Gold underline
  s.addShape(prs.ShapeType.rect, {
    x: PW / 2 - 1.8, y: 3.7, w: 3.6, h: 0.06,
    fill: { color: h('#c9a84c') }, line: { type: 'none' },
  })
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: ML, y: 3.9, w: CW, h: 0.7,
      fontSize: 22, color: h('#94a3b8'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: ML, y: 4.65, w: CW, h: 0.45,
      fontSize: 13, color: h('#64748b'), align: 'center', fontFace: 'Calibri', italic: true,
    })
  }
}

function execAgenda(prs: Prs, s: Slide, slide: SlideData) {
  s.addText('AGENDA', {
    x: ML + 0.15, y: 0.5, w: 2, h: 0.4,
    fontSize: 11, bold: true, color: h('#c9a84c'), fontFace: 'Calibri', charSpacing: 3,
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML + 0.15, y: 0.95, w: CW - 0.2, h: 0.03,
    fill: { color: h('#c9a84c') + '55' }, line: { type: 'none' },
  })
  const items = slide.items ?? gbullets(slide)
  items.forEach((item, i) => {
    s.addText(`${i + 1}`, {
      x: ML + 0.15, y: 1.2 + i * 0.75, w: 0.4, h: 0.55,
      fontSize: 18, bold: true, color: h('#c9a84c'), fontFace: 'Georgia',
    })
    s.addText(item, {
      x: ML + 0.65, y: 1.25 + i * 0.75, w: CW - 0.7, h: 0.5,
      fontSize: 18, color: h('#cbd5e1'), fontFace: 'Calibri',
    })
  })
}

function execContent(prs: Prs, s: Slide, slide: SlideData) {
  s.addText(gh(slide), {
    x: ML + 0.15, y: 0.5, w: CW - 0.2, h: 0.85,
    fontSize: 30, bold: true, color: h('#ffffff'), fontFace: 'Georgia',
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML + 0.15, y: 1.38, w: CW - 0.2, h: 0.04,
    fill: { color: h('#c9a84c') + '40' }, line: { type: 'none' },
  })
  const items = gbullets(slide)
  const bHeight = slide.insight ? 3.2 : 4.5
  addBullets(s, items, {
    x: ML + 0.15, y: 1.55, w: CW - 0.4, h: bHeight,
    bulletColor: h('#c9a84c'), textColor: h('#cbd5e1'), fontSize: 16,
  })
  if (slide.insight) {
    // Dark insight box
    s.addShape(prs.ShapeType.rect, {
      x: ML + 0.15, y: 5.0, w: CW - 0.3, h: 1.1,
      fill: { color: '1a2540' }, line: { color: h('#c9a84c'), pt: 1.5, type: 'solid' },
    })
    s.addShape(prs.ShapeType.rect, {
      x: ML + 0.15, y: 5.0, w: 0.07, h: 1.1,
      fill: { color: h('#c9a84c') }, line: { type: 'none' },
    })
    s.addText(slide.insight, {
      x: ML + 0.4, y: 5.12, w: CW - 0.65, h: 0.86,
      fontSize: 13, color: h('#c8d5ea'), italic: true, fontFace: 'Calibri', valign: 'middle',
    })
  }
}

function execQuote(prs: Prs, s: Slide, slide: SlideData) {
  // Large decorative quote marks
  s.addText('“', {
    x: ML, y: 0.8, w: 1.5, h: 1.5,
    fontSize: 100, color: h('#c9a84c') + '50', fontFace: 'Georgia', bold: true,
  })
  s.addText(slide.text ?? '', {
    x: ML + 0.8, y: 1.6, w: CW - 1.0, h: 2.5,
    fontSize: 24, color: h('#ffffff'), italic: true, fontFace: 'Georgia',
    align: 'center', valign: 'middle',
  })
  if (slide.attribution) {
    s.addShape(prs.ShapeType.rect, {
      x: PW / 2 - 0.8, y: 4.3, w: 1.6, h: 0.04,
      fill: { color: h('#c9a84c') }, line: { type: 'none' },
    })
    s.addText(`— ${slide.attribution}`, {
      x: ML, y: 4.45, w: CW, h: 0.5,
      fontSize: 14, color: h('#94a3b8'), align: 'center', fontFace: 'Calibri',
    })
  }
}

function execExercise(prs: Prs, s: Slide, slide: SlideData) {
  // Gold circle badge
  s.addShape(prs.ShapeType.ellipse, {
    x: ML + 0.15, y: 0.45, w: 0.65, h: 0.65,
    fill: { color: h('#c9a84c') }, line: { type: 'none' },
  })
  s.addText('✦', {
    x: ML + 0.15, y: 0.45, w: 0.65, h: 0.65,
    fontSize: 18, color: '0f1729', align: 'center', valign: 'middle', fontFace: 'Calibri',
  })
  s.addText(gh(slide), {
    x: ML + 1.0, y: 0.5, w: CW - 1.1, h: 0.7,
    fontSize: 26, bold: true, color: h('#ffffff'), fontFace: 'Georgia',
  })
  if (slide.instructions) {
    s.addText('Instructions', {
      x: ML + 0.15, y: 1.4, w: 3, h: 0.35,
      fontSize: 10, bold: true, color: h('#c9a84c'), fontFace: 'Calibri', charSpacing: 2,
    })
    s.addText(slide.instructions, {
      x: ML + 0.15, y: 1.8, w: CW - 0.3, h: 2.2,
      fontSize: 16, color: h('#cbd5e1'), fontFace: 'Calibri',
    })
  }
  if (slide.reflection) {
    s.addShape(prs.ShapeType.rect, {
      x: ML + 0.15, y: 4.2, w: CW - 0.3, h: 0.85,
      fill: { color: '1a2540' }, line: { type: 'none' },
    })
    s.addText(`\u{1F9D8}  ${slide.reflection}`, {
      x: ML + 0.35, y: 4.32, w: CW - 0.65, h: 0.61,
      fontSize: 13, color: h('#c9a84c'), italic: true, fontFace: 'Calibri',
    })
  }
}

function execDivider(prs: Prs, s: Slide, slide: SlideData) {
  // Full-width gold band
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 2.75, w: PW, h: 1.8,
    fill: { color: h('#c9a84c') }, line: { type: 'none' },
  })
  s.addText(slide.sectionTitle ?? gh(slide), {
    x: ML, y: 2.9, w: CW, h: 1.5,
    fontSize: 36, bold: true, color: h('#0f1729'),
    align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
}

function execCta(prs: Prs, s: Slide, slide: SlideData) {
  // Top gold bar
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: PW, h: 0.18,
    fill: { color: h('#c9a84c') }, line: { type: 'none' },
  })
  s.addText(gh(slide), {
    x: ML, y: 0.5, w: CW, h: 1.2,
    fontSize: 38, bold: true, color: h('#ffffff'), align: 'center', fontFace: 'Georgia',
  })
  if (slide.offer) {
    s.addText(slide.offer, {
      x: ML, y: 1.9, w: CW, h: 0.7,
      fontSize: 20, color: h('#cbd5e1'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.price) {
    s.addText(slide.price, {
      x: ML, y: 2.8, w: CW, h: 0.9,
      fontSize: 42, bold: true, color: h('#c9a84c'), align: 'center', fontFace: 'Georgia',
    })
  }
  if (slide.handle) {
    s.addText(`@${slide.handle.replace(/^@/, '')}`, {
      x: ML, y: 3.85, w: CW, h: 0.5,
      fontSize: 18, color: h('#c9a84c'), align: 'center', fontFace: 'Calibri',
    })
  }
  // Bottom gold bar
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: PH - 0.18, w: PW, h: 0.18,
    fill: { color: h('#c9a84c') }, line: { type: 'none' },
  })
}

function renderExecutive(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: h('#0f1729') }
  // Left gold sidebar on every slide
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.1, h: PH,
    fill: { color: h('#c9a84c') }, line: { type: 'none' },
  })
  switch (slide.type) {
    case 'title':    execTitle(prs, s, slide);    break
    case 'agenda':   execAgenda(prs, s, slide);   break
    case 'quote':    execQuote(prs, s, slide);     break
    case 'exercise': execExercise(prs, s, slide); break
    case 'divider':  execDivider(prs, s, slide);  break
    case 'cta':      execCta(prs, s, slide);       break
    default:         execContent(prs, s, slide)
  }
  // Footer handle
  s.addText('@themedhachannel', {
    x: PW - 2.1, y: PH - 0.33, w: 2.0, h: 0.25,
    fontSize: 7, color: h('#475569'), align: 'right', fontFace: 'Calibri',
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — CLEAN LIGHT
// White bg · Violet #7c3aed · Navy headings · Violet left borders
// Thin violet bottom bar + slide number on every slide
// ══════════════════════════════════════════════════════════════════════════════

function cleanTitle(prs: Prs, s: Slide, slide: SlideData) {
  // Violet left accent
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 1.8, w: 0.22, h: 3.5,
    fill: { color: h('#7c3aed') }, line: { type: 'none' },
  })
  s.addText(gh(slide), {
    x: ML, y: 2.0, w: CW, h: 1.5,
    fontSize: 42, bold: true, color: h('#0f1729'), fontFace: 'Georgia',
  })
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: ML, y: 3.65, w: CW, h: 0.7,
      fontSize: 22, color: h('#6b7280'), fontFace: 'Calibri',
    })
  }
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: ML, y: 4.45, w: CW, h: 0.45,
      fontSize: 13, color: h('#9ca3af'), italic: true, fontFace: 'Calibri',
    })
  }
}

function cleanAgenda(prs: Prs, s: Slide, slide: SlideData) {
  s.addText('AGENDA', {
    x: ML, y: 0.45, w: 2.5, h: 0.45,
    fontSize: 12, bold: true, color: h('#7c3aed'), fontFace: 'Calibri', charSpacing: 3,
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 0.95, w: CW, h: 0.04,
    fill: { color: h('#7c3aed') }, line: { type: 'none' },
  })
  const items = slide.items ?? gbullets(slide)
  items.forEach((item, i) => {
    s.addShape(prs.ShapeType.rect, {
      x: ML, y: 1.2 + i * 0.72, w: 0.06, h: 0.5,
      fill: { color: h('#7c3aed') }, line: { type: 'none' },
    })
    s.addText(item, {
      x: ML + 0.25, y: 1.22 + i * 0.72, w: CW - 0.3, h: 0.5,
      fontSize: 17, color: h('#0f1729'), fontFace: 'Calibri',
    })
  })
}

function cleanContent(prs: Prs, s: Slide, slide: SlideData) {
  s.addText(gh(slide), {
    x: ML, y: 0.45, w: CW, h: 0.9,
    fontSize: 30, bold: true, color: h('#0f1729'), fontFace: 'Georgia',
  })
  // Violet underline
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 1.38, w: 2.5, h: 0.05,
    fill: { color: h('#7c3aed') }, line: { type: 'none' },
  })
  const items = gbullets(slide)
  const bHeight = slide.insight ? 2.8 : 4.5
  addBullets(s, items, {
    x: ML, y: 1.6, w: CW, h: bHeight,
    bulletColor: h('#7c3aed'), textColor: h('#374151'), fontSize: 16,
  })
  if (slide.insight) {
    // Light violet insight box
    s.addShape(prs.ShapeType.rect, {
      x: ML, y: 4.6, w: CW, h: 1.1,
      fill: { color: 'f5f3ff' }, line: { type: 'none' },
    })
    s.addShape(prs.ShapeType.rect, {
      x: ML, y: 4.6, w: 0.06, h: 1.1,
      fill: { color: h('#7c3aed') }, line: { type: 'none' },
    })
    s.addText(slide.insight, {
      x: ML + 0.25, y: 4.72, w: CW - 0.35, h: 0.86,
      fontSize: 13, color: h('#4c1d95'), italic: true, fontFace: 'Calibri', valign: 'middle',
    })
  }
}

function cleanQuote(prs: Prs, s: Slide, slide: SlideData) {
  s.addText('“', {
    x: ML, y: 0.8, w: 1.5, h: 1.5,
    fontSize: 100, color: h('#7c3aed') + '40', fontFace: 'Georgia', bold: true,
  })
  s.addText(slide.text ?? '', {
    x: ML + 0.6, y: 1.5, w: CW - 0.8, h: 2.5,
    fontSize: 24, color: h('#0f1729'), italic: true, fontFace: 'Georgia',
    align: 'center', valign: 'middle',
  })
  if (slide.attribution) {
    s.addText(`— ${slide.attribution}`, {
      x: ML, y: 4.3, w: CW, h: 0.5,
      fontSize: 14, color: h('#6b7280'), align: 'center', fontFace: 'Calibri',
    })
  }
}

function cleanExercise(prs: Prs, s: Slide, slide: SlideData) {
  s.addShape(prs.ShapeType.ellipse, {
    x: ML, y: 0.45, w: 0.65, h: 0.65,
    fill: { color: h('#7c3aed') }, line: { type: 'none' },
  })
  s.addText('✦', {
    x: ML, y: 0.45, w: 0.65, h: 0.65,
    fontSize: 16, color: 'ffffff', align: 'center', valign: 'middle',
  })
  s.addText(gh(slide), {
    x: ML + 0.85, y: 0.5, w: CW - 0.9, h: 0.7,
    fontSize: 26, bold: true, color: h('#0f1729'), fontFace: 'Georgia',
  })
  if (slide.instructions) {
    s.addText(slide.instructions, {
      x: ML, y: 1.4, w: CW, h: 2.4,
      fontSize: 16, color: h('#374151'), fontFace: 'Calibri',
    })
  }
  if (slide.reflection) {
    s.addShape(prs.ShapeType.rect, {
      x: ML, y: 4.0, w: CW, h: 0.85,
      fill: { color: 'f5f3ff' }, line: { type: 'none' },
    })
    s.addText(slide.reflection, {
      x: ML + 0.2, y: 4.12, w: CW - 0.3, h: 0.61,
      fontSize: 13, color: h('#7c3aed'), italic: true, fontFace: 'Calibri',
    })
  }
}

function cleanDivider(prs: Prs, s: Slide, slide: SlideData) {
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: PW, h: PH,
    fill: { color: h('#7c3aed') }, line: { type: 'none' },
  })
  s.addText(slide.sectionTitle ?? gh(slide), {
    x: ML, y: 2.5, w: CW, h: 2.0,
    fontSize: 40, bold: true, color: 'ffffff',
    align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
}

function cleanCta(prs: Prs, s: Slide, slide: SlideData) {
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: PW, h: PH,
    fill: { color: h('#0f1729') }, line: { type: 'none' },
  })
  s.addText(gh(slide), {
    x: ML, y: 0.6, w: CW, h: 1.2,
    fontSize: 38, bold: true, color: 'ffffff', align: 'center', fontFace: 'Georgia',
  })
  if (slide.offer) {
    s.addText(slide.offer, {
      x: ML, y: 2.0, w: CW, h: 0.7,
      fontSize: 20, color: h('#cbd5e1'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.price) {
    s.addText(slide.price, {
      x: ML, y: 2.85, w: CW, h: 0.9,
      fontSize: 40, bold: true, color: h('#7c3aed'), align: 'center', fontFace: 'Georgia',
    })
  }
  if (slide.handle) {
    s.addText(`@${slide.handle.replace(/^@/, '')}`, {
      x: ML, y: 3.9, w: CW, h: 0.5,
      fontSize: 18, color: h('#7c3aed'), align: 'center',
    })
  }
}

function renderClean(prs: Prs, s: Slide, slide: SlideData, slideIdx: number) {
  const isDividerOrCta = slide.type === 'divider' || slide.type === 'cta'
  s.background = { fill: isDividerOrCta ? h('#0f1729') : 'ffffff' }

  // Subtle grid watermark on light slides
  if (!isDividerOrCta) {
    for (let row = 0; row < 8; row++) {
      s.addShape(prs.ShapeType.rect, {
        x: 0, y: row * PH / 7, w: PW, h: 0.005,
        fill: { color: h('#7c3aed') + '08' }, line: { type: 'none' },
      })
    }
    for (let col = 0; col < 14; col++) {
      s.addShape(prs.ShapeType.rect, {
        x: col * PW / 13, y: 0, w: 0.005, h: PH,
        fill: { color: h('#7c3aed') + '08' }, line: { type: 'none' },
      })
    }
  }

  switch (slide.type) {
    case 'title':    cleanTitle(prs, s, slide);    break
    case 'agenda':   cleanAgenda(prs, s, slide);   break
    case 'quote':    cleanQuote(prs, s, slide);    break
    case 'exercise': cleanExercise(prs, s, slide); break
    case 'divider':  cleanDivider(prs, s, slide);  break
    case 'cta':      cleanCta(prs, s, slide);      break
    default:         cleanContent(prs, s, slide)
  }

  // Bottom violet bar + slide number on non-dark slides
  if (!isDividerOrCta) {
    s.addShape(prs.ShapeType.rect, {
      x: 0, y: PH - 0.12, w: PW, h: 0.12,
      fill: { color: h('#7c3aed') }, line: { type: 'none' },
    })
    s.addText(`${slideIdx + 1}`, {
      x: 0.3, y: PH - 0.38, w: 0.6, h: 0.28,
      fontSize: 9, color: h('#9ca3af'), fontFace: 'Calibri',
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — BOLD MODERN
// Left 40% violet · Right 60% white · Split layout throughout
// High contrast, editorial feel
// ══════════════════════════════════════════════════════════════════════════════

const SPLIT = PW * 0.4   // 5.33"
const RSPLIT = PW - SPLIT // 8.0"

function boldPanels(prs: Prs, s: Slide) {
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: SPLIT, h: PH,
    fill: { color: h('#7c3aed') }, line: { type: 'none' },
  })
}

function boldTitle(prs: Prs, s: Slide, slide: SlideData) {
  boldPanels(prs, s)
  s.addText(gh(slide), {
    x: 0.35, y: 1.8, w: SPLIT - 0.5, h: 3.0,
    fontSize: 36, bold: true, color: 'ffffff', fontFace: 'Georgia',
    valign: 'middle',
  })
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: SPLIT + 0.5, y: 2.4, w: RSPLIT - 0.7, h: 1.0,
      fontSize: 22, color: h('#1a1a2e'), fontFace: 'Georgia', italic: true,
    })
  }
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: SPLIT + 0.5, y: 3.6, w: RSPLIT - 0.7, h: 0.55,
      fontSize: 14, color: h('#6b7280'), fontFace: 'Calibri', italic: true,
    })
  }
}

function boldAgenda(prs: Prs, s: Slide, slide: SlideData) {
  boldPanels(prs, s)
  s.addText('AGENDA', {
    x: 0.35, y: 3.0, w: SPLIT - 0.5, h: 0.8,
    fontSize: 28, bold: true, color: 'ffffff', fontFace: 'Georgia', valign: 'middle',
  })
  const items = slide.items ?? gbullets(slide)
  items.forEach((item, i) => {
    s.addShape(prs.ShapeType.rect, {
      x: SPLIT + 0.45, y: 0.6 + i * 0.75, w: 0.06, h: 0.55,
      fill: { color: h('#7c3aed') }, line: { type: 'none' },
    })
    s.addText(item, {
      x: SPLIT + 0.65, y: 0.62 + i * 0.75, w: RSPLIT - 0.85, h: 0.55,
      fontSize: 17, color: h('#1a1a2e'), fontFace: 'Calibri',
    })
  })
}

function boldContent(prs: Prs, s: Slide, slide: SlideData) {
  boldPanels(prs, s)
  s.addText(gh(slide), {
    x: 0.35, y: 1.5, w: SPLIT - 0.5, h: 3.5,
    fontSize: 28, bold: true, color: 'ffffff', fontFace: 'Georgia', valign: 'middle',
  })
  const items = gbullets(slide)
  addBullets(s, items, {
    x: SPLIT + 0.45, y: 0.5, w: RSPLIT - 0.65, h: slide.insight ? 4.0 : 5.8,
    bulletColor: h('#7c3aed'), textColor: h('#1a1a2e'), fontSize: 16,
  })
  if (slide.insight) {
    s.addText(`“ ${slide.insight} ”`, {
      x: SPLIT + 0.45, y: 4.7, w: RSPLIT - 0.65, h: 1.0,
      fontSize: 14, color: h('#7c3aed'), italic: true, fontFace: 'Georgia',
    })
  }
}

function boldQuote(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: h('#7c3aed') }
  // Large decorative marks
  s.addText('“', {
    x: 0.3, y: 0.2, w: 2.5, h: 2.5,
    fontSize: 120, color: 'ffffff' + '20', fontFace: 'Georgia', bold: true,
  })
  s.addText('”', {
    x: PW - 2.8, y: 3.0, w: 2.5, h: 2.5,
    fontSize: 120, color: 'ffffff' + '20', fontFace: 'Georgia', bold: true,
  })
  s.addText(slide.text ?? '', {
    x: ML + 0.5, y: 1.4, w: CW - 0.6, h: 3.0,
    fontSize: 26, color: 'ffffff', italic: true, fontFace: 'Georgia',
    align: 'center', valign: 'middle',
  })
  if (slide.attribution) {
    s.addText(`— ${slide.attribution}`, {
      x: ML, y: 4.6, w: CW, h: 0.5,
      fontSize: 15, color: h('#c084fc'), align: 'center', fontFace: 'Calibri',
    })
  }
}

function boldExercise(prs: Prs, s: Slide, slide: SlideData) {
  boldPanels(prs, s)
  s.addText('EXERCISE', {
    x: 0.35, y: 1.0, w: SPLIT - 0.5, h: 0.5,
    fontSize: 11, bold: true, color: h('#c084fc'), fontFace: 'Calibri', charSpacing: 3,
  })
  s.addText(gh(slide), {
    x: 0.35, y: 1.6, w: SPLIT - 0.5, h: 2.8,
    fontSize: 26, bold: true, color: 'ffffff', fontFace: 'Georgia', valign: 'middle',
  })
  if (slide.instructions) {
    s.addText(slide.instructions, {
      x: SPLIT + 0.45, y: 0.5, w: RSPLIT - 0.65, h: 3.0,
      fontSize: 16, color: h('#1a1a2e'), fontFace: 'Calibri',
    })
  }
  if (slide.reflection) {
    s.addShape(prs.ShapeType.rect, {
      x: SPLIT + 0.45, y: 3.7, w: RSPLIT - 0.65, h: 0.9,
      fill: { color: h('#f5f3ff') }, line: { type: 'none' },
    })
    s.addText(slide.reflection, {
      x: SPLIT + 0.65, y: 3.82, w: RSPLIT - 0.9, h: 0.66,
      fontSize: 13, color: h('#7c3aed'), italic: true, fontFace: 'Calibri',
    })
  }
}

function boldDivider(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: h('#7c3aed') }
  s.addText(slide.sectionTitle ?? gh(slide), {
    x: ML, y: 2.2, w: CW, h: 2.5,
    fontSize: 52, bold: true, color: 'ffffff',
    align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
}

function boldCta(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: h('#7c3aed') }
  s.addText(gh(slide), {
    x: ML, y: 0.7, w: CW, h: 1.2,
    fontSize: 38, bold: true, color: 'ffffff', align: 'center', fontFace: 'Georgia',
  })
  if (slide.offer) {
    s.addText(slide.offer, {
      x: ML, y: 2.1, w: CW, h: 0.7,
      fontSize: 20, color: h('#c084fc'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.price) {
    s.addText(slide.price, {
      x: ML, y: 2.9, w: CW, h: 0.9,
      fontSize: 42, bold: true, color: 'ffffff', align: 'center', fontFace: 'Georgia',
    })
  }
  if (slide.handle) {
    s.addText(`@${slide.handle.replace(/^@/, '')}`, {
      x: ML, y: 3.95, w: CW, h: 0.5,
      fontSize: 18, color: h('#fbbf24'), align: 'center',
    })
  }
}

function renderBold(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: 'ffffff' }
  switch (slide.type) {
    case 'title':    boldTitle(prs, s, slide);    break
    case 'agenda':   boldAgenda(prs, s, slide);   break
    case 'quote':    boldQuote(prs, s, slide);    break
    case 'exercise': boldExercise(prs, s, slide); break
    case 'divider':  boldDivider(prs, s, slide);  break
    case 'cta':      boldCta(prs, s, slide);      break
    default:         boldContent(prs, s, slide)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 4 — MINIMAL
// Pure white · Black typography · Single thin line · Gold on insight/price only
// Premium print publication feel
// ══════════════════════════════════════════════════════════════════════════════

function minTitle(prs: Prs, s: Slide, slide: SlideData) {
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 1.9, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  s.addText(gh(slide), {
    x: ML, y: 2.05, w: CW, h: 1.6,
    fontSize: 48, bold: true, color: h('#080808'),
    align: 'center', fontFace: 'Georgia',
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 3.75, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: ML, y: 3.9, w: CW, h: 0.65,
      fontSize: 18, color: h('#4b5563'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: ML, y: 4.65, w: CW, h: 0.4,
      fontSize: 12, color: h('#9ca3af'), align: 'center', italic: true, fontFace: 'Calibri',
    })
  }
}

function minAgenda(prs: Prs, s: Slide, slide: SlideData) {
  s.addText('AGENDA', {
    x: ML, y: 0.5, w: 3, h: 0.45,
    fontSize: 11, bold: true, color: '141414', fontFace: 'Calibri', charSpacing: 5,
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 0.98, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  const items = slide.items ?? gbullets(slide)
  items.forEach((item, i) => {
    s.addText(item, {
      x: ML, y: 1.25 + i * 0.72, w: CW, h: 0.6,
      fontSize: 20, color: h('#141414'), fontFace: 'Calibri',
    })
    if (i < items.length - 1) {
      s.addShape(prs.ShapeType.rect, {
        x: ML, y: 1.87 + i * 0.72, w: CW, h: 0.01,
        fill: { color: 'e5e7eb' }, line: { type: 'none' },
      })
    }
  })
}

function minContent(prs: Prs, s: Slide, slide: SlideData) {
  s.addText(gh(slide), {
    x: ML, y: 0.5, w: CW, h: 1.0,
    fontSize: 36, bold: true, color: h('#080808'), fontFace: 'Georgia',
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 1.52, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  const items = gbullets(slide)
  addBullets(s, items, {
    x: ML, y: 1.7, w: CW, h: slide.insight ? 3.0 : 4.6,
    bulletColor: h('#141414'), textColor: h('#374151'), fontSize: 16, fontFace: 'Calibri',
  })
  if (slide.insight) {
    s.addText(slide.insight, {
      x: ML, y: 4.9, w: CW, h: 0.7,
      fontSize: 16, color: h('#c9a84c'), italic: true, fontFace: 'Georgia',
    })
  }
}

function minQuote(prs: Prs, s: Slide, slide: SlideData) {
  s.addText('“', {
    x: ML, y: 0.5, w: 1.5, h: 1.8,
    fontSize: 100, color: h('#e5e7eb'), fontFace: 'Georgia', bold: true,
  })
  s.addText(slide.text ?? '', {
    x: ML, y: 1.5, w: CW, h: 3.0,
    fontSize: 28, color: h('#080808'), bold: true, fontFace: 'Georgia',
    align: 'center', valign: 'middle',
  })
  s.addShape(prs.ShapeType.rect, {
    x: PW / 2 - 1.0, y: 4.6, w: 2.0, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  if (slide.attribution) {
    s.addText(`— ${slide.attribution}`, {
      x: ML, y: 4.75, w: CW, h: 0.5,
      fontSize: 14, color: h('#6b7280'), align: 'center', fontFace: 'Calibri',
    })
  }
}

function minExercise(prs: Prs, s: Slide, slide: SlideData) {
  s.addText(gh(slide), {
    x: ML, y: 0.45, w: CW, h: 0.9,
    fontSize: 36, bold: true, color: h('#080808'), fontFace: 'Georgia',
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 1.38, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  if (slide.instructions) {
    s.addText(slide.instructions, {
      x: ML, y: 1.6, w: CW, h: 2.8,
      fontSize: 16, color: h('#374151'), fontFace: 'Calibri',
    })
  }
  if (slide.reflection) {
    s.addText(slide.reflection, {
      x: ML, y: 4.55, w: CW, h: 0.65,
      fontSize: 15, color: h('#c9a84c'), italic: true, fontFace: 'Georgia',
    })
  }
}

function minDivider(prs: Prs, s: Slide, slide: SlideData) {
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 2.8, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  s.addText(slide.sectionTitle ?? gh(slide), {
    x: ML, y: 3.0, w: CW, h: 1.5,
    fontSize: 40, bold: true, color: h('#080808'),
    align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 4.6, w: CW, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
}

function minCta(prs: Prs, s: Slide, slide: SlideData) {
  s.addText(gh(slide), {
    x: ML, y: 1.2, w: CW, h: 1.2,
    fontSize: 36, bold: true, color: h('#080808'), align: 'center', fontFace: 'Georgia',
  })
  s.addShape(prs.ShapeType.rect, {
    x: PW / 2 - 1.5, y: 2.5, w: 3.0, h: 0.025,
    fill: { color: '141414' }, line: { type: 'none' },
  })
  if (slide.offer) {
    s.addText(slide.offer, {
      x: ML, y: 2.7, w: CW, h: 0.7,
      fontSize: 18, color: h('#4b5563'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.price) {
    s.addText(slide.price, {
      x: ML, y: 3.5, w: CW, h: 1.0,
      fontSize: 42, bold: true, color: h('#c9a84c'), align: 'center', fontFace: 'Georgia',
    })
  }
  if (slide.handle) {
    s.addText(`@${slide.handle.replace(/^@/, '')}`, {
      x: ML, y: 4.6, w: CW, h: 0.5,
      fontSize: 16, color: h('#c9a84c'), align: 'center',
    })
  }
}

function renderMinimal(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: 'ffffff' }
  switch (slide.type) {
    case 'title':    minTitle(prs, s, slide);    break
    case 'agenda':   minAgenda(prs, s, slide);   break
    case 'quote':    minQuote(prs, s, slide);    break
    case 'exercise': minExercise(prs, s, slide); break
    case 'divider':  minDivider(prs, s, slide);  break
    case 'cta':      minCta(prs, s, slide);      break
    default:         minContent(prs, s, slide)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 5 — VIBRANT PRO
// Gradient dark bg · Pink-purple #e879f9 · Gen-Z spiritual aesthetic
// Glowing title shadows, geometric accents
// ══════════════════════════════════════════════════════════════════════════════

function vibBg(prs: Prs, s: Slide) {
  // Two-tone gradient simulation
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: PW * 0.55, h: PH,
    fill: { color: h('#1a0533') }, line: { type: 'none' },
  })
  s.addShape(prs.ShapeType.rect, {
    x: PW * 0.55, y: 0, w: PW * 0.45, h: PH,
    fill: { color: h('#0f1729') }, line: { type: 'none' },
  })
}

function vibTitle(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  // Geometric accent shape
  s.addShape(prs.ShapeType.ellipse, {
    x: PW - 2.5, y: -0.8, w: 3.5, h: 3.5,
    fill: { color: h('#e879f9') + '18' }, line: { color: h('#e879f9') + '30', pt: 1.5 },
  })
  s.addShape(prs.ShapeType.ellipse, {
    x: -1.0, y: PH - 2.0, w: 3.0, h: 3.0,
    fill: { color: h('#e879f9') + '12' }, line: { color: h('#e879f9') + '25', pt: 1 },
  })
  s.addText(gh(slide), {
    x: ML, y: 1.8, w: CW, h: 1.6,
    fontSize: 44, bold: true, color: 'ffffff',
    align: 'center', fontFace: 'Georgia',
    shadow: { type: 'outer', blur: 20, offset: 0, angle: 90, color: h('#e879f9'), opacity: 0.7 },
  })
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: ML, y: 3.55, w: CW, h: 0.75,
      fontSize: 20, color: h('#c084fc'), align: 'center', fontFace: 'Calibri',
    })
  }
  if (slide.tagline) {
    s.addText(slide.tagline, {
      x: ML, y: 4.4, w: CW, h: 0.45,
      fontSize: 13, color: h('#a78bfa'), align: 'center', italic: true,
    })
  }
}

function vibAgenda(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  s.addText('✨ AGENDA', {
    x: ML, y: 0.45, w: 3, h: 0.45,
    fontSize: 12, bold: true, color: h('#e879f9'), fontFace: 'Calibri', charSpacing: 3,
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 0.95, w: 3.5, h: 0.04,
    fill: { color: h('#e879f9') }, line: { type: 'none' },
  })
  const items = slide.items ?? gbullets(slide)
  items.forEach((item, i) => {
    s.addText(`✦ ${item}`, {
      x: ML, y: 1.2 + i * 0.75, w: CW, h: 0.6,
      fontSize: 18, color: 'ffffff', fontFace: 'Calibri',
    })
  })
}

function vibContent(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  s.addText(gh(slide), {
    x: ML, y: 0.4, w: CW, h: 0.9,
    fontSize: 32, bold: true, color: h('#e879f9'), fontFace: 'Georgia',
    shadow: { type: 'outer', blur: 12, offset: 0, angle: 90, color: h('#e879f9'), opacity: 0.5 },
  })
  s.addShape(prs.ShapeType.rect, {
    x: ML, y: 1.35, w: 2.0, h: 0.05,
    fill: { color: h('#e879f9') }, line: { type: 'none' },
  })
  const items = gbullets(slide)
  addBullets(s, items, {
    x: ML, y: 1.55, w: CW, h: slide.insight ? 3.2 : 4.6,
    bulletColor: h('#e879f9'), textColor: 'ffffff', fontSize: 16,
  })
  if (slide.insight) {
    s.addShape(prs.ShapeType.rect, {
      x: ML, y: 4.95, w: CW, h: 1.0,
      fill: { color: h('#e879f9') + '18' }, line: { color: h('#e879f9') + '50', pt: 1 },
    })
    s.addText(slide.insight, {
      x: ML + 0.2, y: 5.07, w: CW - 0.35, h: 0.76,
      fontSize: 13, color: h('#e879f9'), italic: true, fontFace: 'Calibri', valign: 'middle',
    })
  }
}

function vibQuote(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  s.addText('“', {
    x: 0.2, y: 0.3, w: 2.0, h: 2.0,
    fontSize: 110, color: h('#e879f9') + '30', fontFace: 'Georgia', bold: true,
  })
  s.addText(slide.text ?? '', {
    x: ML + 0.4, y: 1.3, w: CW - 0.6, h: 3.0,
    fontSize: 26, color: 'ffffff', italic: true, fontFace: 'Georgia',
    align: 'center', valign: 'middle',
    shadow: { type: 'outer', blur: 8, offset: 0, angle: 90, color: h('#e879f9'), opacity: 0.4 },
  })
  if (slide.attribution) {
    s.addText(`— ${slide.attribution}`, {
      x: ML, y: 4.55, w: CW, h: 0.5,
      fontSize: 14, color: h('#c084fc'), align: 'center',
    })
  }
}

function vibExercise(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  s.addShape(prs.ShapeType.ellipse, {
    x: ML, y: 0.4, w: 0.75, h: 0.75,
    fill: { color: h('#e879f9') + '30' }, line: { color: h('#e879f9'), pt: 1.5 },
  })
  s.addText('✦', {
    x: ML, y: 0.4, w: 0.75, h: 0.75,
    fontSize: 20, color: h('#e879f9'), align: 'center', valign: 'middle',
  })
  s.addText(gh(slide), {
    x: ML + 0.95, y: 0.45, w: CW - 1.0, h: 0.75,
    fontSize: 26, bold: true, color: h('#e879f9'), fontFace: 'Georgia',
  })
  if (slide.instructions) {
    s.addText(slide.instructions, {
      x: ML, y: 1.4, w: CW, h: 2.6,
      fontSize: 16, color: 'ffffff', fontFace: 'Calibri',
    })
  }
  if (slide.reflection) {
    s.addShape(prs.ShapeType.rect, {
      x: ML, y: 4.2, w: CW, h: 0.95,
      fill: { color: h('#e879f9') + '15' }, line: { color: h('#e879f9') + '40', pt: 1 },
    })
    s.addText(slide.reflection, {
      x: ML + 0.2, y: 4.32, w: CW - 0.35, h: 0.71,
      fontSize: 13, color: h('#c084fc'), italic: true, fontFace: 'Calibri', valign: 'middle',
    })
  }
}

function vibDivider(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: PH / 2 - 1.4, w: PW, h: 2.8,
    fill: { color: h('#e879f9') + '20' }, line: { type: 'none' },
  })
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: PH / 2 - 1.4, w: PW, h: 0.06,
    fill: { color: h('#e879f9') }, line: { type: 'none' },
  })
  s.addShape(prs.ShapeType.rect, {
    x: 0, y: PH / 2 + 1.34, w: PW, h: 0.06,
    fill: { color: h('#e879f9') }, line: { type: 'none' },
  })
  s.addText(slide.sectionTitle ?? gh(slide), {
    x: ML, y: PH / 2 - 1.2, w: CW, h: 2.4,
    fontSize: 42, bold: true, color: 'ffffff',
    align: 'center', valign: 'middle', fontFace: 'Georgia',
    shadow: { type: 'outer', blur: 16, offset: 0, angle: 90, color: h('#e879f9'), opacity: 0.6 },
  })
}

function vibCta(prs: Prs, s: Slide, slide: SlideData) {
  vibBg(prs, s)
  s.addShape(prs.ShapeType.ellipse, {
    x: PW / 2 - 2.5, y: 0.2, w: 5.0, h: 5.0,
    fill: { color: h('#e879f9') + '0a' }, line: { color: h('#e879f9') + '25', pt: 1 },
  })
  s.addText(gh(slide), {
    x: ML, y: 0.7, w: CW, h: 1.2,
    fontSize: 38, bold: true, color: h('#e879f9'), align: 'center', fontFace: 'Georgia',
    shadow: { type: 'outer', blur: 18, offset: 0, angle: 90, color: h('#e879f9'), opacity: 0.7 },
  })
  if (slide.offer) {
    s.addText(slide.offer, {
      x: ML, y: 2.1, w: CW, h: 0.7,
      fontSize: 18, color: h('#c084fc'), align: 'center',
    })
  }
  if (slide.price) {
    s.addText(slide.price, {
      x: ML, y: 2.9, w: CW, h: 0.9,
      fontSize: 42, bold: true, color: 'ffffff', align: 'center', fontFace: 'Georgia',
    })
  }
  if (slide.handle) {
    s.addText(`@${slide.handle.replace(/^@/, '')}`, {
      x: ML, y: 3.95, w: CW, h: 0.5,
      fontSize: 18, color: h('#e879f9'), align: 'center',
    })
  }
}

function renderVibrant(prs: Prs, s: Slide, slide: SlideData) {
  s.background = { fill: h('#1a0533') }
  switch (slide.type) {
    case 'title':    vibTitle(prs, s, slide);    break
    case 'agenda':   vibAgenda(prs, s, slide);   break
    case 'quote':    vibQuote(prs, s, slide);    break
    case 'exercise': vibExercise(prs, s, slide); break
    case 'divider':  vibDivider(prs, s, slide);  break
    case 'cta':      vibCta(prs, s, slide);      break
    default:         vibContent(prs, s, slide)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════

export async function generatePptxBuffer(slides: SlideData[], template: PptTemplate): Promise<Buffer> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const prs = new PptxGenJS()
  prs.layout = 'LAYOUT_WIDE'
  prs.author = 'Instagram Dashboard'
  prs.title = slides[0]?.heading ?? slides[0]?.title ?? 'Masterclass'

  const renderers: Record<string, (prs: Prs, s: Slide, slide: SlideData, idx: number) => void> = {
    executive: (p, s, sl) => renderExecutive(p, s, sl),
    clean: (p, s, sl, i) => renderClean(p, s, sl, i),
    bold: (p, s, sl) => renderBold(p, s, sl),
    minimal: (p, s, sl) => renderMinimal(p, s, sl),
    vibrant: (p, s, sl) => renderVibrant(p, s, sl),
  }

  const render = renderers[template.id] ?? renderers.executive

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const s = prs.addSlide()
    render(prs, s, slide, i)
    if (slide.notes) s.addNotes(slide.notes)
  }

  return await prs.write({ outputType: 'nodebuffer' }) as Buffer
}
