import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Reel } from '@/lib/types'

type Provider = 'anthropic' | 'openai' | 'gemini'

function buildPrompt(
  myTopReels: string,
  myLowReels: string,
  competitorContext: string,
): string {
  return `You are a world-class Instagram content strategist.

MY ACCOUNT: @${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_account'}
TOP PERFORMING REELS (by views):
${myTopReels || '(no data yet)'}

UNDERPERFORMING REELS:
${myLowReels || '(no data yet)'}

COMPETITOR DATA:
${competitorContext || '(no competitor data yet)'}

Based on this data, provide:

1. **3 content themes that are clearly working** (from my top reels and competitors' top reels)
2. **3 content themes I should STOP making** (from underperforming reels)
3. **5 specific reel ideas I should make this week** — each with:
   - Hook (first 3 seconds)
   - Core content angle
   - Why it will work (based on data)
4. **Best time/day to post** (based on timestamps if available)
5. **1 headline insight** — the single biggest observation from the data

Keep it sharp, specific, and actionable. No fluff. Reference specific view counts where relevant.`
}

async function generateWithAnthropic(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // cheapest, fastest
    max_tokens: 1500,
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
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

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

  const { myReels, competitorReels }: { myReels: Reel[]; competitorReels: Record<string, Reel[]> } =
    await req.json()

  const myTopReels = [...(myReels ?? [])]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((r) => `- ${r.views.toLocaleString()} views | Caption: ${r.caption.slice(0, 200)}`)
    .join('\n')

  const myLowReels = [...(myReels ?? [])]
    .sort((a, b) => a.views - b.views)
    .slice(0, 3)
    .map((r) => `- ${r.views.toLocaleString()} views | Caption: ${r.caption.slice(0, 150)}`)
    .join('\n')

  const competitorContext = Object.entries(competitorReels ?? {})
    .map(([username, reels]) => {
      const topReels = [...reels]
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map((r) => `  - ${r.views.toLocaleString()} views | ${r.caption.slice(0, 200)}`)
        .join('\n')
      return `@${username} top reels:\n${topReels}`
    })
    .join('\n\n')

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
