import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Reel } from '@/lib/types'

type Provider = 'anthropic' | 'openai' | 'gemini'
type DataSource = 'caption' | 'transcript' | 'analysis'


// ─────────────────────────────────────────────
// CONTENT SIGNAL HELPER
// ─────────────────────────────────────────────
function getReelContent(r: Reel, dataSources: DataSource[]): string {
  const parts: string[] = []
  const onlyAnalysis = dataSources.length === 1 && dataSources.includes('analysis')

  if (dataSources.includes('analysis')) {
    if (r.reelAnalysis) {
      const a = r.reelAnalysis
      const offer = a.connectsToOffer && a.connectsToOffer.toLowerCase() !== 'none' ? ` | Offer: ${a.connectsToOffer}` : ''
      parts.push(`Analysis — Core Insight: ${a.coreInsight} | Hook: ${a.hook} | Why it works: ${a.whyItWorks}${offer}`)
    } else if (onlyAnalysis && r.transcript) {
      parts.push(`Transcript excerpt: "${r.transcript.slice(0, 500)}"`)
    } else if (onlyAnalysis) {
      parts.push(`Caption: ${r.caption.slice(0, 200)}`)
    }
  }

  if (dataSources.includes('transcript') && r.transcript) {
    parts.push(`Transcript excerpt: "${r.transcript.slice(0, 400)}"`)
  }

  if (dataSources.includes('caption') && r.caption) {
    parts.push(`Caption: ${r.caption.slice(0, 200)}`)
  }

  return parts.length > 0 ? parts.join('\n  ') : `Caption: ${r.caption.slice(0, 200)}`
}


// ─────────────────────────────────────────────
// DATA CONTEXT BUILDER  (no format instructions — system prompt owns everything)
// ─────────────────────────────────────────────
function buildDataContext(
  myReels: Reel[],
  competitorReels: Record<string, Reel[]>,
  dataSources: DataSource[],
  includeTopReels: boolean,
  includeLowReels: boolean,
  includeCompetitorData: boolean,
): string {
  const reelSummary = (r: Reel) => {
    const eng = r.views > 0 ? (((r.likes + r.comments) / r.views) * 100).toFixed(1) : '0.0'
    const content = getReelContent(r, dataSources)
    return `- ${r.views.toLocaleString()} views | ${r.likes.toLocaleString()} likes | ${r.comments.toLocaleString()} comments | ${eng}% engagement\n  ${content}`
  }

  const parts: string[] = []

  if (includeTopReels) {
    const topReels = [...(myReels ?? [])].sort((a, b) => b.views - a.views).slice(0, 5)
    if (topReels.length > 0) {
      parts.push(`MY TOP PERFORMING REELS (by views):\n${topReels.map(reelSummary).join('\n')}`)
    }
  }

  if (includeLowReels) {
    const lowReels = [...(myReels ?? [])].sort((a, b) => a.views - b.views).slice(0, 3)
    if (lowReels.length > 0) {
      parts.push(`MY UNDERPERFORMING REELS:\n${lowReels.map(reelSummary).join('\n')}`)
    }
  }

  if (includeCompetitorData) {
    const compEntries = Object.entries(competitorReels ?? {})
    if (compEntries.length > 0) {
      const compContext = compEntries
        .map(([username, reels]) => {
          const topReels = [...reels]
            .sort((a, b) => b.views - a.views)
            .slice(0, 3)
            .map((r) => {
              const eng = r.views > 0 ? (((r.likes + r.comments) / r.views) * 100).toFixed(1) : '0.0'
              const content = getReelContent(r, dataSources)
              return `  - ${r.views.toLocaleString()} views | ${r.likes.toLocaleString()} likes | ${r.comments.toLocaleString()} comments | ${eng}% engagement\n  ${content}`
            })
            .join('\n')
          return `@${username} top reels:\n${topReels}`
        })
        .join('\n\n')
      parts.push(`COMPETITOR DATA:\n${compContext}`)
    }
  }

  if (parts.length === 0) return '(No performance data selected)'

  return `Account: @${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_account'}\n\n${parts.join('\n\n')}`
}


// ─────────────────────────────────────────────
// AI PROVIDER FUNCTIONS
// ─────────────────────────────────────────────
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

async function generateWithAnthropic(prompt: string, systemPrompt: string, model: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  return textBlock.text
}

async function generateWithOpenAI(prompt: string, systemPrompt: string, model: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
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

async function generateWithGemini(prompt: string, systemPrompt: string, model: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  })
  const result = await geminiModel.generateContent(prompt)
  return result.response.text()
}


function log(msg: string) {
  console.log(`[content-ideas ${new Date().toISOString()}] ${msg}`)
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
    model: requestedModel,
    dataSources: requestedSources,
    includeTopReels = true,
    includeLowReels = true,
    includeCompetitorData = true,
  }: {
    myReels: Reel[]
    competitorReels: Record<string, Reel[]>
    systemPrompt: string
    provider?: string
    model?: string
    dataSources?: string[]
    includeTopReels?: boolean
    includeLowReels?: boolean
    includeCompetitorData?: boolean
  } = await req.json()

  const provider = ((requestedProvider ?? process.env.AI_PROVIDER ?? 'gemini') as Provider)
  const model = requestedModel ?? DEFAULT_MODELS[provider]
  const dataSources = ((requestedSources?.length ? requestedSources : ['analysis']) as DataSource[])

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

  // User message = raw data only. System prompt = user's instructions (owns the format entirely).
  const dataContext = buildDataContext(myReels, competitorReels, dataSources, includeTopReels, includeLowReels, includeCompetitorData)

  log(`━━━ Generate Ideas — provider: ${provider} | model: ${model} | dataSources: ${dataSources.join(', ')} | topReels: ${includeTopReels} | lowReels: ${includeLowReels} | competitors: ${includeCompetitorData}`)
  log(`─── SYSTEM PROMPT (${systemPrompt.length} chars) ───\n${systemPrompt}`)
  log(`─── DATA CONTEXT (${dataContext.length} chars) ───\n${dataContext}`)
  log(`─── TOTAL (${systemPrompt.length + dataContext.length} chars) ───`)

  try {
    const generators: Record<Provider, () => Promise<string>> = {
      anthropic: () => generateWithAnthropic(dataContext, systemPrompt, model),
      openai: () => generateWithOpenAI(dataContext, systemPrompt, model),
      gemini: () => generateWithGemini(dataContext, systemPrompt, model),
    }
    const ideas = await generators[provider]()
    return NextResponse.json({ ideas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
