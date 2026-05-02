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
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 42)
}

const ICON_INSTAGRAM = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5.5" stroke="#c9a84c" stroke-width="2"/><circle cx="12" cy="12" r="4.5" stroke="#c9a84c" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#c9a84c"/></svg>`

const ICON_WHATSAPP = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21l1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const ICON_GLOBE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#60a5fa" stroke-width="2"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke="#60a5fa" stroke-width="2"/><path d="M3.5 9h17M3.5 15h17" stroke="#60a5fa" stroke-width="1.5"/></svg>`

export function buildGiveawayHtml(
  content: GiveawayPdfContent,
  qrCodeDataUrl: string,
  brandName: string,
  instagramHandle: string,
  customCss?: string,
  whatsappLink?: string,
  website?: string,
): string {
  const { title, subtitle, intro, sections = [], reflectionQuestions = [], closingNote, ctaText } = content

  const sectionsHtml = sections.map((s, i) => `
    <div class="section">
      <div class="section-num">${i + 1}</div>
      <div class="section-body">
        <div class="section-heading">${esc(s.heading)}</div>
        <div class="section-text">${esc(s.body)}</div>
        ${s.insight ? `<div class="insight-box"><span>${esc(s.insight)}</span></div>` : ''}
      </div>
    </div>`).join('')

  const questionsHtml = reflectionQuestions.map((q, i) => `
    <div class="question">
      <div class="question-num">${i + 1}.</div>
      <div class="question-text">${esc(q)}</div>
    </div>`).join('')

  const whatsappHref = whatsappLink
    ? (whatsappLink.startsWith('http') ? whatsappLink : `https://${whatsappLink}`)
    : ''
  const websiteHref = website
    ? (website.startsWith('http') ? website : `https://${website}`)
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    @page { margin: 0; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #374151;
      width: 210mm;
      /* Extra top padding = header height (~108px) + 24px breathing room */
      padding-top: 132px;
      /* Extra bottom padding = footer height (~72px) + 16px breathing room */
      padding-bottom: 88px;
    }

    /* Watermark — position:fixed repeats on every PDF page */
    .watermark {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-35deg);
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 76px;
      color: rgba(15, 23, 41, 0.04);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    /* ── Header band — fixed so it repeats on every page ── */
    .header {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #0f1729;
      padding: 18px 60px 14px;
      z-index: 10;
    }

    .header-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.01em;
    }

    .header-handle {
      font-size: 11.5px;
      font-weight: 400;
      color: #c9a84c;
      margin-top: 4px;
      letter-spacing: 0.1em;
    }

    .header-divider {
      margin-top: 14px;
      height: 1px;
      background: linear-gradient(to right, #c9a84c 0%, rgba(201,168,76,0.12) 100%);
    }

    /* ── Title block ───────────────────────────────── */
    .title-block {
      padding: 40px 60px 34px;
      text-align: center;
      border-bottom: 1px solid rgba(201,168,76,0.2);
      background: #ffffff;
      page-break-inside: avoid;
      position: relative;
      z-index: 1;
    }

    .main-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 700;
      color: #0f1729;
      line-height: 1.25;
      margin-bottom: 14px;
    }

    .main-subtitle {
      font-size: 14px;
      font-weight: 300;
      color: #6b7280;
      line-height: 1.7;
      max-width: 460px;
      margin: 0 auto;
    }

    /* ── Intro ─────────────────────────────────────── */
    .intro {
      padding: 26px 60px;
      border-bottom: 1px solid #f3f0ea;
      background: #fffdf8;
      position: relative;
      z-index: 1;
    }

    .intro p {
      font-size: 14px;
      line-height: 1.85;
      color: #374151;
    }

    /* ── Content wrapper ───────────────────────────── */
    .content {
      padding: 0 60px;
      position: relative;
      z-index: 1;
    }

    /* ── Section ───────────────────────────────────── */
    .section {
      display: flex;
      gap: 20px;
      padding: 26px 0;
      border-bottom: 1px solid #f3f0ea;
      page-break-inside: avoid;
    }

    .section:last-child { border-bottom: none; }

    .section-num {
      width: 32px;
      height: 32px;
      min-width: 32px;
      border: 1.5px solid #c9a84c;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      color: #c9a84c;
      margin-top: 1px;
      flex-shrink: 0;
    }

    .section-body { flex: 1; min-width: 0; }

    .section-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 600;
      color: #0f1729;
      margin-bottom: 10px;
      line-height: 1.3;
    }

    .section-text {
      font-size: 13.5px;
      line-height: 1.85;
      color: #374151;
    }

    /* ── Insight box ───────────────────────────────── */
    .insight-box {
      margin-top: 14px;
      background: #1a2540;
      border-left: 3px solid #c9a84c;
      padding: 14px 18px;
      border-radius: 0 6px 6px 0;
    }

    .insight-box span {
      font-size: 13px;
      line-height: 1.75;
      color: #c8d5ea;
      font-style: italic;
    }

    /* ── Reflection questions ──────────────────────── */
    .reflection {
      padding: 30px 60px;
      background: #faf9f6;
      border-top: 1px solid #f3f0ea;
      page-break-inside: avoid;
      position: relative;
      z-index: 1;
    }

    .reflection-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-weight: 600;
      color: #0f1729;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(201,168,76,0.3);
    }

    .question {
      display: flex;
      gap: 14px;
      margin-bottom: 14px;
      align-items: flex-start;
      page-break-inside: avoid;
    }

    .question-num {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 15px;
      font-weight: 700;
      color: #c9a84c;
      min-width: 22px;
      padding-top: 1px;
    }

    .question-text {
      font-size: 13.5px;
      line-height: 1.8;
      color: #374151;
    }

    /* ── Closing note ──────────────────────────────── */
    .closing {
      padding: 26px 60px;
      border-top: 1px solid #f3f0ea;
      background: #ffffff;
      position: relative;
      z-index: 1;
      break-after: avoid;
    }

    .closing p {
      font-size: 13.5px;
      line-height: 1.85;
      color: #4b5563;
      font-style: italic;
    }

    /* ── CTA ───────────────────────────────────────── */
    .cta {
      margin: 4px 60px 24px;
      background: #0f1729;
      border-radius: 10px;
      padding: 20px 28px;
      text-align: center;
      break-before: avoid;
      position: relative;
      z-index: 1;
    }

    .cta p {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 17px;
      font-weight: 600;
      color: #c9a84c;
      line-height: 1.5;
    }

    /* ── Footer — fixed so it repeats on every page ── */
    .footer {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      padding: 10px 60px;
      border-top: 2px solid #c9a84c;
      display: flex;
      align-items: center;
      gap: 16px;
      background: #ffffff;
      z-index: 10;
    }

    .footer-brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-shrink: 0;
    }

    .footer-handle {
      font-size: 12px;
      font-weight: 600;
      color: #c9a84c;
      letter-spacing: 0.07em;
    }

    .footer-tagline {
      font-size: 10px;
      color: #9ca3af;
      font-style: italic;
    }

    .footer-links {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-left: auto;
      margin-right: 14px;
    }

    .footer-link {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      color: #6b7280;
      text-decoration: none;
    }

    .footer-qr {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }
  </style>
  ${customCss ? `<style>\n${customCss}\n</style>` : ''}
