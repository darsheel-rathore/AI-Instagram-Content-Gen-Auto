export interface GiveawayPdfContent {
  title: string
  subtitle: string
  intro: string
  sections: Array<{
    heading: string
    body: string
    insight: string
  }>
  reflectionQuestions: string[]
  closingNote: string
  ctaText: string
  generatedAt: string
}

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function escAttr(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 40)
}

function pad2(n: number): string {
  return String(n + 1).padStart(2, '0')
}

const ORNAMENT = `<div class="ornament"><div class="ornament-line"></div><div class="ornament-diamond"></div><div class="ornament-line"></div></div>`

/* Ghost arc SVG — concentric quarter-circles from top-right corner */
const COVER_ARCS = `<svg class="cover-arcs" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="500" cy="0" r="180" fill="none" stroke="rgba(74,25,66,0.09)" stroke-width="1"/>
  <circle cx="500" cy="0" r="270" fill="none" stroke="rgba(74,25,66,0.065)" stroke-width="1"/>
  <circle cx="500" cy="0" r="360" fill="none" stroke="rgba(74,25,66,0.04)" stroke-width="1"/>
</svg>`

export function buildGiveawayHtml(
  content: GiveawayPdfContent,
  qrCodeDataUrl: string,
  brandName: string,
  instagramHandle: string,
  customCss?: string,
  whatsappLink?: string,
  website?: string,
  linktree?: string,
  profilePhotoUrl?: string,
): string {
  const {
    title, subtitle, intro,
    sections = [], reflectionQuestions = [],
    closingNote, ctaText,
  } = content

  const monogram = brandName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'B'
  const guideLabel = title.toUpperCase().slice(0, 38)

  const whatsappHref = whatsappLink
    ? (whatsappLink.startsWith('http') ? whatsappLink : `https://${whatsappLink}`) : ''
  const websiteHref = website
    ? (website.startsWith('http') ? website : `https://${website}`) : ''
  const linktreeHref = linktree
    ? (linktree.startsWith('http') ? linktree : `https://${linktree}`) : ''

  /* Author circle — photo or monogram */
  const authorCircle = (size: 'sm' | 'lg') => {
    const cls = size === 'lg' ? 'author-circle-lg' : 'author-circle-sm'
    if (profilePhotoUrl) {
      return `<img class="${cls} author-photo" src="${escAttr(profilePhotoUrl)}" alt="${escAttr(brandName)}" />`
    }
    return `<div class="${cls} author-monogram">${monogram}</div>`
  }

  /* What's Inside items */
  const whatInsideHtml = sections.map((s, i) => `
    <div class="wi-item">
      <span class="wi-num">${pad2(i)}</span>
      <span class="wi-text">${esc(s.heading)}</span>
    </div>`).join('')

  /* Content sections */
  const sectionsHtml = sections.map((s, i) => `
    <div class="section" ${i === 0 ? '' : ''}>
      <div class="section-num">${pad2(i)}</div>
      <div class="section-body">
        <div class="section-heading">${esc(s.heading)}</div>
        <div class="section-text">${esc(s.body)}</div>
        ${s.insight ? `<div class="insight-box"><p>${esc(s.insight)}</p></div>` : ''}
      </div>
    </div>`).join('')

  /* Reflection questions with writing lines */
  const questionsHtml = reflectionQuestions.map((q, i) => `
    <div class="question">
      <div class="question-num">${pad2(i)}</div>
      <div class="question-body">
        <div class="question-text">${esc(q)}</div>
        <div class="question-lines">
          <div class="qline"></div>
          <div class="qline"></div>
          <div class="qline"></div>
        </div>
      </div>
    </div>`).join('')

  /* Contact links for about page */
  const contactLinks = [
    websiteHref ? { label: 'Website', value: shortUrl(websiteHref), href: websiteHref } : null,
    { label: 'Instagram', value: `@${instagramHandle}`, href: `https://instagram.com/${instagramHandle}` },
    whatsappHref ? { label: 'WhatsApp', value: 'Chat with me', href: whatsappHref } : null,
    linktreeHref ? { label: 'All Links', value: shortUrl(linktreeHref), href: linktreeHref } : null,
  ].filter(Boolean) as { label: string; value: string; href: string }[]

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    /* ── Palette ──────────────────────────────────────────────────────────
       PLUM    #4A1942   MID  #6B3060   LIGHT  #9B6E90   PALE  #D4B8CC
       GHOST   #F0E8EC   CREAM  #F9F6F0   DEEP  #EDE8E0
       INK     #2A0A26   BODY  #4A3545   GOLD  #C49A6C   DIV  #E0D4DC
    ─────────────────────────────────────────────────────────────────────── */

    @page { margin: 0; size: A4; }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #F9F6F0;
      color: #4A3545;
      width: 210mm;
      padding-left: 22mm;   /* 8mm sidebar + 14mm content margin */
      padding-right: 14mm;
      padding-top: 14mm;    /* running header */
      padding-bottom: 14mm; /* footer */
    }

    /* ══════════════ FIXED ELEMENTS — repeat every page ════════════════ */

    .sidebar {
      position: fixed;
      top: 0; left: 0;
      width: 8mm; height: 100%;
      background: #4A1942;
      z-index: 30;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 18px;
    }

    .sidebar-mono {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: rgba(196,154,108,0.55);
    }

    .watermark {
      position: fixed;
      top: 0; left: 0;
      width: 210mm; height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-35deg);
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 88px;
      color: rgba(74,25,66,0.03);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }

    /* Running header */
    .running-header {
      position: fixed;
      top: 0; left: 0;
      width: 210mm;
      height: 14mm;
      background: #F9F6F0;
      border-bottom: 1.5px solid #4A1942;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14mm 0 22mm;
      z-index: 25;
    }

    .rh-brand {
      font-size: 8px;
      font-weight: 600;
      color: #4A1942;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .rh-guide {
      font-size: 8px;
      color: #9B6E90;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 500;
      max-width: 160px;
      text-align: right;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Footer */
    .footer {
      position: fixed;
      bottom: 0; left: 0;
      width: 210mm;
      height: 11mm;
      background: #EDE8E0;
      border-top: 1px solid #D4B8CC;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14mm 0 22mm;
      z-index: 20;
    }

    .footer-left {
      font-size: 8px;
      color: #6B3060;
      letter-spacing: 0.1em;
      font-weight: 500;
      text-transform: uppercase;
    }

    .footer-diamond {
      font-size: 8px;
      color: #4A1942;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
    }

    .footer-right {
      font-size: 8px;
      color: #9B6E90;
    }

    /* ══════════════ ORNAMENT ══════════════════════════════════════════ */

    .ornament {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0;
    }

    .ornament-line {
      height: 0.5px;
      background: #D4B8CC;
      width: 60px;
    }

    .ornament-diamond {
      width: 7px; height: 7px;
      background: #4A1942;
      transform: rotate(45deg);
      flex-shrink: 0;
    }

    /* ══════════════ COVER PAGE ════════════════════════════════════════ */

    .cover-page {
      position: relative;
      page-break-after: always;
      min-height: calc(297mm - 28mm); /* full page minus header+footer */
      display: flex;
      flex-direction: column;
      z-index: 1;
    }

    /* Ghost arcs — top-right, absolute, break to page edge */
    .cover-arcs {
      position: absolute;
      top: -14mm;          /* break up into running-header zone */
      right: -14mm;        /* break to page right edge */
      width: 132mm;
      height: 132mm;
      pointer-events: none;
      z-index: 0;
    }

    .cover-eyebrow {
      font-size: 9px;
      font-weight: 600;
      color: #9B6E90;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      margin-top: 22px;
      position: relative;
      z-index: 2;
    }

    .cover-rule {
      width: 72px;
      height: 1px;
      background: linear-gradient(to right, #C49A6C, rgba(196,154,108,0.15));
      margin: 10px 0 28px;
      position: relative;
      z-index: 2;
    }

    .cover-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 52px;
      font-weight: 700;
      color: #2A0A26;
      line-height: 1.12;
      letter-spacing: -0.01em;
      position: relative;
      z-index: 2;
    }

    .cover-subtitle {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 14px;
      font-weight: 400;
      font-style: italic;
      color: #6B3060;
      margin-top: 4px;
      position: relative;
      z-index: 2;
    }

    .cover-intro {
      font-size: 13px;
      line-height: 1.85;
      color: #4A3545;
      margin-top: 22px;
      max-width: 440px;
      position: relative;
      z-index: 2;
    }

    /* What's Inside box */
    .cover-whats-inside {
      border: 1px solid #D4B8CC;
      border-radius: 4px;
      padding: 16px 20px 14px;
      margin-top: 24px;
      background: rgba(240,232,236,0.25);
      position: relative;
      z-index: 2;
    }

    .wi-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #4A1942;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .wi-item {
      display: flex;
      align-items: baseline;
      gap: 14px;
      padding: 5px 0;
      border-bottom: 0.5px solid rgba(212,184,204,0.45);
    }

    .wi-item:last-child { border-bottom: none; }

    .wi-num {
      font-size: 10px;
      font-weight: 600;
      color: #6B3060;
      min-width: 20px;
      flex-shrink: 0;
    }

    .wi-text {
      font-size: 12px;
      color: #4A3545;
      line-height: 1.5;
    }

    /* Author block — bottom of cover */
    .cover-author {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: auto;
      padding-top: 20px;
      border-top: 1px solid #E0D4DC;
      position: relative;
      z-index: 2;
    }

    /* ══════════════ AUTHOR CIRCLES ════════════════════════════════════ */

    .author-circle-sm {
      width: 40px; height: 40px; min-width: 40px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .author-circle-lg {
      width: 72px; height: 72px; min-width: 72px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .author-photo {
      object-fit: cover;
      border: 2.5px solid #4A1942;
    }

    .author-monogram {
      background: #F0E8EC;
      border: 2px solid #D4B8CC;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 700;
      color: #4A1942;
    }

    .author-circle-sm.author-monogram { font-size: 15px; }
    .author-circle-lg.author-monogram { font-size: 26px; }

    .cover-author-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 15px;
      font-weight: 600;
      color: #2A0A26;
      margin-bottom: 3px;
    }

    .cover-author-sub {
      font-size: 10px;
      color: #9B6E90;
      letter-spacing: 0.06em;
    }

    /* ══════════════ CONTENT PAGES ═════════════════════════════════════ */

    .content-pages {
      position: relative;
      z-index: 1;
    }

    /* Section */
    .section {
      display: flex;
      gap: 18px;
      padding: 28px 0;
      border-bottom: 1px solid #E0D4DC;
      page-break-inside: avoid;
    }

    .section:last-child { border-bottom: none; }

    .section-num {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 11px;
      font-weight: 700;
      color: #6B3060;
      min-width: 26px;
      padding-top: 4px;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    .section-body { flex: 1; min-width: 0; }

    .section-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 600;
      color: #2A0A26;
      line-height: 1.28;
      margin-bottom: 12px;
    }

    .section-text {
      font-size: 13px;
      line-height: 1.9;
      color: #4A3545;
    }

    .insight-box {
      margin-top: 16px;
      border: 1px solid #D4B8CC;
      border-left: 3px solid #4A1942;
      background: #F0E8EC;
      border-radius: 0 5px 5px 0;
      padding: 14px 18px;
    }

    .insight-box p {
      font-size: 12.5px;
      line-height: 1.75;
      color: #3D1238;
      font-style: italic;
    }

    /* Reflection */
    .reflection {
      padding: 28px 0;
      page-break-inside: avoid;
      position: relative;
      z-index: 1;
    }

    .reflection-header {
      background: #4A1942;
      border-radius: 6px;
      padding: 14px 22px;
      margin-bottom: 26px;
    }

    .reflection-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 600;
      color: #FDFBF8;
      margin-bottom: 5px;
    }

    .reflection-sub {
      font-size: 10px;
      color: #D4B8CC;
      font-style: italic;
      letter-spacing: 0.02em;
    }

    .question {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .question-num {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 11px;
      font-weight: 700;
      color: #6B3060;
      min-width: 26px;
      padding-top: 2px;
      flex-shrink: 0;
    }

    .question-body { flex: 1; }

    .question-text {
      font-size: 13px;
      font-weight: 600;
      color: #2A0A26;
      line-height: 1.5;
      margin-bottom: 10px;
    }

    .question-lines {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .qline {
      width: 100%;
      border-bottom: 1px solid #D4B8CC;
    }

    /* Closing */
    .closing {
      padding: 26px 0;
      border-top: 1px solid #E0D4DC;
      position: relative;
      z-index: 1;
    }

    .closing p {
      font-size: 13px;
      line-height: 1.9;
      color: #6B3060;
      font-style: italic;
    }

    /* CTA */
    .cta {
      margin: 4px 0 26px;
      background: #4A1942;
      border-radius: 8px;
      padding: 24px 30px;
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .cta p {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 17px;
      font-weight: 600;
      color: #C49A6C;
      line-height: 1.65;
    }

    /* ══════════════ ABOUT PAGE ════════════════════════════════════════ */

    .about-page {
      page-break-before: always;
      position: relative;
      z-index: 1;
      padding-bottom: 26px;
    }

    .about-arcs {
      position: absolute;
      top: -14mm;
      right: -14mm;
      width: 100mm;
      height: 100mm;
      pointer-events: none;
      z-index: 0;
    }

    .about-rh-sub {
      /* Used in running header override for about page — not needed with fixed header */
    }

    .about-title-area {
      padding: 20px 0 18px;
      position: relative;
      z-index: 2;
    }

    .about-label {
      font-size: 8.5px;
      font-weight: 600;
      color: #9B6E90;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .about-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 38px;
      font-weight: 700;
      color: #2A0A26;
      line-height: 1.15;
    }

    /* Bio row — photo + text side by side */
    .about-bio-row {
      display: flex;
      gap: 22px;
      padding: 20px 0;
      border-top: 1px solid #E0D4DC;
      position: relative;
      z-index: 2;
    }

    .about-bio-text {
      flex: 1;
      font-size: 13px;
      line-height: 1.9;
      color: #4A3545;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .about-bio-text .author-name-lg {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 700;
      color: #2A0A26;
      margin-bottom: 2px;
    }

    .about-bio-text .author-handle-lg {
      font-size: 11px;
      color: #9B6E90;
      letter-spacing: 0.1em;
      margin-bottom: 8px;
    }

    /* Work With section */
    .about-work {
      border: 1px solid #D4B8CC;
      border-radius: 5px;
      overflow: hidden;
      margin: 18px 0;
      position: relative;
      z-index: 2;
    }

    .about-work-header {
      background: #4A1942;
      padding: 11px 20px;
    }

    .about-work-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      color: #FDFBF8;
      letter-spacing: 0.08em;
    }

    .about-work-body {
      padding: 16px 20px;
      background: #F9F6F0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .about-work-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .about-work-dot {
      width: 6px; height: 6px; min-width: 6px;
      background: #4A1942;
      transform: rotate(45deg);
      margin-top: 6px;
      flex-shrink: 0;
    }

    .about-work-item-content {}

    .about-work-name {
      font-size: 12.5px;
      font-weight: 600;
      color: #2A0A26;
      margin-bottom: 2px;
    }

    .about-work-desc {
      font-size: 11.5px;
      color: #7A5A6A;
      line-height: 1.5;
    }

    /* Contact grid */
    .about-contact-grid {
      display: flex;
      gap: 0;
      border: 1px solid #D4B8CC;
      border-radius: 5px;
      overflow: hidden;
      margin: 16px 0;
      position: relative;
      z-index: 2;
    }

    .about-contact-col {
      flex: 1;
      padding: 12px 14px;
      border-right: 1px solid #D4B8CC;
      background: #F9F6F0;
    }

    .about-contact-col:last-child { border-right: none; }

    .about-contact-label {
      font-size: 8px;
      font-weight: 600;
      color: #9B6E90;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .about-contact-value {
      font-size: 11px;
      font-weight: 600;
      color: #2A0A26;
      text-decoration: none;
      display: block;
      line-height: 1.3;
    }

    /* QR + copyright */
    .about-footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      border-top: 1px solid #E0D4DC;
      position: relative;
      z-index: 2;
    }

    .about-copyright {
      font-size: 9px;
      color: #9B8090;
      font-style: italic;
    }

    .about-qr {
      width: 52px; height: 52px;
    }

    ${customCss ? `/* ── Custom CSS ── */\n${customCss}` : ''}
  </style>
</head>
<body>

  <!-- ── Sidebar: fixed, every page ── -->
  <div class="sidebar">
    <span class="sidebar-mono">${monogram}</span>
  </div>

  <!-- ── Watermark: fixed, every page ── -->
  <div class="watermark">${esc(instagramHandle)}</div>

  <!-- ── Running header: fixed, every page ── -->
  <div class="running-header">
    <span class="rh-brand">${esc(brandName)}</span>
    <span class="rh-guide">${guideLabel}</span>
  </div>

  <!-- ── Footer: fixed, every page ── -->
  <div class="footer">
    <span class="footer-left">@${esc(instagramHandle)}</span>
    <span class="footer-diamond">&#9670;</span>
    <span class="footer-right">${websiteHref ? esc(shortUrl(websiteHref)) : esc(brandName)}</span>
  </div>

  <!-- ══════════════════════════════════════════════════════════════
       COVER PAGE
  ═══════════════════════════════════════════════════════════════ -->
  <div class="cover-page">

    ${COVER_ARCS}

    <div class="cover-eyebrow">FREE GUIDE</div>
    <div class="cover-rule"></div>
    <div class="cover-title">${esc(title)}</div>
    ${ORNAMENT}
    ${subtitle ? `<div class="cover-subtitle">${esc(subtitle)}</div>` : ''}
    ${intro ? `<div class="cover-intro">${esc(intro)}</div>` : ''}

    ${sections.length > 0 ? `
    <div class="cover-whats-inside">
      <div class="wi-label">WHAT'S INSIDE</div>
      ${whatInsideHtml}
    </div>` : ''}

    <div class="cover-author">
      ${authorCircle('sm')}
      <div>
        <div class="cover-author-name">${esc(brandName)}</div>
        <div class="cover-author-sub">@${esc(instagramHandle)}</div>
      </div>
    </div>

  </div>

  <!-- ══════════════════════════════════════════════════════════════
       CONTENT PAGES
  ═══════════════════════════════════════════════════════════════ -->
  <div class="content-pages">

    <div class="content">${sectionsHtml}</div>

    ${reflectionQuestions.length > 0 ? `
    <div class="reflection">
      <div class="reflection-header">
        <div class="reflection-title">Reflection Questions</div>
        <div class="reflection-sub">Take your time. There are no right answers — only honest ones.</div>
      </div>
      ${questionsHtml}
    </div>` : ''}

    ${closingNote ? `<div class="closing"><p>${esc(closingNote)}</p></div>` : ''}

    ${ctaText ? `<div class="cta"><p>${esc(ctaText)}</p></div>` : ''}

  </div>

  <!-- ══════════════════════════════════════════════════════════════
       ABOUT THE AUTHOR PAGE
  ═══════════════════════════════════════════════════════════════ -->
  <div class="about-page">

    <svg class="about-arcs" viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="380" cy="0" r="140" fill="none" stroke="rgba(74,25,66,0.08)" stroke-width="1"/>
      <circle cx="380" cy="0" r="210" fill="none" stroke="rgba(74,25,66,0.055)" stroke-width="1"/>
      <circle cx="380" cy="0" r="280" fill="none" stroke="rgba(74,25,66,0.03)" stroke-width="1"/>
    </svg>

    <div class="about-title-area">
      <div class="about-label">MEET YOUR GUIDE</div>
      <div class="about-title">About the Author</div>
    </div>

    ${ORNAMENT}

    <!-- Bio row: photo on left, text on right -->
    <div class="about-bio-row">
      ${authorCircle('lg')}
      <div class="about-bio-text">
        <div>
          <div class="author-name-lg">${esc(brandName)}</div>
          <div class="author-handle-lg">@${esc(instagramHandle)}</div>
        </div>
        <p>Content creator passionate about helping you grow authentically, connect deeply with your audience, and build a brand that truly reflects who you are — one reel, one story, one conversation at a time.</p>
        <p>My work sits at the intersection of strategy and soul — because sustainable growth isn't just about posting more. It's about saying the right things, to the right people, in a way that only you can.</p>
      </div>
    </div>

    ${ORNAMENT}

    <!-- Work With section -->
    <div class="about-work">
      <div class="about-work-header">
        <div class="about-work-title">WORK WITH ME</div>
      </div>
      <div class="about-work-body">
        <div class="about-work-item">
          <div class="about-work-dot"></div>
          <div class="about-work-item-content">
            <div class="about-work-name">Free Guides &amp; Resources</div>
            <div class="about-work-desc">Downloadable guides like this one — shared regularly with my community</div>
          </div>
        </div>
        <div class="about-work-item">
          <div class="about-work-dot"></div>
          <div class="about-work-item-content">
            <div class="about-work-name">Instagram Strategy Tips</div>
            <div class="about-work-desc">Weekly insights, frameworks &amp; behind-the-scenes on my Instagram feed</div>
          </div>
        </div>
        <div class="about-work-item">
          <div class="about-work-dot"></div>
          <div class="about-work-item-content">
            <div class="about-work-name">1:1 Coaching &amp; Consulting</div>
            <div class="about-work-desc">Personalised sessions to build your content strategy and grow your brand</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contact grid -->
    ${contactLinks.length > 0 ? `
    <div class="about-contact-grid">
      ${contactLinks.map(c => `
      <div class="about-contact-col">
        <div class="about-contact-label">${esc(c.label)}</div>
        <a href="${escAttr(c.href)}" class="about-contact-value">${esc(c.value)}</a>
      </div>`).join('')}
    </div>` : ''}

    <!-- QR + copyright -->
    <div class="about-footer-row">
      <div class="about-copyright">&#169; ${new Date().getFullYear()} ${esc(brandName)}. This guide is for personal use only.</div>
      <img class="about-qr" src="${qrCodeDataUrl}" alt="Instagram QR" />
    </div>

  </div>

</body>
</html>`
}