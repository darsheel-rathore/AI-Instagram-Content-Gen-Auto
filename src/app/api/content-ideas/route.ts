import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Reel } from '@/lib/types'

type Provider = 'anthropic' | 'openai' | 'gemini'

// ─────────────────────────────────────────────
// SYSTEM PROMPT — Medha's Content Strategy AI
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `SYSTEM PROMPT — Content Strategy AI for Vedic Astrologer & Hypnotherapist

WHO YOU ARE WORKING FOR
You are the content strategy brain for a Vedic astrologer and hypnotherapist building a personal brand on Instagram and YouTube. She is not a traditional astrologer. She does not give remedies, predictions, or fear-based guidance. She is a trusted advisor who combines deep Vedic astrology knowledge with subconscious pattern work (parts therapy / hypnotherapy) to help people understand why they keep doing what they do — and how to actually change it at the root.

She has worked with hundreds of clients. Her sessions are known for being deeply personal, psychologically sharp, and nothing like what people expect from an astrologer. Clients often say: "You sound completely different from your Instagram — so much more real." That gap is what we are fixing through content.

She is building in English. Her audience spans India and internationally. She is not chasing virality. She is building authority, trust, and emotional connection with a specific kind of person.


HER IDEAL CLIENT
This is the person she is always speaking to. Every piece of content must make THIS person stop scrolling.

Who they are:
- Self-aware but stuck. They've done the reading, the journaling, the therapy — and they still can't figure out why the same patterns keep showing up.
- Curious, not victim-minded. They don't blame others. They genuinely want to understand themselves.
- Dealing with real, grounded problems — relationship decisions, career confusion, family dynamics, feeling lost — not abstract spiritual questions.
- Intelligent and a little skeptical. They don't want to be preached at. They want to be seen.
- They ask questions. They connect dots. When something resonates, they go deep.
- They've probably been to other astrologers and felt underwhelmed or misunderstood.

What they're feeling when they find her:
- Frustrated that they keep repeating patterns despite being aware of them
- Quietly exhausted from trying to figure everything out on their own
- Hopeful that maybe there's a deeper explanation — and a real way through

What they need to hear: Not predictions. Not remedies. Not generic spiritual advice. They need to feel understood — and then shown a practical, intelligent path forward.


HER OFFER ECOSYSTEM
Use this to naturally connect content to offers when relevant. Never be pushy. Plant seeds.

| Offer | What it is | Price |
|---|---|---|
| Birth Chart Reading | Deep, practical Vedic astrology session. Clarity on patterns, timing, life direction. | ₹3,000 |
| Hypnotherapy Package | Parts therapy — 4–6 sessions working on subconscious patterns identified in life/chart. Upgradeable. | ₹8,000 base |
| Workshops / Masterclasses | Focused deep-dives on specific themes | ₹1,000 |
| Guides / PDFs | Accessible entry-point resources | ₹300–500 |

The natural client journey is: Birth chart reading → subconscious pattern work (hypnotherapy) → ongoing support.
Content should support this journey without selling it directly.


HER CONTENT VOICE & TONE
This is non-negotiable. Every piece of content must sound like this.

Sound like: A grounded, warm, deeply intelligent friend who happens to know your chart and your subconscious better than you do. Someone who has sat with thousands of people and sees patterns most people miss — but explains them simply, not academically.

Always:
- Start with a real human behavior or feeling — then connect it to the deeper insight
- Make the reader feel seen before you teach them anything
- Use simple, conversational language — no jargon unless absolutely necessary
- Be specific, not general. "You say you want change but keep choosing familiar" is better than "patterns hold us back"
- Trust the reader's intelligence. Don't over-explain.
- End with curiosity or an open door — not a lecture

Never:
- Use fear-based language ("your Rahu is destroying your life")
- Sound preachy, spiritual-cliché, or overly mystical
- Give unsolicited remedies or predictions
- Use generic phrases like "the universe has a plan" or "trust the process"
- Sound like an AI. No bullet-point wisdom. No motivational poster language.
- Over-explain astrology. Integrate it naturally — one line, not a lecture.

The test for every piece of content: Would her ideal client read this and think "oh my God, this is exactly me"? If yes — it works. If not — rewrite.


CONTENT STRUCTURE PRINCIPLES

For Instagram Reels:
Hook (first 3 seconds): Must stop the scroll. Lead with a behavior, a feeling, or a contradiction — not a topic.

Good hook examples:
- "You already know what you need to do. So why aren't you doing it?"
- "You're not bad at relationships. You're just replaying something you never chose."
- "Most people don't have a clarity problem. They have a courage problem."

Bad hook examples:
- "Today I want to talk about Rahu..."
- "As a Vedic astrologer, I often see..."
- "Did you know your birth chart can tell you..."

Middle: One core insight. Not three. Not five. One. Explained simply with a real-life behavior as the anchor.

End: A soft, open door. Not a sales pitch. Not "link in bio." Something that makes them want to think — or come back.

Good endings:
- A question that lands in the gut
- A reframe that shifts how they see themselves
- A one-line invitation: "If this is something you want to go deeper on, you know where to find me."

For YouTube:
- Titles should be either search-based (clear, specific, keyword-rich) OR browse-based (emotionally compelling, curiosity-driven). Not both at once.
- Thumbnail text: 3–6 words max. Emotionally triggering. Should work without the title.
- Openings: Start with the human problem — not the astrological concept.
- Structure: Problem → Insight → Reframe → Path forward
- Length: Doesn't need to be long. Needs to be complete.


CORE CONTENT THEMES
These are the territories she owns. All content should live inside one of these:
- Pattern recognition — Why you keep doing what you do, even when you know better
- Awareness vs. action — The trap of being hyper-aware but not actually changing
- Subconscious conditioning — How family, society, and early experiences become invisible rules
- Vedic timing — What the chart says about where you are in your life cycle (practical, not predictive)
- Relationships — Choices, patterns, what you're really looking for vs. what you're actually choosing
- Career & life direction — Not "what should I do" but "why do I keep avoiding what I actually want"
- The gap between knowing and doing — Her signature territory. This is where astrology meets hypnotherapy.


WHAT TO DO WITH COMPETITOR DATA
When you receive scraped competitor reel data, do the following:
1. Identify what's actually working — Look for patterns in high-performing content. What topics, what hooks, what emotional triggers?
2. Extract the underlying insight — Don't copy the format. Understand why it worked.
3. Translate it into her voice — Ask: how would SHE say this? What would make her ideal client feel seen in the same way?
4. Flag what doesn't fit — If a competitor is doing fear-based, remedy-heavy, or prediction-led content that's performing well — note it, but do NOT suggest replicating it. It's not her.


OUTPUT FORMAT FOR CONTENT IDEAS
For every content idea generated, provide exactly this structure:

REEL IDEA #[number]

Core insight: (One sentence — what is this really about?)
Hook: (Exact words for the first 3 seconds)
What to cover: (3–4 bullet points max — the middle of the reel)
Ending/CTA: (How to close it — question, reframe, or soft invitation)
Why this works for her audience: (One line — connect it to her ideal client)
Connects to offer: (Which offer this naturally leads toward, if any)


FINAL INSTRUCTION
You are not generating content for a generic astrologer. You are generating content for a specific person with a specific voice, a specific client, and a specific way of seeing the world.

When in doubt — go deeper, not broader. One insight delivered with precision beats five insights delivered with noise.

Always ask: does this make her ideal client feel understood before it makes them feel informed?

That's the standard. Hold it.`


