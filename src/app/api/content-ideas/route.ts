import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Reel } from '@/lib/types'

type Provider = 'anthropic' | 'openai' | 'gemini'


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
// COMPETITOR CONTEXT BUILDER
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
            ? `\n    Transcript excerpt: "${r.transcript.slice(0, 600)}..."`
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
async function generateWithAnthropic(prompt: string, systemPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  return textBlock.text
}

async function generateWithOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
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

async function generateWithGemini(prompt: string, systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}


// ─────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const {
    myReels,
    competitorReels,
    systemPrompt,
    provider: requestedProvider,
  }: { myReels: Reel[]; competitorReels: Record<string, Reel[]>; systemPrompt: string; provider?: string } = await req.json()

  const provider = ((requestedProvider ?? process.env.AI_PROVIDER ?? 'gemini') as Provider)

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

  if (!systemPrompt?.trim()) {
    return NextResponse.json({ error: 'No prompt provided — set one up in Prompt Factory' }, { status: 400 })
  }

  const reelSummary = (r: Reel, captionLen: number, transcriptLen = 0) => {
    const eng = r.views > 0 ? (((r.likes + r.comments) / r.views) * 100).toFixed(1) : '0.0'
    const transcript = transcriptLen && r.transcript
      ? `\n  Transcript excerpt: "${r.transcript.slice(0, transcriptLen)}..."`
      : ''
    return `- ${r.views.toLocaleString()} views | ${r.likes.toLocaleString()} likes | ${r.comments.toLocaleString()} comments | ${eng}% engagement | Caption: ${r.caption.slice(0, captionLen)}${transcript}`
  }

  const myTopReels = [...(myReels ?? [])]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((r) => reelSummary(r, 200, 500))
    .join('\n')

  const myLowReels = [...(myReels ?? [])]
    .sort((a, b) => a.views - b.views)
    .slice(0, 3)
    .map((r) => reelSummary(r, 150, 300))
    .join('\n')

  const competitorContext = buildCompetitorContext(competitorReels)
  const prompt = buildPrompt(myTopReels, myLowReels, competitorContext)

  try {
    const generators: Record<Provider, () => Promise<string>> = {
      anthropic: () => generateWithAnthropic(prompt, systemPrompt),
      openai: () => generateWithOpenAI(prompt, systemPrompt),
      gemini: () => generateWithGemini(prompt, systemPrompt),
    }
    const ideas = await generators[provider]()
    return NextResponse.json({ ideas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