</head>
<body>

  <div class="watermark">${esc(instagramHandle)}</div>

  <!-- Header -->
  <div class="header">
    <div class="header-name">${esc(brandName)}</div>
    <div class="header-handle">@${esc(instagramHandle)}</div>
    <div class="header-divider"></div>
  </div>

  <!-- Title Block -->
  <div class="title-block">
    <div class="main-title">${esc(title)}</div>
    ${subtitle ? `<div class="main-subtitle">${esc(subtitle)}</div>` : ''}
  </div>

  ${intro ? `<div class="intro"><p>${esc(intro)}</p></div>` : ''}

  <!-- Content Sections -->
  <div class="content">${sectionsHtml}</div>

  ${reflectionQuestions.length > 0 ? `
  <div class="reflection">
    <div class="reflection-title">Reflection Questions</div>
    ${questionsHtml}
  </div>` : ''}

  ${closingNote ? `<div class="closing"><p>${esc(closingNote)}</p></div>` : ''}

  ${ctaText ? `<div class="cta"><p>${esc(ctaText)}</p></div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">
      <div class="footer-handle">@${esc(instagramHandle)}</div>
      <div class="footer-tagline">Your guide to conscious living</div>
    </div>
    <div class="footer-links">
      <a href="https://instagram.com/${escAttr(instagramHandle)}" class="footer-link">
        ${ICON_INSTAGRAM}
        <span>@${esc(instagramHandle)}</span>
      </a>
      ${whatsappHref ? `<a href="${escAttr(whatsappHref)}" class="footer-link">
        ${ICON_WHATSAPP}
        <span>WhatsApp Community</span>
      </a>` : ''}
      ${websiteHref ? `<a href="${escAttr(websiteHref)}" class="footer-link">
        ${ICON_GLOBE}
        <span>${esc(shortUrl(websiteHref))}</span>
      </a>` : ''}
    </div>
    <img class="footer-qr" src="${qrCodeDataUrl}" alt="Scan to follow on Instagram" />
  </div>

</body>
</html>`
}