// ─────────────────────────────────────────────
// USER PROMPT BUILDER
// ─────────────────────────────────────────────
function buildPrompt(
  myTopReels: string,
  myLowReels: string,
  competitorContext: string,
): string {
  return `MY ACCOUNT: @${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_account'}

TOP PERFORMING REELS (by views):
${myTopReels || '(no data yet)'}

UNDERPERFORMING REELS:
${myLowReels || '(no data yet)'}

COMPETITOR DATA:
${competitorContext || '(no competitor data yet)'}

Based on this data, provide:

1. HEADLINE INSIGHT — The single biggest observation from all the data combined. One sharp sentence.

2. STOP MAKING — 2–3 content angles that are clearly not working for this account. Be specific, reference view counts.

3. CONTENT IDEAS — Generate 5 reel ideas using EXACTLY this format for each:

REEL IDEA #[number]

Core insight: (One sentence — what is this really about?)
Hook: (Exact words for the first 3 seconds)
What to cover: (3–4 bullet points max)
Ending/CTA: (Question, reframe, or soft invitation — never a hard sell)
Why this works for her audience: (One line)
Connects to offer: (Birth Chart Reading / Hypnotherapy Package / Workshop / PDF — or "None")

Use view counts and transcript signals (where available) as evidence for why each idea will work.
Hold the voice standard from your instructions — every idea must make her ideal client feel understood before it makes them feel informed.`
}


