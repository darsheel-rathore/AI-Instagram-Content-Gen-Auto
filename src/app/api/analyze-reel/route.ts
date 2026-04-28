import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import type { ReelAnalysis } from '@/lib/types'

// Default persona used when no custom analysis prompt is configured
const DEFAULT_ANALYSIS_PERSONA = `You are an expert Instagram content analyst specializing in spiritual, astrology, and healing content.

Analyze the given reel transcript and extract structured content elements.`

// Always appended — guarantees structured JSON output regardless of custom persona
const JSON_FORMAT_REQUIREMENT = `

Return ONLY a valid JSON object with exactly these fields:
{
  "coreInsight": "The core message or insight of this reel in one clear sentence. Example: 'Your birth chart isn't a fixed destiny, but a guide to your potential and areas where you can actively exert your free will to shape your future.'",
  "hook": "The hook or attention-grabbing opening statement used or that could be used. Examples: 'The thing you can't stop fighting for — even when it exhausts you — that's Mars. And it's not random.' or 'You're very good at being independent. The question is — when did independent become a wall?'",
  "whatToCover": "The key content points covered or that should be covered inside the reel",
  "ending": "The ending statement, call to action, or soft invitation. Examples: 'Save this if you finally feel seen. Comment your Mars house below.' or 'Comment your Venus sign and house. I'll share you a guide to decode your love language.'",
  "whyItWorks": "Why this content works for a spiritual/astrology audience — one line",
  "connectsToOffer": "Birth Chart Reading / Hypnotherapy Package / Workshop / PDF / None"
}

Return nothing else — just the JSON object.`

type Provider = 'anthropic' | 'openai' | 'gemini'

async function analyzeWithGemini(transcript: string, systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: systemPrompt })
  const result = await model.generateContent(`Transcript:\n${transcript}`)
  return result.response.text().trim()
}

async function analyzeWithAnthropic(transcript: string, systemPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  return textBlock.text.trim()
}

async function analyzeWithOpenAI(transcript: string, systemPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Transcript:\n${transcript}` }],
      max_tokens: 1000,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
  const data = await res.json()
  return (data.choices[0].message.content as string).trim()
}

export async function POST(req: NextRequest) {
  const { transcript, systemPrompt: customPrompt, provider: requestedProvider } = await req.json()

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'transcript required' }, { status: 400 })
  }

  const provider = (requestedProvider ?? 'gemini') as Provider
  // Custom prompt sets the persona/context; JSON format is always appended so output is always parseable
  const systemPrompt = (customPrompt?.trim() || DEFAULT_ANALYSIS_PERSONA) + JSON_FORMAT_REQUIREMENT

  const keyMap: Record<Provider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }
  if (!keyMap[provider]) {
    return NextResponse.json({ error: `API key for ${provider} not set` }, { status: 500 })
  }

  try {
    let text: string
    if (provider === 'anthropic') text = await analyzeWithAnthropic(transcript, systemPrompt)
    else if (provider === 'openai') text = await analyzeWithOpenAI(transcript, systemPrompt)
    else text = await analyzeWithGemini(transcript, systemPrompt)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const analysis: ReelAnalysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ analysis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}