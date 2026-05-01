import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { buildGiveawayHtml, type GiveawayPdfContent } from '@/lib/giveaway-html-template'

export const dynamic = 'force-dynamic'

const PREVIEW_CONTENT: GiveawayPdfContent = {
  title: 'The Inner Circle: A Guide to Conscious Content Creation',
  subtitle: 'How to build an authentic presence without burning out — and actually enjoy the process',
  intro: 'Most creators start with fire in their heart and end up staring at a blank screen wondering what happened. This guide is for the ones who know they have something to say — and are ready to say it with intention, depth, and a little bit of grace.',
  sections: [
    {
      heading: 'Start With Why You Actually Care',
      body: 'Before you open Reels, open a journal. The creators who last are the ones who are deeply connected to a reason that goes beyond followers and views. Your audience is not a number — they are real people who will feel the difference between content made from fear and content made from love.\n\nWhen you create from a place of genuine curiosity and care, the algorithm becomes irrelevant. You stop chasing trends and start setting them. The first step is to get radically honest about why you are here.',
      insight: 'The truth is: your audience can feel the difference between content made from fear and content made from love.',
    },
    {
      heading: 'The Art of Saying One Thing Well',
      body: 'Most content fails not because the creator has nothing to say, but because they try to say everything at once. A reel that tries to cover three ideas covers none of them. The most impactful creators have learned the discipline of the single idea — the one thought, explored fully, from every angle.\n\nThink of each piece of content as a seed, not a fruit. You are planting one idea in someone\'s mind. Let it take root before you plant the next one. Depth over breadth, always.',
      insight: 'What most people miss: one idea explored deeply beats five ideas listed shallowly every time.',
    },
    {
      heading: 'Boundaries as a Creative Practice',
      body: 'The most sustainable creators are not the ones who post every day — they are the ones who know when not to post. Setting boundaries around your creative time is not laziness; it is the highest form of self-respect and strategic thinking combined.\n\nSchedule your creation time like a sacred appointment. Protect it. When you show up to create from a full cup, it shows in every frame, every word, every pause.',
      insight: 'Begin here: protect your creative time like you would protect your most important relationship.',
    },
    {
      heading: 'Let Your Audience Co-Create With You',
      body: 'The creators who build the deepest communities are not broadcast towers — they are conversation starters. Every piece of content is an invitation. Ask questions that you genuinely want answered. Share dilemmas you are actually wrestling with. Be in progress, not just in polish.\n\nYour audience does not want a finished version of you. They want to witness the becoming. That vulnerability, offered with intention, is what transforms followers into family.',
      insight: 'The truth is: your audience wants to witness your becoming, not just your arrival.',
    },
  ],
  reflectionQuestions: [
    'What would you create if you knew nobody was watching — and would that be different from what you create now?',
    'Which of your content pieces felt the most alive when you made it? What was present in you when you created it?',
    'Where in your creative process are you performing, and where are you truly expressing?',
    'If you could only post once a week, what would be the one thing worth saying?',
  ],
  closingNote: 'You do not need a bigger audience to begin. You need a truer voice. Start there. The reach will come as a byproduct of the depth you are willing to go. The world does not need more content — it needs more creators who genuinely mean it.',
  ctaText: 'If this guide found you at the right moment, share it with someone who needs to hear it. And when you are ready to go deeper — I am here.',
  generatedAt: new Date().toISOString(),
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand = searchParams.get('brand')?.trim() || 'Medha'
  const handle = searchParams.get('handle')?.trim().replace(/^@/, '') || 'themedhachannel'
  const customCss = searchParams.get('css') || undefined

  const qrDataUrl = await QRCode.toDataURL(`https://instagram.com/${handle}`, {
    width: 128,
    margin: 1,
    color: { dark: '#0f1729', light: '#ffffff' },
  })

  const html = buildGiveawayHtml(PREVIEW_CONTENT, qrDataUrl, brand, handle, customCss)

  // Inject a thin preview banner at the top
  const withBanner = html.replace(
    '<body>',
    `<body>
<div style="
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #1e1b4b; color: #a5b4fc; font-family: sans-serif;
  font-size: 11px; padding: 6px 16px; text-align: center;
  letter-spacing: 0.05em; border-bottom: 1px solid #4338ca;
">
  PDF PREVIEW — Sample content shown. Actual AI-generated content will vary. Close this tab when done.
</div>
<div style="height: 28px;"></div>`,
  )

  return new NextResponse(withBanner, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}