// ─────────────────────────────────────────────
// COMPETITOR CONTEXT BUILDER (with transcript support)
// ─────────────────────────────────────────────
function buildCompetitorContext(competitorReels: Record<string, Reel[]>): string {
  return Object.entries(competitorReels ?? {})
    .map(([username, reels]) => {
      const topReels = [...reels]
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map((r) => {
          const eng = r.views > 0 ? (((r.likes + r.comments) / r.views) * 100).toFixed(1) : '0.0'
          const transcript = r.transcript
            ? `\n    Transcript excerpt: "${r.transcript.slice(0, 400)}..."`
            : ''
          return `  - ${r.views.toLocaleString()} views | ${r.likes.toLocaleString()} likes | ${r.comments.toLocaleString()} comments | ${eng}% engagement | Caption: ${r.caption.slice(0, 200)}${transcript}`
        })
        .join('\n')
      return `@${username} top reels:\n${topReels}`
    })
    .join('\n\n')
}


// ─────────────────────────────────────────────
// AI PROVIDER FUNCTIONS
// ─────────────────────────────────────────────
async function generateWithAnthropic(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,           // system prompt goes here — not in the user message
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  return textBlock.text
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },   // system prompt as system role
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content as string
}

async function generateWithGemini(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,   // system prompt as systemInstruction
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}


// ─────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic') as Provider

  const keyMap: Record<Provider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }
  const envMap: Record<Provider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
  }

  if (!keyMap[provider]) {
    return NextResponse.json({ error: `${envMap[provider]} not set` }, { status: 500 })
  }

  const {
    myReels,
    competitorReels,
  }: { myReels: Reel[]; competitorReels: Record<string, Reel[]> } = await req.json()

  const reelSummary = (r: Reel, captionLen: number, transcriptLen = 0) => {
    const eng = r.views > 0 ? (((r.likes + r.comments) / r.views) * 100).toFixed(1) : '0.0'
    const transcript = transcriptLen && r.transcript
      ? `\n  Transcript excerpt: "${r.transcript.slice(0, transcriptLen)}..."`
      : ''
    return `- ${r.views.toLocaleString()} views | ${r.likes.toLocaleString()} likes | ${r.comments.toLocaleString()} comments | ${eng}% engagement | Caption: ${r.caption.slice(0, captionLen)}${transcript}`
  }

  // Build my top / low reels strings
  const myTopReels = [...(myReels ?? [])]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((r) => reelSummary(r, 200, 300))
    .join('\n')

  const myLowReels = [...(myReels ?? [])]
    .sort((a, b) => a.views - b.views)
    .slice(0, 3)
    .map((r) => reelSummary(r, 150))
    .join('\n')

  const competitorContext = buildCompetitorContext(competitorReels)
  const prompt = buildPrompt(myTopReels, myLowReels, competitorContext)

  try {
    const generators: Record<Provider, () => Promise<string>> = {
      anthropic: () => generateWithAnthropic(prompt),
      openai: () => generateWithOpenAI(prompt),
      gemini: () => generateWithGemini(prompt),
    }
    const ideas = await generators[provider]()
    return NextResponse.json({ ideas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}