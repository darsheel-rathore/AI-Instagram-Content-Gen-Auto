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

export function buildGiveawayHtml(
  content: GiveawayPdfContent,
  qrCodeDataUrl: string,
  brandName: string,
  instagramHandle: string,
  customCss?: string,
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

    /* ── Header band ───────────────────────────────── */
    .header {
      background: #0f1729;
      padding: 30px 60px 24px;
      page-break-inside: avoid;
      position: relative;
      z-index: 1;
    }

    .header-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.01em;
    }

    .header-handle {
      font-size: 12px;
      font-weight: 400;
      color: #c9a84c;
      margin-top: 5px;
      letter-spacing: 0.1em;
    }

    .header-divider {
      margin-top: 18px;
      height: 1px;
      background: linear-gradient(to right, #c9a84c 0%, rgba(201,168,76,0.15) 100%);
    }

    /* ── Title block ───────────────────────────────── */
    .title-block {
      padding: 44px 60px 36px;
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
    }

    .closing p {
      font-size: 13.5px;
      line-height: 1.85;
      color: #4b5563;
      font-style: italic;
    }

    /* ── CTA ───────────────────────────────────────── */
    .cta {
      margin: 4px 60px 28px;
      background: #0f1729;
      border-radius: 10px;
      padding: 20px 28px;
      text-align: center;
      page-break-inside: avoid;
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

    /* ── Footer ────────────────────────────────────── */
    .footer {
      padding: 16px 60px;
      border-top: 2px solid #c9a84c;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      position: relative;
      z-index: 1;
    }

    .footer-left { display: flex; flex-direction: column; gap: 4px; }

    .footer-handle {
      font-size: 13px;
      font-weight: 600;
      color: #c9a84c;
      letter-spacing: 0.08em;
    }

    .footer-tagline {
      font-size: 11px;
      color: #9ca3af;
      font-style: italic;
    }

    .footer-qr {
      width: 64px;
      height: 64px;
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
    <div class="footer-left">
      <div class="footer-handle">@${esc(instagramHandle)}</div>
      <div class="footer-tagline">Your guide to conscious living</div>
    </div>
    <img class="footer-qr" src="${qrCodeDataUrl}" alt="Scan to follow on Instagram" />
  </div>

</body>
</html>`
}